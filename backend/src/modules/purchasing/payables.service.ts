import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toDay } from '../../common/text.js';
import { addDays, dayMs } from '../../common/settle.js';
import { DebtCharge, DebtRow, DebtSettlement, chargesOfOrder, debtRow } from '../../common/debt-rows.js';
import { receivedValueOf } from './purchase-order.rules.js';

/**
 * Công nợ phải trả, computed the way the frontend's DebtService.payables does: each đơn nhập owes
 * the value of the goods ĐÃ NHẬN (VAT included), due "ngày nhập kho + số ngày được nợ"; phiếu chi
 * to the supplier settle it (Chọn tay first, then FIFO); phiếu thu from the supplier (hoàn tiền)
 * count as a charge. Suppliers with no activity are left out.
 */
@Injectable()
export class PayablesService {
  constructor(private readonly prisma: PrismaService) {}

  async rows(today = new Date().toISOString().slice(0, 10)): Promise<DebtRow[]> {
    const [suppliers, orders, vouchers, receipts] = await Promise.all([
      this.prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.purchaseOrder.findMany({
        where: { status: { not: 'HUY' } },
        include: { lines: true, receipts: { orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] }, returns: { where: { isCancelled: false } } },
      }),
      this.prisma.cashVoucher.findMany({ where: { isCancelled: false, partnerType: 'NHA_CUNG_CAP' }, include: { allocations: true } }),
      this.prisma.warehouseVoucher.findMany({
        where: { isCancelled: false, type: 'NHAP' }, select: { code: true, purchaseOrderId: true, reason: true }, orderBy: { code: 'asc' },
      }),
    ]);
    const now = dayMs(today);

    return suppliers.flatMap((s) => {
      const charges: DebtCharge[] = orders
        .filter((o) => o.supplierId === s.id)
        .flatMap((o) => {
          const amount = receivedValueOf(o.lines.map((l) => ({
            quantity: l.quantity.toNumber(), unitPrice: l.unitPrice.toNumber(), receivedQuantity: l.receivedQuantity.toNumber(), vatRate: l.vatRate.toNumber(),
          })));
          const rounds = o.receipts.map((r) => ({ date: toDay(r.date)!, amount: r.amount.toNumber() }));
          // Before the lần nhận were recorded: the đơn's ngày nhận, or its ngày đặt when later lần nhận were recorded since.
          const legacy = toDay(rounds.length ? o.date : (o.receivedDate ?? o.date))!;
          // The phiếu nhập kho of this order (older ones only name it in their lý do).
          const pnk = receipts.filter((w) => w.purchaseOrderId === o.id || (w.reason ?? '').includes(o.code)).map((w) => w.code);
          const description = `Nhận hàng đơn nhập ${o.code}` + (pnk.length ? ` (${pnk.join(', ')})` : '');
          return chargesOfOrder({ code: o.code, sourceId: o.id, typeLabel: 'Nhập kho', description }, amount, rounds, legacy, (date) => addDays(date, s.creditDays));
        });
      const payments: DebtSettlement[] = [];
      for (const o of orders.filter((x) => x.supplierId === s.id)) {
        for (const r of o.returns) {
          payments.push({
            id: r.id, code: r.code, date: toDay(r.date)!, amount: r.amount.toNumber(), typeLabel: 'Trả lại hàng mua',
            description: `Trả lại hàng đơn nhập ${o.code}: ${r.reason}`, allocations: [{ ref: o.code, amount: r.amount.toNumber() }],
          });
        }
      }
      for (const v of vouchers.filter((x) => x.supplierId === s.id)) {
        const date = v.date.toISOString().slice(0, 10);
        if (v.kind === 'CHI') {
          payments.push({
            id: v.id, code: v.code, date, amount: v.amount.toNumber(), typeLabel: 'Phiếu chi', description: v.description || v.category,
            allocations: v.allocations.map((a) => ({ ref: a.ref, amount: a.amount.toNumber() })),
          });
        } else {
          charges.push({ ref: v.code, date, dueDate: date, amount: v.amount.toNumber(), typeLabel: 'Phiếu thu hoàn tiền', description: v.description || v.category });
        }
      }
      const row = debtRow({ partnerId: s.id, code: s.code, name: s.name, creditDays: s.creditDays }, charges, payments, now);
      return row ? [row] : [];
    });
  }
}
