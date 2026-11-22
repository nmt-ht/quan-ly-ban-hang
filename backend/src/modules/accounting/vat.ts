import { BadRequestException, Body, ConflictException, Controller, Get, HttpCode, HttpStatus, Injectable, Post, Query, UseGuards } from '@nestjs/common';
import { Matches } from 'class-validator';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { fromDay, toDay } from '../../common/text.js';
import { documentDay } from '../../common/period-lock.js';
import { vnd } from '../../audit/audit.diff.js';
import { TaxBucket, invoiceBuckets, mergeBuckets } from '../../common/vat.js';
import { LedgerService } from './ledger.service.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const num = (d: Prisma.Decimal | null | undefined) => (d ? d.toNumber() : 0);
const nextDay = (d: string) => new Date(fromDay(d)!.getTime() + 86_400_000);
const sum = (b: TaxBucket[], f: 'taxable' | 'vat') => b.reduce((s, x) => s + x[f], 0);

function range(from: string | undefined, to: string | undefined) {
  if (!from || !to || !DAY.test(from) || !DAY.test(to)) throw new BadRequestException('Chọn kỳ kê khai (từ ngày – đến ngày).');
  if (from > to) throw new BadRequestException('Từ ngày phải trước đến ngày.');
  return { from, to, gte: fromDay(from)!, lt: nextDay(to) };
}

export class VatOffsetDto {
  @Matches(DAY, { message: 'Ngày phải có dạng YYYY-MM-DD' }) date!: string;
}

interface InvoiceKey { supplierId: string; series: string | null; no: string }
const keyOf = (k: InvoiceKey) => `${k.supplierId}|${k.series ?? ''}|${k.no}`;

/**
 * Thuế GTGT: bảng kê bán ra (từ hoá đơn điện tử đã phát hành), bảng kê mua vào (từ hoá đơn NCC ghi trên lần nhận hàng và hoá đơn
 * mua không qua kho), tổng hợp theo thuế suất và khấu trừ. Đây là số liệu HỖ TRỢ lập tờ khai — đối chiếu với mẫu 01/GTGT hiện hành
 * khi kê khai (mẫu và chỉ tiêu có thể thay đổi theo văn bản mới).
 */
@Injectable()
export class VatService {
  constructor(private readonly prisma: PrismaService, private readonly ledger: LedgerService, private readonly audit: AuditService) {}

  /** Bảng kê hoá đơn bán ra: hoá đơn điện tử ĐÃ phát hành trong kỳ (hoá đơn bị thay thế không tính; điều chỉnh giảm ghi số âm). */
  async outputs(fromQ?: string, toQ?: string) {
    const r = range(fromQ, toQ);
    const invoices = await this.prisma.eInvoice.findMany({
      where: { status: 'ISSUED', issueDate: { gte: r.gte, lt: r.lt } },
      include: { order: { select: { code: true } } },
      orderBy: [{ issueDate: 'asc' }, { createdAt: 'asc' }],
    });
    const rows = invoices.map((i) => {
      const taxable = num(i.taxable), vat = num(i.vat);
      const buyer = i.buyer as { companyName?: string; name?: string; taxCode?: string } | null;
      const buckets = invoiceBuckets((i.lines as unknown as { amount: number; vat: string | null }[]) ?? [], taxable, vat);
      return {
        id: i.id, kind: i.kind, templateCode: i.templateCode, series: i.series, number: i.number, date: toDay(i.issueDate)!,
        buyerName: buyer?.companyName || buyer?.name || '', buyerTaxCode: buyer?.taxCode ?? '', orderCode: i.order.code,
        taxable, vat, total: num(i.total), buckets,
      };
    });
    const buckets = mergeBuckets(rows.map((x) => x.buckets));
    return { from: r.from, to: r.to, rows, buckets, totals: { taxable: sum(buckets, 'taxable'), vat: sum(buckets, 'vat'), total: rows.reduce((s, x) => s + x.total, 0) } };
  }

  /**
   * Bảng kê hoá đơn mua vào. Chỉ các khoản CÓ số hoá đơn NCC mới được kê khai khấu trừ (theo ngày hoá đơn; thiếu ngày thì theo
   * ngày nhận); khoản chưa có hoá đơn nằm ở `uninvoiced`. Trả lại hàng mua là dòng âm (cần hoá đơn điều chỉnh của NCC).
   */
  async inputs(fromQ?: string, toQ?: string) {
    const r = range(fromQ, toQ);
    const inRange = { gte: r.gte, lt: r.lt };
    const [receipts, bills, returns] = await Promise.all([
      this.prisma.purchaseOrderReceipt.findMany({
        where: { OR: [{ invoiceNo: { not: null }, invoiceDate: inRange }, { invoiceNo: { not: null }, invoiceDate: null, date: inRange }, { invoiceNo: null, date: inRange }] },
        include: { order: { select: { code: true, supplier: { select: { id: true, code: true, name: true, taxCode: true } } } } },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.purchaseBill.findMany({
        where: { isCancelled: false, OR: [{ invoiceNo: { not: null }, invoiceDate: inRange }, { invoiceNo: { not: null }, invoiceDate: null, date: inRange }, { invoiceNo: null, date: inRange }] },
        include: { supplier: { select: { id: true, code: true, name: true, taxCode: true } }, lines: true },
        orderBy: [{ date: 'asc' }, { code: 'asc' }],
      }),
      this.prisma.purchaseReturn.findMany({
        where: { isCancelled: false, date: inRange },
        include: { order: { select: { code: true, supplier: { select: { id: true, code: true, name: true, taxCode: true } } } }, lines: { include: { orderLine: { select: { vatRate: true } } } } },
        orderBy: [{ date: 'asc' }, { code: 'asc' }],
      }),
    ]);

    // Lần nhận cũ chưa lưu tách thuế: lấy thuế 133 từ bút toán của chính lần nhận đó (nếu sổ cái đã ghi).
    const legacy = receipts.filter((x) => !x.taxBreakdown).map((x) => x.id);
    const legacyVat = new Map<string, number>();
    if (legacy.length) {
      const entries = await this.prisma.journalEntry.findMany({
        where: { refType: 'PurchaseOrderReceipt', refId: { in: legacy }, isReversal: false },
        include: { lines: { where: { accountCode: '133' } } },
      });
      for (const e of entries) legacyVat.set(e.refId!, e.lines.reduce((s, l) => s + num(l.debit), 0));
    }

    type Item = {
      source: 'NHAN_HANG' | 'HOA_DON_MUA'; ref: string; date: string; supplierId: string; supplierName: string; supplierTaxCode: string;
      series: string | null; no: string | null; invoiceDate: string | null; buckets: TaxBucket[]; known: boolean;
    };
    const items: Item[] = [];
    for (const x of receipts) {
      const total = num(x.amount);
      let buckets = (x.taxBreakdown as TaxBucket[] | null) ?? null;
      let known = true;
      if (!buckets) {
        const vat = legacyVat.get(x.id);
        if (vat === undefined) { buckets = [{ rate: -1, taxable: total, vat: 0 }]; known = false; }
        else buckets = [{ rate: -1, taxable: total - vat, vat }];
      }
      items.push({
        source: 'NHAN_HANG', ref: x.order.code, date: toDay(x.date)!, supplierId: x.order.supplier.id, supplierName: x.order.supplier.name, supplierTaxCode: x.order.supplier.taxCode ?? '',
        series: x.invoiceSeries, no: x.invoiceNo, invoiceDate: toDay(x.invoiceDate), buckets, known,
      });
    }
    for (const b of bills) {
      const byRate = new Map<number, number>();
      for (const l of b.lines) byRate.set(num(l.vatRate), (byRate.get(num(l.vatRate)) ?? 0) + num(l.amount));
      const buckets = [...byRate].map(([rate, taxable]) => ({ rate, taxable, vat: Math.round((taxable * rate) / 100) })).sort((a, b2) => a.rate - b2.rate);
      const diff = num(b.vat) - sum(buckets, 'vat');
      if (diff && buckets.length) buckets[buckets.length - 1].vat += diff;
      items.push({
        source: 'HOA_DON_MUA', ref: b.code, date: toDay(b.date)!, supplierId: b.supplier.id, supplierName: b.supplier.name, supplierTaxCode: b.supplier.taxCode ?? '',
        series: b.invoiceSeries, no: b.invoiceNo, invoiceDate: toDay(b.invoiceDate), buckets, known: true,
      });
    }

    // Có số hoá đơn → gom theo (NCC, ký hiệu, số): một hoá đơn có thể phủ nhiều lần nhận.
    const invoiced = new Map<string, {
      supplierId: string; supplierName: string; supplierTaxCode: string; series: string | null; number: string; date: string; refs: string[]; buckets: TaxBucket[][];
    }>();
    const uninvoiced: { source: Item['source']; ref: string; date: string; supplierName: string; taxable: number; vat: number; known: boolean }[] = [];
    for (const it of items) {
      if (!it.no) {
        uninvoiced.push({ source: it.source, ref: it.ref, date: it.date, supplierName: it.supplierName, taxable: sum(it.buckets, 'taxable'), vat: sum(it.buckets, 'vat'), known: it.known });
        continue;
      }
      const k = keyOf({ supplierId: it.supplierId, series: it.series, no: it.no });
      const g = invoiced.get(k) ?? { supplierId: it.supplierId, supplierName: it.supplierName, supplierTaxCode: it.supplierTaxCode, series: it.series, number: it.no, date: it.invoiceDate ?? it.date, refs: [], buckets: [] };
      g.refs.push(it.ref); g.buckets.push(it.buckets);
      invoiced.set(k, g);
    }
    const rows = [...invoiced.values()].map((g) => {
      const buckets = mergeBuckets(g.buckets);
      return {
        kind: 'HOA_DON' as const, series: g.series, number: g.number, date: g.date, supplierName: g.supplierName, supplierTaxCode: g.supplierTaxCode,
        refs: [...new Set(g.refs)].join(', '), taxable: sum(buckets, 'taxable'), vat: sum(buckets, 'vat'), buckets,
      };
    }).sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));

    // Trả lại hàng mua: giảm thuế đầu vào. Tách thuế từ số tiền gồm thuế của từng dòng trả.
    const returnRows = returns.map((x) => {
      const byRate = new Map<number, number>();
      let vatTotal = 0;
      for (const l of x.lines) {
        const rate = num(l.orderLine.vatRate), gross = num(l.amount);
        const taxable = Math.round(gross / (1 + rate / 100));
        byRate.set(rate, (byRate.get(rate) ?? 0) - taxable);
        vatTotal -= gross - taxable;
      }
      const buckets: TaxBucket[] = [...byRate].map(([rate, taxable]) => ({ rate, taxable, vat: Math.round((taxable * rate) / 100) })).sort((a, b) => a.rate - b.rate);
      const diff = vatTotal - sum(buckets, 'vat');
      if (diff && buckets.length) buckets[buckets.length - 1].vat += diff;
      return {
        kind: 'TRA_HANG' as const, series: null, number: x.code, date: toDay(x.date)!, supplierName: x.order.supplier.name, supplierTaxCode: x.order.supplier.taxCode ?? '',
        refs: x.order.code, taxable: sum(buckets, 'taxable'), vat: sum(buckets, 'vat'), buckets,
      };
    });

    const all = [...rows, ...returnRows].sort((a, b) => a.date.localeCompare(b.date));
    const buckets = mergeBuckets(all.map((x) => x.buckets));
    return {
      from: r.from, to: r.to, rows: all, buckets, totals: { taxable: sum(buckets, 'taxable'), vat: sum(buckets, 'vat') },
      uninvoiced, uninvoicedVat: uninvoiced.reduce((s, x) => s + x.vat, 0),
    };
  }

  /** Số dư của một TK (theo chiều thường) tại cuối ngày `day`: số dư đầu năm + phát sinh từ đầu năm. */
  private async balanceAt(code: string, day: string): Promise<number> {
    const account = await this.prisma.account.findUnique({ where: { code } });
    if (!account) return 0;
    const year = day.slice(0, 4);
    const [ob, mv] = await Promise.all([
      this.prisma.openingBalance.findUnique({ where: { accountCode_period: { accountCode: code, period: year } } }),
      this.prisma.journalLine.aggregate({ where: { accountCode: code, entry: { date: { gte: fromDay(`${year}-01-01`)!, lt: nextDay(day) } } }, _sum: { debit: true, credit: true } }),
    ]);
    const d = num(ob?.debit) + num(mv._sum.debit), c = num(ob?.credit) + num(mv._sum.credit);
    return account.normalSide === 'NO' ? d - c : c - d;
  }

  /**
   * Tổng hợp thuế GTGT kỳ: bán ra / mua vào theo thuế suất, thuế phải nộp hoặc còn được khấu trừ, và đối chiếu với sổ cái
   * (3331, 133). Chênh lệch bán ra = thuế của hàng đã giao nhưng chưa xuất hoá đơn; chênh lệch mua vào = thuế của khoản chưa có hoá đơn NCC.
   */
  async summary(fromQ?: string, toQ?: string) {
    const r = range(fromQ, toQ);
    const [out, inp] = await Promise.all([this.outputs(r.from, r.to), this.inputs(r.from, r.to)]);
    const dayBefore = toDay(new Date(r.gte.getTime() - 86_400_000))!;
    const sameYear = dayBefore.slice(0, 4) === r.from.slice(0, 4);
    // Thuế GTGT còn được khấu trừ đầu kỳ: số dư 133 trừ số dư 3331 tại cuối ngày trước kỳ (nếu dương). Sổ cái chưa có kỳ trước (đầu năm) → 0.
    const [b133, b3331] = sameYear ? await Promise.all([this.balanceAt('133', dayBefore), this.balanceAt('3331', dayBefore)]) : [0, 0];
    const carry = Math.max(0, b133 - b3331);

    // Lọc theo chứng từ gốc (refType), không theo `source`: bút toán đảo khi huỷ mang source REVERSAL nhưng cùng refType với bút toán gốc,
    // nên chỉ lọc theo refType mới trừ đúng phần đã huỷ.
    const salesLines = await this.prisma.journalLine.aggregate({
      where: { accountCode: '3331', entry: { date: { gte: r.gte, lt: r.lt }, refType: { in: ['SalesOrderDelivery', 'SalesReturn', 'SalesAllowance'] } } }, _sum: { debit: true, credit: true },
    });
    const ledgerOutput = num(salesLines._sum.credit) - num(salesLines._sum.debit);
    const purchaseLines = await this.prisma.journalLine.aggregate({
      where: { accountCode: '133', entry: { date: { gte: r.gte, lt: r.lt }, refType: { in: ['PurchaseOrderReceipt', 'PurchaseBill', 'PurchaseReturn'] } } }, _sum: { debit: true, credit: true },
    });
    const ledgerInput = num(purchaseLines._sum.debit) - num(purchaseLines._sum.credit);

    const outputVat = out.totals.vat;
    const inputVat = inp.totals.vat;
    const net = outputVat - inputVat - carry;
    return {
      from: r.from, to: r.to,
      output: { buckets: out.buckets, taxable: out.totals.taxable, vat: outputVat, invoices: out.rows.length },
      input: { buckets: inp.buckets, taxable: inp.totals.taxable, vat: inputVat, invoices: inp.rows.length, uninvoicedVat: inp.uninvoicedVat, uninvoicedCount: inp.uninvoiced.length },
      carryForward: carry,
      // > 0: phải nộp; < 0: còn được khấu trừ chuyển kỳ sau.
      payable: net > 0 ? net : 0,
      carryOver: net < 0 ? -net : 0,
      reconciliation: {
        outputVatLedger: ledgerOutput, outputVatInvoiced: outputVat, outputDifference: ledgerOutput - outputVat,
        inputVatLedger: ledgerInput, inputVatListed: inputVat, inputDifference: ledgerInput - inputVat,
      },
    };
  }

  /**
   * Khấu trừ thuế GTGT cuối kỳ: Nợ 3331 / Có 133 bằng số nhỏ hơn của hai số dư tại `date`. Mỗi ngày một lần; sửa bằng cách đảo bút toán.
   */
  async offset(date: string, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const day = await documentDay(tx, date, 'Khấu trừ thuế GTGT');
      if (!(await this.ledger.isLedgerActive(tx, day))) throw new BadRequestException('Sổ kế toán chưa bật hoặc chưa tới ngày bắt đầu ghi sổ.');
      if (await tx.journalEntry.findFirst({ where: { source: 'VAT_OFFSET', refId: day, isReversal: false } })) {
        throw new ConflictException(`Ngày ${day} đã có bút toán khấu trừ thuế GTGT — đảo bút toán cũ nếu cần làm lại.`);
      }
      const [b133, b3331] = await Promise.all([this.balanceAt('133', day), this.balanceAt('3331', day)]);
      const amount = Math.min(b133, b3331);
      if (amount <= 0) throw new BadRequestException(`Không có gì để khấu trừ: 133 còn ${vnd(b133)}, 3331 còn ${vnd(b3331)}.`);
      const id = await this.ledger.postEntry(tx, {
        date: day, source: 'VAT_OFFSET', refType: 'VatOffset', refId: day, createdById: user.id,
        description: `Khấu trừ thuế GTGT đến ${day}`, lines: [{ accountCode: '3331', debit: amount }, { accountCode: '133', credit: amount }],
      });
      await this.audit.log(tx, { action: 'accounting.vat_offset', entityType: 'JournalEntry', entityId: id, summary: `Khấu trừ thuế GTGT ${vnd(amount)} (133 ↔ 3331) ngày ${day}` });
      return { id, amount, date: day };
    });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('accounting/vat')
export class VatController {
  constructor(private readonly svc: VatService) {}

  @RequirePermissions('accounting.view')
  @Get('outputs')
  outputs(@Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.outputs(from?.trim(), to?.trim());
  }

  @RequirePermissions('accounting.view')
  @Get('inputs')
  inputs(@Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.inputs(from?.trim(), to?.trim());
  }

  @RequirePermissions('accounting.view')
  @Get('summary')
  summary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.summary(from?.trim(), to?.trim());
  }

  @RequirePermissions('accounting.manual')
  @Post('offset')
  @HttpCode(HttpStatus.OK)
  offset(@Body() dto: VatOffsetDto, @CurrentUser() user: AuthUser) {
    return this.svc.offset(dto.date, user);
  }
}
