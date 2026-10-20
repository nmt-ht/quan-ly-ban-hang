import { Injectable } from '@angular/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { AuthService } from '../../core/services/auth.service';
import { PurchaseOrder, PurchaseOrderLine, StockLevel, WarehouseVoucher } from '../../core/models/domain.models';
import { isoDay } from '../../shared/period';
import {
  canCancel, canComplete, canEdit, canReceive, canSend, lineRatio, nextCode, orderTotals, receivedValueOf, round4,
  statusAfterReceipt,
} from './purchase-order.rules';

export interface OrderDraft {
  supplierId: string;
  date: string;
  note?: string;
  lines: PurchaseOrderLine[];
}

export interface ReceiptItem {
  lineIndex: number;
  quantity: number; // in the line's unit
  warehouseId: string;
}

// All writes for Đơn nhập hàng. Against the mock store today; the same methods map 1:1 to
// the backend endpoints later (create/update/send/cancel/complete/receive).
@Injectable({ providedIn: 'root' })
export class PurchaseOrderService {
  constructor(
    private readonly data: MockDataService,
    private readonly auth: AuthService,
  ) {}

  private get userEmail(): string {
    return this.auth.user()?.email ?? 'unknown';
  }

  private find(id: string): PurchaseOrder {
    const o = this.data.purchaseOrders().find((x) => x.id === id);
    if (!o) throw new Error(`Không tìm thấy đơn nhập ${id}`);
    return o;
  }

  private save(o: PurchaseOrder): void {
    const next = { ...o, updatedAt: new Date().toISOString() };
    const list = this.data.purchaseOrders();
    this.data.purchaseOrders.set(list.some((x) => x.id === o.id) ? list.map((x) => (x.id === o.id ? next : x)) : [next, ...list]);
  }

  create(d: OrderDraft): PurchaseOrder {
    const o: PurchaseOrder = {
      id: crypto.randomUUID(),
      code: nextCode(this.data.purchaseOrders().map((x) => x.code), 'DN'),
      supplierId: d.supplierId,
      date: d.date,
      note: d.note || undefined,
      status: 'NHAP',
      lines: d.lines,
      totalValue: orderTotals(d.lines).total,
      receivedValue: 0,
      createdBy: this.userEmail,
    };
    this.save(o);
    return o;
  }

  update(id: string, d: OrderDraft): PurchaseOrder {
    const o = this.find(id);
    if (!canEdit(o.status)) throw new Error('Chỉ sửa được đơn ở trạng thái Nháp.');
    const next = { ...o, supplierId: d.supplierId, date: d.date, note: d.note || undefined, lines: d.lines, totalValue: orderTotals(d.lines).total };
    this.save(next);
    return next;
  }

  send(id: string): void {
    const o = this.find(id);
    if (!canSend(o.status)) return;
    this.save({ ...o, status: 'DA_GUI_NCC', sentDate: isoDay(new Date()) });
  }

  cancel(id: string, reason: string): void {
    const o = this.find(id);
    if (!canCancel(o)) return;
    this.save({ ...o, status: 'HUY', cancelReason: reason || undefined });
  }

  complete(id: string): void {
    const o = this.find(id);
    if (!canComplete(o.status)) return;
    this.save({ ...o, status: 'HOAN_TAT' });
  }

  /**
   * Nhận hàng: one phiếu nhập kho per warehouse, stock up in base units, received quantities
   * and receivedValue (= công nợ phải trả, incl. VAT) updated, status recomputed.
   */
  receive(id: string, items: ReceiptItem[], date: string, note: string): WarehouseVoucher[] {
    const o = this.find(id);
    if (!canReceive(o.status)) throw new Error('Đơn này không ở trạng thái nhận hàng được.');
    const valid = items.filter((i) => i.quantity > 0);
    if (!valid.length) return [];

    const lines = o.lines.map((l) => ({ ...l }));
    const byWarehouse = new Map<string, { productId: string; base: number }[]>();
    for (const it of valid) {
      const line = lines[it.lineIndex];
      const qty = Math.min(it.quantity, round4(line.quantity - line.receivedQuantity));
      if (qty <= 0) continue;
      line.receivedQuantity = round4(line.receivedQuantity + qty);
      const entry = byWarehouse.get(it.warehouseId) ?? [];
      entry.push({ productId: line.productId, base: round4(qty * lineRatio(line)) });
      byWarehouse.set(it.warehouseId, entry);
    }

    const codes = this.data.warehouseVouchers().map((v) => v.code);
    const vouchers: WarehouseVoucher[] = [];
    for (const [warehouseId, entries] of byWarehouse) {
      const code = nextCode([...codes, ...vouchers.map((v) => v.code)], 'PNK');
      vouchers.push({
        id: crypto.randomUUID(),
        code,
        type: 'NHAP',
        date,
        warehouseId,
        reason: `Nhập hàng theo đơn ${o.code}${note ? ` — ${note}` : ''}`,
        createdBy: this.userEmail,
        isCancelled: false,
        purchaseOrderId: o.id,
        lines: entries.map((e) => ({ productId: e.productId, quantity: e.base, delta: e.base })),
      });
    }
    this.data.warehouseVouchers.set([...vouchers, ...this.data.warehouseVouchers()]);

    // Stock goes up per (product, warehouse), in base units.
    const levels: StockLevel[] = this.data.stockLevels().map((s) => ({ ...s }));
    for (const v of vouchers) {
      for (const l of v.lines ?? []) {
        const lv = levels.find((s) => s.productId === l.productId && s.warehouseId === v.warehouseId);
        if (lv) lv.quantity = round4(lv.quantity + l.delta);
        else {
          const minStock = this.data.products().find((p) => p.id === l.productId)?.minStock ?? 0;
          levels.push({ productId: l.productId, warehouseId: v.warehouseId, quantity: l.delta, minStock });
        }
      }
    }
    this.data.stockLevels.set(levels);

    this.save({
      ...o,
      lines,
      receivedValue: receivedValueOf(lines),
      status: statusAfterReceipt(lines),
      receivedDate: date,
    });
    return vouchers;
  }
}
