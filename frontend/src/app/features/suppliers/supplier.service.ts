import { Injectable, computed, inject } from '@angular/core';
import { DataStore } from '../../core/services/data-store.service';
import { DebtService } from '../../core/services/debt.service';
import { Supplier, SupplierProduct } from '../../core/models/domain.models';
import { ApiService, upsertById } from '../../core/api/api.service';

export type SupplierDraft = Omit<Supplier, 'id' | 'code' | 'createdAt' | 'updatedAt'>;

export interface SupplierStats {
  productCount: number;
  orderCount: number;
  payable: number; // còn phải trả (âm = trả trước)
  overdue: number;
}

const EMPTY_STATS: SupplierStats = { productCount: 0, orderCount: 0, payable: 0, overdue: 0 };

// All writes for Nhà cung cấp go through the API.
@Injectable({ providedIn: 'root' })
export class SupplierService {
  private readonly api = inject(ApiService);

  constructor(
    private readonly data: DataStore,
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
    return this.keep(await this.api.post<Supplier>('/suppliers', draft));
  }

  async update(id: string, draft: SupplierDraft): Promise<void> {
    this.keep(await this.api.put<Supplier>(`/suppliers/${id}`, draft));
  }

  /** Ngừng hợp tác is a status change, not a delete: history and payables stay. */
  async setActive(id: string, isActive: boolean): Promise<void> {
    this.keep(await this.api.patch<Supplier>(`/suppliers/${id}/active`, { isActive }));
  }

  /** Thêm lại mặt hàng đã có sẽ cập nhật mã theo NCC và giá mua. */
  async upsertCatalogItem(item: SupplierProduct): Promise<'added' | 'updated'> {
    const { supplierId, productId, ...body } = item;
    const res = await this.api.put<{ result: 'added' | 'updated'; item: SupplierProduct }>(`/suppliers/${supplierId}/products/${productId}`, body);
    this.data.supplierProducts.update((list) =>
      res.result === 'updated' ? list.map((c) => (c.supplierId === supplierId && c.productId === productId ? res.item : c)) : [...list, res.item],
    );
    return res.result;
  }

  async removeCatalogItem(supplierId: string, productId: string): Promise<void> {
    await this.api.delete(`/suppliers/${supplierId}/products/${productId}`);
    this.data.supplierProducts.update((list) => list.filter((c) => !(c.supplierId === supplierId && c.productId === productId)));
  }

  private keep(s: Supplier): Supplier {
    this.data.suppliers.update((list) => upsertById(list, s));
    return s;
  }
}
