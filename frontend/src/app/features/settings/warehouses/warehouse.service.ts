import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { DataStore } from '../../../core/services/data-store.service';
import { CostService } from '../../../core/services/cost.service';
import { Warehouse } from '../../../core/models/domain.models';
import { foldVi } from '../../../shared/format.util';
import { ApiService, upsertById } from '../../../core/api/api.service';

export interface WarehouseUsage {
  /** Mặt hàng with a non-zero tồn here. */
  items: number;
  /** Tồn × giá vốn ước tính (negative tồn counts 0, as on Tồn kho). */
  value: number;
  /** Phiếu kho from or into this kho. */
  vouchers: number;
  /** Mặt hàng that use it as kho ngầm định. */
  defaults: number;
  /** Lines of đơn nhập / đơn bán / chuyến giao hàng that name it. */
  lines: number;
}

/** A user who may be thủ kho: active, with a chức vụ that lập phiếu kho or kiểm kê (server: KEEPER_PERMISSIONS). */
export interface KeeperCandidate {
  id: string;
  name: string;
  roleName: string;
  phone?: string;
}

/** What the Thêm / Sửa kho form sends. */
export interface WarehouseDraft {
  name: string;
  address?: string;
  phone?: string;
  managerId?: string;
  note?: string;
  isActive: boolean;
}

const EMPTY = (): WarehouseUsage => ({ items: 0, value: 0, vouchers: 0, defaults: 0, lines: 0 });
const byName = (a: Warehouse, b: Warehouse) => a.name.localeCompare(b.name, 'vi');

// All writes for Kho (Thiết lập › Kho). A kho with history is only renamed; an unused one may be deleted.
@Injectable({ providedIn: 'root' })
export class WarehouseService {
  private readonly api = inject(ApiService);
  private readonly data = inject(DataStore);
  private readonly cost = inject(CostService);
  /** Phiếu kho and lines of đơn / chuyến per kho over the whole history, from the server (Pha 1.1). */
  private readonly history = signal<Record<string, { vouchers: number; lines: number }>>({});

  constructor() {
    // Read again whenever a chứng từ is saved here (the lists in memory change).
    effect(() => {
      this.data.warehouseVouchers();
      this.data.purchaseOrders();
      this.data.salesOrders();
      this.data.deliveryTrips();
      untracked(() => this.api.get<Record<string, { vouchers: number; lines: number }>>('/warehouse-vouchers/usage').then((x) => this.history.set(x), () => undefined));
    });
  }

  readonly usage = computed(() => {
    const m = new Map<string, WarehouseUsage>();
    const get = (id: string | undefined) => (id ? (m.get(id) ?? (m.set(id, EMPTY()), m.get(id)!)) : null);
    for (const s of this.data.stockLevels()) {
      const u = get(s.warehouseId)!;
      if (s.quantity !== 0) u.items++;
      u.value += Math.round(Math.max(0, s.quantity) * this.cost.costOf(s.productId));
    }
    for (const [id, h] of Object.entries(this.history())) {
      const u = get(id)!;
      u.vouchers = h.vouchers;
      u.lines = h.lines;
    }
    for (const p of this.data.products()) { const u = get(p.defaultWarehouseId); if (u) u.defaults++; }
    return m;
  });

  usageOf(id: string): WarehouseUsage {
    return this.usage().get(id) ?? EMPTY();
  }

  /** Has history (a voucher, an order line or tồn): keep it so stock history stays whole — the server checks too. */
  inUse(id: string): boolean {
    const u = this.usageOf(id);
    return u.vouchers > 0 || u.lines > 0 || u.items > 0;
  }

  duplicateName(name: string, selfId: string | null): Warehouse | undefined {
    const n = foldVi(name.trim());
    return n ? this.data.warehouses().find((w) => w.id !== selfId && foldVi(w.name) === n) : undefined;
  }

  async create(d: WarehouseDraft): Promise<Warehouse> {
    return this.keep(await this.api.post<Warehouse>('/warehouses', clean(d)));
  }

  async update(id: string, d: WarehouseDraft): Promise<Warehouse> {
    return this.keep(await this.api.put<Warehouse>(`/warehouses/${id}`, clean(d)));
  }

  managerCandidates(): Promise<KeeperCandidate[]> {
    return this.api.get<KeeperCandidate[]>('/warehouses/manager-candidates');
  }

  /** Ngừng dùng / Dùng lại. */
  async setActive(id: string, isActive: boolean): Promise<Warehouse> {
    return this.keep(await this.api.patch<Warehouse>(`/warehouses/${id}/active`, { isActive }));
  }

  async remove(id: string): Promise<void> {
    await this.api.delete(`/warehouses/${id}`);
    this.data.products.update((list) => list.map((p) => (p.defaultWarehouseId === id ? { ...p, defaultWarehouseId: undefined } : p)));
    this.data.stockLevels.update((list) => list.filter((s) => s.warehouseId !== id));
    this.data.warehouses.update((list) => list.filter((w) => w.id !== id));
  }

  private keep(w: Warehouse): Warehouse {
    this.data.warehouses.update((list) => upsertById(list, w, true).sort(byName));
    return w;
  }
}

function clean(d: WarehouseDraft): WarehouseDraft {
  const t = (v?: string) => v?.trim() || undefined;
  return { name: d.name.trim(), address: t(d.address), phone: t(d.phone), managerId: t(d.managerId), note: t(d.note), isActive: d.isActive };
}
