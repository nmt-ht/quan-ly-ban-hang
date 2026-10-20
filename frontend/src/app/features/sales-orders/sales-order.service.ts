import { Injectable } from '@angular/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { AuthService } from '../../core/services/auth.service';
import {
  ProductionOrder, SalesOrder, SalesOrderLine, StockLevel, WarehouseVoucher, WarehouseVoucherType,
} from '../../core/models/domain.models';
import { isoDay } from '../../shared/period';
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
  lines: SalesOrderLine[];
}

export interface DeliveryItem {
  lineIndex: number;
  quantity: number; // theo ĐVT của dòng
  warehouseId: string; // '' for dịch vụ
}

const FINISHED_GOODS_WAREHOUSE = 'wh-thanhpham';

// All writes for Đơn hàng bán. Against the mock store today; the same methods map 1:1 to the
// backend endpoints later (create/update/cancel/close/production/deliver).
@Injectable({ providedIn: 'root' })
export class SalesOrderService {
  constructor(
    private readonly data: MockDataService,
    private readonly auth: AuthService,
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

  private find(id: string): SalesOrder {
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
    this.data.salesOrders.set(list.some((x) => x.id === o.id) ? list.map((x) => (x.id === o.id ? next : x)) : [next, ...list]);
    return next;
  }

  create(d: SalesOrderDraft): SalesOrder {
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

  update(id: string, d: SalesOrderDraft): SalesOrder {
    const o = this.find(id);
    if (!canEdit(o, this.lsxOf(id))) throw new Error('Đơn đã sản xuất hoặc đã giao, không sửa được.');
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

  cancel(id: string, reason: string): void {
    const o = this.find(id);
    if (!canCancel(o)) return;
    this.data.productionOrders.update((list) =>
      list.map((x) => (x.sourceOrderId === id && (x.status === 'NHAP' || x.status === 'DANG_SAN_XUAT')
        ? { ...x, status: 'HUY', cancelReason: `Huỷ theo đơn ${o.code}` } : x)),
    );
    this.save({ ...o, status: 'HUY', cancelReason: reason || undefined });
  }

  /** Kết thúc đơn: khách không lấy phần còn lại — đơn giữ trạng thái Giao một phần, không giao thêm. */
  close(id: string): void {
    const o = this.find(id);
    if (!canClose(o)) return;
    this.save({ ...o, closedDate: isoDay(new Date()) });
  }

  // ---------- sản xuất ----------

  /** One lệnh sản xuất (Nháp) per thành phẩm line that has none yet. */
  createProductionOrders(id: string): ProductionOrder[] {
    const o = this.find(id);
    const idx = linesNeedingLsx(o, this.lsxOf(id), this.isTp);
    const codes = this.data.productionOrders().map((x) => x.code);
    const created: ProductionOrder[] = idx.map((i) => {
      const l = o.lines[i];
      const code = nextCode(codes, 'LSX');
      codes.push(code);
      return {
        id: crypto.randomUUID(), code, sourceOrderId: o.id, productId: l.productId,
        quantity: round4(l.quantity * lineRatio(l)), status: 'NHAP', createdDate: isoDay(new Date()),
      };
    });
    if (created.length) {
      this.data.productionOrders.update((list) => [...created, ...list]);
      this.save(o);
    }
    return created;
  }

  /** Bắt đầu sản xuất: xuất vật tư theo định mức từ kho ngầm định của từng vật tư. */
  startProduction(lsxId: string): WarehouseVoucher[] {
    const x = this.data.productionOrders().find((p) => p.id === lsxId);
    if (!x || x.status !== 'NHAP') return [];
    const date = isoDay(new Date());
    const byWh = new Map<string, Map<string, number>>();
    for (const b of this.data.bomLines().filter((l) => l.finishedProductId === x.productId)) {
      const wh = this.product(b.componentId)?.defaultWarehouseId ?? this.data.warehouses()[0]?.id ?? '';
      const m = byWh.get(wh) ?? new Map<string, number>();
      m.set(b.componentId, round4((m.get(b.componentId) ?? 0) + b.quantityPerUnit * x.quantity));
      byWh.set(wh, m);
    }
    const vouchers = [...byWh].map(([wh, m]) =>
      this.voucher('XUAT', date, wh, `Xuất vật tư cho ${x.code}`, [...m].map(([productId, q]) => ({ productId, q })), { productionOrderId: x.id }));
    this.post(vouchers);
    this.setLsx(x.id, { status: 'DANG_SAN_XUAT', startDate: date });
    return vouchers;
  }

  /** Hoàn tất sản xuất: nhập thành phẩm vào Kho thành phẩm. */
  completeProduction(lsxId: string): WarehouseVoucher[] {
    const x = this.data.productionOrders().find((p) => p.id === lsxId);
    if (!x || x.status !== 'DANG_SAN_XUAT') return [];
    const date = isoDay(new Date());
    const v = this.voucher('NHAP', date, FINISHED_GOODS_WAREHOUSE, `Nhập thành phẩm từ xưởng: ${x.code}`, [{ productId: x.productId, q: x.quantity }], { productionOrderId: x.id });
    this.post([v]);
    this.setLsx(x.id, { status: 'HOAN_TAT', completeDate: date });
    return [v];
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
  deliver(id: string, items: DeliveryItem[], date: string, note: string): WarehouseVoucher[] {
    const o = this.find(id);
    if (!canDeliver(o)) throw new Error('Đơn này không ở trạng thái giao hàng được.');
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
      this.voucher('XUAT', date, wh, `Xuất kho giao đơn ${o.code}${note ? ` — ${note}` : ''}`, e, { salesOrderId: o.id }));
    this.post(vouchers);
    this.save({ ...o, lines, deliveredDate: date, dueDate: undefined });
    return vouchers;
  }

  // ---------- kho ----------

  /** Build a voucher without a code; post() numbers a batch in sequence. */
  private voucher(
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

  /** Number and store vouchers, then move stock (NHAP +, XUAT −) per (product, warehouse) in base units. */
  private post(vouchers: WarehouseVoucher[]): void {
    if (!vouchers.length) return;
    const codes = this.data.warehouseVouchers().map((v) => v.code);
    for (const v of vouchers) {
      v.code = nextCode(codes, v.type === 'NHAP' ? 'PNK' : 'PXK');
      codes.push(v.code);
    }
    this.data.warehouseVouchers.set([...vouchers, ...this.data.warehouseVouchers()]);
    const levels: StockLevel[] = this.data.stockLevels().map((x) => ({ ...x }));
    for (const v of vouchers) {
      const sign = v.type === 'XUAT' ? -1 : 1;
      for (const l of v.lines ?? []) {
        const lv = levels.find((x) => x.productId === l.productId && x.warehouseId === v.warehouseId);
        if (lv) lv.quantity = round4(lv.quantity + sign * l.delta);
        else levels.push({ productId: l.productId, warehouseId: v.warehouseId, quantity: sign * l.delta, minStock: this.product(l.productId)?.minStock ?? 0 });
      }
    }
    this.data.stockLevels.set(levels);
  }
}
