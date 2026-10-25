import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toDay } from '../../common/text.js';
import { addDays, dayMs } from '../../common/settle.js';
import { DebtCharge, DebtRow, DebtSettlement, chargesOfOrder, debtRow } from '../../common/debt-rows.js';
import { SaleLine, orderTotals, receivedValueOf } from './sales-order.rules.js';

/**
 * Công nợ phải thu, computed the way the frontend's DebtService.receivables does: each đơn bán is owed
 * for what the customer THỰC NHẬN (receivedValue, VAT included, after chiết khấu), due on the order's
 * hạn or "ngày nhận + số ngày được nợ"; phiếu thu settle it (Chọn tay first, then FIFO); phiếu chi to
 * the customer (hoàn tiền) count as a charge.
 */
@Injectable()
export class ReceivablesService {
  constructor(private readonly prisma: PrismaService) {}

  async rows(today = new Date().toISOString().slice(0, 10), onlyCustomerId?: string): Promise<DebtRow[]> {
    const who = onlyCustomerId ? { customerId: onlyCustomerId } : {};
    const [customers, orders, vouchers] = await Promise.all([
      this.prisma.customer.findMany({ where: onlyCustomerId ? { id: onlyCustomerId } : {}, orderBy: { name: 'asc' } }),
      this.prisma.salesOrder.findMany({
        where: { status: { not: 'HUY' }, ...who },
        include: { lines: true, returns: { where: { isCancelled: false } }, deliveries: { orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] } },
      }),
      this.prisma.cashVoucher.findMany({ where: { isCancelled: false, partnerType: 'KHACH_HANG', ...who }, include: { allocations: true } }),
    ]);
    const now = dayMs(today);

    return customers.flatMap((c) => {
      // One khoản per đợt khách nhận hàng, each due "ngày nhận + số ngày được nợ" (or the đơn's own hạn).
      const charges: DebtCharge[] = orders
        .filter((o) => o.customerId === c.id)
        .flatMap((o) => {
          const amount = receivedValueOf(o.lines.map((l) => ({
            productId: l.productId, quantity: l.quantity.toNumber(), unitPrice: l.unitPrice.toNumber(), discountRate: l.discountRate?.toNumber() ?? null,
            discountAmount: l.discountAmount.toNumber(), vatRate: l.vatRate.toNumber(), receivedQuantity: l.receivedQuantity.toNumber(), ratioToBase: l.ratioToBase.toNumber(),
          })), o.discountAmount.toNumber());
          const rounds = o.deliveries.map((d) => ({ date: toDay(d.date)!, amount: d.amount.toNumber() }));
          // Before the đợt were recorded: the đơn's ngày nhận, or its ngày đặt when later đợt were recorded since.
          const legacy = toDay(rounds.length ? o.orderDate : (o.deliveredDate ?? o.orderDate))!;
          return chargesOfOrder({ code: o.code, sourceId: o.id, typeLabel: 'Giao hàng', description: `Khách nhận hàng đơn ${o.code}` },
            amount, rounds, legacy, (date) => toDay(o.dueDate) ?? addDays(date, c.creditDays));
        });
      const payments: DebtSettlement[] = [];
      // Trả hàng (Pha 1.5) settles the đơn it belongs to, like a payment on that đơn; beyond what is owed it is the
      // customer's credit (số dư âm), refunded with a phiếu chi.
      for (const o of orders.filter((x) => x.customerId === c.id)) {
        for (const r of o.returns) {
          payments.push({
            id: r.id, code: r.code, date: toDay(r.date)!, amount: r.amount.toNumber(), typeLabel: 'Trả hàng',
            description: `Khách trả hàng đơn ${o.code}: ${r.reason}`, allocations: [{ ref: o.code, amount: r.amount.toNumber() }],
          });
        }
      }
      for (const v of vouchers.filter((x) => x.customerId === c.id)) {
        const date = v.date.toISOString().slice(0, 10);
        if (v.kind === 'THU') {
          payments.push({
            id: v.id, code: v.code, date, amount: v.amount.toNumber(), typeLabel: 'Phiếu thu', description: v.description || v.category,
            allocations: v.allocations.map((a) => ({ ref: a.ref, amount: a.amount.toNumber() })),
          });
        } else {
          charges.push({ ref: v.code, date, dueDate: date, amount: v.amount.toNumber(), typeLabel: 'Phiếu chi hoàn tiền', description: v.description || v.category });
        }
      }
      const row = debtRow({ partnerId: c.id, code: c.code, name: c.name, creditDays: c.creditDays }, charges, payments, now);
      return row ? [row] : [];
    });
  }

  /**
   * What a customer owes or is about to owe, for the hạn mức công nợ check: `owed` = số dư phải thu hiện tại
   * (đã trừ phiếu thu; trả trước thì âm), `open` = giá trị phần chưa giao của các đơn còn mở — đơn đã đặt
   * nhưng chưa thành công nợ. `excludeOrderId` leaves out the đơn being edited.
   */
  async exposure(customerId: string, excludeOrderId?: string): Promise<{ owed: number; open: number }> {
    const [rows, orders] = await Promise.all([
      this.rows(undefined, customerId),
      this.prisma.salesOrder.findMany({
        where: { customerId, status: { notIn: ['HUY', 'HOAN_THANH', 'TRA_TOAN_BO'] }, closedDate: null, ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}) },
        include: { lines: true },
      }),
    ]);
    const open = orders.reduce((sum, o) => {
      const lines: SaleLine[] = o.lines.map((l) => ({
        productId: l.productId, quantity: l.quantity.toNumber(), unitPrice: l.unitPrice.toNumber(), discountRate: l.discountRate?.toNumber() ?? null,
        discountAmount: l.discountAmount.toNumber(), vatRate: l.vatRate.toNumber(), receivedQuantity: l.receivedQuantity.toNumber(), ratioToBase: l.ratioToBase.toNumber(),
      }));
      const discount = o.discountAmount.toNumber();
      return sum + Math.max(0, orderTotals(lines, discount).total - receivedValueOf(lines, discount));
    }, 0);
    return { owed: rows[0]?.balance ?? 0, open };
  }
}
