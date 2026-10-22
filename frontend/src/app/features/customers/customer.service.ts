import { Injectable, computed, inject } from '@angular/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { DebtService } from '../../core/services/debt.service';
import { Customer, CustomerAddress } from '../../core/models/domain.models';
import { nextCode } from '../purchase-orders/purchase-order.rules';
import { CUSTOMER_CODE_PREFIX } from './customer.rules';
import { ApiService, upsertById } from '../../core/api/api.service';
import { CATALOG_FROM_API } from '../../core/api/api.config';

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

// All writes for Khách hàng: the API (CATALOG_FROM_API) or, in demo mode, the in-browser store.
@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly api = inject(ApiService);

  constructor(
    private readonly data: MockDataService,
    private readonly debt: DebtService,
  ) {}

  /** Đơn hàng, doanh số, công nợ — derived, never stored on the customer. */
  readonly stats = computed(() => {
    const map = new Map<string, CustomerStats>();
    const get = (id: string) => map.get(id) ?? (map.set(id, { ...EMPTY }), map.get(id)!);
    for (const o of this.data.salesOrders()) {
      const s = get(o.customerId);
      s.orderCount++;
      if (o.status === 'HUY') continue;
      if (o.receivedValue > 0) {
        s.receivedOrders++;
        s.revenue += o.receivedValue;
        const d = (o.deliveredDate ?? o.orderDate).slice(0, 10);
        if (!s.lastPurchase || d > s.lastPurchase) s.lastPurchase = d;
      }
      const done = o.status === 'HOAN_THANH' || o.status === 'TRA_TOAN_BO' || !!o.closedDate;
      if (!done) s.openOrders++;
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
    if (CATALOG_FROM_API) return this.keep(await this.api.post<Customer>('/customers', draft));
    const now = new Date().toISOString();
    const c: Customer = {
      ...draft,
      addresses: normalizeDefault(draft.addresses ?? []),
      id: crypto.randomUUID(),
      code: nextCode(this.data.customers().map((x) => x.code), CUSTOMER_CODE_PREFIX),
      createdAt: now,
      updatedAt: now,
    };
    this.data.customers.update((list) => [c, ...list]);
    return c;
  }

  async update(id: string, draft: CustomerDraft): Promise<void> {
    if (CATALOG_FROM_API) {
      this.keep(await this.api.put<Customer>(`/customers/${id}`, draft));
      return;
    }
    this.patch(id, { ...draft, addresses: normalizeDefault(draft.addresses ?? []) });
  }

  /** Ngừng theo dõi is a status change, not a delete: orders and công nợ stay. */
  async setActive(id: string, isActive: boolean): Promise<void> {
    if (CATALOG_FROM_API) {
      this.keep(await this.api.patch<Customer>(`/customers/${id}/active`, { isActive }));
      return;
    }
    this.patch(id, { isActive });
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
    if (CATALOG_FROM_API) {
      this.keep(await this.api.put<Customer>(`/customers/${customerId}/addresses`, { addresses }));
      return;
    }
    this.patch(customerId, { addresses });
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

  private patch(id: string, changes: Partial<Customer>): void {
    this.find(id);
    const updatedAt = new Date().toISOString();
    this.data.customers.update((list) => list.map((c) => (c.id === id ? { ...c, ...changes, updatedAt } : c)));
  }
}

/** Exactly one default address when there is any: the chosen one, else the first marked, else the first. */
function normalizeDefault(list: CustomerAddress[], preferId?: string): CustomerAddress[] {
  if (!list.length) return [];
  const id = preferId ?? list.find((a) => a.isDefault)?.id ?? list[0].id;
  return list.map((a) => ({ ...a, isDefault: a.id === id }));
}
