import { Injectable, signal } from '@angular/core';
import {
  Product, ProductCategory, Warehouse, StockLevel, WarehouseVoucher, ProductionOrder,
  Supplier, PurchaseOrder, Customer, SalesOrder, DeliveryTrip, Vehicle, CashAccount,
  CashVoucher, Tag, CompanyInfo, Role, PermissionModule, AppUser, BomLine, SupplierProduct, CashCategory
} from '../models/domain.models';
import {
  DEMO_PRODUCTS, DEMO_BOM_LINES, DEMO_STOCK_LEVELS, DEMO_WAREHOUSE_VOUCHERS, DEMO_PRODUCTION_ORDERS, DEMO_SUPPLIERS, DEMO_SUPPLIER_PRODUCTS,
  DEMO_PURCHASE_ORDERS, DEMO_CUSTOMERS, DEMO_SALES_ORDERS, DEMO_DELIVERY_TRIPS, DEMO_VEHICLES,
  DEMO_CASH_ACCOUNTS, DEMO_CASH_VOUCHERS, DEMO_TAGS, DEMO_USERS, DEMO_ROLE_USER_COUNT,
} from '../data/demo-data';
import { DEFAULT_CASH_CATEGORIES } from '../../features/cash-vouchers/cash-voucher.rules';
import { loadCompany } from './company.storage';
import { PERMISSION_MODULES } from '../data/permission-catalog';
import { grantsFor } from '../../features/settings/roles-permissions/role.rules';
import { CATALOG_FROM_API } from '../api/api.config';

// Danh mục start empty when they come from the API (CatalogLoader fills them after sign-in);
// the demo lists stay for demo mode and for the modules not yet on the API.
const demo = <T>(rows: T[]): T[] => (CATALOG_FROM_API ? [] : rows);

// Dữ liệu GIẢ (xem core/data/demo-data.ts, sinh bởi tools/gen-demo-data.mjs) — chỉ để thử giao diện.
@Injectable({ providedIn: 'root' })
export class MockDataService {
  readonly categories = signal<ProductCategory[]>(demo([
    { id: 'cat-hh', name: 'HH' },
    { id: 'cat-khung', name: 'Khung tranh' },
    { id: 'cat-kinh', name: 'Kính - Mica - Hậu' },
    { id: 'cat-nep', name: 'Nẹp trang trí' },
    { id: 'cat-nhom', name: 'Nhôm' },
    { id: 'cat-nvl', name: 'NVL' },
    { id: 'cat-pk', name: 'Phụ kiện' },
    { id: 'cat-tp', name: 'TP' },
  ]));

  readonly warehouses = signal<Warehouse[]>(demo([
    { id: 'wh-ninhtrang', name: 'Kho Ninh Trang' },
    { id: 'wh-phukien', name: 'Kho phụ kiện' },
    { id: 'wh-thanhpham', name: 'Kho thành phẩm' },
    { id: 'wh-vattu', name: 'Kho vật tư hàng hoá' },
  ]));

  readonly products = signal<Product[]>(demo(DEMO_PRODUCTS));
  readonly bomLines = signal<BomLine[]>(demo(DEMO_BOM_LINES));
  readonly stockLevels = signal<StockLevel[]>(DEMO_STOCK_LEVELS);
  readonly warehouseVouchers = signal<WarehouseVoucher[]>(DEMO_WAREHOUSE_VOUCHERS);
  readonly productionOrders = signal<ProductionOrder[]>(DEMO_PRODUCTION_ORDERS);

  readonly suppliers = signal<Supplier[]>(demo(DEMO_SUPPLIERS));
  readonly supplierProducts = signal<SupplierProduct[]>(demo(DEMO_SUPPLIER_PRODUCTS));

  readonly purchaseOrders = signal<PurchaseOrder[]>(DEMO_PURCHASE_ORDERS);

  readonly customers = signal<Customer[]>(demo(DEMO_CUSTOMERS));

  readonly salesOrders = signal<SalesOrder[]>(DEMO_SALES_ORDERS);

  readonly deliveryTrips = signal<DeliveryTrip[]>(DEMO_DELIVERY_TRIPS);

  readonly vehicles = signal<Vehicle[]>(demo(DEMO_VEHICLES));

  readonly cashAccounts = signal<CashAccount[]>(demo(DEMO_CASH_ACCOUNTS));

  readonly cashVouchers = signal<CashVoucher[]>(DEMO_CASH_VOUCHERS);

  readonly cashCategories = signal<CashCategory[]>(demo(DEFAULT_CASH_CATEGORIES));

  readonly tags = signal<Tag[]>(demo(DEMO_TAGS));

  // Edits in Thiết lập › Thông tin công ty persist in this browser (see company.storage.ts).
  readonly companyInfo = signal<CompanyInfo>(CATALOG_FROM_API ? { name: '' } : loadCompany({
    name: 'Công ty Ninh Trang',
    taxCode: '0301234567',
    phone: '0912345678',
    email: 'lienhe@congty.vn',
    website: 'congty.vn',
  }));

  readonly roles = signal<Role[]>(demo([
    { id: 'role-ceo', name: 'CEO', description: 'Toàn quyền hệ thống. Chức vụ hệ thống — không xoá, không gỡ quyền được.', isSystem: true, userCount: DEMO_ROLE_USER_COUNT['role-ceo'] ?? 0, permissionCount: 98, totalPermissionCount: 98, isActive: true, permissions: grantsFor('role-ceo') },
    { id: 'role-manager', name: 'Quản lý', description: 'Duyệt đơn, duyệt lệnh sản xuất, xem toàn bộ báo cáo. Xem được giá vốn.', isSystem: false, userCount: DEMO_ROLE_USER_COUNT['role-manager'] ?? 0, permissionCount: 89, totalPermissionCount: 98, isActive: true, permissions: grantsFor('role-manager') },
    { id: 'role-accountant', name: 'Kế toán', description: 'Phiếu thu/chi, công nợ, đối trừ, báo cáo tài chính. Xem được giá vốn.', isSystem: false, userCount: DEMO_ROLE_USER_COUNT['role-accountant'] ?? 0, permissionCount: 47, totalPermissionCount: 98, isActive: true, permissions: grantsFor('role-accountant') },
    { id: 'role-sale', name: 'Sale', description: 'Chăm sóc khách, chốt đơn — người đứng tên Người bán trên đơn. KHÔNG xem được giá vốn.', isSystem: false, userCount: DEMO_ROLE_USER_COUNT['role-sale'] ?? 0, permissionCount: 16, totalPermissionCount: 98, isActive: true, permissions: grantsFor('role-sale') },
    { id: 'role-thukho', name: 'Thủ kho', description: 'Phiếu nhập/xuất kho, kiểm kê, chuyển kho. KHÔNG thấy giá nhập và giá vốn.', isSystem: false, userCount: DEMO_ROLE_USER_COUNT['role-thukho'] ?? 0, permissionCount: 19, totalPermissionCount: 98, isActive: true, permissions: grantsFor('role-thukho') },
    { id: 'role-giaohang', name: 'Nhân viên giao hàng', description: 'Xem đơn được giao, chốt giao nhận, nhập số lượng khách thực nhận.', isSystem: false, userCount: DEMO_ROLE_USER_COUNT['role-giaohang'] ?? 0, permissionCount: 6, totalPermissionCount: 98, isActive: true, permissions: grantsFor('role-giaohang') },
    { id: 'role-xuong', name: 'Nhân viên xưởng', description: 'Cập nhật tiến độ lệnh sản xuất được giao.', isSystem: false, userCount: DEMO_ROLE_USER_COUNT['role-xuong'] ?? 0, permissionCount: 5, totalPermissionCount: 98, isActive: true, permissions: grantsFor('role-xuong') },
  ]));

  readonly permissionModules = signal<PermissionModule[]>(PERMISSION_MODULES);

  readonly users = signal<AppUser[]>(demo(DEMO_USERS));
}
