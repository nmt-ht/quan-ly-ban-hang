import { Injectable, computed } from '@angular/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { DebtService } from '../../core/services/debt.service';
import { Supplier, SupplierProduct } from '../../core/models/domain.models';
import { nextCode } from '../purchase-orders/purchase-order.rules';
import { SUPPLIER_CODE_PREFIX } from './supplier.rules';

export type SupplierDraft = Omit<Supplier, 'id' | 'code' | 'createdAt' | 'updatedAt'>;

export interface SupplierStats {
  productCount: number;
  orderCount: number;
  payable: number; // còn phải trả (âm = trả trước)
  overdue: number;
}

const EMPTY_STATS: SupplierStats = { productCount: 0, orderCount: 0, payable: 0, overdue: 0 };

// All writes for Nhà cung cấp. Against the mock store today; maps 1:1 to backend endpoints later.
@Injectable({ providedIn: 'root' })
export class SupplierService {
  constructor(
    private readonly data: MockDataService,
    private readonly debt: DebtService,
  ) {}

  /** Mặt hàng (danh mục theo NCC), số đơn nhập, công nợ — derived, never stored on the supplier. */
  readonly stats = computed(() => {
    const map = new Map<string, SupplierStats>();
    const get = (id: string) => map.get(id) ?? (map.set(id, { ...EMPTY_STATS }), map.get(id)!);
    for (const c of this.data.supplierProducts()) get(c.supplierId).productCount++;
    for (const o of this.data.purchaseOrders()) get(o.supplierId).orderCount++;
    for (const r of this.debt.payables()) {
      const s = get(r.partnerId);
      s.payable = r.balance;
      s.overdue = r.overdue;
    }
    return map;
  });

  statsOf(id: string): SupplierStats {
    return this.stats().get(id) ?? EMPTY_STATS;
  }

  create(draft: SupplierDraft): Supplier {
    const now = new Date().toISOString();
    const supplier: Supplier = {
      ...draft,
      id: crypto.randomUUID(),
      code: nextCode(this.data.suppliers().map((s) => s.code), SUPPLIER_CODE_PREFIX),
      createdAt: now,
      updatedAt: now,
    };
    this.data.suppliers.update((list) => [supplier, ...list]);
    return supplier;
  }

  update(id: string, draft: SupplierDraft): void {
    this.patch(id, { ...draft });
  }

  /** Ngừng hợp tác is a status change, not a delete: history and payables stay. */
  setActive(id: string, isActive: boolean): void {
    this.patch(id, { isActive });
  }

  /** Thêm lại mặt hàng đã có sẽ cập nhật mã theo NCC và giá mua. */
  upsertCatalogItem(item: SupplierProduct): 'added' | 'updated' {
    const exists = this.data.supplierProducts().some((c) => c.supplierId === item.supplierId && c.productId === item.productId);
    this.data.supplierProducts.update((list) =>
      exists
        ? list.map((c) => (c.supplierId === item.supplierId && c.productId === item.productId ? { ...item } : c))
        : [...list, { ...item }],
    );
    return exists ? 'updated' : 'added';
  }

  removeCatalogItem(supplierId: string, productId: string): void {
    this.data.supplierProducts.update((list) => list.filter((c) => !(c.supplierId === supplierId && c.productId === productId)));
  }

  private patch(id: string, changes: Partial<Supplier>): void {
    if (!this.data.suppliers().some((s) => s.id === id)) throw new Error(`Không tìm thấy nhà cung cấp ${id}`);
    const updatedAt = new Date().toISOString();
    this.data.suppliers.update((list) => list.map((s) => (s.id === id ? { ...s, ...changes, updatedAt } : s)));
  }
}
