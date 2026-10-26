import { Injectable, inject } from '@angular/core';
import { DataStore } from '../../core/services/data-store.service';
import { AuthService } from '../../core/services/auth.service';
import { CashVoucher, ProductionOrder, SaleType, SalesOrder, SalesOrderLine, SalesReturn, SalesReturnDraft, WarehouseVoucher } from '../../core/models/domain.models';
import { ApiService, upsertById } from '../../core/api/api.service';
import { CatalogLoader } from '../../core/api/catalog-loader.service';
import { pageQuery } from '../../core/api/on-demand';
import { CashVoucherService } from '../cash-vouchers/cash-voucher.service';
import { canCancel, canClose, canDeliver, canEdit } from './sales-order.rules';

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
  /** Khuyến mãi theo tổng đơn đã áp vào chiết khấu cả đơn. */
  promotionId?: string;
  payNowAccountId?: string;
  /** Lưu dù vượt hạn mức công nợ của khách (server chỉ nhận từ chức vụ có debt.adjust). */
  overrideCreditLimit?: boolean;
  /** Lập đơn từ báo giá (chỉ khi tạo đơn). */
  quotationId?: string;
  /** Loại chứng từ bán hàng; xuất khẩu được ghi ngoại tệ và tỷ giá. */
  saleType: SaleType;
  currency?: string;
  exchangeRate?: number;
  lines: SalesOrderLine[];
}

/** Bộ lọc của danh sách đơn theo trang (Pha 1.1) — the server's SalesOrderPageQuery. */
export interface SalesOrderPageQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string[];
  tags?: string[];
  reps?: string[];
  createdBy?: string[];
  customerId?: string;
  from?: string;
  to?: string;
  min?: number;
  max?: number;
  late?: boolean;
  sort?: string;
  dir?: 'asc' | 'desc';
}

export interface SalesOrderPage {
  rows: SalesOrder[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: Partial<Record<string, number>>;
  totals: { value: number; received: number; pending: number; late: number };
}

export interface CustomerOrderStats {
  orderCount: number;
  receivedOrders: number;
  revenue: number;
  lastPurchase: string | null;
  openOrders: number;
}

export interface DeliveryItem {
  lineIndex: number;
  quantity: number; // theo ĐVT của dòng
  warehouseId: string; // '' for dịch vụ
}

// All writes for Đơn hàng bán and lệnh sản xuất. The server checks the rules, numbers the documents,
// writes their phiếu kho and the phiếu thu of "Thu tiền ngay"; the page checks the same rules first to
// say why a button is off.
@Injectable({ providedIn: 'root' })
export class SalesOrderService {
  private readonly data = inject(DataStore);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly loader = inject(CatalogLoader);
  private readonly cash = inject(CashVoucherService);

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

  get userEmail(): string {
    return this.auth.user()?.email ?? 'unknown';
  }

  lsxOf(orderId: string): ProductionOrder[] {
    return this.data.productionOrders().filter((x) => x.sourceOrderId === orderId);
  }

  // ---------- Pha 1.1: đơn không nạp sẵn ----------

  /** One page of the list, filtered, sorted and totalled on the server. */
  page(q: SalesOrderPageQuery): Promise<SalesOrderPage> {
    return this.api.get<SalesOrderPage>(`/sales-orders/page${pageQuery(q)}`);
  }

  /**
   * An order the app did not load at sign-in (older than 90 days and closed): read it and keep it, so its screens and
   * links work. Resolves undefined when it does not exist or this user may not see it.
   */
  async ensure(id: string): Promise<SalesOrder | undefined> {
    const have = this.data.salesOrders().find((x) => x.id === id);
    if (have) return have;
    // Without order.view the server refuses every read (Nhân viên xưởng on a lệnh): do not ask.
    if (!this.auth.can('order.view')) return undefined;
    try {
      return this.keepOrder(await this.api.get<SalesOrder>(`/sales-orders/${id}`));
    } catch {
      return undefined;
    }
  }

  private readonly asked = new Set<string>();

  /** Several at once (the orders of chuyến, lệnh, phiếu thu…), by id or by mã — one request for those missing. */
  async ensureMany(ids: string[], codes: string[] = []): Promise<void> {
    const have = this.data.salesOrders();
    // Each id / mã is asked once: one the server does not return (gone, or another seller's) is not asked again.
    const missingIds = [...new Set(ids.filter(Boolean))].filter((id) => !have.some((o) => o.id === id) && !this.asked.has(id));
    const missingCodes = [...new Set(codes.filter(Boolean))].filter((c) => !have.some((o) => o.code === c) && !this.asked.has(c));
    if ((!missingIds.length && !missingCodes.length) || !this.auth.can('order.view')) return;
    for (const k of [...missingIds, ...missingCodes]) this.asked.add(k);
    try {
      const rows = await this.api.get<SalesOrder[]>(`/sales-orders${pageQuery({ ids: missingIds, codes: missingCodes })}`);
      if (rows.length) this.data.salesOrders.update((list) => rows.reduce((acc, o) => upsertById(acc, o, true), list));
    } catch {
      /* the screen shows what it has */
    }
  }

  customerStats(): Promise<Record<string, CustomerOrderStats>> {
    return this.api.get<Record<string, CustomerOrderStats>>('/sales-orders/customer-stats');
  }

  find(id: string): SalesOrder {
    const o = this.data.salesOrders().find((x) => x.id === id);
    if (!o) throw new Error(`Không tìm thấy đơn hàng ${id}`);
    return o;
  }

  async create(d: SalesOrderDraft): Promise<SalesOrder> {
    return this.keepOrder(await this.api.post<SalesOrder>('/sales-orders', d));
  }

  async update(id: string, d: SalesOrderDraft): Promise<SalesOrder> {
    const o = this.find(id);
    if (!canEdit(o, this.lsxOf(id))) throw new Error('Đơn đã sản xuất hoặc đã giao, không sửa được.');
    // updatedAt: the server refuses the save if someone else changed the order since it was loaded.
    const saved = this.keepOrder(await this.api.put<SalesOrder>(`/sales-orders/${id}`, { ...d, updatedAt: o.updatedAt }));
    this.data.productionOrders.set(await this.api.get<ProductionOrder[]>('/production-orders')); // draft lệnh follow the lines
    return saved;
  }

  async cancel(id: string, reason: string): Promise<void> {
    if (!canCancel(this.find(id))) return;
    this.keepOrder(await this.api.post<SalesOrder>(`/sales-orders/${id}/cancel`, { reason }));
    this.data.productionOrders.set(await this.api.get<ProductionOrder[]>('/production-orders')); // its open lệnh are cancelled too
  }

  /** Kết thúc đơn: khách không lấy phần còn lại — đơn giữ trạng thái Giao một phần, không giao thêm. */
  async close(id: string): Promise<void> {
    if (!canClose(this.find(id))) return;
    this.keepOrder(await this.api.post<SalesOrder>(`/sales-orders/${id}/close`));
  }

  // ---------- sản xuất ----------

  /** One lệnh sản xuất (Nháp) per thành phẩm line that has none yet. */
  async createProductionOrders(id: string): Promise<ProductionOrder[]> {
    const res = await this.api.post<{ created: ProductionOrder[]; order: SalesOrder }>(`/sales-orders/${id}/production-orders`);
    res.created.forEach((x) => this.keepLsx(x));
    this.keepOrder(res.order);
    return res.created;
  }

  /** Bắt đầu sản xuất: the server xuất vật tư theo định mức từ kho ngầm định của từng vật tư. */
  async startProduction(lsxId: string): Promise<WarehouseVoucher[]> {
    const x = this.data.productionOrders().find((p) => p.id === lsxId);
    if (!x || x.status !== 'NHAP') return [];
    return this.lsxStep(`/production-orders/${lsxId}/start`, lsxId, {});
  }

  /** Định mức của lệnh: bản chụp lúc lập (lệnh cũ không có thì lấy định mức hiện tại). */
  bomOf(x: ProductionOrder): { componentId: string; quantityPerUnit: number }[] {
    return x.bomSnapshot?.length ? x.bomSnapshot : this.data.bomLines().filter((l) => l.finishedProductId === x.productId);
  }

  /** Hoàn tất sản xuất: nhập số thực làm được vào Kho thành phẩm (hàng hỏng làm số này nhỏ hơn số lệnh). */
  async completeProduction(lsxId: string, produced?: number): Promise<WarehouseVoucher[]> {
    const x = this.data.productionOrders().find((p) => p.id === lsxId);
    if (!x || x.status !== 'DANG_SAN_XUAT') return [];
    return this.lsxStep(`/production-orders/${lsxId}/complete`, lsxId, { producedQuantity: produced });
  }

  /** Huỷ lệnh (Nháp hoặc Đang sản xuất). Vật tư đã xuất không tự nhập lại — lập phiếu nhập nếu còn dùng được. */
  async cancelProduction(lsxId: string, reason: string): Promise<void> {
    const x = this.data.productionOrders().find((p) => p.id === lsxId);
    if (!x || (x.status !== 'NHAP' && x.status !== 'DANG_SAN_XUAT')) return;
    const res = await this.api.post<{ productionOrder: ProductionOrder; order: SalesOrder }>(`/production-orders/${lsxId}/cancel`, { reason: reason.trim() || undefined });
    this.keepLsx(res.productionOrder);
    this.keepOrder(res.order);
  }

  /** Bắt đầu / nghiệm thu on the server: the lệnh, its order and the phiếu kho it wrote. */
  private async lsxStep(path: string, lsxId: string, body: object): Promise<WarehouseVoucher[]> {
    const before = this.voucherIds();
    const res = await this.api.post<{ productionOrder: ProductionOrder; order: SalesOrder }>(path, body);
    this.keepLsx(res.productionOrder);
    this.keepOrder(res.order);
    return this.newVouchers(before, (v) => v.productionOrderId === lsxId);
  }

  // ---------- giao hàng ----------

  /**
   * Giao hàng: khách thực nhận (toàn bộ hoặc một phần). The server writes one phiếu xuất kho per warehouse
   * (dịch vụ không xuất kho); công nợ phải thu = receivedValue (gồm thuế, đã trừ chiết khấu theo tỷ lệ);
   * hạn thanh toán = ngày nhận + số ngày được nợ.
   */
  async deliver(id: string, items: DeliveryItem[], date: string, note: string): Promise<WarehouseVoucher[]> {
    if (!canDeliver(this.find(id))) throw new Error('Đơn này không ở trạng thái giao hàng được.');
    const before = this.voucherIds();
    const res = await this.api.post<{ order: SalesOrder; receipts: CashVoucher[] }>(`/sales-orders/${id}/deliver`, {
      items: items.filter((i) => i.quantity > 0), date, note: note || undefined,
    });
    this.keepOrder(res.order);
    if (res.receipts.length) {
      // The server lập the "Thu tiền ngay" phiếu thu: add it to the list and read số dư quỹ again.
      this.data.cashVouchers.update((list) => [...res.receipts, ...list]);
      await this.cash.refreshBalances();
    }
    return this.newVouchers(before, (v) => v.salesOrderId === id);
  }

  // ---------- trả hàng (Pha 1.5) ----------

  /** Nhận hàng trả lại: the server writes the phiếu nhập trả về and lowers công nợ; read the order and stock again. */
  async createReturn(orderId: string, d: SalesReturnDraft): Promise<SalesReturn> {
    const r = await this.api.post<SalesReturn>(`/sales-orders/${orderId}/returns`, d);
    await this.reloadOrder(orderId);
    await this.loader.loadInventory();
    return r;
  }

  /** Huỷ phiếu trả: the phiếu kho is undone and the value counts against công nợ again. */
  async cancelReturn(orderId: string, returnId: string, reason: string): Promise<SalesReturn> {
    const r = await this.api.post<SalesReturn>(`/sales-orders/${orderId}/returns/${returnId}/cancel`, { reason: reason || undefined });
    await this.reloadOrder(orderId);
    await this.loader.loadInventory();
    return r;
  }

  private async reloadOrder(id: string): Promise<void> {
    this.keepOrder(await this.api.get<SalesOrder>(`/sales-orders/${id}`));
  }
}
