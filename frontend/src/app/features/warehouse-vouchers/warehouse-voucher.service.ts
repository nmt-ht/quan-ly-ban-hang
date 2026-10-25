import { Injectable, inject } from '@angular/core';
import { DataStore } from '../../core/services/data-store.service';
import { StockLevel, WarehouseVoucher, WarehouseVoucherType } from '../../core/models/domain.models';
import { round4 } from '../purchase-orders/purchase-order.rules';
import { sourceOf } from './warehouse-voucher.rules';
import { ApiService } from '../../core/api/api.service';
import { onDemand, pageQuery } from '../../core/api/on-demand';

export interface VoucherLineDraft {
  productId: string;
  unitName?: string; // '' / undefined = ĐVT chính
  ratio: number; // ĐVT chính trong 1 unitName
  quantity: number; // theo unitName; kiểm kê: số thực đếm
  unitPrice?: number; // phiếu nhập: theo unitName
  note?: string;
}

export interface VoucherDraft {
  type: WarehouseVoucherType;
  date: string;
  warehouseId: string;
  targetWarehouseId?: string;
  reason?: string;
  note?: string;
  lines: VoucherLineDraft[];
}

/** Bộ lọc của danh sách phiếu kho theo trang (Pha 1.1) — the server's WarehouseVoucherPageQuery. */
export interface WarehouseVoucherPageQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  kind?: string;
  warehouseId?: string;
  productId?: string;
  createdBy?: string[];
  from?: string;
  to?: string;
  cancelled?: boolean;
  sort?: string;
  dir?: 'asc' | 'desc';
}

export interface WarehouseVoucherPage {
  rows: WarehouseVoucher[];
  total: number;
  page: number;
  pageSize: number;
  /** Per loại (Nhập trả về apart), within the chosen kho. */
  kindCounts: Partial<Record<string, number>>;
  /** Per kho, within the chosen loại; allCount is every kho. */
  warehouseCounts: Record<string, number>;
  allCount: number;
  totals: { value: number };
}

/**
 * Phiếu kho lập tay: NHAP +, XUAT −, CHUYEN − kho xuất / + kho nhận, KIEM_KE ± chênh lệch (số đếm − sổ
 * sách lúc lưu). The server numbers the phiếu, computes the kiểm kê difference and moves stock; the
 * returned phiếu moves the local copy the same way. Cancelling applies the same movement in reverse.
 */
@Injectable({ providedIn: 'root' })
export class WarehouseVoucherService {
  private readonly data = inject(DataStore);
  private readonly api = inject(ApiService);

  private readonly older = onDemand(this.api, this.data.warehouseVouchers, '/warehouse-vouchers');

  // ---------- Pha 1.1: phiếu không nạp sẵn ----------

  /** One page of the list, filtered, sorted and counted on the server. */
  page(q: WarehouseVoucherPageQuery): Promise<WarehouseVoucherPage> {
    return this.api.get<WarehouseVoucherPage>(`/warehouse-vouchers/page${pageQuery(q)}`);
  }

  /** Phiếu older than the window, by id. */
  ensureMany(ids: string[]): Promise<void> {
    return this.older.byIds(ids);
  }

  /** Every phiếu of one đơn / lệnh / chuyến (its id, or its mã in the lý do of older phiếu). */
  ensureOf(id: string, code?: string): Promise<void> {
    return this.older.where({ relatedId: id, relatedCode: code });
  }

  /** Số phiếu và số dòng chứng từ của từng kho trên toàn bộ lịch sử. */
  usage(): Promise<Record<string, { vouchers: number; lines: number }>> {
    return this.api.get('/warehouse-vouchers/usage');
  }

  stockAt(productId: string, warehouseId: string): number {
    return this.data.stockLevels().find((s) => s.productId === productId && s.warehouseId === warehouseId)?.quantity ?? 0;
  }

  async create(d: VoucherDraft): Promise<WarehouseVoucher> {
    if (!d.warehouseId) throw new Error('Chọn kho');
    if (d.type === 'CHUYEN' && (!d.targetWarehouseId || d.targetWarehouseId === d.warehouseId)) throw new Error('Kho nhận phải khác kho xuất');
    const lines = d.lines.filter((l) => l.productId && (d.type === 'KIEM_KE' ? l.quantity >= 0 : l.quantity > 0));
    if (!lines.length) throw new Error('Thêm ít nhất một dòng hàng');
    const saved = await this.api.post<WarehouseVoucher>('/warehouse-vouchers', {
      type: d.type, date: d.date, warehouseId: d.warehouseId, targetWarehouseId: d.type === 'CHUYEN' ? d.targetWarehouseId : undefined,
      reason: d.reason, note: d.note,
      lines: lines.map((l) => ({
        productId: l.productId,
        quantity: round4(l.quantity * (l.ratio || 1)),
        ...(l.unitName && l.ratio !== 1 ? { unitName: l.unitName, unitQuantity: l.quantity } : {}),
        ...(d.type === 'NHAP' && l.unitPrice ? { unitPrice: Math.round(l.unitPrice / (l.ratio || 1)) } : {}),
        note: l.note,
      })),
    });
    this.data.warehouseVouchers.update((list) => [saved, ...list]);
    this.applyStock([saved], 1);
    return saved;
  }

  canCancel(v: WarehouseVoucher): boolean {
    return !v.isCancelled && !sourceOf(v);
  }

  /** Huỷ phiếu: hàng quay về như trước khi lập phiếu; phiếu vẫn lưu để đối chiếu. */
  async cancel(id: string, reason: string): Promise<void> {
    const v = this.data.warehouseVouchers().find((x) => x.id === id);
    if (!v || !this.canCancel(v)) throw new Error('Phiếu này lập từ chứng từ khác — huỷ ở chứng từ gốc.');
    const saved = await this.api.post<WarehouseVoucher>(`/warehouse-vouchers/${id}/cancel`, { reason });
    this.applyStock([v], -1);
    this.data.warehouseVouchers.update((list) => list.map((x) => (x.id === id ? saved : x)));
  }

  private applyStock(vouchers: WarehouseVoucher[], sign: 1 | -1): void {
    const levels: StockLevel[] = this.data.stockLevels().map((x) => ({ ...x }));
    const move = (productId: string, warehouseId: string, change: number) => {
      const lv = levels.find((x) => x.productId === productId && x.warehouseId === warehouseId);
      if (lv) lv.quantity = round4(lv.quantity + change);
      else levels.push({ productId, warehouseId, quantity: change, minStock: this.data.products().find((p) => p.id === productId)?.minStock ?? 0 });
    };
    for (const v of vouchers) {
      for (const l of v.lines ?? []) {
        const d = sign * l.delta;
        if (v.type === 'NHAP' || v.type === 'KIEM_KE') move(l.productId, v.warehouseId, d);
        else if (v.type === 'XUAT') move(l.productId, v.warehouseId, -d);
        else {
          move(l.productId, v.warehouseId, -d);
          if (v.targetWarehouseId) move(l.productId, v.targetWarehouseId, d);
        }
      }
    }
    this.data.stockLevels.set(levels);
  }
}
