import { Injectable, computed, inject } from '@angular/core';
import { DataStore } from '../../../core/services/data-store.service';
import { Tag } from '../../../core/models/domain.models';
import { foldVi } from '../../../shared/format.util';
import { ApiService, upsertById } from '../../../core/api/api.service';

export type TagDraft = Omit<Tag, 'id' | 'orderCount' | 'customerCount'>;

// All writes for Thẻ đánh dấu. A tag is shared by đơn hàng bán and khách hàng.
@Injectable({ providedIn: 'root' })
export class TagService {
  private readonly api = inject(ApiService);

  constructor(private readonly data: DataStore) {}

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
    return this.keep(await this.api.post<Tag>('/tags', { ...d, name: d.name.trim() }));
  }

  async update(id: string, d: TagDraft): Promise<void> {
    this.keep(await this.api.put<Tag>(`/tags/${id}`, { ...d, name: d.name.trim() }));
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    this.keep(await this.api.patch<Tag>(`/tags/${id}/active`, { isActive }));
  }

  /** Xoá chỉ khi chưa gắn vào đơn / khách nào — thẻ đang dùng thì Ngừng dùng để giữ lịch sử. */
  async remove(id: string): Promise<void> {
    const u = this.usageOf(id);
    if (u.orders || u.customers) throw new Error('Thẻ đang được dùng — chọn Ngừng dùng thay vì xoá.');
    await this.api.delete(`/tags/${id}`);
    this.data.tags.update((list) => list.filter((t) => t.id !== id));
  }

  private keep(t: Tag): Tag {
    this.data.tags.update((list) => upsertById(list, t, true));
    return t;
  }
}
