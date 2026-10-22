import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toDay } from '../../common/text.js';
import { addDays, dayMs } from '../../common/settle.js';
import { DebtCharge, DebtRow, DebtSettlement, debtRow } from '../../common/debt-rows.js';
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
      this.prisma.purchaseOrder.findMany({ where: { status: { not: 'HUY' } }, include: { lines: true } }),
      this.prisma.cashVoucher.findMany({ where: { isCancelled: false, partnerType: 'NHA_CUNG_CAP' }, include: { allocations: true } }),
      this.prisma.warehouseVoucher.findMany({
        where: { isCancelled: false, type: 'NHAP' }, select: { code: true, purchaseOrderId: true, reason: true }, orderBy: { code: 'asc' },
      }),
    ]);
    const now = dayMs(today);

    return suppliers.flatMap((s) => {
      const charges: DebtCharge[] = orders
        .filter((o) => o.supplierId === s.id)
        .map((o) => {
          const amount = receivedValueOf(o.lines.map((l) => ({
            quantity: l.quantity.toNumber(), unitPrice: l.unitPrice.toNumber(), receivedQuantity: l.receivedQuantity.toNumber(), vatRate: l.vatRate.toNumber(),
          })));
          const date = toDay(o.receivedDate ?? o.date)!;
          // The phiếu nhập kho of this order (older ones only name it in their lý do).
          const pnk = receipts.filter((w) => w.purchaseOrderId === o.id || (w.reason ?? '').includes(o.code)).map((w) => w.code);
          const description = `Nhận hàng đơn nhập ${o.code}` + (pnk.length ? ` (${pnk.join(', ')})` : '');
          return { ref: o.code, date, dueDate: addDays(date, s.creditDays), amount, typeLabel: 'Nhập kho', description, sourceId: o.id };
        })
        .filter((c) => c.amount > 0);
      const payments: DebtSettlement[] = [];
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
