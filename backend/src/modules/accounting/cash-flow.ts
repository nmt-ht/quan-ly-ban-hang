import { BadRequestException, Controller, Get, Injectable, Query, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { RequirePermissions } from '../../auth/permissions.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { fromDay } from '../../common/text.js';
import { CASH_ACCOUNTS, buildStatement, classifyEntries } from './cash-flow.rules.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const num = (d: Prisma.Decimal | null | undefined) => (d ? d.toNumber() : 0);
const nextDay = (d: string) => new Date(fromDay(d)!.getTime() + 86_400_000);

/**
 * Báo cáo lưu chuyển tiền tệ (B03-DNN, phương pháp trực tiếp) từ sổ cái: phân loại các bút toán có tiền (111, 112, 113) theo tài
 * khoản đối ứng. Tiền đầu kỳ = số dư đầu năm đã nhập + biến động từ đầu năm đến trước kỳ; tiền cuối kỳ phải khớp số dư tiền trên sổ cái
 * (`check`). Khoảng ngày nằm trong một năm.
 */
@Injectable()
export class CashFlowService {
  constructor(private readonly prisma: PrismaService) {}

  /** Số dư các TK tiền (Nợ − Có) cuối ngày `until` (hoặc trước `from` khi `exclusive`): số dư đầu năm + phát sinh từ đầu năm. */
  private async cashBalance(year: string, lt: Date): Promise<number> {
    const [ob, mv] = await Promise.all([
      this.prisma.openingBalance.findMany({ where: { accountCode: { in: CASH_ACCOUNTS }, period: year } }),
      this.prisma.journalLine.aggregate({
        where: { accountCode: { in: CASH_ACCOUNTS }, entry: { date: { gte: fromDay(`${year}-01-01`)!, lt } } }, _sum: { debit: true, credit: true },
      }),
    ]);
    return ob.reduce((s, o) => s + num(o.debit) - num(o.credit), 0) + num(mv._sum.debit) - num(mv._sum.credit);
  }

  async statement(from?: string, to?: string) {
    if (!from || !to || !DAY.test(from) || !DAY.test(to)) throw new BadRequestException('Chọn kỳ báo cáo (từ ngày – đến ngày).');
    if (from > to) throw new BadRequestException('Từ ngày phải trước đến ngày.');
    if (from.slice(0, 4) !== to.slice(0, 4)) throw new BadRequestException('Chọn khoảng trong cùng một năm (số dư đầu kỳ nhập theo năm).');
    const year = from.slice(0, 4);
    const gte = fromDay(from)!, lt = nextDay(to);

    const entries = await this.prisma.journalEntry.findMany({
      where: { date: { gte, lt }, lines: { some: { accountCode: { in: CASH_ACCOUNTS } } } },
      select: { lines: { select: { accountCode: true, debit: true, credit: true } } },
    });
    const result = classifyEntries(entries.map((e) => e.lines.map((l) => ({ accountCode: l.accountCode, debit: num(l.debit), credit: num(l.credit) }))));
    const opening = await this.cashBalance(year, gte);
    const s = buildStatement(result, opening);
    const ledgerClosing = await this.cashBalance(year, lt);
    return { from, to, items: s.items, net: s.net, opening, closing: s.closing, check: { ledgerClosing, difference: ledgerClosing - s.closing } };
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('accounting/cash-flow')
export class CashFlowController {
  constructor(private readonly svc: CashFlowService) {}

  @RequirePermissions('accounting.view')
  @Get()
  statement(@Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.statement(from?.trim(), to?.trim());
  }
}
