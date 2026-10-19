// Domain model interfaces mirrored from the Ninh Trang ERP crawl.
// Money fields are VND integers (no decimals), dates are ISO strings.

export type ProductType = 'VAT_TU' | 'THANH_PHAM' | 'DICH_VU'; // Vật tư | Thành phẩm | Dịch vụ
// Cách tính of a Thành phẩm: sold per m² (dài × rộng) or per metre (chiều dài).
export type MeasureMode = 'AREA' | 'LENGTH';
export type CustomerType = 'LE' | 'SI' | 'DROPSHIP'; // Lẻ | Sỉ | Dropship

// × / ÷ change quantity (1 bó = 12 cái); + / − keep 1:1 quantity and shift the price.
export type UnitOperation = 'MUL' | 'DIV' | 'ADD' | 'SUB';

export interface UnitConversion {
  unitName: string;
  operation?: UnitOperation; // older rows: MUL
  factor?: number; // the number typed in "Tỷ lệ" / "Số tiền"; older rows: ratioToBaseUnit
  ratioToBaseUnit: number; // base units in 1 of this unit (derived from operation + factor)
  price: number; // giá lẻ
  wholesalePrice?: number;
  dropshipPrice?: number;
}

export interface Product {
  id: string;
  code: string; // VT/SP/DV + sequence
  name: string;
  type: ProductType;
  baseUnit: string;
  measureMode?: MeasureMode; // Thành phẩm only; fixes baseUnit to m2 / m
  crossRefCode?: string;
  categoryId?: string;
  defaultWarehouseId?: string;
  minStock: number;
  vatRate: number;
  warrantyMonths: number;
  origin?: string;
  retailPrice: number;
  wholesalePrice: number;
  dropshipPrice: number;
  unitConversions: UnitConversion[];
  purchaseNote?: string;
  saleNote?: string;
  description?: string;
  isSellable: boolean;
  isActive: boolean;
  images?: ProductImage[]; // first image is the main one (Ảnh chính)
  createdAt?: string; // ISO; demo rows predate this field
  updatedAt?: string;
}

export interface ProductImage {
  id: string;
  url: string; // data: URL in the mock; a storage URL once the backend has uploads
  name: string;
  width: number;
  height: number;
}

// Định mức: how much of a component one unit of a finished product consumes.
export interface BomLine {
  finishedProductId: string;
  componentId: string;
  quantityPerUnit: number;
}

export interface ProductCategory {
  id: string;
  name: string;
}

export interface Warehouse {
  id: string;
  name: string;
}

export interface StockLevel {
  productId: string;
  warehouseId: string;
  quantity: number;
  minStock: number;
}

export type WarehouseVoucherType = 'NHAP' | 'XUAT' | 'CHUYEN' | 'KIEM_KE'; // nhập | xuất | chuyển kho | kiểm kê

export interface WarehouseVoucher {
  id: string;
  code: string;
  type: WarehouseVoucherType;
  date: string;
  warehouseId: string;
  targetWarehouseId?: string; // for transfer
  reason?: string;
  createdBy: string;
  isCancelled: boolean;
  lines?: WarehouseVoucherLine[];
}

export interface WarehouseVoucherLine {
  productId: string;
  quantity: number; // kiểm kê: the counted quantity
  delta: number; // stock change magnitude; sign comes from the voucher type (kiểm kê: signed)
}

export type ProductionOrderStatus = 'NHAP' | 'DANG_SAN_XUAT' | 'HOAN_TAT' | 'HUY';

export interface ProductionOrder {
  id: string;
  code: string;
  sourceOrderId: string;
  productId: string;
  quantity: number;
  status: ProductionOrderStatus;
  createdDate: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactPhone?: string;
  taxCode?: string;
  address?: string;
  creditAllowed: boolean;
  productCount: number;
  purchaseOrderCount: number;
  isActive: boolean;
}

export type PurchaseOrderStatus = 'NHAP' | 'DA_GUI_NCC' | 'NHAN_MOT_PHAN' | 'DA_NHAN_DU' | 'HOAN_TAT' | 'HUY';

export interface PurchaseOrderLine {
  productId: string;
  quantity: number;
  unitPrice: number;
  receivedQuantity: number;
}

export interface PurchaseOrder {
  id: string;
  code: string;
  supplierId: string;
  date: string;
  status: PurchaseOrderStatus;
  totalValue: number;
  createdBy: string;
  lines: PurchaseOrderLine[];
  receivedValue: number; // giá trị hàng đã nhận thực tế = công nợ phải trả
  receivedDate?: string;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  companyName?: string;
  type: CustomerType;
  creditDays: number; // 0 = pay on receipt
  phone?: string;
  email?: string;
  idNumber?: string;
  personalTaxCode?: string;
  companyTaxCode?: string;
  note?: string;
  tagIds: string[];
  orderCount: number;
  isActive: boolean;
}

export type SalesOrderStatus =
  | 'CHO_SAN_XUAT' | 'DANG_SAN_XUAT' | 'CHO_GIAO_HANG' | 'DANG_GIAO'
  | 'HOAN_THANH' | 'GIAO_MOT_PHAN' | 'TRA_TOAN_BO' | 'HUY';

export interface SalesOrderLine {
  id: string;
  productId: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  receivedQuantity?: number; // khách thực nhận
  length?: number;
  width?: number;
  note?: string;
}

export interface SalesOrder {
  id: string;
  code: string;
  customerId: string;
  recipientName?: string;
  recipientPhone?: string;
  description?: string;
  source?: string; // Zalo, Facebook, khách quen...
  tagIds: string[];
  orderDate: string;
  neededByDate?: string;
  status: SalesOrderStatus;
  lines: SalesOrderLine[];
  discountAmount: number;
  totalGoods: number;
  totalOrder: number;
  salesRep: string;
  createdBy: string;
  tripId?: string;
  deliveredDate?: string;
  receivedValue: number; // giá trị khách thực nhận (đã phân bổ chiết khấu) = công nợ phải thu
  dueDate?: string;
}

export type DeliveryTripStatus = 'GOM_DON' | 'DA_XUAT_KHO' | 'XE_VE_KHO' | 'HOAN_TAT' | 'HUY';

export interface DeliveryTrip {
  id: string;
  code: string;
  date: string;
  driverName?: string;
  plateNumber?: string;
  status: DeliveryTripStatus;
  orderIds: string[];
  totalValue: number;
  vehicleId?: string;
  confirmedCount: number;
  receivedValue: number;
}

export interface Vehicle {
  id: string;
  code: string;
  plateNumber: string;
  type: string;
  loadCapacity?: number;
  usualDriver?: string;
  status: 'DANG_DUNG' | 'RANH' | 'BAO_TRI';
  currentTripCode?: string;
}

export type CashAccountType = 'TIEN_MAT' | 'NGAN_HANG';

export interface CashAccount {
  id: string;
  name: string;
  type: CashAccountType;
  balance: number;
}

export type VoucherKind = 'THU' | 'CHI'; // receipt | payment

export interface CashVoucher {
  id: string;
  code: string;
  date: string;
  kind: VoucherKind;
  category: string; // Thu tiền khách hàng, Chi mua hàng, ...
  partnerType: 'KHACH_HANG' | 'NHA_CUNG_CAP' | 'KHAC';
  partnerId?: string;
  accountId: string;
  amount: number;
  settledAmount: number;
  description?: string;
  isCancelled: boolean;
  createdBy: string;
}

export interface DebtAgingBucket {
  notDue: number;
  overdue1to30: number;
  overdue31to60: number;
  overdue61to90: number;
  overdueOver90: number;
  total: number;
}

export interface Tag {
  id: string;
  name: string;
  sortOrder: number;
  orderCount: number;
  customerCount: number;
  isActive: boolean;
}

export interface CompanyInfo {
  name: string;
  address?: string;
  taxCode?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  userCount: number;
  permissionCount: number;
  totalPermissionCount: number;
  isActive: boolean;
}

export interface PermissionModule {
  key: string;
  label: string;
  permissions: { code: string; label: string }[];
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  roleId: string;
  lastLoginAt?: string;
  openSessions: number;
  status: 'ACTIVE' | 'DISABLED';
}
