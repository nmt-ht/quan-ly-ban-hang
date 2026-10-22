import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toDay } from '../../common/text.js';
import { DebtInvoice, DebtPayment, addDays, dayMs, daysBetween, settle } from '../../common/settle.js';
import { receivedValueOf } from './purchase-order.rules.js';

/** A document that raises what we owe: nhận hàng of an đơn nhập, or money the supplier refunded. */
interface Charge extends DebtInvoice {
  date: string;
  typeLabel: string;
  description: string;
  purchaseOrderId?: string;
}

const creditLabel = (days: number) => (days > 0 ? `${days} ngày` : 'Trả ngay');

/**
 * Công nợ phải trả, computed the way the frontend's DebtService.payables does: each đơn nhập owes
 * the value of the goods ĐÃ NHẬN (VAT included), due "ngày nhập kho + số ngày được nợ"; phiếu chi
 * to the supplier settle it (Chọn tay first, then FIFO); phiếu thu from the supplier (hoàn tiền)
 * count as a charge. Suppliers with no activity are left out.
 */
@Injectable()
export class PayablesService {
  constructor(private readonly prisma: PrismaService) {}

  async rows(today = new Date().toISOString().slice(0, 10)) {
    const [suppliers, orders, vouchers] = await Promise.all([
      this.prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.purchaseOrder.findMany({ where: { status: { not: 'HUY' } }, include: { lines: true } }),
      this.prisma.cashVoucher.findMany({ where: { isCancelled: false, partnerType: 'NHA_CUNG_CAP' }, include: { allocations: true } }),
    ]);
    const now = dayMs(today);

    return suppliers.flatMap((s) => {
      const charges: Charge[] = orders
        .filter((o) => o.supplierId === s.id)
        .map((o) => {
          const amount = receivedValueOf(o.lines.map((l) => ({
            quantity: l.quantity.toNumber(), unitPrice: l.unitPrice.toNumber(), receivedQuantity: l.receivedQuantity.toNumber(), vatRate: l.vatRate.toNumber(),
          })));
          const date = toDay(o.receivedDate ?? o.date)!;
          return { ref: o.code, date, dueDate: addDays(date, s.creditDays), amount, typeLabel: 'Nhập kho', description: `Nhận hàng đơn nhập ${o.code}`, purchaseOrderId: o.id };
        })
        .filter((c) => c.amount > 0);
      const payments: (DebtPayment & { code: string; description: string })[] = [];
      for (const v of vouchers.filter((x) => x.supplierId === s.id)) {
        const date = v.date.toISOString().slice(0, 10);
        if (v.kind === 'CHI') {
          payments.push({
            id: v.id, code: v.code, date, amount: v.amount.toNumber(), description: v.description || v.category,
            allocations: v.allocations.map((a) => ({ ref: a.ref, amount: a.amount.toNumber() })),
          });
        } else {
          charges.push({ ref: v.code, date, dueDate: date, amount: v.amount.toNumber(), typeLabel: 'Phiếu thu hoàn tiền', description: v.description || v.category });
        }
      }
      if (!charges.length && !payments.length) return [];

      const r = settle(charges, payments, now);
      const balance = r.items.reduce((sum, i) => sum + i.amount, 0) - r.prepaid;
      const lines = [
        ...charges.map((c) => {
          const remaining = r.invoiceOpen.get(c.ref) ?? 0;
          return {
            date: c.date, kind: 'PHAT_SINH' as const, typeLabel: c.typeLabel, ref: c.ref, purchaseOrderId: c.purchaseOrderId, description: c.description,
            amount: c.amount, settled: c.amount - remaining, remaining, dueDate: c.dueDate,
            overdueDays: remaining > 0 ? daysBetween(c.dueDate, now) : undefined,
          };
        }),
        ...payments.map((p) => {
          const settled = r.paymentUsed.get(p.id) ?? 0;
          return {
            date: p.date, kind: 'THANH_TOAN' as const, typeLabel: 'Phiếu chi', ref: p.code, description: p.description,
            amount: -p.amount, settled, remaining: p.amount - settled,
          };
        }),
      ].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? a.ref.localeCompare(b.ref) : a.kind === 'PHAT_SINH' ? -1 : 1));
      let running = 0;
      const entries = lines.map((l) => ({ ...l, balance: (running += l.amount) }));

      return [{
        partnerId: s.id, code: s.code, name: s.name, creditDays: s.creditDays, creditLabel: creditLabel(s.creditDays),
        items: r.items, prepaid: r.prepaid, overdue: r.overdue, balance, aging: r.aging,
        nextDue: r.items[0]?.dueDate, lastActivity: entries.at(-1)?.date, entries,
      }];
    });
  }
}
