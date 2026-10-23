import { Injectable, signal } from '@angular/core';
import {
  Product, ProductCategory, Warehouse, StockLevel, WarehouseVoucher, ProductionOrder,
  Supplier, PurchaseOrder, Customer, SalesOrder, DeliveryTrip, Vehicle, CashAccount,
  CashVoucher, Tag, CompanyInfo, Role, PermissionModule, AppUser, BomLine, SupplierProduct, CashCategory, TagColors,
} from '../models/domain.models';
import { PERMISSION_MODULES } from '../data/permission-catalog';

/**
 * The lists the screens read, as the API answered them. CatalogLoader fills them after sign-in and
 * each feature service puts what the server returns after a save back here; nothing is kept in the
 * browser beyond the session.
 */
@Injectable({ providedIn: 'root' })
export class DataStore {
  readonly categories = signal<ProductCategory[]>([]);
  readonly warehouses = signal<Warehouse[]>([]);

  readonly products = signal<Product[]>([]);
  readonly bomLines = signal<BomLine[]>([]);
  readonly stockLevels = signal<StockLevel[]>([]);
  readonly warehouseVouchers = signal<WarehouseVoucher[]>([]);
  readonly productionOrders = signal<ProductionOrder[]>([]);

  readonly suppliers = signal<Supplier[]>([]);
  readonly supplierProducts = signal<SupplierProduct[]>([]);

  readonly purchaseOrders = signal<PurchaseOrder[]>([]);

  readonly customers = signal<Customer[]>([]);

  readonly salesOrders = signal<SalesOrder[]>([]);

  readonly deliveryTrips = signal<DeliveryTrip[]>([]);

  readonly vehicles = signal<Vehicle[]>([]);

  readonly cashAccounts = signal<CashAccount[]>([]);

  readonly cashVouchers = signal<CashVoucher[]>([]);

  readonly cashCategories = signal<CashCategory[]>([]);

  readonly tags = signal<Tag[]>([]);

  readonly companyInfo = signal<CompanyInfo>({ name: '' });

  readonly tagColors = signal<TagColors>({});

  readonly roles = signal<Role[]>([]);

  /** The permission catalog is fixed in code (mirrors the server's), not loaded. */
  readonly permissionModules = signal<PermissionModule[]>(PERMISSION_MODULES);

  readonly users = signal<AppUser[]>([]);
}
