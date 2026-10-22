import { Injectable, inject, signal } from '@angular/core';
import {
  AppUser, BomLine, ProductionOrder, PurchaseOrder, SalesOrder, StockLevel, WarehouseVoucher, CashAccount, CashCategory, CompanyInfo, Customer, Product, ProductCategory, Role, Supplier, SupplierProduct, Tag, Vehicle,
  Warehouse,
} from '../models/domain.models';
import { MockDataService } from '../services/mock-data.service';
import { AuthService } from '../services/auth.service';
import { ApiService, errorText } from './api.service';
import { CATALOG_FROM_API, INVENTORY_FROM_API, PURCHASING_FROM_API, SALES_FROM_API } from './api.config';

type DirectoryUser = Pick<AppUser, 'id' | 'name' | 'email' | 'roleId' | 'status'>;

/**
 * Loads every danh mục (and, from Đợt 2, tồn kho and phiếu kho) from the API into MockDataService's
 * signals once per signed-in user, so the screens keep reading `data.products()` etc. unchanged.
 * Lists a role may not read come back empty.
 */
@Injectable({ providedIn: 'root' })
export class CatalogLoader {
  private readonly api = inject(ApiService);
  private readonly data = inject(MockDataService);
  private readonly auth = inject(AuthService);

  readonly status = signal<'idle' | 'loading' | 'ready' | 'error'>(CATALOG_FROM_API || INVENTORY_FROM_API ? 'idle' : 'ready');
  readonly error = signal('');
  private pending: Promise<void> | null = null;
  private loadedFor: string | null = null;

  /** Resolves when the catalog of the current user is in place; never rejects (see `status`). */
  ensureLoaded(): Promise<void> {
    if (!CATALOG_FROM_API && !INVENTORY_FROM_API) return Promise.resolve();
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

  /** Tồn kho and phiếu kho; also used to re-read stock after a save elsewhere. */
  async loadInventory(): Promise<void> {
    const [stockLevels, vouchers] = await Promise.all([
      this.api.get<StockLevel[]>('/stock-levels'),
      this.api.get<WarehouseVoucher[]>('/warehouse-vouchers'),
    ]);
    this.data.stockLevels.set(stockLevels);
    this.data.warehouseVouchers.set(vouchers);
  }

  private async load(): Promise<void> {
    this.status.set('loading');
    this.error.set('');
    const can = (c: string) => this.auth.can(c);
    try {
      if (INVENTORY_FROM_API) await this.loadInventory();
      if (PURCHASING_FROM_API) this.data.purchaseOrders.set(await this.api.get<PurchaseOrder[]>('/purchase-orders'));
      if (SALES_FROM_API) {
        const [orders, lsx] = await Promise.all([
          this.api.get<SalesOrder[]>('/sales-orders'),
          this.api.get<ProductionOrder[]>('/production-orders'),
        ]);
        this.data.salesOrders.set(orders);
        this.data.productionOrders.set(lsx);
      }
      if (!CATALOG_FROM_API) {
        this.status.set('ready');
        return;
      }
      const [
        products, bomLines, categories, warehouses, customers, suppliers, supplierProducts, vehicles,
        cashAccounts, cashCategories, tags, company, users, roles,
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
        // Full accounts for Thiết lập › Người dùng; everyone else gets names only.
        can('user.view')
          ? this.api.get<AppUser[]>('/users')
          : this.api.get<DirectoryUser[]>('/users/directory').then((list) => list.map((u): AppUser => ({ ...u, openSessions: 0 }))),
        can('position.view') || can('user.view') ? this.api.get<Role[]>('/roles') : Promise.resolve([]),
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
      d.users.set(users);
      d.roles.set(roles);
      this.status.set('ready');
    } catch (e) {
      this.status.set('error');
      this.error.set(errorText(e));
    }
  }
}
