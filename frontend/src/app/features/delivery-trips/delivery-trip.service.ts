import { Injectable, inject } from '@angular/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { CashVoucher, DeliveryTrip, SalesOrder, TripConfirmation, TripCosts, TripLoad, WarehouseVoucher } from '../../core/models/domain.models';
import { ApiService, upsertById } from '../../core/api/api.service';
import { CatalogLoader } from '../../core/api/catalog-loader.service';
import { DELIVERY_FROM_API } from '../../core/api/api.config';
import { CashVoucherService } from '../cash-vouchers/cash-voucher.service';
import { isoDay } from '../../shared/period';
import { nextCode, round4 } from '../purchase-orders/purchase-order.rules';
import { defaultWarehouse, lineRatio, lineRemaining, movesStock } from '../sales-orders/sales-order.rules';
import { SalesOrderService } from '../sales-orders/sales-order.service';
import {
  canArrange, canCancel, canComplete, canConfirm, canLoadOrder, canReturn, canShip, isConfirmed, remainingValue,
  unitValues,
} from './delivery-trip.rules';

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

// All writes for Chuyến giao hàng: the API (DELIVERY_FROM_API) — the server checks the steps, writes the
// phiếu kho, moves the orders and makes / cancels the "Thu tiền ngay" phiếu thu — or, in demo mode, the
// in-browser store.
@Injectable({ providedIn: 'root' })
export class DeliveryTripService {
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
  private async withVouchers(path: string, id: string): Promise<WarehouseVoucher[]> {
    const before = new Set(this.data.warehouseVouchers().map((v) => v.id));
    const t = this.apply(await this.api.post<TripResult>(path));
    await this.loader.loadInventory();
    return this.vouchersOf(t).filter((v) => !before.has(v.id));
  }

  constructor(
    private readonly data: MockDataService,
    private readonly orders: SalesOrderService,
  ) {}

  find(id: string): DeliveryTrip {
    const t = this.data.deliveryTrips().find((x) => x.id === id);
    if (!t) throw new Error(`Không tìm thấy chuyến ${id}`);
    return t;
  }

  private tripOf = (id: string | undefined) => (id ? this.data.deliveryTrips().find((t) => t.id === id) : undefined);

  /** Recompute the trip's figures and store it. */
  private save(t: DeliveryTrip): DeliveryTrip {
    const orders = new Map(this.data.salesOrders().map((o) => [o.id, o]));
    let totalValue = 0;
    let receivedValue = 0;
    if (t.loads?.length) {
      for (const l of t.loads) {
        const o = orders.get(l.orderId);
        if (o) totalValue += l.quantity * (unitValues(o)[l.lineIndex] ?? 0);
      }
    } else {
      for (const id of t.orderIds) {
        const o = orders.get(id);
        if (o) totalValue += remainingValue(o);
      }
    }
    for (const c of t.confirmations ?? []) {
      const o = orders.get(c.orderId);
      if (o) for (const r of c.lines) receivedValue += r.received * (unitValues(o)[r.lineIndex] ?? 0);
    }
    const next: DeliveryTrip = {
      ...t,
      totalValue: Math.round(totalValue),
      receivedValue: Math.round(receivedValue),
      confirmedCount: t.confirmations?.length ?? 0,
    };
    const list = this.data.deliveryTrips();
    this.data.deliveryTrips.set(list.some((x) => x.id === t.id) ? list.map((x) => (x.id === t.id ? next : x)) : [next, ...list]);
    return next;
  }

  async create(h: TripHeader): Promise<DeliveryTrip> {
    if (DELIVERY_FROM_API) {
      const t = await this.api.post<DeliveryTrip>('/delivery-trips', h);
      this.data.deliveryTrips.update((list) => upsertById(list, t));
      return t;
    }
    const t: DeliveryTrip = {
      ...this.cleanHeader(h),
      id: crypto.randomUUID(),
      code: nextCode(this.data.deliveryTrips().map((x) => x.code), 'CH'),
      status: 'GOM_DON',
      orderIds: [],
      totalValue: 0,
      confirmedCount: 0,
      receivedValue: 0,
      createdBy: this.orders.userEmail,
      createdAt: new Date().toISOString(),
    };
    return this.save(t);
  }

  async updateHeader(id: string, h: TripHeader): Promise<void> {
    if (DELIVERY_FROM_API) {
      this.apply(await this.api.put<TripResult>(`/delivery-trips/${id}`, h));
      return;
    }
    this.save({ ...this.find(id), ...this.cleanHeader(h) });
  }

  private cleanHeader(h: TripHeader): TripHeader {
    const v = h.vehicleId ? this.data.vehicles().find((x) => x.id === h.vehicleId) : undefined;
    return {
      date: h.date,
      vehicleId: v?.id,
      plateNumber: v ? v.plateNumber : h.plateNumber?.trim() || undefined,
      driverName: h.driverName?.trim() || undefined,
      driverPhone: h.driverPhone?.trim() || undefined,
      note: h.note?.trim() || undefined,
    };
  }

  async saveCosts(id: string, costs: TripCosts): Promise<void> {
    if (DELIVERY_FROM_API) {
      this.apply(await this.api.put<TripResult>(`/delivery-trips/${id}/costs`, { ...costs, note: costs.note?.trim() || undefined }));
      return;
    }
    this.save({ ...this.find(id), costs: { ...costs, note: costs.note?.trim() || undefined } });
  }

  // ---------- xếp đơn ----------

  async addOrders(id: string, orderIds: string[]): Promise<number> {
    const t = this.find(id);
    if (!canArrange(t)) return 0;
    if (DELIVERY_FROM_API) {
      const next = this.apply(await this.api.post<TripResult>(`/delivery-trips/${id}/orders`, { orderIds }));
      return next.orderIds.length - t.orderIds.length;
    }
    const ok = orderIds.filter((oid) => {
      const o = this.data.salesOrders().find((x) => x.id === oid);
      return !!o && !t.orderIds.includes(oid) && canLoadOrder(o, this.tripOf);
    });
    for (const oid of ok) this.orders.setTrip(oid, t.id);
    this.save({ ...t, orderIds: [...t.orderIds, ...ok] });
    return ok.length;
  }

  async removeOrder(id: string, orderId: string): Promise<void> {
    const t = this.find(id);
    if (!canArrange(t)) return;
    if (DELIVERY_FROM_API) {
      this.apply(await this.api.delete<TripResult>(`/delivery-trips/${id}/orders/${orderId}`));
      return;
    }
    this.orders.setTrip(orderId, undefined);
    this.save({ ...t, orderIds: t.orderIds.filter((x) => x !== orderId) });
  }

  // ---------- xuất kho một lượt ----------

  /** Xếp toàn bộ phần còn phải giao lên xe; một phiếu xuất kho cho mỗi kho; đơn chuyển Đang giao. */
  async ship(id: string): Promise<WarehouseVoucher[]> {
    const t = this.find(id);
    if (!canShip(t)) throw new Error('Chuyến chưa có đơn hoặc đã xuất kho.');
    if (DELIVERY_FROM_API) return this.withVouchers(`/delivery-trips/${id}/ship`, id);
    const products = new Map(this.data.products().map((p) => [p.id, p]));
    const loads: TripLoad[] = [];
    const byWh = new Map<string, { productId: string; q: number }[]>();
    for (const oid of t.orderIds) {
      const o = this.orders.find(oid);
      o.lines.forEach((l, lineIndex) => {
        const q = lineRemaining(l);
        if (q <= 0) return;
        const p = products.get(l.productId);
        const wh = movesStock(p) ? l.warehouseId || defaultWarehouse(p) || this.data.warehouses()[0]?.id : undefined;
        loads.push({ orderId: oid, lineIndex, productId: l.productId, quantity: q, warehouseId: wh });
        if (wh) {
          const e = byWh.get(wh) ?? [];
          e.push({ productId: l.productId, q: round4(q * lineRatio(l)) });
          byWh.set(wh, e);
        }
      });
    }
    const date = isoDay(new Date());
    const vouchers = [...byWh].map(([wh, e]) =>
      this.orders.buildVoucher('XUAT', date, wh, `Xuất kho giao hàng — chuyến ${t.code}`, e, {}));
    this.orders.postVouchers(vouchers);
    for (const oid of t.orderIds) this.orders.markShipping(oid, t.id);
    this.save({ ...t, status: 'DA_XUAT_KHO', shippedAt: new Date().toISOString(), loads, confirmations: [] });
    return vouchers;
  }

  // ---------- chốt giao ----------

  loadsOf(t: DeliveryTrip, orderId: string): TripLoad[] {
    return (t.loads ?? []).filter((l) => l.orderId === orderId);
  }

  /** Chốt số khách thực nhận từng dòng (≤ số đã xếp lên xe). Công nợ phải thu ghi theo số này. */
  async confirm(id: string, orderId: string, lines: { lineIndex: number; received: number }[], note: string): Promise<void> {
    const t = this.find(id);
    if (!canConfirm(t) || isConfirmed(t, orderId)) return;
    if (DELIVERY_FROM_API) {
      this.apply(await this.api.post<TripResult>(`/delivery-trips/${id}/orders/${orderId}/confirm`, { lines, note: note.trim() || undefined }));
      return;
    }
    const loads = this.loadsOf(t, orderId);
    const clean = loads.map((l) => {
      const r = lines.find((x) => x.lineIndex === l.lineIndex)?.received ?? 0;
      return { lineIndex: l.lineIndex, received: Math.min(Math.max(0, round4(r)), l.quantity) };
    });
    const date = isoDay(new Date());
    this.orders.recordTripReceipt(orderId, clean, date);
    const c: TripConfirmation = { orderId, confirmedAt: new Date().toISOString(), lines: clean, note: note.trim() || undefined };
    this.save({ ...t, confirmations: [...(t.confirmations ?? []), c] });
  }

  /** Bỏ chốt (trước khi xe về kho): trả lại số đã ghi nhận, đơn về Đang giao. */
  async unconfirm(id: string, orderId: string): Promise<void> {
    const t = this.find(id);
    const c = t.confirmations?.find((x) => x.orderId === orderId);
    if (!canConfirm(t) || !c) return;
    if (DELIVERY_FROM_API) {
      this.apply(await this.api.post<TripResult>(`/delivery-trips/${id}/orders/${orderId}/unconfirm`));
      return;
    }
    this.orders.recordTripReceipt(orderId, c.lines, isoDay(new Date()), -1);
    this.save({ ...t, confirmations: (t.confirmations ?? []).filter((x) => x.orderId !== orderId) });
  }

  // ---------- xe về kho / hoàn tất / huỷ ----------

  /** Hàng khách không nhận được nhập lại đúng kho đã xuất (phiếu "Nhập trả về"). */
  async returnToWarehouse(id: string): Promise<WarehouseVoucher[]> {
    const t = this.find(id);
    if (!canReturn(t)) throw new Error('Còn đơn chưa chốt giao.');
    if (DELIVERY_FROM_API) return this.withVouchers(`/delivery-trips/${id}/return`, id);
    const byWh = new Map<string, { productId: string; q: number }[]>();
    const refs = new Set<string>();
    for (const l of t.loads ?? []) {
      if (!l.warehouseId) continue;
      const got = t.confirmations?.find((c) => c.orderId === l.orderId)?.lines.find((x) => x.lineIndex === l.lineIndex)?.received ?? 0;
      const back = round4(l.quantity - got);
      if (back <= 0) continue;
      const o = this.orders.find(l.orderId);
      const e = byWh.get(l.warehouseId) ?? [];
      e.push({ productId: l.productId, q: round4(back * lineRatio(o.lines[l.lineIndex])) });
      byWh.set(l.warehouseId, e);
      refs.add(o.code);
    }
    const date = isoDay(new Date());
    const vouchers = [...byWh].map(([wh, e]) =>
      this.orders.buildVoucher('NHAP', date, wh, `Nhập trả về — chuyến ${t.code} (${[...refs].join(', ')})`, e, {}));
    this.orders.postVouchers(vouchers);
    this.save({ ...t, status: 'XE_VE_KHO', returnedAt: new Date().toISOString() });
    return vouchers;
  }

  async complete(id: string): Promise<void> {
    const t = this.find(id);
    if (!canComplete(t)) return;
    if (DELIVERY_FROM_API) {
      this.apply(await this.api.post<TripResult>(`/delivery-trips/${id}/complete`));
      return;
    }
    this.save({ ...t, status: 'HOAN_TAT', completedAt: new Date().toISOString() });
  }

  async cancel(id: string, reason: string): Promise<void> {
    const t = this.find(id);
    if (!canCancel(t)) return;
    if (DELIVERY_FROM_API) {
      this.apply(await this.api.post<TripResult>(`/delivery-trips/${id}/cancel`, { reason: reason.trim() || undefined }));
      return;
    }
    for (const oid of t.orderIds) this.orders.setTrip(oid, undefined);
    this.save({ ...t, status: 'HUY', orderIds: [], cancelReason: reason.trim() || undefined });
  }

  /** Vouchers of this trip (new ones and demo ones both name the trip code in the reason). */
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
