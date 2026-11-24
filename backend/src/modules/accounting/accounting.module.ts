import {
  BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Injectable, Module, NotFoundException, Param, Post, Query, UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, Matches, Min, ValidateNested } from 'class-validator';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OptionalText, Text } from '../../common/dto.js';
import { fromDay, toDay } from '../../common/text.js';
import { documentDay } from '../../common/period-lock.js';
import { AuditService } from '../../audit/audit.service.js';
import { vnd } from '../../audit/audit.diff.js';
import { LedgerService } from './ledger.service.js';
import { FixedAssetsController, FixedAssetsService } from './fixed-assets.js';
import { PrepaidItemsController, PrepaidItemsService } from './prepaid-items.js';
import { ProductionAccountingService, ProductionCostsController, ProductionCostsService } from './production-accounting.js';
import { EmployeesController, PayrollController, PayrollService } from './payroll.js';
import { BooksController, BooksService } from './books.js';
import { VatController, VatService } from './vat.js';
import { CashFlowController, CashFlowService } from './cash-flow.js';
import { PeriodClosingController, PeriodClosingService } from './period-closing.js';
import { CorporateTaxController, CorporateTaxService } from './corporate-tax.js';
import { StatementsController, StatementsService } from './statements.js';
import { AccountsController, AccountsService } from './accounts.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const num = (d: Prisma.Decimal | null | undefined) => (d ? d.toNumber() : 0);
const periodRange = (period: string) => ({ start: fromDay(`${period}-01-01`)!, end: fromDay(`${Number(period) + 1}-01-01`)! });

// ---------- DTOs ----------
class ManualLineDto {
  @Text(10) accountCode!: string;
  @IsNumber() @Min(0) debit = 0;
  @IsNumber() @Min(0) credit = 0;
  @OptionalText(200) description?: string;
}
class ManualEntryDto {
  @Matches(DAY, { message: 'Ngày phải có dạng YYYY-MM-DD' }) date!: string;
  @OptionalText(300) description?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ManualLineDto) lines!: ManualLineDto[];
}
class OpeningRowDto {
  @Text(10) accountCode!: string;
  @IsNumber() @Min(0) debit = 0;
  @IsNumber() @Min(0) credit = 0;
}
class OpeningBalancesDto {
  @Matches(/^\d{4}$/, { message: 'Kỳ phải là năm, ví dụ 2026' }) period!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => OpeningRowDto) rows!: OpeningRowDto[];
}
class LedgerSettingsDto {
  @IsOptional() @IsString() ledgerStartDate?: string | null; // 'YYYY-MM-DD' để bật, '' hoặc null để tắt
}

@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  accounts() {
    return this.prisma.account.findMany({ orderBy: { code: 'asc' } });
  }

  async settings() {
    const c = await this.prisma.companyInfo.findUnique({ where: { id: 1 }, select: { ledgerStartDate: true } });
    return { ledgerStartDate: toDay(c?.ledgerStartDate ?? null) };
  }

  async setSettings(dto: LedgerSettingsDto) {
    const d = dto.ledgerStartDate && DAY.test(dto.ledgerStartDate) ? fromDay(dto.ledgerStartDate) : null;
    await this.prisma.$transaction(async (tx) => {
      await tx.companyInfo.update({ where: { id: 1 }, data: { ledgerStartDate: d } });
      await this.audit.log(tx, { action: 'accounting.settings', entityType: 'CompanyInfo', entityId: '1', summary: `Ngày bật sổ kế toán: ${d ? toDay(d) : 'tắt'}` });
    });
    return this.settings();
  }

  /** Sổ nhật ký chung: bút toán + các dòng, theo khoảng ngày (mặc định toàn bộ, mới nhất trước). */
  async journal(from?: string, to?: string) {
    const where: Prisma.JournalEntryWhereInput = {};
    if (from || to) where.date = { ...(from ? { gte: fromDay(from)! } : {}), ...(to ? { lt: new Date(fromDay(to)!.getTime() + 86_400_000) } : {}) };
    const entries = await this.prisma.journalEntry.findMany({
      where, orderBy: [{ date: 'desc' }, { code: 'desc' }], take: 500,
      include: { lines: { include: { account: { select: { name: true } } } } },
    });
    return entries.map((e) => ({
      id: e.id, code: e.code, date: toDay(e.date), description: e.description, source: e.source, isReversal: e.isReversal,
      lines: e.lines.map((l) => ({ accountCode: l.accountCode, accountName: l.account.name, debit: num(l.debit), credit: num(l.credit), description: l.description })),
    }));
  }

  /** Sổ cái một tài khoản + số dư luỹ kế. */
  async ledgerOf(code: string, period: string) {
    const account = await this.prisma.account.findUnique({ where: { code } });
    if (!account) throw new NotFoundException('Tài khoản không tồn tại.');
    const ob = await this.prisma.openingBalance.findUnique({ where: { accountCode_period: { accountCode: code, period } } });
    const openNo = num(ob?.debit), openCo = num(ob?.credit);
    const { start, end } = periodRange(period);
    const rows = await this.prisma.journalLine.findMany({
      where: { accountCode: code, entry: { date: { gte: start, lt: end } } },
      include: { entry: { select: { code: true, date: true, description: true } } },
      orderBy: [{ entry: { date: 'asc' } }, { entryId: 'asc' }],
    });
    let bal = account.normalSide === 'NO' ? openNo - openCo : openCo - openNo;
    const items = rows.map((r) => {
      const debit = num(r.debit), credit = num(r.credit);
      bal += account.normalSide === 'NO' ? debit - credit : credit - debit;
      return { date: toDay(r.entry.date), code: r.entry.code, description: r.entry.description, debit, credit, balance: bal };
    });
    return { account, openingNo: openNo, openingCo: openCo, period, rows: items };
  }

  /** Bảng cân đối số phát sinh của kỳ. */
  async trialBalance(period: string) {
    const { start, end } = periodRange(period);
    const [accounts, movements, openings] = await Promise.all([
      this.prisma.account.findMany({ where: { isDetail: true }, orderBy: { code: 'asc' } }),
      this.prisma.journalLine.groupBy({ by: ['accountCode'], where: { entry: { date: { gte: start, lt: end } } }, _sum: { debit: true, credit: true } }),
      this.prisma.openingBalance.findMany({ where: { period } }),
    ]);
    const mv = new Map(movements.map((m) => [m.accountCode, { d: num(m._sum.debit), c: num(m._sum.credit) }]));
    const ob = new Map(openings.map((o) => [o.accountCode, { d: num(o.debit), c: num(o.credit) }]));
    const tot = { od: 0, oc: 0, pd: 0, pc: 0, cd: 0, cc: 0 };
    const data = [];
    for (const a of accounts) {
      const o = ob.get(a.code) ?? { d: 0, c: 0 };
      const m = mv.get(a.code) ?? { d: 0, c: 0 };
      const net = (a.normalSide === 'NO' ? o.d - o.c : o.c - o.d) + (a.normalSide === 'NO' ? m.d - m.c : m.c - m.d);
      let cd = 0, cc = 0;
      if (a.normalSide === 'NO') { if (net >= 0) cd = net; else cc = -net; } else { if (net >= 0) cc = net; else cd = -net; }
      if (o.d || o.c || m.d || m.c || cd || cc) {
        data.push({ code: a.code, name: a.name, openingNo: o.d, openingCo: o.c, debit: m.d, credit: m.c, closingNo: cd, closingCo: cc });
        tot.od += o.d; tot.oc += o.c; tot.pd += m.d; tot.pc += m.c; tot.cd += cd; tot.cc += cc;
      }
    }
    return { period, rows: data, totals: tot };
  }

  /**
   * Gộp số liệu kỳ: phát sinh Nợ/Có và số dư đầu kỳ theo từng TK. `revenue` / `expense` bỏ qua bút toán kết chuyển (source
   * CLOSING) nên báo cáo kết quả kinh doanh vẫn đủ số liệu sau khi kết chuyển; `closing` và `unclosedProfit` tính cả bút toán
   * kết chuyển: lãi lỗ đã kết chuyển nằm ở 421, phần chưa kết chuyển còn ở các TK doanh thu, chi phí.
   */
  private async periodMaps(period: string) {
    const { start, end } = periodRange(period);
    const inYear = { date: { gte: start, lt: end } };
    const [accounts, movements, operating, openings] = await Promise.all([
      this.prisma.account.findMany({ where: { isDetail: true } }),
      this.prisma.journalLine.groupBy({ by: ['accountCode'], where: { entry: inYear }, _sum: { debit: true, credit: true } }),
      this.prisma.journalLine.groupBy({ by: ['accountCode'], where: { entry: { ...inYear, source: { not: 'CLOSING' } } }, _sum: { debit: true, credit: true } }),
      this.prisma.openingBalance.findMany({ where: { period } }),
    ]);
    const all = new Map(movements.map((m) => [m.accountCode, { d: num(m._sum.debit), c: num(m._sum.credit) }]));
    const mv = new Map(operating.map((m) => [m.accountCode, { d: num(m._sum.debit), c: num(m._sum.credit) }]));
    const ob = new Map(openings.map((o) => [o.accountCode, { d: num(o.debit), c: num(o.credit) }]));
    const sideOf = new Map(accounts.map((a) => [a.code, a.normalSide]));
    // Net phát sinh theo chiều doanh thu (Có−Nợ) / chi phí (Nợ−Có)
    const revenue = (code: string) => { const m = mv.get(code) ?? { d: 0, c: 0 }; return m.c - m.d; };
    const expense = (code: string) => { const m = mv.get(code) ?? { d: 0, c: 0 }; return m.d - m.c; };
    // Lãi lỗ còn nằm ở các TK doanh thu, chi phí (chưa kết chuyển sang 421)
    const unclosedProfit = accounts.reduce((s, a) => {
      const m = all.get(a.code) ?? { d: 0, c: 0 };
      return a.kind === 'DOANH_THU' ? s + m.c - m.d : a.kind === 'CHI_PHI' ? s - (m.d - m.c) : s;
    }, 0);
    // Số dư cuối kỳ theo chiều số dư thường của TK
    const closing = (code: string) => {
      const side = sideOf.get(code); if (!side) return 0;
      const o = ob.get(code) ?? { d: 0, c: 0 }; const m = all.get(code) ?? { d: 0, c: 0 };
      return (side === 'NO' ? o.d - o.c : o.c - o.d) + (side === 'NO' ? m.d - m.c : m.c - m.d);
    };
    return { revenue, expense, closing, unclosedProfit };
  }

  /** Báo cáo Kết quả hoạt động kinh doanh (B02-DNN, TT133). */
  async incomeStatement(period: string) {
    const { revenue, expense } = await this.periodMaps(period);
    const doanhThu = revenue('511');
    // Các khoản giảm trừ doanh thu (521: chiết khấu thương mại, hàng bán bị trả lại, giảm giá hàng bán).
    const giamTru = expense('5211') + expense('5212') + expense('5213');
    const doanhThuThuan = doanhThu - giamTru;
    const giaVon = expense('632');
    const loiNhuanGop = doanhThuThuan - giaVon;
    const dtTaiChinh = revenue('515');
    const cpTaiChinh = expense('635');
    const cpQuanLy = expense('642') + expense('641'); // TT133 gộp chi phí bán hàng và quản lý vào một chỉ tiêu
    const lnThuan = loiNhuanGop + dtTaiChinh - cpTaiChinh - cpQuanLy;
    const thuNhapKhac = revenue('711');
    const chiPhiKhac = expense('811');
    const lnKhac = thuNhapKhac - chiPhiKhac;
    const lnTruocThue = lnThuan + lnKhac;
    const thueTNDN = expense('821');
    const lnSauThue = lnTruocThue - thueTNDN;
    const items = [
      { label: '1. Doanh thu bán hàng và cung cấp dịch vụ', amount: doanhThu },
      { label: '- Các khoản giảm trừ doanh thu', amount: giamTru },
      { label: '2. Doanh thu thuần', amount: doanhThuThuan, strong: true },
      { label: '3. Giá vốn hàng bán', amount: giaVon },
      { label: '4. Lợi nhuận gộp', amount: loiNhuanGop, strong: true },
      { label: '5. Doanh thu hoạt động tài chính', amount: dtTaiChinh },
      { label: '6. Chi phí tài chính', amount: cpTaiChinh },
      { label: '7. Chi phí quản lý kinh doanh', amount: cpQuanLy },
      { label: '8. Lợi nhuận thuần từ hoạt động kinh doanh', amount: lnThuan, strong: true },
      { label: '9. Thu nhập khác', amount: thuNhapKhac },
      { label: '10. Chi phí khác', amount: chiPhiKhac },
      { label: '11. Lợi nhuận khác', amount: lnKhac },
      { label: '12. Tổng lợi nhuận kế toán trước thuế', amount: lnTruocThue, strong: true },
      { label: '13. Chi phí thuế thu nhập doanh nghiệp', amount: thueTNDN },
      { label: '14. Lợi nhuận sau thuế TNDN', amount: lnSauThue, strong: true },
    ];
    return { period, items, profitAfterTax: lnSauThue };
  }

  /** Bảng cân đối kế toán (B01-DNN, TT133) — rút gọn theo các TK đang dùng. */
  async balanceSheet(period: string) {
    const { closing, unclosedProfit } = await this.periodMaps(period);
    const assets = [
      { label: 'Tiền (111, 112, 113)', amount: closing('111') + closing('112') + closing('113') },
      { label: 'Phải thu của khách hàng (131)', amount: closing('131') },
      { label: 'Tạm ứng (141)', amount: closing('141') },
      { label: 'Tài sản thiếu chờ xử lý (1381)', amount: closing('1381') },
      { label: 'Thuế GTGT được khấu trừ (133)', amount: closing('133') },
      { label: 'Hàng tồn kho (152,153,154,155,156)', amount: ['152', '153', '154', '155', '156'].reduce((s, c) => s + closing(c), 0) },
      { label: 'Tài sản cố định (211 − 214)', amount: closing('211') - closing('214') },
      { label: 'Chi phí trả trước (242)', amount: closing('242') },
    ];
    const resources = [
      { label: 'Phải trả người bán (331)', amount: closing('331') },
      { label: 'Thuế và các khoản phải nộp NN (3331, 3334, 3335)', amount: closing('3331') + closing('3334') + closing('3335') },
      { label: 'Phải trả người lao động (334)', amount: closing('334') },
      { label: 'Phải trả, phải nộp khác (3381, 3382, 3383, 3384, 3385)', amount: ['3381', '3382', '3383', '3384', '3385'].reduce((s, c) => s + closing(c), 0) },
      { label: 'Vốn đầu tư của chủ sở hữu (411)', amount: closing('411') },
      { label: 'Lợi nhuận sau thuế chưa phân phối (421)', amount: closing('421') + unclosedProfit },
    ];
    const totalAssets = assets.reduce((s, a) => s + a.amount, 0);
    const totalResources = resources.reduce((s, r) => s + r.amount, 0);
    return { period, assets, resources, totalAssets, totalResources, balanced: Math.round(totalAssets - totalResources) === 0 };
  }

  async openingBalances(period: string) {
    const [accounts, existing] = await Promise.all([
      this.prisma.account.findMany({ where: { isDetail: true }, orderBy: { code: 'asc' } }),
      this.prisma.openingBalance.findMany({ where: { period } }),
    ]);
    const by = new Map(existing.map((o) => [o.accountCode, o]));
    return {
      period,
      rows: accounts.map((a) => ({ code: a.code, name: a.name, kind: a.kind, normalSide: a.normalSide, debit: num(by.get(a.code)?.debit), credit: num(by.get(a.code)?.credit) })),
    };
  }

  async saveOpeningBalances(dto: OpeningBalancesDto, _user: AuthUser) {
    await this.prisma.$transaction(async (tx) => {
      const carriedFrom = Number(dto.period) - 1;
      if (await tx.fiscalYearClose.findUnique({ where: { year: carriedFrom } })) {
        throw new BadRequestException(`Số dư đầu năm ${dto.period} lấy từ cuối năm ${carriedFrom} đã đóng sổ. Mở lại năm ${carriedFrom} nếu cần sửa.`);
      }
      for (const r of dto.rows) {
        await tx.openingBalance.upsert({
          where: { accountCode_period: { accountCode: r.accountCode, period: dto.period } },
          update: { debit: r.debit, credit: r.credit },
          create: { accountCode: r.accountCode, period: dto.period, debit: r.debit, credit: r.credit },
        });
      }
      await this.audit.log(tx, { action: 'accounting.opening', entityType: 'OpeningBalance', entityId: dto.period, summary: `Cập nhật số dư đầu kỳ ${dto.period}` });
    });
    return this.openingBalances(dto.period);
  }

  async createManual(dto: ManualEntryDto, user: AuthUser) {
    const id = await this.prisma.$transaction(async (tx) => {
      await documentDay(tx, dto.date, 'Bút toán');
      const entryId = await this.ledger.postEntry(tx, {
        date: dto.date, description: dto.description ?? null, source: 'MANUAL', createdById: user.id,
        lines: dto.lines.map((l) => ({ accountCode: l.accountCode, debit: l.debit, credit: l.credit, description: l.description ?? null })),
      });
      const total = dto.lines.reduce((s, l) => s + (l.debit || 0), 0);
      const e = await tx.journalEntry.findUnique({ where: { id: entryId }, select: { code: true } });
      await this.audit.log(tx, { action: 'journal.create', entityType: 'JournalEntry', entityId: entryId, entityCode: e!.code, summary: `Nhập bút toán ${e!.code}: ${vnd(total)}${dto.description ? ` · ${dto.description}` : ''}` });
      return entryId;
    });
    return { id };
  }

  async reverse(id: string, user: AuthUser) {
    await this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findUnique({ where: { id }, include: { lines: true } });
      if (!entry) throw new NotFoundException('Không tìm thấy bút toán.');
      if (entry.isReversal) throw new NotFoundException('Không thể đảo một bút toán đảo.');
      if (entry.source === 'CIT') throw new BadRequestException('Bút toán thuế TNDN không đảo riêng lẻ được: dùng Huỷ ở Kế toán › Thuế TNDN.');
      if (entry.source === 'CLOSING') throw new BadRequestException('Bút toán kết chuyển không đảo riêng lẻ được: dùng Huỷ kết chuyển ở Kế toán › Kết chuyển cuối kỳ.');
      const day = toDay(entry.date)!;
      await this.ledger.postEntry(tx, {
        date: day, source: 'REVERSAL', refType: entry.refType ?? 'JournalEntry', refId: entry.refId ?? entry.id,
        createdById: user.id, isReversal: true, description: `Đảo bút toán ${entry.code}`,
        lines: entry.lines.map((l) => ({ accountCode: l.accountCode, debit: l.credit.toNumber(), credit: l.debit.toNumber(), partnerType: l.partnerType, customerId: l.customerId, supplierId: l.supplierId, description: `Đảo: ${l.description ?? ''}`.trim() })),
      });
      await this.audit.log(tx, { action: 'journal.reverse', entityType: 'JournalEntry', entityId: entry.id, entityCode: entry.code, summary: `Đảo bút toán ${entry.code}` });
    });
    return { ok: true };
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('accounting')
export class AccountingController {
  constructor(private readonly svc: AccountingService) {}

  @RequirePermissions('accounting.view')
  @Get('accounts')
  accounts() {
    return this.svc.accounts();
  }

  @RequirePermissions('accounting.view')
  @Get('settings')
  settings() {
    return this.svc.settings();
  }

  @RequirePermissions('accounting.manage_account')
  @Post('settings')
  setSettings(@Body() dto: LedgerSettingsDto) {
    return this.svc.setSettings(dto);
  }

  @RequirePermissions('accounting.view')
  @Get('journal')
  journal(@Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.journal(from?.trim() || undefined, to?.trim() || undefined);
  }

  @RequirePermissions('accounting.view')
  @Get('ledger/:code')
  ledger(@Param('code') code: string, @Query('period') period?: string) {
    return this.svc.ledgerOf(code, period?.trim() || String(new Date().getFullYear()));
  }

  @RequirePermissions('accounting.view')
  @Get('trial-balance')
  trialBalance(@Query('period') period?: string) {
    return this.svc.trialBalance(period?.trim() || String(new Date().getFullYear()));
  }

  @RequirePermissions('accounting.view')
  @Get('income-statement')
  incomeStatement(@Query('period') period?: string) {
    return this.svc.incomeStatement(period?.trim() || String(new Date().getFullYear()));
  }

  @RequirePermissions('accounting.view')
  @Get('balance-sheet')
  balanceSheet(@Query('period') period?: string) {
    return this.svc.balanceSheet(period?.trim() || String(new Date().getFullYear()));
  }

  @RequirePermissions('accounting.view')
  @Get('opening-balances')
  openingBalances(@Query('period') period?: string) {
    return this.svc.openingBalances(period?.trim() || String(new Date().getFullYear()));
  }

  @RequirePermissions('accounting.opening')
  @Post('opening-balances')
  saveOpening(@Body() dto: OpeningBalancesDto, @CurrentUser() user: AuthUser) {
    return this.svc.saveOpeningBalances(dto, user);
  }

  @RequirePermissions('accounting.manual')
  @Post('journal')
  createManual(@Body() dto: ManualEntryDto, @CurrentUser() user: AuthUser) {
    return this.svc.createManual(dto, user);
  }

  @RequirePermissions('accounting.reverse')
  @Post('journal/:id/reverse')
  @HttpCode(HttpStatus.OK)
  reverse(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.svc.reverse(id, user);
  }
}

@Module({
  controllers: [AccountingController, AccountsController, PeriodClosingController, CorporateTaxController, StatementsController, FixedAssetsController, PrepaidItemsController, ProductionCostsController, EmployeesController, PayrollController, BooksController, VatController, CashFlowController],
  providers: [AccountingService, AccountsService, PeriodClosingService, CorporateTaxService, StatementsService, LedgerService, FixedAssetsService, PrepaidItemsService, ProductionAccountingService, ProductionCostsService, PayrollService, BooksService, VatService, CashFlowService],
  exports: [LedgerService, ProductionAccountingService],
})
export class AccountingModule {}
