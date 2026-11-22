import { BadRequestException, Controller, Get, Injectable, Query, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { RequirePermissions } from '../../auth/permissions.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { fromDay } from '../../common/text.js';
import { BooksService } from './books.js';
import {
  IncomeInput, MAPPED_ACCOUNTS, PositionInput, buildFinancialPosition, buildIncomeStatement, isBalanced,
} from './statements.rules.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const num = (d: Prisma.Decimal | null | undefined) => (d ? d.toNumber() : 0);
const nextDay = (d: string) => new Date(fromDay(d)!.getTime() + 86_400_000);
const BALANCE_KINDS = ['TAI_SAN', 'NO_PHAI_TRA', 'VON_CSH'];

/** Cùng ngày năm trước (29/02 → 28/02). */
export function yearBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const dim = new Date(Date.UTC(y - 1, m, 0)).getUTCDate();
  return `${y - 1}-${String(m).padStart(2, '0')}-${String(Math.min(d, dim)).padStart(2, '0')}`;
}

/**
 * Báo cáo tài chính theo mẫu TT133, đọc từ sổ cái: B01b-DNN (tình hình tài chính tại một ngày) và B02-DNN (kết quả kinh doanh
 * trong một khoảng ngày, kèm kỳ trước = cùng khoảng năm trước). B03-DNN do CashFlowService trả. Quy tắc nằm ở statements.rules.ts.
 */
@Injectable()
export class StatementsService {
  constructor(private readonly prisma: PrismaService, private readonly books: BooksService) {}

  /** B01b-DNN tại ngày `date`: số cuối năm = số dư đầu năm đã nhập + phát sinh đến hết `date`; số đầu năm = số dư đầu năm. */
  async financialPosition(date?: string) {
    if (!date || !DAY.test(date)) throw new BadRequestException('Chọn ngày lập báo cáo.');
    const year = date.slice(0, 4);
    const yearStart = `${year}-01-01`;
    const [accounts, openings, moves, ar, ap] = await Promise.all([
      this.prisma.account.findMany({ where: { isDetail: true }, select: { code: true, kind: true } }),
      this.prisma.openingBalance.findMany({ where: { period: year } }),
      this.prisma.journalLine.groupBy({ by: ['accountCode'], where: { entry: { date: { gte: fromDay(yearStart)!, lt: nextDay(date) } } }, _sum: { debit: true, credit: true } }),
      this.books.partnerSummary({ code: '131', from: yearStart, to: date }),
      this.books.partnerSummary({ code: '331', from: yearStart, to: date }),
    ]);
    const open: Record<string, number> = {};
    for (const o of openings) open[o.accountCode] = num(o.debit) - num(o.credit);
    const net: Record<string, number> = { ...open };
    const move = new Map(moves.map((m) => [m.accountCode, num(m._sum.debit) - num(m._sum.credit)]));
    for (const [code, v] of move) net[code] = (net[code] ?? 0) + v;

    let unclosedProfit = 0;
    for (const a of accounts) {
      const v = move.get(a.code) ?? 0; // Nợ − Có trong năm
      if (a.kind === 'DOANH_THU' || a.kind === 'CHI_PHI') unclosedProfit -= v; // doanh thu: Có − Nợ; chi phí: −(Nợ − Có)
    }

    const current: PositionInput = {
      net, receivable: { debit: ar.totals.closingNo, credit: ar.totals.closingCo }, payable: { debit: ap.totals.closingNo, credit: ap.totals.closingCo }, unclosedProfit,
    };
    const o131 = open['131'] ?? 0;
    const o331 = open['331'] ?? 0;
    const opening: PositionInput = {
      net: open, unclosedProfit: 0,
      receivable: { debit: Math.max(o131, 0), credit: Math.max(-o131, 0) },
      payable: { debit: Math.max(o331, 0), credit: Math.max(-o331, 0) },
    };
    const lines = buildFinancialPosition(current, opening);
    const unmapped = accounts
      .filter((a) => BALANCE_KINDS.includes(a.kind) && !MAPPED_ACCOUNTS.includes(a.code) && Math.round(net[a.code] ?? 0) !== 0)
      .map((a) => a.code);
    return { date, openingDate: yearStart, lines, balanced: isBalanced(lines), unmapped };
  }

  private async incomeInput(from: string, to: string): Promise<IncomeInput> {
    const rows = await this.prisma.journalLine.groupBy({
      by: ['accountCode'],
      where: { entry: { source: { not: 'CLOSING' }, date: { gte: fromDay(from)!, lt: nextDay(to) } } },
      _sum: { debit: true, credit: true },
    });
    const by = new Map(rows.map((r) => [r.accountCode, { d: num(r._sum.debit), c: num(r._sum.credit) }]));
    const revenue = (code: string) => { const m = by.get(code); return m ? m.c - m.d : 0; };
    const expense = (code: string) => { const m = by.get(code); return m ? m.d - m.c : 0; };
    return {
      revenue: revenue('511'), deductions: expense('5211') + expense('5212') + expense('5213'), cogs: expense('632'), financeIncome: revenue('515'), financeExpense: expense('635'),
      management: expense('641') + expense('642'), otherIncome: revenue('711'), otherExpense: expense('811'), incomeTax: expense('821'),
    };
  }

  /** B02-DNN cho khoảng ngày, bỏ bút toán kết chuyển, kèm kỳ trước (cùng khoảng năm trước). */
  async incomeStatement(from?: string, to?: string) {
    if (!from || !to || !DAY.test(from) || !DAY.test(to)) throw new BadRequestException('Chọn kỳ báo cáo (từ ngày – đến ngày).');
    if (from > to) throw new BadRequestException('Từ ngày phải trước đến ngày.');
    const priorFrom = yearBefore(from);
    const priorTo = yearBefore(to);
    const [current, prior] = await Promise.all([this.incomeInput(from, to), this.incomeInput(priorFrom, priorTo)]);
    return { from, to, priorFrom, priorTo, lines: buildIncomeStatement(current, prior) };
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('accounting/statements')
export class StatementsController {
  constructor(private readonly svc: StatementsService) {}

  @RequirePermissions('accounting.view')
  @Get('financial-position')
  financialPosition(@Query('date') date?: string) {
    return this.svc.financialPosition(date?.trim());
  }

  @RequirePermissions('accounting.view')
  @Get('income-statement')
  incomeStatement(@Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.incomeStatement(from?.trim(), to?.trim());
  }
}
