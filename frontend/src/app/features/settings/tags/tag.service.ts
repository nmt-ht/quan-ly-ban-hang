import { Injectable, computed } from '@angular/core';
import { MockDataService } from '../../../core/services/mock-data.service';
import { Tag } from '../../../core/models/domain.models';
import { foldVi } from '../../../shared/format.util';

export type TagDraft = Omit<Tag, 'id' | 'orderCount' | 'customerCount'>;

// All writes for Thẻ đánh dấu. A tag is shared by đơn hàng bán and khách hàng.
@Injectable({ providedIn: 'root' })
export class TagService {
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

  create(d: TagDraft): Tag {
    const t: Tag = { ...d, name: d.name.trim(), id: crypto.randomUUID() };
    this.data.tags.update((list) => [...list, t]);
    return t;
  }

  update(id: string, d: TagDraft): void {
    this.data.tags.update((list) => list.map((t) => (t.id === id ? { ...t, ...d, name: d.name.trim() } : t)));
  }

  setActive(id: string, isActive: boolean): void {
    this.data.tags.update((list) => list.map((t) => (t.id === id ? { ...t, isActive } : t)));
  }

  /** Xoá chỉ khi chưa gắn vào đơn / khách nào — thẻ đang dùng thì Ngừng dùng để giữ lịch sử. */
  remove(id: string): void {
    const u = this.usageOf(id);
    if (u.orders || u.customers) throw new Error('Thẻ đang được dùng — chọn Ngừng dùng thay vì xoá.');
    this.data.tags.update((list) => list.filter((t) => t.id !== id));
  }
}
