import { Injectable, inject, signal } from '@angular/core';
import {
  AppUser, BomLine, CashVoucher, DeliveryTrip, ProductionOrder, PurchaseOrder, PriceList, Promotion, Quotation, SalesOrder, StockLevel, WarehouseVoucher, CashAccount, CashCategory, CompanyInfo, Customer, Product, ProductCategory, Role, Supplier, SupplierProduct, Tag, Vehicle,
  TagColors, Warehouse,
} from '../models/domain.models';
import { DataStore } from '../services/data-store.service';
import { AuthService } from '../services/auth.service';
import { ApiService, errorText } from './api.service';

type DirectoryUser = Pick<AppUser, 'id' | 'name' | 'email' | 'roleId' | 'status'>;

/** Chứng từ loaded at sign-in: those still open plus the last this many days (Pha 1.1). */
export const RECENT_DAYS = 90;

/** A fresh windowed read, plus the older rows read on demand before (they are not in the window). */
function keepOlder<T extends { id: string }>(fresh: T[], had: T[]): T[] {
  const ids = new Set(fresh.map((x) => x.id));
  return [...fresh, ...had.filter((x) => !ids.has(x.id))];
}

/**
 * Loads every danh mục, tồn kho and chứng từ from the API into DataStore's
 * signals once per signed-in user, so the screens keep reading `data.products()` etc. unchanged.
 * Lists a role may not read come back empty.
 */
@Injectable({ providedIn: 'root' })
export class CatalogLoader {
  private readonly api = inject(ApiService);
  private readonly data = inject(DataStore);
  private readonly auth = inject(AuthService);

  readonly status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly error = signal('');
  private pending: Promise<void> | null = null;
  private loadedFor: string | null = null;

  /** Resolves when the catalog of the current user is in place; never rejects (see `status`). */
  ensureLoaded(): Promise<void> {
    const userId = this.auth.user()?.userId ?? null;
    if (userId && userId === this.loadedFor && this.status() === 'ready') return Promise.resolve();
    if (this.pending && userId === this.loadedFor) return this.pending;
    this.loadedFor = userId;
    this.pending = this.load().finally(() => (this.pending = null));
    return this.pending;
  }

  /** Load again (the "Thử lại" of the error banner). */
  reload(): Promise<void> {
    this.loadedFor = null;
    return this.ensureLoaded();
  }

  /**
   * Tồn kho and phiếu kho of the last 90 days (older ones are read when a screen needs them, Pha 1.1); also used to re-read
   * stock after a save elsewhere — older phiếu already read stay.
   */
  async loadInventory(): Promise<void> {
    const [stockLevels, vouchers] = await Promise.all([
      this.api.get<StockLevel[]>('/stock-levels'),
      this.api.get<WarehouseVoucher[]>(`/warehouse-vouchers?recentDays=${RECENT_DAYS}`),
    ]);
    this.data.stockLevels.set(stockLevels);
    this.data.warehouseVouchers.update((had) => keepOlder(vouchers, had));
  }

  private async load(): Promise<void> {
    this.status.set('loading');
    this.error.set('');
    const can = (c: string) => this.auth.can(c);
    try {
      await this.loadInventory();
      // Còn mở + 90 ngày gần nhất, as đơn bán below.
      this.data.purchaseOrders.set(await this.api.get<PurchaseOrder[]>(`/purchase-orders?recentDays=${RECENT_DAYS}`));
      const [orders, lsx] = await Promise.all([
        // Còn mở + 90 ngày gần nhất; đơn cũ hơn đọc theo trang hoặc theo id khi mở (Pha 1.1).
        this.api.get<SalesOrder[]>(`/sales-orders?recentDays=${RECENT_DAYS}`),
        this.api.get<ProductionOrder[]>('/production-orders'),
      ]);
      this.data.salesOrders.set(orders);
      this.data.productionOrders.set(lsx);
      this.data.quotations.set(can('quote.view') ? await this.api.get<Quotation[]>('/quotations') : []);
      this.data.deliveryTrips.set(await this.api.get<DeliveryTrip[]>('/delivery-trips'));
      // Công nợ, the dashboard and the cash-flow report read them too (same rule as the server).
      const canRead = ['voucher.view', 'debt.view', 'report.cashflow', 'report.dashboard'].some((c) => can(c));
      this.data.cashVouchers.set(canRead ? await this.api.get<CashVoucher[]>(`/cash-vouchers?recentDays=${RECENT_DAYS}`) : []);
      const [
        products, bomLines, categories, warehouses, customers, suppliers, supplierProducts, vehicles,
        cashAccounts, cashCategories, tags, company, tagColors, users, roles, priceLists, promotions,
      ] = await Promise.all([
        this.api.get<Product[]>('/products'),
        this.api.get<BomLine[]>('/bom-lines'),
        this.api.get<ProductCategory[]>('/categories'),
        this.api.get<Warehouse[]>('/warehouses'),
        this.api.get<Customer[]>('/customers'),
        this.api.get<Supplier[]>('/suppliers'),
        can('supplier.view') ? this.api.get<SupplierProduct[]>('/supplier-products') : Promise.resolve([]),
        this.api.get<Vehicle[]>('/vehicles'),
        this.api.get<CashAccount[]>('/cash-accounts'),
        this.api.get<CashCategory[]>('/cash-categories'),
        this.api.get<Tag[]>('/tags'),
        this.api.get<CompanyInfo>('/company'),
        this.api.get<TagColors>('/company/display-colors'),
        // Full accounts for Thiết lập › Người dùng; everyone else gets names only.
        can('user.view')
          ? this.api.get<AppUser[]>('/users')
          : this.api.get<DirectoryUser[]>('/users/directory').then((list) => list.map((u): AppUser => ({ ...u, openSessions: 0 }))),
        can('position.view') || can('user.view') ? this.api.get<Role[]>('/roles') : Promise.resolve([]),
        this.api.get<PriceList[]>('/price-lists'),
        this.api.get<Promotion[]>('/promotions'),
      ]);
      const d = this.data;
      d.products.set(products);
      d.bomLines.set(bomLines);
      d.categories.set(categories);
      d.warehouses.set(warehouses);
      d.customers.set(customers);
      d.suppliers.set(suppliers);
      d.supplierProducts.set(supplierProducts);
      d.vehicles.set(vehicles);
      d.cashAccounts.set(cashAccounts);
      d.cashCategories.set(cashCategories);
      d.tags.set(tags);
      d.companyInfo.set(company);
      d.tagColors.set(tagColors);
      d.users.set(users);
      d.roles.set(roles);
      d.priceLists.set(priceLists);
      d.promotions.set(promotions);
      this.status.set('ready');
    } catch (e) {
      this.status.set('error');
      this.error.set(errorText(e));
    }
  }
}
