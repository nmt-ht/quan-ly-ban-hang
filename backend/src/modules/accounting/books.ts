import { BadRequestException, Controller, Get, Injectable, NotFoundException, Query, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { RequirePermissions } from '../../auth/permissions.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { fromDay, toDay } from '../../common/text.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const num = (d: Prisma.Decimal | null | undefined) => (d ? d.toNumber() : 0);
const nextDay = (d: string) => new Date(fromDay(d)!.getTime() + 86_400_000);
/** TK có đối tượng công nợ: số dư theo từng khách / NCC. */
export const PARTNER_ACCOUNTS = ['131', '331'];
export const MAX_BOOK_ROWS = 5000;

/** Số dư theo chiều thường của TK → (dư Nợ, dư Có): âm nghĩa là dư bên đối diện. */
function sides(net: number, normal: 'NO' | 'CO') {
  const onNormal = net >= 0 ? net : 0;
  const onOpposite = net < 0 ? -net : 0;
  return normal === 'NO' ? { no: onNormal, co: onOpposite } : { no: onOpposite, co: onNormal };
}

function range(from: string | undefined, to: string | undefined) {
  if (!from || !to || !DAY.test(from) || !DAY.test(to)) throw new BadRequestException('Chọn khoảng ngày (từ ngày – đến ngày).');
  if (from > to) throw new BadRequestException('Từ ngày phải trước đến ngày.');
  if (from.slice(0, 4) !== to.slice(0, 4)) throw new BadRequestException('Chọn khoảng trong cùng một năm (số dư đầu kỳ nhập theo năm).');
  return { from, to, year: from.slice(0, 4), yearStart: `${from.slice(0, 4)}-01-01` };
}

/**
 * Sổ sách theo mẫu TT133, đọc từ sổ cái: sổ chi tiết tài khoản (111 = Sổ quỹ tiền mặt, 112 = Sổ tiền gửi ngân hàng, 131/331 theo
 * đối tượng = Sổ chi tiết công nợ) và bảng tổng hợp công nợ theo đối tượng. Số dư đầu kỳ = số dư đầu năm đã nhập + phát sinh từ
 * đầu năm đến trước ngày bắt đầu; số dư đầu năm nhập theo tài khoản, KHÔNG theo đối tượng nên sổ của một đối tượng chỉ gồm phát
 * sinh từ sổ cái (xem `note`).
 */
@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  async accountBook(q: { code?: string; from?: string; to?: string; partnerId?: string }) {
    const r = range(q.from, q.to);
    if (!q.code) throw new BadRequestException('Chọn tài khoản.');
    const account = await this.prisma.account.findUnique({ where: { code: q.code } });
    if (!account) throw new NotFoundException('Tài khoản không tồn tại.');
    const byPartner = !!q.partnerId;
    if (byPartner && !PARTNER_ACCOUNTS.includes(account.code)) throw new BadRequestException('Chỉ TK 131 và 331 có sổ theo đối tượng.');
    // 131 = khách hàng, 331 = nhà cung cấp: loại đối tượng suy ra từ tài khoản.
    const partnerWhere: Prisma.JournalLineWhereInput = byPartner ? (account.code === '131' ? { customerId: q.partnerId } : { supplierId: q.partnerId }) : {};
    const side = account.normalSide;
    const signed = (d: number, c: number) => (side === 'NO' ? d - c : c - d);

    const ob = byPartner ? null : await this.prisma.openingBalance.findUnique({ where: { accountCode_period: { accountCode: account.code, period: r.year } } });
    const before = await this.prisma.journalLine.aggregate({
      where: { accountCode: account.code, ...partnerWhere, entry: { date: { gte: fromDay(r.yearStart)!, lt: fromDay(r.from)! } } },
      _sum: { debit: true, credit: true },
    });
    const opening = (ob ? signed(num(ob.debit), num(ob.credit)) : 0) + signed(num(before._sum.debit), num(before._sum.credit));

    const rows = await this.prisma.journalLine.findMany({
      where: { accountCode: account.code, ...partnerWhere, entry: { date: { gte: fromDay(r.from)!, lt: nextDay(r.to) } } },
      include: { entry: { select: { id: true, code: true, date: true, description: true, lines: { select: { accountCode: true } } } } },
      orderBy: [{ entry: { date: 'asc' } }, { entry: { code: 'asc' } }, { id: 'asc' }],
      take: MAX_BOOK_ROWS + 1,
    });
    const truncated = rows.length > MAX_BOOK_ROWS;
    const used = truncated ? rows.slice(0, MAX_BOOK_ROWS) : rows;

    const customers = new Map((await this.prisma.customer.findMany({ where: { id: { in: [...new Set(used.map((l) => l.customerId).filter((x): x is string => !!x))] } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
    const suppliers = new Map((await this.prisma.supplier.findMany({ where: { id: { in: [...new Set(used.map((l) => l.supplierId).filter((x): x is string => !!x))] } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));

    let balance = opening, totalDebit = 0, totalCredit = 0;
    const items = used.map((l) => {
      const debit = num(l.debit), credit = num(l.credit);
      balance += signed(debit, credit);
      totalDebit += debit; totalCredit += credit;
      const counter = [...new Set(l.entry.lines.map((x) => x.accountCode).filter((c) => c !== account.code))].join(', ');
      return {
        date: toDay(l.entry.date)!, entryId: l.entry.id, code: l.entry.code, description: l.description ?? l.entry.description, counterAccounts: counter,
        partner: (l.customerId && customers.get(l.customerId)) || (l.supplierId && suppliers.get(l.supplierId)) || null,
        debit, credit, balance,
      };
    });
    const o = sides(opening, side), c = sides(balance, side);
    return {
      account: { code: account.code, name: account.name, normalSide: side },
      from: r.from, to: r.to, partnerId: q.partnerId ?? null,
      openingNo: o.no, openingCo: o.co, rows: items, totalDebit, totalCredit, closingNo: c.no, closingCo: c.co,
      truncated,
      note: byPartner ? 'Số dư đầu năm nhập theo tài khoản, không theo đối tượng, nên sổ này chỉ gồm các bút toán đã ghi cho đối tượng.' : null,
    };
  }

  /** Tổng hợp công nợ 131 / 331 theo đối tượng: số dư đầu kỳ, phát sinh Nợ/Có, số dư cuối kỳ. */
  async partnerSummary(q: { code?: string; from?: string; to?: string }) {
    const r = range(q.from, q.to);
    if (!q.code || !PARTNER_ACCOUNTS.includes(q.code)) throw new BadRequestException('Chọn TK 131 (phải thu) hoặc 331 (phải trả).');
    const account = await this.prisma.account.findUniqueOrThrow({ where: { code: q.code } });
    const side = account.normalSide;
    const signed = (d: number, c: number) => (side === 'NO' ? d - c : c - d);
    const isCustomer = q.code === '131';

    const [prior, inside, ob] = await Promise.all([
      this.prisma.journalLine.groupBy({
        by: ['customerId', 'supplierId'], where: { accountCode: q.code, entry: { date: { gte: fromDay(r.yearStart)!, lt: fromDay(r.from)! } } }, _sum: { debit: true, credit: true },
      }),
      this.prisma.journalLine.groupBy({
        by: ['customerId', 'supplierId'], where: { accountCode: q.code, entry: { date: { gte: fromDay(r.from)!, lt: nextDay(r.to) } } }, _sum: { debit: true, credit: true },
      }),
      this.prisma.openingBalance.findUnique({ where: { accountCode_period: { accountCode: q.code, period: r.year } } }),
    ]);
    const NONE = '__none__';
    const keyOf = (g: { customerId: string | null; supplierId: string | null }) => (isCustomer ? g.customerId : g.supplierId) ?? NONE;
    const acc = new Map<string, { opening: number; debit: number; credit: number }>();
    const slot = (k: string) => { const s = acc.get(k) ?? { opening: 0, debit: 0, credit: 0 }; acc.set(k, s); return s; };
    for (const g of prior) slot(keyOf(g)).opening += signed(num(g._sum.debit), num(g._sum.credit));
    // Số dư đầu năm nhập theo tài khoản, chưa gắn đối tượng: nằm ở dòng "Chưa phân đối tượng".
    if (ob) slot(NONE).opening += signed(num(ob.debit), num(ob.credit));
    for (const g of inside) { const s = slot(keyOf(g)); s.debit += num(g._sum.debit); s.credit += num(g._sum.credit); }

    const ids = [...acc.keys()].filter((k) => k !== NONE);
    const names = new Map<string, { code: string; name: string }>(
      (isCustomer
        ? await this.prisma.customer.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, name: true } })
        : await this.prisma.supplier.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, name: true } })
      ).map((p) => [p.id, { code: p.code, name: p.name }]),
    );
    const rows = [...acc].map(([k, v]) => {
      const closing = v.opening + signed(v.debit, v.credit);
      const o = sides(v.opening, side), c = sides(closing, side);
      const who = names.get(k);
      return {
        partnerId: k === NONE ? null : k, code: k === NONE ? '' : (who?.code ?? ''), name: k === NONE ? 'Chưa phân đối tượng (số dư đầu năm, bút toán tay)' : (who?.name ?? '—'),
        openingNo: o.no, openingCo: o.co, debit: v.debit, credit: v.credit, closingNo: c.no, closingCo: c.co,
      };
    }).filter((x) => x.openingNo || x.openingCo || x.debit || x.credit || x.closingNo || x.closingCo)
      .sort((a, b) => (a.partnerId === null ? 1 : 0) - (b.partnerId === null ? 1 : 0) || a.code.localeCompare(b.code));
    const sum = (f: (x: (typeof rows)[number]) => number) => rows.reduce((s, x) => s + f(x), 0);
    return {
      account: { code: account.code, name: account.name }, from: r.from, to: r.to, rows,
      totals: { openingNo: sum((x) => x.openingNo), openingCo: sum((x) => x.openingCo), debit: sum((x) => x.debit), credit: sum((x) => x.credit), closingNo: sum((x) => x.closingNo), closingCo: sum((x) => x.closingCo) },
    };
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('accounting/books')
export class BooksController {
  constructor(private readonly svc: BooksService) {}

  @RequirePermissions('accounting.view')
  @Get('account')
  account(@Query('code') code?: string, @Query('from') from?: string, @Query('to') to?: string, @Query('partnerId') partnerId?: string) {
    return this.svc.accountBook({ code: code?.trim(), from: from?.trim(), to: to?.trim(), partnerId: partnerId?.trim() || undefined });
  }

  @RequirePermissions('accounting.view')
  @Get('partners')
  partners(@Query('code') code?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.partnerSummary({ code: code?.trim(), from: from?.trim(), to: to?.trim() });
  }
}
