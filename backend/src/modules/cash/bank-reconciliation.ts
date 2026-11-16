import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Injectable, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNumber, IsOptional, Matches, Min, ValidateNested } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { OptionalText, Text } from '../../common/dto.js';
import { fromDay, toDay, vnDay } from '../../common/text.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { vnd } from '../../audit/audit.diff.js';
import { bookBalance } from './cash-balance.js';
import { autoMatch, sameMoney } from './bank-reconciliation.rules.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const nextDay = (d: string) => new Date(fromDay(d)!.getTime() + 86_400_000);
export const MAX_IMPORT_ROWS = 1000;

export class StatementRowDto {
  @Matches(DAY, { message: 'Ngày phải có dạng YYYY-MM-DD' }) date!: string;
  @OptionalText(500) description?: string;
  @OptionalText(60) reference?: string;
  @IsOptional() @IsNumber() @Min(0) amountIn?: number;
  @IsOptional() @IsNumber() @Min(0) amountOut?: number;
}

export class ImportStatementDto {
  @Text(60) accountId!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(MAX_IMPORT_ROWS) @ValidateNested({ each: true }) @Type(() => StatementRowDto) rows!: StatementRowDto[];
}

export class AutoMatchDto {
  @Text(60) accountId!: string;
  @Matches(DAY) from!: string;
  @Matches(DAY) to!: string;
}

export class MatchDto {
  @Text(60) voucherId!: string;
}

/**
 * Đối chiếu sao kê ngân hàng: nhập các dòng sao kê (tay hoặc Excel) của một tài khoản ngân hàng, khớp với phiếu thu / chi cùng
 * chiều và số tiền (tự động hoặc chọn tay). Phiếu chưa có trên sao kê và dòng sao kê chưa có phiếu là những gì còn phải xử lý;
 * số dư sổ sách được so với số dư cuối kỳ trên sao kê do người dùng nhập.
 */
@Injectable()
export class BankReconciliationService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private async bankAccount(accountId: string) {
    const account = await this.prisma.cashAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException('Không tìm thấy tài khoản ngân hàng.');
    if (account.type !== 'NGAN_HANG') throw new BadRequestException('Đối chiếu sao kê chỉ dùng cho tài khoản ngân hàng.');
    return account;
  }

  private range(from?: string, to?: string) {
    if (!from || !to || !DAY.test(from) || !DAY.test(to)) throw new BadRequestException('Chọn khoảng ngày (từ ngày – đến ngày).');
    if (from > to) throw new BadRequestException('Từ ngày phải trước đến ngày.');
    return { gte: fromDay(from)!, lt: nextDay(to) };
  }

  async view(accountId: string, from?: string, to?: string) {
    const account = await this.bankAccount(accountId);
    const r = this.range(from, to);
    const [lines, vouchers] = await Promise.all([
      this.prisma.bankStatementLine.findMany({
        where: { accountId, date: r }, include: { voucher: { select: { code: true } } }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.cashVoucher.findMany({ where: { accountId, isCancelled: false, date: r }, include: { statementLine: { select: { id: true } } }, orderBy: [{ date: 'asc' }, { code: 'asc' }] }),
    ]);
    const lineRows = lines.map((l) => ({
      id: l.id, date: toDay(l.date)!, description: l.description, reference: l.reference, amountIn: l.amountIn.toNumber(), amountOut: l.amountOut.toNumber(),
      voucherId: l.voucherId, voucherCode: l.voucher?.code ?? null,
    }));
    const voucherRows = vouchers.map((v) => ({
      id: v.id, code: v.code, date: toDay(v.date)!, kind: v.kind, amount: v.amount.toNumber(), category: v.category, description: v.description, matched: !!v.statementLine,
    }));
    const unmatchedLines = lineRows.filter((l) => !l.voucherId);
    const unmatchedVouchers = voucherRows.filter((v) => !v.matched);
    const net = (xs: { amountIn: number; amountOut: number }[]) => xs.reduce((s, x) => s + x.amountIn - x.amountOut, 0);
    return {
      account: { id: account.id, name: account.name, bankName: account.bankName, accountNumber: account.accountNumber },
      from, to, bookBalance: await bookBalance(this.prisma, account, to),
      lines: lineRows, vouchers: voucherRows,
      summary: {
        lines: lineRows.length, matched: lineRows.length - unmatchedLines.length, unmatchedLines: unmatchedLines.length, unmatchedVouchers: unmatchedVouchers.length,
        // Phần tiền chưa khớp, theo chiều tăng quỹ (+): dòng sao kê chưa có phiếu, và phiếu chưa có trên sao kê.
        unmatchedLinesNet: net(unmatchedLines),
        unmatchedVouchersNet: unmatchedVouchers.reduce((s, v) => s + (v.kind === 'THU' ? v.amount : -v.amount), 0),
      },
    };
  }

  async importLines(dto: ImportStatementDto, user: AuthUser) {
    const account = await this.bankAccount(dto.accountId);
    const today = vnDay();
    const rows = dto.rows.map((r, i) => {
      const amountIn = Math.round(r.amountIn ?? 0), amountOut = Math.round(r.amountOut ?? 0);
      if ((amountIn > 0) === (amountOut > 0)) throw new BadRequestException(`Dòng ${i + 1}: nhập số tiền vào hoặc số tiền ra (đúng một trong hai, lớn hơn 0).`);
      if (r.date > today) throw new BadRequestException(`Dòng ${i + 1}: ngày sao kê sau hôm nay.`);
      return { ...r, amountIn, amountOut };
    });
    return this.prisma.$transaction(async (tx) => {
      // Dòng có số tham chiếu đã nhập rồi thì bỏ qua — nhập lại cùng một file sao kê không tạo trùng.
      const refs = rows.map((r) => r.reference?.trim()).filter((x): x is string => !!x);
      const known = new Set(
        (await tx.bankStatementLine.findMany({ where: { accountId: account.id, reference: { in: refs } }, select: { reference: true } })).map((x) => x.reference),
      );
      const seen = new Set<string>();
      const fresh = rows.filter((r) => {
        const ref = r.reference?.trim();
        if (!ref) return true;
        if (known.has(ref) || seen.has(ref)) return false;
        seen.add(ref);
        return true;
      });
      await tx.bankStatementLine.createMany({
        data: fresh.map((r) => ({
          accountId: account.id, date: fromDay(r.date)!, description: r.description ?? null, reference: r.reference?.trim() || null,
          amountIn: r.amountIn, amountOut: r.amountOut, createdById: user.id,
        })),
      });
      await this.audit.log(tx, {
        action: 'bank_statement.import', entityType: 'CashAccount', entityId: account.id, entityCode: account.code ?? undefined,
        summary: `Nhập ${fresh.length} dòng sao kê ${account.name}${rows.length - fresh.length ? ` (bỏ ${rows.length - fresh.length} dòng trùng số tham chiếu)` : ''}`,
      });
      return { inserted: fresh.length, skipped: rows.length - fresh.length };
    });
  }

  async auto(dto: AutoMatchDto) {
    const account = await this.bankAccount(dto.accountId);
    const r = this.range(dto.from, dto.to);
    return this.prisma.$transaction(async (tx) => {
      const [lines, vouchers] = await Promise.all([
        tx.bankStatementLine.findMany({ where: { accountId: account.id, voucherId: null, date: r } }),
        tx.cashVoucher.findMany({ where: { accountId: account.id, isCancelled: false, statementLine: null, date: { gte: new Date(r.gte.getTime() - 3 * 86_400_000), lt: new Date(r.lt.getTime() + 3 * 86_400_000) } } }),
      ]);
      const pairs = autoMatch(
        lines.map((l) => ({ id: l.id, date: toDay(l.date)!, amountIn: l.amountIn.toNumber(), amountOut: l.amountOut.toNumber() })),
        vouchers.map((v) => ({ id: v.id, code: v.code, date: toDay(v.date)!, kind: v.kind, amount: v.amount.toNumber() })),
      );
      for (const p of pairs) await tx.bankStatementLine.update({ where: { id: p.lineId }, data: { voucherId: p.voucherId } });
      await this.audit.log(tx, {
        action: 'bank_statement.auto_match', entityType: 'CashAccount', entityId: account.id, entityCode: account.code ?? undefined,
        summary: `Tự khớp sao kê ${account.name} ${dto.from} → ${dto.to}: ${pairs.length}/${lines.length} dòng`,
      });
      return { matched: pairs.length, lines: lines.length };
    });
  }

  async match(lineId: string, voucherId: string) {
    return this.prisma.$transaction(async (tx) => {
      const line = await tx.bankStatementLine.findUnique({ where: { id: lineId } });
      if (!line) throw new NotFoundException('Không tìm thấy dòng sao kê.');
      if (line.voucherId) throw new BadRequestException('Dòng sao kê này đã khớp một phiếu — bỏ khớp trước.');
      const v = await tx.cashVoucher.findUnique({ where: { id: voucherId }, include: { statementLine: { select: { id: true } } } });
      if (!v || v.isCancelled) throw new BadRequestException('Phiếu không có hoặc đã huỷ.');
      if (v.accountId !== line.accountId) throw new BadRequestException('Phiếu thuộc tài khoản ngân hàng khác.');
      if (v.statementLine) throw new BadRequestException(`${v.code} đã khớp một dòng sao kê khác.`);
      const item = { id: line.id, date: toDay(line.date)!, amountIn: line.amountIn.toNumber(), amountOut: line.amountOut.toNumber() };
      if (!sameMoney(item, { id: v.id, code: v.code, date: toDay(v.date)!, kind: v.kind, amount: v.amount.toNumber() })) {
        throw new BadRequestException(`Phiếu ${v.code} (${v.kind === 'THU' ? 'thu' : 'chi'} ${vnd(v.amount.toNumber())}) không cùng chiều và số tiền với dòng sao kê.`);
      }
      await tx.bankStatementLine.update({ where: { id: lineId }, data: { voucherId } });
      await this.audit.log(tx, { action: 'bank_statement.match', entityType: 'CashVoucher', entityId: v.id, entityCode: v.code, summary: `Khớp ${v.code} với dòng sao kê ngày ${toDay(line.date)} (${vnd(v.amount.toNumber())})` });
      return { ok: true };
    });
  }

  async unmatch(lineId: string) {
    return this.prisma.$transaction(async (tx) => {
      const line = await tx.bankStatementLine.findUnique({ where: { id: lineId }, include: { voucher: { select: { code: true } } } });
      if (!line) throw new NotFoundException('Không tìm thấy dòng sao kê.');
      if (!line.voucherId) throw new BadRequestException('Dòng sao kê này chưa khớp phiếu nào.');
      await tx.bankStatementLine.update({ where: { id: lineId }, data: { voucherId: null } });
      await this.audit.log(tx, { action: 'bank_statement.unmatch', entityType: 'CashVoucher', entityId: line.voucherId, entityCode: line.voucher?.code, summary: `Bỏ khớp ${line.voucher?.code ?? ''} với dòng sao kê ngày ${toDay(line.date)}` });
      return { ok: true };
    });
  }

  async remove(lineId: string) {
    return this.prisma.$transaction(async (tx) => {
      const line = await tx.bankStatementLine.findUnique({ where: { id: lineId } });
      if (!line) throw new NotFoundException('Không tìm thấy dòng sao kê.');
      await tx.bankStatementLine.delete({ where: { id: lineId } });
      await this.audit.log(tx, { action: 'bank_statement.delete', entityType: 'CashAccount', entityId: line.accountId, summary: `Xoá dòng sao kê ngày ${toDay(line.date)} (vào ${vnd(line.amountIn.toNumber())}, ra ${vnd(line.amountOut.toNumber())})` });
      return { ok: true };
    });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('bank-reconciliation')
export class BankReconciliationController {
  constructor(private readonly svc: BankReconciliationService) {}

  @RequirePermissions('voucher.manage_account')
  @Get()
  view(@Query('accountId') accountId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    if (!accountId) throw new BadRequestException('Chọn tài khoản ngân hàng.');
    return this.svc.view(accountId, from, to);
  }

  @RequirePermissions('voucher.manage_account')
  @Post('import')
  importLines(@Body() dto: ImportStatementDto, @CurrentUser() user: AuthUser) {
    return this.svc.importLines(dto, user);
  }

  @RequirePermissions('voucher.manage_account')
  @Post('auto-match')
  @HttpCode(HttpStatus.OK)
  auto(@Body() dto: AutoMatchDto) {
    return this.svc.auto(dto);
  }

  @RequirePermissions('voucher.manage_account')
  @Post('lines/:id/match')
  @HttpCode(HttpStatus.OK)
  match(@Param('id') id: string, @Body() dto: MatchDto) {
    return this.svc.match(id, dto.voucherId);
  }

  @RequirePermissions('voucher.manage_account')
  @Post('lines/:id/unmatch')
  @HttpCode(HttpStatus.OK)
  unmatch(@Param('id') id: string) {
    return this.svc.unmatch(id);
  }

  @RequirePermissions('voucher.manage_account')
  @Post('lines/:id/delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
