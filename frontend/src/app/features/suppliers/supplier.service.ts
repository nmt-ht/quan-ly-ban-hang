import { Injectable, computed, inject } from '@angular/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { DebtService } from '../../core/services/debt.service';
import { Supplier, SupplierProduct } from '../../core/models/domain.models';
import { nextCode } from '../purchase-orders/purchase-order.rules';
import { SUPPLIER_CODE_PREFIX } from './supplier.rules';
import { ApiService, upsertById } from '../../core/api/api.service';
import { CATALOG_FROM_API } from '../../core/api/api.config';

export type SupplierDraft = Omit<Supplier, 'id' | 'code' | 'createdAt' | 'updatedAt'>;

export interface SupplierStats {
  productCount: number;
  orderCount: number;
  payable: number; // còn phải trả (âm = trả trước)
  overdue: number;
}

const EMPTY_STATS: SupplierStats = { productCount: 0, orderCount: 0, payable: 0, overdue: 0 };

// All writes for Nhà cung cấp: the API (CATALOG_FROM_API) or, in demo mode, the in-browser store.
@Injectable({ providedIn: 'root' })
export class SupplierService {
  private readonly api = inject(ApiService);

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

  async create(draft: SupplierDraft): Promise<Supplier> {
    if (CATALOG_FROM_API) return this.keep(await this.api.post<Supplier>('/suppliers', draft));
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

  async update(id: string, draft: SupplierDraft): Promise<void> {
    if (CATALOG_FROM_API) {
      this.keep(await this.api.put<Supplier>(`/suppliers/${id}`, draft));
      return;
    }
    this.patch(id, { ...draft });
  }

  /** Ngừng hợp tác is a status change, not a delete: history and payables stay. */
  async setActive(id: string, isActive: boolean): Promise<void> {
    if (CATALOG_FROM_API) {
      this.keep(await this.api.patch<Supplier>(`/suppliers/${id}/active`, { isActive }));
      return;
    }
    this.patch(id, { isActive });
  }

  /** Thêm lại mặt hàng đã có sẽ cập nhật mã theo NCC và giá mua. */
  async upsertCatalogItem(item: SupplierProduct): Promise<'added' | 'updated'> {
    if (CATALOG_FROM_API) {
      const { supplierId, productId, ...body } = item;
      const res = await this.api.put<{ result: 'added' | 'updated'; item: SupplierProduct }>(`/suppliers/${supplierId}/products/${productId}`, body);
      this.data.supplierProducts.update((list) =>
        res.result === 'updated' ? list.map((c) => (c.supplierId === supplierId && c.productId === productId ? res.item : c)) : [...list, res.item],
      );
      return res.result;
    }
    const exists = this.data.supplierProducts().some((c) => c.supplierId === item.supplierId && c.productId === item.productId);
    this.data.supplierProducts.update((list) =>
      exists
        ? list.map((c) => (c.supplierId === item.supplierId && c.productId === item.productId ? { ...item } : c))
        : [...list, { ...item }],
    );
    return exists ? 'updated' : 'added';
  }

  async removeCatalogItem(supplierId: string, productId: string): Promise<void> {
    if (CATALOG_FROM_API) await this.api.delete(`/suppliers/${supplierId}/products/${productId}`);
    this.data.supplierProducts.update((list) => list.filter((c) => !(c.supplierId === supplierId && c.productId === productId)));
  }

  private keep(s: Supplier): Supplier {
    this.data.suppliers.update((list) => upsertById(list, s));
    return s;
  }

  private patch(id: string, changes: Partial<Supplier>): void {
    if (!this.data.suppliers().some((s) => s.id === id)) throw new Error(`Không tìm thấy nhà cung cấp ${id}`);
    const updatedAt = new Date().toISOString();
    this.data.suppliers.update((list) => list.map((s) => (s.id === id ? { ...s, ...changes, updatedAt } : s)));
  }
}
