import { Injectable, inject } from '@angular/core';
import { DataStore } from '../../core/services/data-store.service';
import { PurchaseOrder, PurchaseOrderLine, WarehouseVoucher } from '../../core/models/domain.models';
import { canCancel, canComplete, canEdit, canReceive, canSend } from './purchase-order.rules';
import { ApiService, upsertById } from '../../core/api/api.service';
import { CatalogLoader } from '../../core/api/catalog-loader.service';

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

// All writes for Đơn nhập hàng. The server checks the status rules, numbers the order and, on nhận
// hàng, writes the phiếu nhập kho; the page checks the same rules first to say why a button is off.
@Injectable({ providedIn: 'root' })
export class PurchaseOrderService {
  private readonly data = inject(DataStore);
  private readonly api = inject(ApiService);
  private readonly loader = inject(CatalogLoader);

  /** The order as the server returned it replaces the local copy. */
  private keep(o: PurchaseOrder): PurchaseOrder {
    this.data.purchaseOrders.update((list) => upsertById(list, o));
    return o;
  }

  private find(id: string): PurchaseOrder {
    const o = this.data.purchaseOrders().find((x) => x.id === id);
    if (!o) throw new Error(`Không tìm thấy đơn nhập ${id}`);
    return o;
  }

  async create(d: OrderDraft): Promise<PurchaseOrder> {
    return this.keep(await this.api.post<PurchaseOrder>('/purchase-orders', d));
  }

  async update(id: string, d: OrderDraft): Promise<PurchaseOrder> {
    const o = this.find(id);
    if (!canEdit(o.status)) throw new Error('Chỉ sửa được đơn ở trạng thái Nháp.');
    // updatedAt: the server refuses the save if someone else changed the order since it was loaded.
    return this.keep(await this.api.put<PurchaseOrder>(`/purchase-orders/${id}`, { ...d, updatedAt: o.updatedAt }));
  }

  async send(id: string): Promise<void> {
    if (!canSend(this.find(id).status)) return;
    this.keep(await this.api.post<PurchaseOrder>(`/purchase-orders/${id}/send`));
  }

  async cancel(id: string, reason: string): Promise<void> {
    if (!canCancel(this.find(id))) return;
    this.keep(await this.api.post<PurchaseOrder>(`/purchase-orders/${id}/cancel`, { reason }));
  }

  async complete(id: string): Promise<void> {
    if (!canComplete(this.find(id).status)) return;
    this.keep(await this.api.post<PurchaseOrder>(`/purchase-orders/${id}/complete`));
  }

  /**
   * Nhận hàng: the server writes one phiếu nhập kho per warehouse, moves stock in base units and
   * updates received quantities, receivedValue (= công nợ phải trả, incl. VAT) and the status.
   */
  async receive(id: string, items: ReceiptItem[], date: string, note: string): Promise<WarehouseVoucher[]> {
    if (!canReceive(this.find(id).status)) throw new Error('Đơn này không ở trạng thái nhận hàng được.');
    const valid = items.filter((i) => i.quantity > 0);
    if (!valid.length) return [];
    const before = new Set(this.data.warehouseVouchers().map((v) => v.id));
    this.keep(await this.api.post<PurchaseOrder>(`/purchase-orders/${id}/receive`, { items: valid, date, note: note || undefined }));
    // The server wrote the phiếu nhập kho and moved stock: read both again.
    await this.loader.loadInventory();
    return this.data.warehouseVouchers().filter((v) => v.purchaseOrderId === id && !before.has(v.id));
  }
}
