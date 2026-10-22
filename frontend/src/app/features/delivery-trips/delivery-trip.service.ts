import { Injectable, inject } from '@angular/core';
import { DataStore } from '../../core/services/data-store.service';
import { CashVoucher, DeliveryTrip, SalesOrder, TripCosts, TripLoad, WarehouseVoucher } from '../../core/models/domain.models';
import { ApiService, upsertById } from '../../core/api/api.service';
import { CatalogLoader } from '../../core/api/catalog-loader.service';
import { CashVoucherService } from '../cash-vouchers/cash-voucher.service';
import { SalesOrderService } from '../sales-orders/sales-order.service';
import { canArrange, canCancel, canComplete, canConfirm, canReturn, canShip, isConfirmed, unitValues } from './delivery-trip.rules';

export interface TripHeader {
  date: string;
  vehicleId?: string; // trống = xe thuê ngoài
  plateNumber?: string;
  driverName?: string;
  driverPhone?: string;
  note?: string;
}

/** What every chuyến step answers on the server. */
interface TripResult {
  trip: DeliveryTrip;
  orders: SalesOrder[];
  receipts?: CashVoucher[];
  cancelledReceipts?: string[];
}

// All writes for Chuyến giao hàng. The server checks the steps, writes the phiếu kho, moves the orders
// and makes / cancels the "Thu tiền ngay" phiếu thu; the page checks the same steps first to say why a
// button is off.
@Injectable({ providedIn: 'root' })
export class DeliveryTripService {
  private readonly data = inject(DataStore);
  private readonly orders = inject(SalesOrderService);
  private readonly api = inject(ApiService);
  private readonly loader = inject(CatalogLoader);
  private readonly cash = inject(CashVoucherService);

  /** Put the chuyến and the orders it touched back into the local lists. */
  private apply(res: TripResult): DeliveryTrip {
    this.data.deliveryTrips.update((list) => upsertById(list, res.trip));
    for (const o of res.orders) this.data.salesOrders.update((list) => upsertById(list, o));
    // The server lập / huỷ the "Thu tiền ngay" phiếu thu: keep the list in step and read số dư quỹ again.
    if (res.receipts?.length) this.data.cashVouchers.update((list) => [...res.receipts!, ...list]);
    if (res.cancelledReceipts?.length) {
      const ids = new Set(res.cancelledReceipts);
      this.data.cashVouchers.update((list) => list.map((v) => (ids.has(v.id) ? { ...v, isCancelled: true } : v)));
    }
    if (res.receipts?.length || res.cancelledReceipts?.length) void this.cash.refreshBalances();
    return res.trip;
  }

  /** A step that wrote phiếu kho: read stock and vouchers again, return this chuyến's new ones. */
  private async withVouchers(path: string): Promise<WarehouseVoucher[]> {
    const before = new Set(this.data.warehouseVouchers().map((v) => v.id));
    const t = this.apply(await this.api.post<TripResult>(path));
    await this.loader.loadInventory();
    return this.vouchersOf(t).filter((v) => !before.has(v.id));
  }

  find(id: string): DeliveryTrip {
    const t = this.data.deliveryTrips().find((x) => x.id === id);
    if (!t) throw new Error(`Không tìm thấy chuyến ${id}`);
    return t;
  }

  async create(h: TripHeader): Promise<DeliveryTrip> {
    const t = await this.api.post<DeliveryTrip>('/delivery-trips', h);
    this.data.deliveryTrips.update((list) => upsertById(list, t));
    return t;
  }

  async updateHeader(id: string, h: TripHeader): Promise<void> {
    this.apply(await this.api.put<TripResult>(`/delivery-trips/${id}`, h));
  }

  async saveCosts(id: string, costs: TripCosts): Promise<void> {
    this.apply(await this.api.put<TripResult>(`/delivery-trips/${id}/costs`, { ...costs, note: costs.note?.trim() || undefined }));
  }

  // ---------- xếp đơn ----------

  async addOrders(id: string, orderIds: string[]): Promise<number> {
    const t = this.find(id);
    if (!canArrange(t)) return 0;
    const next = this.apply(await this.api.post<TripResult>(`/delivery-trips/${id}/orders`, { orderIds }));
    return next.orderIds.length - t.orderIds.length;
  }

  async removeOrder(id: string, orderId: string): Promise<void> {
    if (!canArrange(this.find(id))) return;
    this.apply(await this.api.delete<TripResult>(`/delivery-trips/${id}/orders/${orderId}`));
  }

  // ---------- xuất kho một lượt ----------

  /** Xếp toàn bộ phần còn phải giao lên xe; một phiếu xuất kho cho mỗi kho; đơn chuyển Đang giao. */
  async ship(id: string): Promise<WarehouseVoucher[]> {
    if (!canShip(this.find(id))) throw new Error('Chuyến chưa có đơn hoặc đã xuất kho.');
    return this.withVouchers(`/delivery-trips/${id}/ship`);
  }

  // ---------- chốt giao ----------

  loadsOf(t: DeliveryTrip, orderId: string): TripLoad[] {
    return (t.loads ?? []).filter((l) => l.orderId === orderId);
  }

  /** Chốt số khách thực nhận từng dòng (≤ số đã xếp lên xe). Công nợ phải thu ghi theo số này. */
  async confirm(id: string, orderId: string, lines: { lineIndex: number; received: number }[], note: string): Promise<void> {
    const t = this.find(id);
    if (!canConfirm(t) || isConfirmed(t, orderId)) return;
    this.apply(await this.api.post<TripResult>(`/delivery-trips/${id}/orders/${orderId}/confirm`, { lines, note: note.trim() || undefined }));
  }

  /** Bỏ chốt (trước khi xe về kho): trả lại số đã ghi nhận, đơn về Đang giao. */
  async unconfirm(id: string, orderId: string): Promise<void> {
    const t = this.find(id);
    if (!canConfirm(t) || !t.confirmations?.some((x) => x.orderId === orderId)) return;
    this.apply(await this.api.post<TripResult>(`/delivery-trips/${id}/orders/${orderId}/unconfirm`));
  }

  // ---------- xe về kho / hoàn tất / huỷ ----------

  /** Hàng khách không nhận được nhập lại đúng kho đã xuất (phiếu "Nhập trả về"). */
  async returnToWarehouse(id: string): Promise<WarehouseVoucher[]> {
    if (!canReturn(this.find(id))) throw new Error('Còn đơn chưa chốt giao.');
    return this.withVouchers(`/delivery-trips/${id}/return`);
  }

  async complete(id: string): Promise<void> {
    if (!canComplete(this.find(id))) return;
    this.apply(await this.api.post<TripResult>(`/delivery-trips/${id}/complete`));
  }

  async cancel(id: string, reason: string): Promise<void> {
    if (!canCancel(this.find(id))) return;
    this.apply(await this.api.post<TripResult>(`/delivery-trips/${id}/cancel`, { reason: reason.trim() || undefined }));
  }

  /** Vouchers of this trip (they name the trip code in the reason). */
  vouchersOf(t: DeliveryTrip): WarehouseVoucher[] {
    return this.data.warehouseVouchers()
      .filter((v) => (v.reason ?? '').includes(`chuyến ${t.code}`))
      .sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code));
  }

  unitValuesOf(orderId: string): number[] {
    return unitValues(this.orders.find(orderId));
  }

  /** Giá trị nhận (gồm thuế) for a set of received quantities of an order. */
  valueOf(orderId: string, lines: { lineIndex: number; received: number }[]): number {
    const v = this.unitValuesOf(orderId);
    return Math.round(lines.reduce((s, r) => s + r.received * (v[r.lineIndex] ?? 0), 0));
  }
}
