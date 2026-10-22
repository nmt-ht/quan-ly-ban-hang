import { Injectable, inject } from '@angular/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { AuthService } from '../../core/services/auth.service';
import { PurchaseOrder, PurchaseOrderLine, StockLevel, WarehouseVoucher } from '../../core/models/domain.models';
import { isoDay } from '../../shared/period';
import {
  canCancel, canComplete, canEdit, canReceive, canSend, lineRatio, nextCode, orderTotals, receivedValueOf, round4,
  statusAfterReceipt,
} from './purchase-order.rules';
import { ApiService, upsertById } from '../../core/api/api.service';
import { CatalogLoader } from '../../core/api/catalog-loader.service';
import { PURCHASING_FROM_API } from '../../core/api/api.config';

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

// All writes for Đơn nhập hàng: the API (PURCHASING_FROM_API) — the server checks the status rules,
// numbers the order and, on nhận hàng, writes the phiếu nhập kho — or, in demo mode, the in-browser store.
@Injectable({ providedIn: 'root' })
export class PurchaseOrderService {
  private readonly api = inject(ApiService);
  private readonly loader = inject(CatalogLoader);

  /** The order as the server returned it replaces the local copy. */
  private keep(o: PurchaseOrder): PurchaseOrder {
    this.data.purchaseOrders.update((list) => upsertById(list, o));
    return o;
  }

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

  async create(d: OrderDraft): Promise<PurchaseOrder> {
    if (PURCHASING_FROM_API) return this.keep(await this.api.post<PurchaseOrder>('/purchase-orders', d));
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

  async update(id: string, d: OrderDraft): Promise<PurchaseOrder> {
    const o = this.find(id);
    if (!canEdit(o.status)) throw new Error('Chỉ sửa được đơn ở trạng thái Nháp.');
    // updatedAt: the server refuses the save if someone else changed the order since it was loaded.
    if (PURCHASING_FROM_API) return this.keep(await this.api.put<PurchaseOrder>(`/purchase-orders/${id}`, { ...d, updatedAt: o.updatedAt }));
    const next = { ...o, supplierId: d.supplierId, date: d.date, note: d.note || undefined, lines: d.lines, totalValue: orderTotals(d.lines).total };
    this.save(next);
    return next;
  }

  async send(id: string): Promise<void> {
    const o = this.find(id);
    if (!canSend(o.status)) return;
    if (PURCHASING_FROM_API) {
      this.keep(await this.api.post<PurchaseOrder>(`/purchase-orders/${id}/send`));
      return;
    }
    this.save({ ...o, status: 'DA_GUI_NCC', sentDate: isoDay(new Date()) });
  }

  async cancel(id: string, reason: string): Promise<void> {
    const o = this.find(id);
    if (!canCancel(o)) return;
    if (PURCHASING_FROM_API) {
      this.keep(await this.api.post<PurchaseOrder>(`/purchase-orders/${id}/cancel`, { reason }));
      return;
    }
    this.save({ ...o, status: 'HUY', cancelReason: reason || undefined });
  }

  async complete(id: string): Promise<void> {
    const o = this.find(id);
    if (!canComplete(o.status)) return;
    if (PURCHASING_FROM_API) {
      this.keep(await this.api.post<PurchaseOrder>(`/purchase-orders/${id}/complete`));
      return;
    }
    this.save({ ...o, status: 'HOAN_TAT' });
  }

  /**
   * Nhận hàng: one phiếu nhập kho per warehouse, stock up in base units, received quantities
   * and receivedValue (= công nợ phải trả, incl. VAT) updated, status recomputed.
   */
  async receive(id: string, items: ReceiptItem[], date: string, note: string): Promise<WarehouseVoucher[]> {
    const o = this.find(id);
    if (!canReceive(o.status)) throw new Error('Đơn này không ở trạng thái nhận hàng được.');
    const valid = items.filter((i) => i.quantity > 0);
    if (!valid.length) return [];
    if (PURCHASING_FROM_API) {
      const before = new Set(this.data.warehouseVouchers().map((v) => v.id));
      this.keep(await this.api.post<PurchaseOrder>(`/purchase-orders/${id}/receive`, { items: valid, date, note: note || undefined }));
      // The server wrote the phiếu nhập kho and moved stock: read both again.
      await this.loader.loadInventory();
      return this.data.warehouseVouchers().filter((v) => v.purchaseOrderId === id && !before.has(v.id));
    }

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
