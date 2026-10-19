import { Injectable, signal } from '@angular/core';
import {
  Product, ProductCategory, Warehouse, StockLevel, WarehouseVoucher, ProductionOrder,
  Supplier, PurchaseOrder, Customer, SalesOrder, DeliveryTrip, Vehicle, CashAccount,
  CashVoucher, Tag, CompanyInfo, Role, PermissionModule, AppUser
} from '../models/domain.models';
import {
  DEMO_PRODUCTS, DEMO_STOCK_LEVELS, DEMO_WAREHOUSE_VOUCHERS, DEMO_PRODUCTION_ORDERS, DEMO_SUPPLIERS,
  DEMO_PURCHASE_ORDERS, DEMO_CUSTOMERS, DEMO_SALES_ORDERS, DEMO_DELIVERY_TRIPS, DEMO_VEHICLES,
  DEMO_CASH_ACCOUNTS, DEMO_CASH_VOUCHERS, DEMO_TAGS, DEMO_USERS, DEMO_ROLE_USER_COUNT,
} from '../data/demo-data';

// Dữ liệu GIẢ (xem core/data/demo-data.ts, sinh bởi tools/gen-demo-data.mjs) — chỉ để thử giao diện.
@Injectable({ providedIn: 'root' })
export class MockDataService {
  readonly categories = signal<ProductCategory[]>([
    { id: 'cat-hh', name: 'HH' },
    { id: 'cat-khung', name: 'Khung tranh' },
    { id: 'cat-kinh', name: 'Kính - Mica - Hậu' },
    { id: 'cat-nep', name: 'Nẹp trang trí' },
    { id: 'cat-nhom', name: 'Nhôm' },
    { id: 'cat-nvl', name: 'NVL' },
    { id: 'cat-pk', name: 'Phụ kiện' },
    { id: 'cat-tp', name: 'TP' },
  ]);

  readonly warehouses = signal<Warehouse[]>([
    { id: 'wh-ninhtrang', name: 'Kho Ninh Trang' },
    { id: 'wh-phukien', name: 'Kho phụ kiện' },
    { id: 'wh-thanhpham', name: 'Kho thành phẩm' },
    { id: 'wh-vattu', name: 'Kho vật tư hàng hoá' },
  ]);

  readonly products = signal<Product[]>(DEMO_PRODUCTS);
  readonly stockLevels = signal<StockLevel[]>(DEMO_STOCK_LEVELS);
  readonly warehouseVouchers = signal<WarehouseVoucher[]>(DEMO_WAREHOUSE_VOUCHERS);
  readonly productionOrders = signal<ProductionOrder[]>(DEMO_PRODUCTION_ORDERS);

  readonly suppliers = signal<Supplier[]>(DEMO_SUPPLIERS);

  readonly purchaseOrders = signal<PurchaseOrder[]>(DEMO_PURCHASE_ORDERS);

  readonly customers = signal<Customer[]>(DEMO_CUSTOMERS);

  readonly salesOrders = signal<SalesOrder[]>(DEMO_SALES_ORDERS);

  readonly deliveryTrips = signal<DeliveryTrip[]>(DEMO_DELIVERY_TRIPS);

  readonly vehicles = signal<Vehicle[]>(DEMO_VEHICLES);

  readonly cashAccounts = signal<CashAccount[]>(DEMO_CASH_ACCOUNTS);

  readonly cashVouchers = signal<CashVoucher[]>(DEMO_CASH_VOUCHERS);

  readonly tags = signal<Tag[]>(DEMO_TAGS);

  readonly companyInfo = signal<CompanyInfo>({
    name: 'Công ty Ninh Trang',
    taxCode: '0301234567',
    phone: '0912345678',
    email: 'lienhe@congty.vn',
    website: 'congty.vn',
  });

  readonly roles = signal<Role[]>([
    { id: 'role-ceo', name: 'CEO', description: 'Toàn quyền hệ thống. Chức vụ hệ thống — không xoá, không gỡ quyền được.', isSystem: true, userCount: DEMO_ROLE_USER_COUNT['role-ceo'] ?? 0, permissionCount: 98, totalPermissionCount: 98, isActive: true },
    { id: 'role-manager', name: 'Quản lý', description: 'Duyệt đơn, duyệt lệnh sản xuất, xem toàn bộ báo cáo. Xem được giá vốn.', isSystem: false, userCount: DEMO_ROLE_USER_COUNT['role-manager'] ?? 0, permissionCount: 89, totalPermissionCount: 98, isActive: true },
    { id: 'role-accountant', name: 'Kế toán', description: 'Phiếu thu/chi, công nợ, đối trừ, báo cáo tài chính. Xem được giá vốn.', isSystem: false, userCount: DEMO_ROLE_USER_COUNT['role-accountant'] ?? 0, permissionCount: 47, totalPermissionCount: 98, isActive: true },
    { id: 'role-sale', name: 'Sale', description: 'Chăm sóc khách, chốt đơn — người đứng tên Người bán trên đơn. KHÔNG xem được giá vốn.', isSystem: false, userCount: DEMO_ROLE_USER_COUNT['role-sale'] ?? 0, permissionCount: 16, totalPermissionCount: 98, isActive: true },
    { id: 'role-thukho', name: 'Thủ kho', description: 'Phiếu nhập/xuất kho, kiểm kê, chuyển kho. KHÔNG thấy giá nhập và giá vốn.', isSystem: false, userCount: DEMO_ROLE_USER_COUNT['role-thukho'] ?? 0, permissionCount: 19, totalPermissionCount: 98, isActive: true },
    { id: 'role-giaohang', name: 'Nhân viên giao hàng', description: 'Xem đơn được giao, chốt giao nhận, nhập số lượng khách thực nhận.', isSystem: false, userCount: DEMO_ROLE_USER_COUNT['role-giaohang'] ?? 0, permissionCount: 6, totalPermissionCount: 98, isActive: true },
    { id: 'role-xuong', name: 'Nhân viên xưởng', description: 'Cập nhật tiến độ lệnh sản xuất được giao.', isSystem: false, userCount: DEMO_ROLE_USER_COUNT['role-xuong'] ?? 0, permissionCount: 5, totalPermissionCount: 98, isActive: true },
  ]);

  readonly permissionModules = signal<PermissionModule[]>([
    { key: 'user', label: 'Người dùng', permissions: [
      { code: 'user.view', label: 'Xem người dùng' },
      { code: 'user.create', label: 'Thêm người dùng' },
      { code: 'user.update', label: 'Sửa người dùng' },
      { code: 'user.delete', label: 'Xoá người dùng' },
      { code: 'user.reset_password', label: 'Đặt lại mật khẩu' },
    ]},
    { key: 'position', label: 'Chức vụ', permissions: [
      { code: 'position.view', label: 'Xem chức vụ' },
      { code: 'position.create', label: 'Thêm chức vụ' },
      { code: 'position.update', label: 'Sửa chức vụ' },
      { code: 'position.delete', label: 'Xoá chức vụ' },
      { code: 'position.assign_permission', label: 'Phân quyền cho chức vụ' },
    ]},
    { key: 'company', label: 'Công ty', permissions: [
      { code: 'company.view', label: 'Xem thông tin công ty' },
      { code: 'company.update', label: 'Sửa thông tin công ty' },
    ]},
    { key: 'category', label: 'Nhóm hàng', permissions: [
      { code: 'category.view', label: 'Xem nhóm hàng' },
      { code: 'category.create', label: 'Thêm nhóm hàng' },
      { code: 'category.update', label: 'Sửa nhóm hàng' },
      { code: 'category.delete', label: 'Xoá nhóm hàng' },
    ]},
    { key: 'warehouse', label: 'Kho', permissions: [
      { code: 'warehouse.view', label: 'Xem kho' },
      { code: 'warehouse.create', label: 'Thêm kho' },
      { code: 'warehouse.update', label: 'Sửa kho' },
      { code: 'warehouse.delete', label: 'Xoá kho' },
    ]},
    { key: 'tag', label: 'Thẻ', permissions: [
      { code: 'tag.view', label: 'Xem thẻ' },
      { code: 'tag.manage', label: 'Quản lý thẻ' },
    ]},
    { key: 'product', label: 'Hàng hoá', permissions: [
      { code: 'product.view', label: 'Xem hàng hoá' },
      { code: 'product.create', label: 'Thêm hàng hoá' },
      { code: 'product.update', label: 'Sửa hàng hoá' },
      { code: 'product.delete', label: 'Ngừng kinh doanh hàng hoá' },
      { code: 'product.import', label: 'Nhập hàng hoá từ Excel' },
      { code: 'product.export', label: 'Xuất danh mục hàng hoá' },
      { code: 'product.manage_image', label: 'Quản lý ảnh hàng hoá' },
    ]},
    { key: 'price', label: 'Giá', permissions: [
      { code: 'product.update_price', label: 'Sửa giá bán' },
      { code: 'product.view_cost_price', label: 'Xem giá vốn' },
    ]},
    { key: 'bom', label: 'Định mức', permissions: [
      { code: 'bom.view', label: 'Xem định mức' },
      { code: 'bom.manage', label: 'Khai báo định mức' },
    ]},
    { key: 'customer', label: 'Khách hàng', permissions: [
      { code: 'customer.view', label: 'Xem khách hàng' },
      { code: 'customer.create', label: 'Thêm khách hàng' },
      { code: 'customer.update', label: 'Sửa khách hàng' },
      { code: 'customer.delete', label: 'Ngừng theo dõi khách hàng' },
    ]},
    { key: 'supplier', label: 'Nhà cung cấp', permissions: [
      { code: 'supplier.view', label: 'Xem nhà cung cấp' },
      { code: 'supplier.create', label: 'Thêm nhà cung cấp' },
      { code: 'supplier.update', label: 'Sửa nhà cung cấp' },
      { code: 'supplier.delete', label: 'Ngừng hợp tác nhà cung cấp' },
      { code: 'supplier.manage_product', label: 'Quản lý danh mục hàng của NCC' },
    ]},
    { key: 'stock', label: 'Tồn kho', permissions: [
      { code: 'stock.view', label: 'Xem tồn kho' },
      { code: 'stock.view_value', label: 'Xem giá trị tồn kho' },
    ]},
    { key: 'stock_voucher', label: 'Phiếu kho', permissions: [
      { code: 'stock.import', label: 'Lập phiếu nhập kho' },
      { code: 'stock.import_price', label: 'Nhập đơn giá trên phiếu nhập' },
      { code: 'stock.export', label: 'Lập phiếu xuất kho' },
      { code: 'stock.transfer', label: 'Chuyển kho' },
      { code: 'stock.adjust', label: 'Điều chỉnh tồn kho' },
      { code: 'stock.cancel', label: 'Huỷ phiếu kho' },
    ]},
    { key: 'stocktake', label: 'Kiểm kê', permissions: [
      { code: 'stock.stocktake', label: 'Kiểm kê kho' },
    ]},
    { key: 'purchase', label: 'Đơn nhập hàng', permissions: [
      { code: 'purchase.view', label: 'Xem đơn nhập hàng' },
      { code: 'purchase.create', label: 'Tạo đơn nhập hàng' },
      { code: 'purchase.update', label: 'Sửa đơn nhập hàng' },
      { code: 'purchase.approve', label: 'Duyệt đơn nhập hàng' },
      { code: 'purchase.receive', label: 'Xác nhận nhận hàng' },
      { code: 'purchase.cancel', label: 'Huỷ đơn nhập hàng' },
    ]},
    { key: 'order', label: 'Đơn bán hàng', permissions: [
      { code: 'order.view', label: 'Xem đơn hàng' },
      { code: 'order.view_all', label: 'Xem đơn của mọi người bán' },
      { code: 'order.create', label: 'Tạo đơn hàng' },
      { code: 'order.update', label: 'Sửa đơn hàng' },
      { code: 'order.cancel', label: 'Huỷ đơn hàng' },
      { code: 'order.update_price', label: 'Sửa đơn giá trên đơn' },
    ]},
    { key: 'vehicle', label: 'Xe', permissions: [
      { code: 'vehicle.view', label: 'Xem danh mục xe' },
      { code: 'vehicle.create', label: 'Thêm xe' },
      { code: 'vehicle.update', label: 'Sửa xe' },
      { code: 'vehicle.manage_cost', label: 'Nhập chi phí chuyến xe' },
    ]},
    { key: 'trip', label: 'Chuyến giao hàng', permissions: [
      { code: 'trip.view', label: 'Xem chuyến giao hàng' },
      { code: 'trip.create', label: 'Tạo chuyến giao hàng' },
      { code: 'trip.update', label: 'Sửa chuyến giao hàng' },
      { code: 'trip.ship', label: 'Xuất kho cho chuyến' },
      { code: 'trip.deliver', label: 'Chốt giao hàng với khách' },
      { code: 'trip.return', label: 'Nhập lại kho hàng trả về' },
      { code: 'trip.cancel', label: 'Huỷ chuyến giao hàng' },
    ]},
    { key: 'production', label: 'Lệnh sản xuất', permissions: [
      { code: 'production.view', label: 'Xem lệnh sản xuất' },
      { code: 'production.create', label: 'Tạo lệnh sản xuất' },
      { code: 'production.approve', label: 'Duyệt lệnh sản xuất' },
      { code: 'production.update_progress', label: 'Cập nhật tiến độ sản xuất' },
      { code: 'production.complete', label: 'Nghiệm thu, nhập kho thành phẩm' },
      { code: 'production.cancel', label: 'Huỷ lệnh sản xuất' },
    ]},
    { key: 'debt', label: 'Công nợ', permissions: [
      { code: 'debt.view', label: 'Xem công nợ' },
      { code: 'debt.settle', label: 'Đối trừ công nợ' },
      { code: 'debt.adjust', label: 'Điều chỉnh công nợ' },
    ]},
    { key: 'voucher', label: 'Phiếu thu chi', permissions: [
      { code: 'voucher.view', label: 'Xem phiếu thu chi' },
      { code: 'voucher.create_receipt', label: 'Lập phiếu thu' },
      { code: 'voucher.create_payment', label: 'Lập phiếu chi' },
      { code: 'voucher.cancel', label: 'Huỷ phiếu thu chi' },
      { code: 'voucher.manage_category', label: 'Quản lý loại thu chi' },
      { code: 'voucher.manage_account', label: 'Quản lý tài khoản tiền' },
    ]},
    { key: 'dashboard', label: 'Tổng quan', permissions: [
      { code: 'report.dashboard', label: 'Xem trang tổng quan' },
    ]},
    { key: 'report', label: 'Báo cáo', permissions: [
      { code: 'report.sales', label: 'Báo cáo bán hàng' },
      { code: 'report.stock', label: 'Báo cáo kho' },
      { code: 'report.purchase', label: 'Báo cáo mua hàng' },
      { code: 'report.debt', label: 'Báo cáo công nợ' },
      { code: 'report.cashflow', label: 'Báo cáo dòng tiền' },
      { code: 'report.production', label: 'Báo cáo sản xuất' },
      { code: 'report.delivery', label: 'Báo cáo giao hàng' },
      { code: 'report.view_profit', label: 'Xem lợi nhuận, lãi gộp' },
    ]},
  ]);

  readonly users = signal<AppUser[]>(DEMO_USERS);
}
