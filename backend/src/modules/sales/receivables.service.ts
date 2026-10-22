import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toDay } from '../../common/text.js';
import { addDays, dayMs } from '../../common/settle.js';
import { DebtCharge, DebtRow, DebtSettlement, debtRow } from '../../common/debt-rows.js';
import { receivedValueOf } from './sales-order.rules.js';

/**
 * Công nợ phải thu, computed the way the frontend's DebtService.receivables does: each đơn bán is owed
 * for what the customer THỰC NHẬN (receivedValue, VAT included, after chiết khấu), due on the order's
 * hạn or "ngày nhận + số ngày được nợ"; phiếu thu settle it (Chọn tay first, then FIFO); phiếu chi to
 * the customer (hoàn tiền) count as a charge.
 */
@Injectable()
export class ReceivablesService {
  constructor(private readonly prisma: PrismaService) {}

  async rows(today = new Date().toISOString().slice(0, 10)): Promise<DebtRow[]> {
    const [customers, orders, vouchers] = await Promise.all([
      this.prisma.customer.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.salesOrder.findMany({ where: { status: { not: 'HUY' } }, include: { lines: true } }),
      this.prisma.cashVoucher.findMany({ where: { isCancelled: false, partnerType: 'KHACH_HANG' }, include: { allocations: true } }),
    ]);
    const now = dayMs(today);

    return customers.flatMap((c) => {
      const charges: DebtCharge[] = orders
        .filter((o) => o.customerId === c.id)
        .map((o) => {
          const amount = receivedValueOf(o.lines.map((l) => ({
            productId: l.productId, quantity: l.quantity.toNumber(), unitPrice: l.unitPrice.toNumber(), discountRate: l.discountRate?.toNumber() ?? null,
            discountAmount: l.discountAmount.toNumber(), vatRate: l.vatRate.toNumber(), receivedQuantity: l.receivedQuantity.toNumber(), ratioToBase: l.ratioToBase.toNumber(),
          })), o.discountAmount.toNumber());
          const date = toDay(o.deliveredDate ?? o.orderDate)!;
          return {
            ref: o.code, date, dueDate: toDay(o.dueDate) ?? addDays(date, c.creditDays), amount,
            typeLabel: 'Giao hàng', description: `Khách nhận hàng đơn ${o.code}`, sourceId: o.id,
          };
        })
        .filter((x) => x.amount > 0);
      const payments: DebtSettlement[] = [];
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
}
