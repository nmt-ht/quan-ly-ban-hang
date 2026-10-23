import { Injectable, computed, inject } from '@angular/core';
import { DataStore } from '../../../core/services/data-store.service';
import { ProductCategory, ProductType } from '../../../core/models/domain.models';
import { foldVi } from '../../../shared/format.util';
import { ApiService, upsertById } from '../../../core/api/api.service';

/** Where a deleted nhóm's products go: another nhóm's id, or 'none' (no nhóm). */
export type MoveTarget = string | 'none';

export interface CategoryUsage {
  total: number;
  byType: Record<ProductType, number>;
}

const EMPTY = (): CategoryUsage => ({ total: 0, byType: { VAT_TU: 0, THANH_PHAM: 0, DICH_VU: 0 } });
const byName = (a: ProductCategory, b: ProductCategory) => a.name.localeCompare(b.name, 'vi');

// All writes for Nhóm hàng (Thiết lập › Nhóm hàng). A nhóm is a plain name; products point at it.
@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly api = inject(ApiService);
  private readonly data = inject(DataStore);

  /** Products per nhóm (key '' = no nhóm), split by Tính chất — derived, never stored on the nhóm. */
  readonly usage = computed(() => {
    const m = new Map<string, CategoryUsage>();
    for (const p of this.data.products()) {
      const k = p.categoryId ?? '';
      const u = m.get(k) ?? (m.set(k, EMPTY()), m.get(k)!);
      u.total++;
      u.byType[p.type]++;
    }
    return m;
  });

  usageOf(id: string | null): CategoryUsage {
    return this.usage().get(id ?? '') ?? EMPTY();
  }

  duplicateName(name: string, selfId: string | null): ProductCategory | undefined {
    const n = foldVi(name.trim());
    return n ? this.data.categories().find((c) => c.id !== selfId && foldVi(c.name) === n) : undefined;
  }

  async create(name: string): Promise<ProductCategory> {
    return this.keep(await this.api.post<ProductCategory>('/categories', { name: name.trim() }));
  }

  async rename(id: string, name: string): Promise<void> {
    this.keep(await this.api.put<ProductCategory>(`/categories/${id}`, { name: name.trim() }));
  }

  /** Deletes a nhóm; its products move to `moveTo` first (required when it has any — the server checks too). */
  async remove(id: string, moveTo: MoveTarget | null): Promise<void> {
    await this.api.delete(`/categories/${id}${moveTo ? `?moveTo=${encodeURIComponent(moveTo)}` : ''}`);
    const to = moveTo && moveTo !== 'none' ? moveTo : undefined;
    this.data.products.update((list) => list.map((p) => (p.categoryId === id ? { ...p, categoryId: to } : p)));
    this.data.categories.update((list) => list.filter((c) => c.id !== id));
  }

  private keep(c: ProductCategory): ProductCategory {
    this.data.categories.update((list) => upsertById(list, c, true).sort(byName));
    return c;
  }
}
