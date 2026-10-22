import { Injectable, computed, inject } from '@angular/core';
import { MockDataService } from '../../../core/services/mock-data.service';
import { Tag } from '../../../core/models/domain.models';
import { foldVi } from '../../../shared/format.util';
import { ApiService, upsertById } from '../../../core/api/api.service';
import { CATALOG_FROM_API } from '../../../core/api/api.config';

export type TagDraft = Omit<Tag, 'id' | 'orderCount' | 'customerCount'>;

// All writes for Thẻ đánh dấu. A tag is shared by đơn hàng bán and khách hàng.
@Injectable({ providedIn: 'root' })
export class TagService {
  private readonly api = inject(ApiService);

  constructor(private readonly data: MockDataService) {}

  /** Đơn hàng / khách hàng gắn mỗi thẻ — derived, never stored on the tag. */
  readonly usage = computed(() => {
    const m = new Map<string, { orders: number; customers: number }>();
    const get = (id: string) => m.get(id) ?? (m.set(id, { orders: 0, customers: 0 }), m.get(id)!);
    for (const o of this.data.salesOrders()) for (const t of o.tagIds) get(t).orders++;
    for (const c of this.data.customers()) for (const t of c.tagIds) get(t).customers++;
    return m;
  });

  usageOf(id: string): { orders: number; customers: number } {
    return this.usage().get(id) ?? { orders: 0, customers: 0 };
  }

  duplicateName(name: string, selfId: string | null): Tag | undefined {
    const n = foldVi(name.trim());
    return n ? this.data.tags().find((t) => t.id !== selfId && foldVi(t.name) === n) : undefined;
  }

  async create(d: TagDraft): Promise<Tag> {
    if (CATALOG_FROM_API) return this.keep(await this.api.post<Tag>('/tags', { ...d, name: d.name.trim() }));
    const t: Tag = { ...d, name: d.name.trim(), id: crypto.randomUUID() };
    this.data.tags.update((list) => [...list, t]);
    return t;
  }

  async update(id: string, d: TagDraft): Promise<void> {
    if (CATALOG_FROM_API) {
      this.keep(await this.api.put<Tag>(`/tags/${id}`, { ...d, name: d.name.trim() }));
      return;
    }
    this.data.tags.update((list) => list.map((t) => (t.id === id ? { ...t, ...d, name: d.name.trim() } : t)));
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    if (CATALOG_FROM_API) {
      this.keep(await this.api.patch<Tag>(`/tags/${id}/active`, { isActive }));
      return;
    }
    this.data.tags.update((list) => list.map((t) => (t.id === id ? { ...t, isActive } : t)));
  }

  /** Xoá chỉ khi chưa gắn vào đơn / khách nào — thẻ đang dùng thì Ngừng dùng để giữ lịch sử. */
  async remove(id: string): Promise<void> {
    const u = this.usageOf(id);
    if (u.orders || u.customers) throw new Error('Thẻ đang được dùng — chọn Ngừng dùng thay vì xoá.');
    if (CATALOG_FROM_API) await this.api.delete(`/tags/${id}`);
    this.data.tags.update((list) => list.filter((t) => t.id !== id));
  }

  private keep(t: Tag): Tag {
    this.data.tags.update((list) => upsertById(list, t, true));
    return t;
  }
}
