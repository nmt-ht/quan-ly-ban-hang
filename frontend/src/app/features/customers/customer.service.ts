import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { DataStore } from '../../core/services/data-store.service';
import { DebtService } from '../../core/services/debt.service';
import { Customer, CustomerAddress } from '../../core/models/domain.models';
import { ApiService, upsertById } from '../../core/api/api.service';
import { AuthService } from '../../core/services/auth.service';

export type CustomerDraft = Omit<Customer, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'orderCount'>;

export interface CustomerStats {
  orderCount: number; // mọi đơn (kể cả huỷ)
  receivedOrders: number; // đơn khách đã nhận hàng
  revenue: number; // đã mua = tổng giá trị khách thực nhận
  lastPurchase?: string; // ngày nhận / đặt gần nhất của đơn đã nhận
  openOrders: number; // đơn chưa xong (chưa huỷ, chưa giao đủ, chưa kết thúc)
  receivable: number; // số dư phải thu (âm = trả trước)
  overdue: number;
  prepaid: number;
  openItems: number;
}

const EMPTY: CustomerStats = { orderCount: 0, receivedOrders: 0, revenue: 0, openOrders: 0, receivable: 0, overdue: 0, prepaid: 0, openItems: 0 };

// All writes for Khách hàng go through the API.
@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly api = inject(ApiService);

  private readonly auth = inject(AuthService);
  /** Đơn hàng & doanh số per khách over the whole history, from the server (the app holds only recent orders — Pha 1.1). */
  private readonly orderStats = signal<Record<string, Omit<CustomerStats, 'receivable' | 'overdue' | 'prepaid' | 'openItems' | 'lastPurchase'> & { lastPurchase: string | null }>>({});

  constructor(
    private readonly data: DataStore,
    private readonly debt: DebtService,
  ) {
    // Read again whenever an order is saved here (the list in memory changes).
    effect(() => {
      this.data.salesOrders();
      untracked(() => {
        if (!this.auth.can('customer.view')) return;
        this.api.get<Record<string, never>>('/sales-orders/customer-stats').then((x) => this.orderStats.set(x), () => undefined);
      });
    });
  }

  /** Đơn hàng, doanh số, công nợ — derived, never stored on the customer. */
  readonly stats = computed(() => {
    const map = new Map<string, CustomerStats>();
    const get = (id: string) => map.get(id) ?? (map.set(id, { ...EMPTY }), map.get(id)!);
    for (const [id, o] of Object.entries(this.orderStats())) {
      Object.assign(get(id), { ...o, lastPurchase: o.lastPurchase ?? undefined });
    }
    for (const r of this.debt.receivables()) {
      const s = get(r.partnerId);
      s.receivable = r.balance;
      s.overdue = r.overdue;
      s.prepaid = r.prepaid;
      s.openItems = r.items.length;
    }
    return map;
  });

  statsOf(id: string): CustomerStats {
    return this.stats().get(id) ?? EMPTY;
  }

  async create(draft: CustomerDraft): Promise<Customer> {
    return this.keep(await this.api.post<Customer>('/customers', draft));
  }

  async update(id: string, draft: CustomerDraft): Promise<void> {
    this.keep(await this.api.put<Customer>(`/customers/${id}`, draft));
  }

  /** Ngừng theo dõi is a status change, not a delete: orders and công nợ stay. */
  async setActive(id: string, isActive: boolean): Promise<void> {
    this.keep(await this.api.patch<Customer>(`/customers/${id}/active`, { isActive }));
  }

  saveAddress(customerId: string, a: CustomerAddress): Promise<void> {
    const list = this.find(customerId).addresses ?? [];
    const next = list.some((x) => x.id === a.id) ? list.map((x) => (x.id === a.id ? a : x)) : [...list, a];
    return this.setAddresses(customerId, normalizeDefault(next, a.isDefault ? a.id : undefined));
  }

  removeAddress(customerId: string, addressId: string): Promise<void> {
    const c = this.find(customerId);
    return this.setAddresses(customerId, normalizeDefault((c.addresses ?? []).filter((x) => x.id !== addressId)));
  }

  setDefaultAddress(customerId: string, addressId: string): Promise<void> {
    const c = this.find(customerId);
    return this.setAddresses(customerId, normalizeDefault(c.addresses ?? [], addressId));
  }

  private async setAddresses(customerId: string, addresses: CustomerAddress[]): Promise<void> {
    this.keep(await this.api.put<Customer>(`/customers/${customerId}/addresses`, { addresses }));
  }

  /** The saved customer as the server returned it replaces the local copy. */
  private keep(c: Customer): Customer {
    this.data.customers.update((list) => upsertById(list, c));
    return c;
  }

  private find(id: string): Customer {
    const c = this.data.customers().find((x) => x.id === id);
    if (!c) throw new Error(`Không tìm thấy khách hàng ${id}`);
    return c;
  }
}

/** Exactly one default address when there is any: the chosen one, else the first marked, else the first. */
function normalizeDefault(list: CustomerAddress[], preferId?: string): CustomerAddress[] {
  if (!list.length) return [];
  const id = preferId ?? list.find((a) => a.isDefault)?.id ?? list[0].id;
  return list.map((a) => ({ ...a, isDefault: a.id === id }));
}
