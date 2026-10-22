import { Injectable, inject } from '@angular/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { AuthService } from '../../core/services/auth.service';
import {
  CashVoucher, ProductionOrder, SalesOrder, SalesOrderLine, WarehouseVoucher, WarehouseVoucherType,
} from '../../core/models/domain.models';
import { ApiService, upsertById } from '../../core/api/api.service';
import { CatalogLoader } from '../../core/api/catalog-loader.service';
import { SALES_FROM_API } from '../../core/api/api.config';
import { isoDay } from '../../shared/period';
import { WarehouseVoucherService } from '../warehouse-vouchers/warehouse-voucher.service';
import { CashVoucherService } from '../cash-vouchers/cash-voucher.service';
import { nextCode, round4 } from '../purchase-orders/purchase-order.rules';
import {
  canCancel, canClose, canDeliver, canEdit, deriveStatus, lineRatio, lineRemaining, linesNeedingLsx, movesStock,
  needsProduction, orderTotals, receivedValueOf,
} from './sales-order.rules';

export interface SalesOrderDraft {
  customerId: string;
  recipientName?: string;
  recipientPhone?: string;
  deliveryAddress?: string;
  description?: string;
  source?: string;
  tagIds: string[];
  orderDate: string;
  neededByDate?: string;
  salesRep: string;
  discountAmount: number;
  payNowAccountId?: string;
  lines: SalesOrderLine[];
}

export interface DeliveryItem {
  lineIndex: number;
  quantity: number; // theo ĐVT của dòng
  warehouseId: string; // '' for dịch vụ
}

const FINISHED_GOODS_WAREHOUSE = 'wh-thanhpham';

// All writes for Đơn hàng bán and lệnh sản xuất: the API (SALES_FROM_API) — the server checks the rules,
// numbers the documents, writes their phiếu kho and the phiếu thu of "Thu tiền ngay" — or, in demo mode,
// the in-browser store. The chuyến methods (setTrip, markShipping, recordTripReceipt) stay in the browser
// until Chuyến giao hàng moves (Đợt 5).
@Injectable({ providedIn: 'root' })
export class SalesOrderService {
  private readonly api = inject(ApiService);
  private readonly loader = inject(CatalogLoader);

  private keepOrder(o: SalesOrder): SalesOrder {
    this.data.salesOrders.update((list) => upsertById(list, o));
    return o;
  }

  private keepLsx(x: ProductionOrder): ProductionOrder {
    this.data.productionOrders.update((list) => upsertById(list, x));
    return x;
  }

  /** After a step that wrote phiếu kho on the server: read stock and vouchers again, return the new ones. */
  private async newVouchers(before: Set<string>, mine: (v: WarehouseVoucher) => boolean): Promise<WarehouseVoucher[]> {
    await this.loader.loadInventory();
    return this.data.warehouseVouchers().filter((v) => mine(v) && !before.has(v.id));
  }

  private voucherIds(): Set<string> {
    return new Set(this.data.warehouseVouchers().map((v) => v.id));
  }

  constructor(
    private readonly data: MockDataService,
    private readonly auth: AuthService,
    private readonly stock: WarehouseVoucherService,
    private readonly cash: CashVoucherService,
  ) {}

  get userEmail(): string {
    return this.auth.user()?.email ?? 'unknown';
  }

  private product(id: string) {
    return this.data.products().find((p) => p.id === id);
  }

  private isTp = (productId: string) => needsProduction(this.product(productId));

  lsxOf(orderId: string): ProductionOrder[] {
    return this.data.productionOrders().filter((x) => x.sourceOrderId === orderId);
  }

  find(id: string): SalesOrder {
    const o = this.data.salesOrders().find((x) => x.id === id);
    if (!o) throw new Error(`Không tìm thấy đơn hàng ${id}`);
    return o;
  }

  /** Recompute totals + status and store. */
  private save(o: SalesOrder): SalesOrder {
    const t = orderTotals(o.lines, o.discountAmount);
    const next: SalesOrder = {
      ...o,
      totalGoods: t.goods,
      totalOrder: t.total,
      vatAmount: t.vat,
      receivedValue: receivedValueOf(o),
      updatedAt: new Date().toISOString(),
    };
    next.status = deriveStatus(next, this.lsxOf(o.id), this.isTp);
    const list = this.data.salesOrders();
    const before = list.find((x) => x.id === o.id)?.receivedValue ?? 0;
    this.data.salesOrders.set(list.some((x) => x.id === o.id) ? list.map((x) => (x.id === o.id ? next : x)) : [next, ...list]);
    this.syncPayNow(next, next.receivedValue - before);
    return next;
  }

  /**
   * "Thu tiền ngay": khách nhận thêm hàng → lập phiếu thu đúng phần vừa nhận, đối trừ thẳng vào đơn này.
   * Bỏ chốt giao (số nhận giảm) → huỷ các phiếu thu tự lập gần nhất cho khớp lại công nợ.
   */
  private syncPayNow(o: SalesOrder, delta: number): void {
    if (!o.payNowAccountId || o.status === 'HUY' || !delta) return;
    if (!this.data.cashAccounts().some((a) => a.id === o.payNowAccountId)) return;
    const marker = `Thu tiền ngay đơn ${o.code}`;
    if (delta > 0) {
      this.cash.create({
        kind: 'THU', date: o.deliveredDate ?? isoDay(new Date()), category: 'Thu tiền khách hàng', partnerType: 'KHACH_HANG',
        partnerId: o.customerId, accountId: o.payNowAccountId, amount: delta, description: marker,
        allocations: [{ ref: o.code, amount: delta }], settledAmount: delta,
      });
      return;
    }
    let left = -delta;
    const auto = this.data.cashVouchers().filter((v) => !v.isCancelled && v.description === marker).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    for (const v of auto) {
      if (left <= 0 || v.amount > left) continue;
      this.cash.cancel(v.id, 'Khách bỏ nhận hàng — huỷ phiếu thu tự lập');
      left -= v.amount;
    }
  }

  async create(d: SalesOrderDraft): Promise<SalesOrder> {
    if (SALES_FROM_API) return this.keepOrder(await this.api.post<SalesOrder>('/sales-orders', d));
    const o: SalesOrder = {
      ...d,
      id: crypto.randomUUID(),
      code: nextCode(this.data.salesOrders().map((x) => x.code), 'DH'),
      status: 'CHO_SAN_XUAT',
      totalGoods: 0,
      totalOrder: 0,
      receivedValue: 0,
      createdBy: this.userEmail,
    };
    return this.save(o);
  }

  async update(id: string, d: SalesOrderDraft): Promise<SalesOrder> {
    const o = this.find(id);
    if (!canEdit(o, this.lsxOf(id))) throw new Error('Đơn đã sản xuất hoặc đã giao, không sửa được.');
    if (SALES_FROM_API) {
      // updatedAt: the server refuses the save if someone else changed the order since it was loaded.
      const saved = this.keepOrder(await this.api.put<SalesOrder>(`/sales-orders/${id}`, { ...d, updatedAt: o.updatedAt }));
      this.data.productionOrders.set(await this.api.get<ProductionOrder[]>('/production-orders')); // draft lệnh follow the lines
      return saved;
    }
    // Lệnh SX còn nháp đi theo dòng thành phẩm: dòng bị bỏ thì huỷ lệnh, đổi số lượng thì cập nhật lệnh.
    const baseQty = new Map<string, number>();
    for (const l of d.lines) if (this.isTp(l.productId)) baseQty.set(l.productId, (baseQty.get(l.productId) ?? 0) + round4(l.quantity * lineRatio(l)));
    this.data.productionOrders.update((list) =>
      list.map((x) => {
        if (x.sourceOrderId !== id || x.status !== 'NHAP') return x;
        const q = baseQty.get(x.productId);
        return q ? { ...x, quantity: q } : { ...x, status: 'HUY', cancelReason: 'Dòng hàng đã bỏ khỏi đơn' };
      }),
    );
    return this.save({ ...o, ...d });
  }

  async cancel(id: string, reason: string): Promise<void> {
    const o = this.find(id);
    if (!canCancel(o)) return;
    if (SALES_FROM_API) {
      this.keepOrder(await this.api.post<SalesOrder>(`/sales-orders/${id}/cancel`, { reason }));
      this.data.productionOrders.set(await this.api.get<ProductionOrder[]>('/production-orders')); // its open lệnh are cancelled too
      return;
    }
    this.data.productionOrders.update((list) =>
      list.map((x) => (x.sourceOrderId === id && (x.status === 'NHAP' || x.status === 'DANG_SAN_XUAT')
        ? { ...x, status: 'HUY', cancelReason: `Huỷ theo đơn ${o.code}` } : x)),
    );
    this.save({ ...o, status: 'HUY', cancelReason: reason || undefined });
  }

  /** Kết thúc đơn: khách không lấy phần còn lại — đơn giữ trạng thái Giao một phần, không giao thêm. */
  async close(id: string): Promise<void> {
    const o = this.find(id);
    if (!canClose(o)) return;
    if (SALES_FROM_API) {
      this.keepOrder(await this.api.post<SalesOrder>(`/sales-orders/${id}/close`));
      return;
    }
    this.save({ ...o, closedDate: isoDay(new Date()) });
  }

  // ---------- sản xuất ----------

  /** One lệnh sản xuất (Nháp) per thành phẩm line that has none yet. */
  async createProductionOrders(id: string): Promise<ProductionOrder[]> {
    if (SALES_FROM_API) {
      const res = await this.api.post<{ created: ProductionOrder[]; order: SalesOrder }>(`/sales-orders/${id}/production-orders`);
      res.created.forEach((x) => this.keepLsx(x));
      this.keepOrder(res.order);
      return res.created;
    }
    const o = this.find(id);
    const idx = linesNeedingLsx(o, this.lsxOf(id), this.isTp);
    const codes = this.data.productionOrders().map((x) => x.code);
    const created: ProductionOrder[] = idx.map((i) => {
      const l = o.lines[i];
      const code = nextCode(codes, 'LSX');
      codes.push(code);
      return {
        id: crypto.randomUUID(), code, sourceOrderId: o.id, productId: l.productId,
        quantity: round4(l.quantity * lineRatio(l)), status: 'NHAP', createdDate: isoDay(new Date()), createdBy: this.userEmail,
        // Định mức chụp lúc lập lệnh — sửa định mức sau đó không ảnh hưởng lệnh này.
        bomSnapshot: this.data.bomLines()
          .filter((b) => b.finishedProductId === l.productId)
          .map((b) => ({ componentId: b.componentId, quantityPerUnit: b.quantityPerUnit })),
      };
    });
    if (created.length) {
      this.data.productionOrders.update((list) => [...created, ...list]);
      this.save(o);
    }
    return created;
  }

  /** Bắt đầu sản xuất: xuất vật tư theo định mức từ kho ngầm định của từng vật tư. */
  async startProduction(lsxId: string): Promise<WarehouseVoucher[]> {
    const x = this.data.productionOrders().find((p) => p.id === lsxId);
    if (!x || x.status !== 'NHAP') return [];
    if (SALES_FROM_API) return this.lsxStep(`/production-orders/${lsxId}/start`, lsxId, {});
    const date = isoDay(new Date());
    const byWh = new Map<string, Map<string, number>>();
    for (const b of this.bomOf(x)) {
      const wh = this.product(b.componentId)?.defaultWarehouseId ?? this.data.warehouses()[0]?.id ?? '';
      const m = byWh.get(wh) ?? new Map<string, number>();
      m.set(b.componentId, round4((m.get(b.componentId) ?? 0) + b.quantityPerUnit * x.quantity));
      byWh.set(wh, m);
    }
    const vouchers = [...byWh].map(([wh, m]) =>
      this.buildVoucher('XUAT', date, wh, `Xuất vật tư cho ${x.code}`, [...m].map(([productId, q]) => ({ productId, q })), { productionOrderId: x.id }));
    this.postVouchers(vouchers);
    this.setLsx(x.id, { status: 'DANG_SAN_XUAT', startDate: date });
    return vouchers;
  }

  /** Định mức của lệnh: bản chụp lúc lập (lệnh cũ không có thì lấy định mức hiện tại). */
  bomOf(x: ProductionOrder): { componentId: string; quantityPerUnit: number }[] {
    return x.bomSnapshot?.length ? x.bomSnapshot : this.data.bomLines().filter((l) => l.finishedProductId === x.productId);
  }

  /** Hoàn tất sản xuất: nhập số thực làm được vào Kho thành phẩm (hàng hỏng làm số này nhỏ hơn số lệnh). */
  async completeProduction(lsxId: string, produced?: number): Promise<WarehouseVoucher[]> {
    const x = this.data.productionOrders().find((p) => p.id === lsxId);
    if (!x || x.status !== 'DANG_SAN_XUAT') return [];
    if (SALES_FROM_API) return this.lsxStep(`/production-orders/${lsxId}/complete`, lsxId, { producedQuantity: produced });
    const qty = round4(Math.max(0, produced ?? x.quantity));
    const date = isoDay(new Date());
    const vouchers = qty > 0
      ? [this.buildVoucher('NHAP', date, FINISHED_GOODS_WAREHOUSE, `Nhập thành phẩm từ xưởng: ${x.code}`, [{ productId: x.productId, q: qty }], { productionOrderId: x.id })]
      : [];
    this.postVouchers(vouchers);
    this.setLsx(x.id, { status: 'HOAN_TAT', completeDate: date, producedQuantity: qty });
    return vouchers;
  }

  /** Huỷ lệnh (Nháp hoặc Đang sản xuất). Vật tư đã xuất không tự nhập lại — lập phiếu nhập nếu còn dùng được. */
  async cancelProduction(lsxId: string, reason: string): Promise<void> {
    const x = this.data.productionOrders().find((p) => p.id === lsxId);
    if (!x || (x.status !== 'NHAP' && x.status !== 'DANG_SAN_XUAT')) return;
    if (SALES_FROM_API) {
      const res = await this.api.post<{ productionOrder: ProductionOrder; order: SalesOrder }>(`/production-orders/${lsxId}/cancel`, { reason: reason.trim() || undefined });
      this.keepLsx(res.productionOrder);
      this.keepOrder(res.order);
      return;
    }
    this.setLsx(x.id, { status: 'HUY', cancelReason: reason.trim() || undefined });
  }

  /** Bắt đầu / nghiệm thu on the server: the lệnh, its order and the phiếu kho it wrote. */
  private async lsxStep(path: string, lsxId: string, body: object): Promise<WarehouseVoucher[]> {
    const before = this.voucherIds();
    const res = await this.api.post<{ productionOrder: ProductionOrder; order: SalesOrder }>(path, body);
    this.keepLsx(res.productionOrder);
    this.keepOrder(res.order);
    return this.newVouchers(before, (v) => v.productionOrderId === lsxId);
  }

  private setLsx(id: string, change: Partial<ProductionOrder>): void {
    let orderId = '';
    this.data.productionOrders.update((list) => list.map((x) => (x.id === id ? ((orderId = x.sourceOrderId), { ...x, ...change }) : x)));
    if (orderId) this.save(this.find(orderId));
  }

  // ---------- giao hàng ----------

  /**
   * Giao hàng: khách thực nhận (toàn bộ hoặc một phần). One phiếu xuất kho per warehouse (dịch
   * vụ không xuất kho); stock down in base units; công nợ phải thu = receivedValue (gồm thuế, đã
   * trừ chiết khấu theo tỷ lệ); hạn thanh toán = ngày nhận + số ngày được nợ (DebtService).
   */
  async deliver(id: string, items: DeliveryItem[], date: string, note: string): Promise<WarehouseVoucher[]> {
    const o = this.find(id);
    if (!canDeliver(o)) throw new Error('Đơn này không ở trạng thái giao hàng được.');
    if (SALES_FROM_API) {
      const before = this.voucherIds();
      const res = await this.api.post<{ order: SalesOrder; receipts: CashVoucher[] }>(`/sales-orders/${id}/deliver`, {
        items: items.filter((i) => i.quantity > 0), date, note: note || undefined,
      });
      this.keepOrder(res.order);
      if (res.receipts.length) {
        // Phiếu thu chi are still in the browser (Đợt 6): show the server's "Thu tiền ngay" receipt there too.
        this.data.cashVouchers.update((list) => [...res.receipts, ...list]);
        this.cash.recomputeBalances();
      }
      return this.newVouchers(before, (v) => v.salesOrderId === id);
    }
    const lines = o.lines.map((l) => ({ ...l }));
    const byWh = new Map<string, { productId: string; q: number }[]>();
    for (const it of items.filter((i) => i.quantity > 0)) {
      const line = lines[it.lineIndex];
      const qty = Math.min(it.quantity, lineRemaining(line));
      if (qty <= 0) continue;
      line.receivedQuantity = round4((line.receivedQuantity ?? 0) + qty);
      if (movesStock(this.product(line.productId)) && it.warehouseId) {
        const e = byWh.get(it.warehouseId) ?? [];
        e.push({ productId: line.productId, q: round4(qty * lineRatio(line)) });
        byWh.set(it.warehouseId, e);
      }
    }
    const vouchers = [...byWh].map(([wh, e]) =>
      this.buildVoucher('XUAT', date, wh, `Xuất kho giao đơn ${o.code}${note ? ` — ${note}` : ''}`, e, { salesOrderId: o.id }));
    this.postVouchers(vouchers);
    this.save({ ...o, lines, deliveredDate: date, dueDate: undefined });
    return vouchers;
  }

  // ---------- chuyến giao hàng ----------

  /** Gắn / gỡ đơn khỏi chuyến (đang gom đơn) — không đổi trạng thái đơn. */
  setTrip(id: string, tripId: string | undefined): void {
    const o = this.find(id);
    this.data.salesOrders.update((list) => list.map((x) => (x.id === id ? { ...o, tripId } : x)));
  }

  /** Chuyến đã xuất kho: đơn chuyển "Đang giao" (hàng đã rời kho trong phiếu xuất của chuyến). */
  markShipping(id: string, tripId: string): void {
    const o = this.find(id);
    if (o.status === 'HUY') return;
    this.data.salesOrders.update((list) => list.map((x) => (x.id === id ? { ...o, tripId, status: 'DANG_GIAO' } : x)));
  }

  /**
   * Chốt giao trên chuyến: cộng số khách nhận (hàng đã xuất kho cùng chuyến nên không lập phiếu
   * xuất nữa). Khách không nhận gì và chưa từng nhận → Trả toàn bộ.
   */
  recordTripReceipt(id: string, received: { lineIndex: number; received: number }[], date: string, sign: 1 | -1 = 1): SalesOrder {
    const o = this.find(id);
    const lines = o.lines.map((l) => ({ ...l }));
    for (const r of received) {
      const l = lines[r.lineIndex];
      if (!l) continue;
      l.receivedQuantity = Math.max(0, round4((l.receivedQuantity ?? 0) + sign * r.received));
    }
    const anyReceived = lines.some((l) => (l.receivedQuantity ?? 0) > 0);
    const saved = this.save({
      ...o, lines, status: anyReceived || sign === -1 ? 'DANG_GIAO' : 'TRA_TOAN_BO',
      deliveredDate: anyReceived ? date : undefined, dueDate: undefined,
    });
    if (sign === -1 && saved.status !== 'DANG_GIAO') {
      // Bỏ chốt: hàng vẫn đang trên xe, dù đơn đã nhận một phần ở chuyến trước.
      const back = { ...saved, status: 'DANG_GIAO' as const };
      this.data.salesOrders.update((list) => list.map((x) => (x.id === id ? back : x)));
      return back;
    }
    return saved;
  }

  // ---------- kho ----------

  /** Build a voucher without a code; WarehouseVoucherService.post numbers and posts it. */
  buildVoucher(
    type: WarehouseVoucherType, date: string, warehouseId: string, reason: string,
    lines: { productId: string; q: number }[], link: Partial<WarehouseVoucher>,
  ): WarehouseVoucher {
    const merged = new Map<string, number>();
    for (const l of lines) merged.set(l.productId, round4((merged.get(l.productId) ?? 0) + l.q));
    return {
      id: crypto.randomUUID(), code: '', type, date, warehouseId, reason, createdBy: this.userEmail, isCancelled: false, ...link,
      lines: [...merged].map(([productId, q]) => ({ productId, quantity: q, delta: q })),
    };
  }

  postVouchers(vouchers: WarehouseVoucher[]): void {
    this.stock.post(vouchers);
  }
}
