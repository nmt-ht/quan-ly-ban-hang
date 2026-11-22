import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Injectable, NotFoundException, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Matches } from 'class-validator';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { vnd } from '../../audit/audit.diff.js';
import { documentDay } from '../../common/period-lock.js';
import { fromDay, toDay, vnDay } from '../../common/text.js';
import { LedgerService } from './ledger.service.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const num = (d: Prisma.Decimal | null | undefined) => (d ? d.toNumber() : 0);
const r0 = (n: number) => Math.round(n);
const dmy = (d: string) => d.split('-').reverse().join('/');
const dayAfter = (d: string) => new Date(fromDay(d)!.getTime() + 86_400_000);
const PL_KINDS = ['DOANH_THU', 'CHI_PHI'] as const;

class ClosingDto {
  @Matches(DAY, { message: 'Ngày phải có dạng YYYY-MM-DD' }) date!: string;
}

/** Số dư một tài khoản doanh thu / chi phí còn phải kết chuyển. `net` = Nợ − Có. */
interface PlBalance { code: string; name: string; kind: 'DOANH_THU' | 'CHI_PHI'; net: number }

/**
 * Kết chuyển lãi lỗ và đóng sổ năm (as MISA, Thông tư 133).
 *
 * Kết chuyển đến ngày X: số dư các TK doanh thu và chi phí từ đầu năm đến hết X được chuyển sang 911, rồi lãi lỗ sang 421
 * (ba bút toán source CLOSING). Làm được nhiều lần trong năm (cuối tháng, quý), mỗi lần sau ngày của lần trước; chỉ huỷ được
 * lần gần nhất. Báo cáo kết quả kinh doanh bỏ qua các bút toán này nên số liệu kỳ không mất đi sau khi kết chuyển.
 *
 * Đóng sổ năm: kết chuyển đến 31/12, chuyển số dư cuối năm sang số dư đầu kỳ năm sau và khoá sổ đến 31/12, nên năm đã đóng
 * không sửa được nữa (muốn sửa thì mở lại năm).
 */
@Injectable()
export class PeriodClosingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  /** Số dư các TK doanh thu / chi phí từ 01/01 đến hết `date`, kể cả các lần kết chuyển trước (đã cấn trừ). */
  private async plBalances(db: Prisma.TransactionClient | PrismaService, date: string): Promise<PlBalance[]> {
    const accounts = await db.account.findMany({ where: { isDetail: true, kind: { in: [...PL_KINDS] } }, select: { code: true, name: true, kind: true } });
    const sums = await db.journalLine.groupBy({
      by: ['accountCode'],
      where: { accountCode: { in: accounts.map((a) => a.code) }, entry: { date: { gte: fromDay(`${date.slice(0, 4)}-01-01`)!, lt: dayAfter(date) } } },
      _sum: { debit: true, credit: true },
    });
    const by = new Map(sums.map((s) => [s.accountCode, r0(num(s._sum.debit) - num(s._sum.credit))]));
    return accounts
      .map((a) => ({ code: a.code, name: a.name, kind: a.kind as PlBalance['kind'], net: by.get(a.code) ?? 0 }))
      .filter((a) => a.net !== 0)
      .sort((a, b) => a.code.localeCompare(b.code));
  }

  /** Lãi (+) / lỗ (−) nếu kết chuyển: doanh thu trừ chi phí. */
  private profitOf(balances: PlBalance[]): number {
    return -balances.reduce((s, b) => s + b.net, 0);
  }

  /** Dòng bút toán xoá các TK `balances` và dồn chênh lệch vào 911. */
  private closingLines(balances: PlBalance[]) {
    const lines = balances.map((b) => ({ accountCode: b.code, debit: b.net < 0 ? -b.net : 0, credit: b.net > 0 ? b.net : 0 }));
    const debit = lines.reduce((s, l) => s + l.debit, 0);
    const credit = lines.reduce((s, l) => s + l.credit, 0);
    return [...lines, { accountCode: '911', debit: credit > debit ? credit - debit : 0, credit: debit > credit ? debit - credit : 0 }];
  }

  async preview(date: string) {
    if (!DAY.test(date)) throw new BadRequestException('Chọn ngày kết chuyển.');
    const balances = await this.plBalances(this.prisma, date);
    return {
      date,
      accounts: balances.map((b) => ({ code: b.code, name: b.name, kind: b.kind, amount: b.kind === 'DOANH_THU' ? -b.net : b.net })),
      revenue: -balances.filter((b) => b.kind === 'DOANH_THU').reduce((s, b) => s + b.net, 0),
      expense: balances.filter((b) => b.kind === 'CHI_PHI').reduce((s, b) => s + b.net, 0),
      profit: this.profitOf(balances),
    };
  }

  async overview(year: number) {
    const [rows, yearClose, info, previous, next, citYear] = await Promise.all([
      this.prisma.periodClosing.findMany({ where: { year }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.fiscalYearClose.findUnique({ where: { year } }),
      this.prisma.companyInfo.findUnique({ where: { id: 1 }, select: { ledgerStartDate: true, lockDate: true } }),
      this.prisma.fiscalYearClose.findUnique({ where: { year: year - 1 } }),
      this.prisma.fiscalYearClose.findUnique({ where: { year: year + 1 } }),
      this.prisma.citAssessment.findFirst({ where: { year, period: 'Y', reversedAt: null }, select: { id: true } }),
    ]);
    const active = rows.filter((r) => !r.reversedAt);
    const latest = active.at(-1);
    return {
      year,
      ledgerStartDate: toDay(info?.ledgerStartDate ?? null),
      lockDate: toDay(info?.lockDate ?? null),
      closings: rows.map((r) => ({
        id: r.id, date: toDay(r.date)!, profit: num(r.profit), createdByName: r.createdByName, createdAt: r.createdAt, reversedAt: r.reversedAt,
        canReverse: !r.reversedAt && r.id === latest?.id && !yearClose,
      })),
      lastClosedDate: latest ? toDay(latest.date) : null,
      yearClose: yearClose ? { year: yearClose.year, profit: num(yearClose.profit), closedByName: yearClose.closedByName, closedAt: yearClose.closedAt } : null,
      /** Đã quyết toán thuế TNDN năm này chưa: nên làm trước khi đóng sổ để lợi nhuận kết chuyển là lợi nhuận sau thuế. */
      citAssessed: !!citYear,
      previousYearClosed: !!previous,
      nextYearClosed: !!next,
      yearBlocker: await this.yearBlocker(this.prisma, year),
    };
  }

  /** Lý do chưa đóng sổ được năm `year` (null = đóng được). */
  private async yearBlocker(db: Prisma.TransactionClient | PrismaService, year: number): Promise<string | null> {
    if (await db.fiscalYearClose.findUnique({ where: { year } })) return `Năm ${year} đã đóng sổ.`;
    const info = await db.companyInfo.findUnique({ where: { id: 1 }, select: { ledgerStartDate: true } });
    const start = toDay(info?.ledgerStartDate ?? null);
    if (!start) return 'Chưa bật sổ kế toán (Kế toán › Thiết lập).';
    const startYear = Number(start.slice(0, 4));
    if (year < startYear) return `Sổ kế toán bắt đầu từ ${dmy(start)}, không có số liệu năm ${year}.`;
    if (year > startYear && !(await db.fiscalYearClose.findUnique({ where: { year: year - 1 } }))) {
      return `Hãy đóng sổ năm ${year - 1} trước: số dư đầu năm ${year} lấy từ số dư cuối năm ${year - 1}.`;
    }
    if (`${year}-12-31` > vnDay()) return `Năm ${year} chưa hết (31/12/${year} sau hôm nay). Kết chuyển đến cuối tháng hiện tại nếu cần.`;
    return null;
  }

  /** Kết chuyển doanh thu, chi phí đến hết `date`. */
  async close(date: string, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const made = await this.post(tx, date, user);
      if (!made) throw new BadRequestException('Không có số dư doanh thu, chi phí nào để kết chuyển.');
      return made;
    });
  }

  private async post(tx: Prisma.TransactionClient, date: string, user: AuthUser): Promise<{ id: string; date: string; profit: number } | null> {
    const year = Number(date.slice(0, 4));
    await documentDay(tx, date, 'Kết chuyển');
    if (!(await this.ledger.isLedgerActive(tx, date))) throw new BadRequestException('Sổ kế toán chưa bật hoặc ngày này trước ngày bắt đầu ghi sổ.');
    if (await tx.fiscalYearClose.findUnique({ where: { year } })) throw new BadRequestException(`Năm ${year} đã đóng sổ.`);
    const last = await tx.periodClosing.findFirst({ where: { year, reversedAt: null }, orderBy: { date: 'desc' } });
    if (last && toDay(last.date)! >= date) {
      throw new BadRequestException(`Đã kết chuyển đến ngày ${dmy(toDay(last.date)!)}. Chọn ngày sau đó, hoặc huỷ lần kết chuyển đó trước.`);
    }
    const balances = await this.plBalances(tx, date);
    if (!balances.length) return null;

    const profit = this.profitOf(balances);
    const closing = await tx.periodClosing.create({
      data: { date: fromDay(date)!, year, profit, createdById: user.id, createdByName: user.name },
    });
    const base = { date, source: 'CLOSING' as const, refType: 'PeriodClosing', refId: closing.id, createdById: user.id };
    const upTo = `đến hết ngày ${dmy(date)}`;
    const revenue = balances.filter((b) => b.kind === 'DOANH_THU');
    const expense = balances.filter((b) => b.kind === 'CHI_PHI');
    if (revenue.length) await this.ledger.postEntry(tx, { ...base, description: `Kết chuyển doanh thu ${upTo}`, lines: this.closingLines(revenue) });
    if (expense.length) await this.ledger.postEntry(tx, { ...base, description: `Kết chuyển chi phí ${upTo}`, lines: this.closingLines(expense) });
    if (profit !== 0) {
      await this.ledger.postEntry(tx, {
        ...base,
        description: `Kết chuyển ${profit > 0 ? 'lãi' : 'lỗ'} ${upTo}`,
        lines: profit > 0 ? [{ accountCode: '911', debit: profit }, { accountCode: '421', credit: profit }] : [{ accountCode: '421', debit: -profit }, { accountCode: '911', credit: -profit }],
      });
    }
    await this.audit.log(tx, {
      action: 'accounting.close_period', entityType: 'PeriodClosing', entityId: closing.id,
      summary: `Kết chuyển lãi lỗ ${upTo}: ${profit >= 0 ? 'lãi' : 'lỗ'} ${vnd(Math.abs(profit))}`,
    });
    return { id: closing.id, date, profit };
  }

  /** Huỷ lần kết chuyển gần nhất của năm: đảo các bút toán của nó. */
  async reverse(id: string, user: AuthUser) {
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.periodClosing.findUnique({ where: { id } });
      if (!row) throw new NotFoundException('Không tìm thấy lần kết chuyển.');
      if (row.reversedAt) throw new BadRequestException('Lần kết chuyển này đã huỷ.');
      if (await tx.fiscalYearClose.findUnique({ where: { year: row.year } })) throw new BadRequestException(`Năm ${row.year} đã đóng sổ: mở lại năm trước khi huỷ kết chuyển.`);
      const latest = await tx.periodClosing.findFirst({ where: { year: row.year, reversedAt: null }, orderBy: { date: 'desc' } });
      if (latest?.id !== row.id) throw new BadRequestException(`Chỉ huỷ được lần kết chuyển gần nhất (đến ngày ${dmy(toDay(latest!.date)!)}).`);
      const day = toDay(row.date)!;
      await this.ledger.reverseEntriesFor(tx, 'PeriodClosing', row.id, { date: day, createdById: user.id, description: `Huỷ kết chuyển đến hết ngày ${dmy(day)}`, source: 'CLOSING' });
      await tx.periodClosing.update({ where: { id }, data: { reversedAt: new Date(), reversedById: user.id } });
      await this.audit.log(tx, {
        action: 'accounting.reverse_closing', entityType: 'PeriodClosing', entityId: row.id,
        summary: `Huỷ kết chuyển lãi lỗ đến hết ngày ${dmy(day)} (${num(row.profit) >= 0 ? 'lãi' : 'lỗ'} ${vnd(Math.abs(num(row.profit)))})`,
      });
    });
    return { ok: true };
  }

  /** Đóng sổ năm: kết chuyển đến 31/12 (nếu còn), chuyển số dư cuối năm sang số dư đầu năm sau, khoá sổ đến 31/12. */
  async closeYear(year: number, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const blocker = await this.yearBlocker(tx, year);
      if (blocker) throw new BadRequestException(blocker);
      const end = `${year}-12-31`;

      if ((await this.plBalances(tx, end)).length) {
        const last = await tx.periodClosing.findFirst({ where: { year, reversedAt: null }, orderBy: { date: 'desc' } });
        if (last && toDay(last.date)! >= end) {
          throw new BadRequestException(`Có bút toán mới sau lần kết chuyển ngày ${dmy(end)}. Huỷ lần kết chuyển đó rồi đóng sổ lại.`);
        }
        await this.post(tx, end, user);
      }

      // Số dư cuối năm = số dư đầu năm đã nhập + phát sinh cả năm (kể cả bút toán kết chuyển).
      const [accounts, moves, openings] = await Promise.all([
        tx.account.findMany({ where: { isDetail: true }, select: { code: true, kind: true } }),
        tx.journalLine.groupBy({ by: ['accountCode'], where: { entry: { date: { gte: fromDay(`${year}-01-01`)!, lt: dayAfter(end) } } }, _sum: { debit: true, credit: true } }),
        tx.openingBalance.findMany({ where: { period: String(year) } }),
      ]);
      const move = new Map(moves.map((m) => [m.accountCode, num(m._sum.debit) - num(m._sum.credit)]));
      const open = new Map(openings.map((o) => [o.accountCode, num(o.debit) - num(o.credit)]));
      const carried: { accountCode: string; period: string; debit: number; credit: number }[] = [];
      const leftover: string[] = [];
      for (const a of accounts) {
        const net = r0((open.get(a.code) ?? 0) + (move.get(a.code) ?? 0));
        if (net === 0) continue;
        if (a.kind === 'DOANH_THU' || a.kind === 'CHI_PHI' || a.kind === 'KQKD') {
          leftover.push(a.code);
          continue;
        }
        carried.push({ accountCode: a.code, period: String(year + 1), debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 });
      }
      if (leftover.length) throw new BadRequestException(`Còn số dư ở tài khoản ${leftover.join(', ')} sau kết chuyển, kiểm tra lại sổ.`);
      const totalDebit = carried.reduce((s, c) => s + c.debit, 0);
      const totalCredit = carried.reduce((s, c) => s + c.credit, 0);
      if (totalDebit !== totalCredit) {
        throw new BadRequestException(`Số dư cuối năm ${year} không cân (Nợ ${vnd(totalDebit)}, Có ${vnd(totalCredit)}). Kiểm tra số dư đầu năm và các bút toán trước khi đóng sổ.`);
      }

      await tx.openingBalance.deleteMany({ where: { period: String(year + 1) } });
      await tx.openingBalance.createMany({ data: carried });

      const info = await tx.companyInfo.findUnique({ where: { id: 1 }, select: { lockDate: true } });
      const previousLock = toDay(info?.lockDate ?? null);
      if (!previousLock || previousLock < end) {
        await tx.companyInfo.update({ where: { id: 1 }, data: { lockDate: fromDay(end) } });
      }
      const profit = (await tx.periodClosing.findMany({ where: { year, reversedAt: null } })).reduce((s, c) => s + num(c.profit), 0);
      await tx.fiscalYearClose.create({
        data: { year, profit, previousLockDate: fromDay(previousLock), closedById: user.id, closedByName: user.name },
      });
      await this.audit.log(tx, {
        action: 'accounting.close_year', entityType: 'FiscalYearClose', entityId: String(year),
        summary: `Đóng sổ năm ${year}: ${profit >= 0 ? 'lãi' : 'lỗ'} ${vnd(Math.abs(profit))}, chuyển ${carried.length} số dư sang đầu năm ${year + 1}, khoá sổ đến ${dmy(end)}`,
      });
      return { year, profit, carriedAccounts: carried.length };
    });
  }

  /** Mở lại năm đã đóng: trả ngày khoá sổ về như trước khi đóng. Số dư đầu năm sau được tính lại khi đóng sổ lại. */
  async reopenYear(year: number, user: AuthUser) {
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.fiscalYearClose.findUnique({ where: { year } });
      if (!row) throw new BadRequestException(`Năm ${year} chưa đóng sổ.`);
      if (await tx.fiscalYearClose.findUnique({ where: { year: year + 1 } })) throw new BadRequestException(`Năm ${year + 1} đã đóng sổ: mở lại năm ${year + 1} trước.`);
      const end = `${year}-12-31`;
      const info = await tx.companyInfo.findUnique({ where: { id: 1 }, select: { lockDate: true } });
      const lock = toDay(info?.lockDate ?? null);
      if (lock && lock > end) throw new BadRequestException(`Ngày khoá sổ đã dời đến ${dmy(lock)}, sau cuối năm ${year}. Hạ ngày khoá sổ (Thiết lập › Thông tin công ty) rồi mở lại năm.`);
      if (lock === end) await tx.companyInfo.update({ where: { id: 1 }, data: { lockDate: row.previousLockDate } });
      await tx.fiscalYearClose.delete({ where: { year } });
      await this.audit.log(tx, {
        action: 'accounting.reopen_year', entityType: 'FiscalYearClose', entityId: String(year),
        summary: `Mở lại năm ${year} (người mở: ${user.name}); số dư đầu năm ${year + 1} sẽ tính lại khi đóng sổ lại`,
      });
    });
    return { ok: true };
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('accounting/closing')
export class PeriodClosingController {
  constructor(private readonly svc: PeriodClosingService) {}

  @RequirePermissions('accounting.view')
  @Get()
  overview(@Query('year') year?: string) {
    return this.svc.overview(Number(year) || Number(vnDay().slice(0, 4)));
  }

  @RequirePermissions('accounting.view')
  @Get('preview')
  preview(@Query('date') date?: string) {
    return this.svc.preview(date?.trim() ?? '');
  }

  @RequirePermissions('accounting.manual')
  @Post()
  @HttpCode(HttpStatus.OK)
  close(@Body() dto: ClosingDto, @CurrentUser() user: AuthUser) {
    return this.svc.close(dto.date, user);
  }

  @RequirePermissions('accounting.reverse')
  @Post(':id/reverse')
  @HttpCode(HttpStatus.OK)
  reverse(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.svc.reverse(id, user);
  }

  @RequirePermissions('accounting.opening', 'period.lock')
  @Post('year/:year/close')
  @HttpCode(HttpStatus.OK)
  closeYear(@Param('year', ParseIntPipe) year: number, @CurrentUser() user: AuthUser) {
    return this.svc.closeYear(year, user);
  }

  @RequirePermissions('accounting.opening', 'period.lock')
  @Post('year/:year/reopen')
  @HttpCode(HttpStatus.OK)
  reopenYear(@Param('year', ParseIntPipe) year: number, @CurrentUser() user: AuthUser) {
    return this.svc.reopenYear(year, user);
  }
}
