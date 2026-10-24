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
  code?: string; // KHO0000001
  name: string;
  address?: string;
  phone?: string;
  managerId?: string; // thủ kho — a user
  managerName?: string;
  note?: string;
  /** false = ngừng dùng: not offered for new chứng từ, history stays. Missing = đang dùng. */
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Kho a new chứng từ may pick: the đang dùng ones, plus the one already chosen (so an old choice still shows). */
export function pickableWarehouses(all: Warehouse[], current?: string | null): Warehouse[] {
  return all.filter((w) => w.isActive !== false || w.id === current);
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
  purchaseOrderId?: string; // phiếu nhập lập từ "Nhận hàng" của đơn nhập
  salesOrderId?: string; // phiếu xuất lập từ "Giao hàng" của đơn bán
  productionOrderId?: string; // phiếu xuất vật tư / nhập thành phẩm của lệnh sản xuất
  note?: string;
  createdAt?: string;
  cancelReason?: string;
  cancelledAt?: string;
}

export interface WarehouseVoucherLine {
  productId: string;
  quantity: number; // ĐVT chính; kiểm kê: the counted quantity
  delta: number; // stock change magnitude; sign comes from the voucher type (kiểm kê: signed)
  unitName?: string; // ĐVT nhập trên phiếu (đơn vị quy đổi), nếu khác ĐVT chính
  unitQuantity?: number; // số lượng theo unitName
  unitPrice?: number; // phiếu nhập: đơn giá nhập theo ĐVT chính
  bookQuantity?: number; // kiểm kê: tồn sổ sách lúc lưu
  note?: string;
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
  startDate?: string;
  completeDate?: string;
  cancelReason?: string;
  bomSnapshot?: { componentId: string; quantityPerUnit: number }[]; // định mức chụp lúc lập lệnh
  producedQuantity?: number; // số thực nhập kho khi hoàn tất (hàng hỏng làm số này < quantity)
  note?: string;
  createdBy?: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactPhone?: string;
  email?: string;
  taxCode?: string;
  address?: string;
  /** Số ngày được nợ: hạn thanh toán = ngày nhập kho + số ngày này (0 = trả ngay). */
  creditDays: number;
  note?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Danh mục hàng theo NCC — một mặt hàng có thể do nhiều NCC cung cấp với giá khác nhau. */
export interface SupplierProduct {
  supplierId: string;
  productId: string;
  supplierCode?: string; // mã hàng theo NCC
  purchasePrice: number; // giá mua, theo đơn vị cơ bản
}

export type PurchaseOrderStatus = 'NHAP' | 'DA_GUI_NCC' | 'NHAN_MOT_PHAN' | 'DA_NHAN_DU' | 'HOAN_TAT' | 'HUY';

export interface PurchaseOrderLine {
  productId: string;
  quantity: number; // in unitName (defaults to the product's base unit)
  unitPrice: number; // per unitName
  receivedQuantity: number; // in unitName
  unitName?: string; // ordering in a conversion unit (e.g. Bó); undefined = base unit
  ratioToBase?: number; // base units per unitName; undefined = 1
  vatRate?: number; // % thuế GTGT; undefined = 0 (orders created before VAT lines)
  warehouseId?: string; // kho nhập dự kiến
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
  note?: string;
  sentDate?: string; // ngày gửi NCC
  cancelReason?: string;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  companyName?: string;
  type: CustomerType;
  creditDays: number; // 0 = pay on receipt
  /** Hạn mức công nợ phải thu (đồng); 0 hoặc trống = không giới hạn. Server chặn đơn làm vượt hạn mức. */
  creditLimit?: number;
  /** Bảng giá riêng (Pha 1.6); không có thì giá theo loại khách. */
  priceListId?: string | null;
  phone?: string;
  email?: string;
  idNumber?: string;
  personalTaxCode?: string;
  companyTaxCode?: string;
  note?: string;
  tagIds: string[];
  orderCount?: number; // legacy; the UI derives it from salesOrders
  isActive: boolean; // Đang theo dõi
  createdAt?: string;
  updatedAt?: string;
  addresses?: CustomerAddress[]; // địa chỉ giao hàng
}

export interface CustomerAddress {
  id: string;
  label?: string; // Nhà riêng, Cửa hàng, Kho…
  recipientName?: string;
  phone?: string;
  address: string;
  isDefault: boolean;
}

export type SalesOrderStatus =
  | 'CHO_SAN_XUAT' | 'DANG_SAN_XUAT' | 'CHO_GIAO_HANG' | 'DANG_GIAO'
  | 'HOAN_THANH' | 'GIAO_MOT_PHAN' | 'TRA_TOAN_BO' | 'HUY';

export interface SalesOrderLine {
  id: string;
  productId: string;
  unit: string; // ĐVT bán (đơn vị chính hoặc đơn vị quy đổi)
  unitName?: string; // set when selling in a conversion unit (Bó, Thùng…)
  ratioToBase?: number; // base units in 1 unit of this line (default 1)
  quantity: number; // theo ĐVT của dòng
  unitPrice: number; // theo ĐVT của dòng, chốt khi lưu
  lineTotal: number; // thành tiền = SL × đơn giá (trước chiết khấu, trước thuế)
  discountRate?: number; // % chiết khấu dòng (hiển thị)
  discountAmount?: number; // tiền chiết khấu dòng
  vatRate?: number; // % thuế GTGT
  warehouseId?: string; // kho xuất
  receivedQuantity?: number; // khách thực nhận, theo ĐVT của dòng
  length?: number; // cm — thành phẩm cắt theo cỡ
  width?: number;
  note?: string;
  /** Khuyến mãi đã áp vào dòng (Pha 1.6). */
  promotionId?: string | null;
  /** Hàng tặng: giá theo bảng giá, chiết khấu 100%. */
  isGift?: boolean;
}

export interface SalesOrder {
  id: string;
  code: string;
  customerId: string;
  recipientName?: string;
  recipientPhone?: string;
  deliveryAddress?: string; // địa chỉ giao hàng (chép từ danh sách điểm giao của khách hoặc gõ tay)
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
  receivedValue: number; // giá trị khách thực nhận (đã phân bổ chiết khấu, gồm thuế) = công nợ phải thu
  dueDate?: string;
  vatAmount?: number;
  cancelReason?: string;
  closedDate?: string; // "Kết thúc đơn": khách không lấy phần còn lại
  /** "Thu tiền ngay": mỗi lần khách nhận hàng, tự lập phiếu thu đúng số nhận vào tài khoản này. */
  payNowAccountId?: string;
  updatedAt?: string;
  /** Phiếu trả hàng (Pha 1.5), cũ trước. */
  returns?: SalesReturn[];
  /** Giá trị các phiếu trả chưa huỷ — công nợ của đơn = receivedValue − returnedValue. */
  returnedValue?: number;
  /** Khuyến mãi theo tổng đơn đã áp vào Chiết khấu cả đơn (Pha 1.6). */
  promotionId?: string | null;
  /** Báo giá đơn được lập từ (Pha 1.4). */
  quotationId?: string | null;
  quotationCode?: string | null;
}

/** MOI = đang mở (sửa, huỷ, lập đơn được); "Hết hạn" không lưu — màn hình suy ra từ validUntil. */
export type QuotationStatus = 'MOI' | 'DA_CHOT' | 'HUY';

/** Dòng báo giá: như dòng đơn bán, không có kho xuất và số đã nhận. */
export type QuotationLine = Omit<SalesOrderLine, 'warehouseId' | 'receivedQuantity'>;

/** Báo giá BG…: không đụng tồn kho, công nợ. "Lập đơn" sao sang đơn hàng bán (orderId) và chốt báo giá. */
export interface Quotation {
  id: string;
  code: string;
  customerId: string;
  recipientName?: string | null;
  recipientPhone?: string | null;
  deliveryAddress?: string | null;
  description?: string | null;
  quoteDate: string;
  validUntil?: string | null;
  status: QuotationStatus;
  cancelReason?: string | null;
  discountAmount: number;
  promotionId?: string | null;
  lines: QuotationLine[];
  totalGoods: number;
  totalOrder: number;
  vatAmount: number;
  salesRep: string;
  createdBy: string;
  orderId?: string | null;
  orderCode?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Trả hàng bán: khách trả lại hàng đã nhận. Hàng nhập lại kho (phiếu "Nhập trả về" voucherCode), giá trị giảm công nợ
 * và doanh thu vào ngày trả. Huỷ thì phiếu kho đi kèm bị huỷ theo. */
export interface SalesReturn {
  id: string;
  code: string; // TH0000001
  orderId: string;
  date: string;
  reason: string;
  note?: string;
  amount: number; // gồm thuế, sau chiết khấu
  voucherId?: string;
  voucherCode?: string;
  isCancelled: boolean;
  cancelReason?: string;
  createdBy: string;
  createdAt?: string;
  lines: { id: string; orderLineId: string; quantity: number; amount: number }[];
}

export interface SalesReturnDraft {
  date: string;
  warehouseId: string;
  reason: string;
  note?: string;
  lines: { orderLineId: string; quantity: number }[];
}

export type DeliveryTripStatus = 'GOM_DON' | 'DA_XUAT_KHO' | 'XE_VE_KHO' | 'HOAN_TAT' | 'HUY';

export interface DeliveryTrip {
  id: string;
  code: string;
  date: string;
  driverName?: string;
  driverPhone?: string;
  plateNumber?: string;
  status: DeliveryTripStatus;
  orderIds: string[];
  totalValue: number; // giá trị hàng trên chuyến (gồm thuế, sau chiết khấu)
  vehicleId?: string; // trống = xe thuê ngoài
  confirmedCount: number; // số đơn đã chốt giao
  receivedValue: number; // khách thực nhận trên chuyến này
  note?: string;
  createdBy?: string;
  createdAt?: string;
  shippedAt?: string; // xuất kho lúc
  returnedAt?: string; // về kho lúc
  completedAt?: string;
  cancelReason?: string;
  costs?: TripCosts;
  loads?: TripLoad[]; // hàng xếp lên xe lúc xuất kho, theo ĐVT của dòng đơn
  confirmations?: TripConfirmation[];
}

/** Chi phí điều vận — không phải phiếu chi (tiền thật vẫn lập phiếu chi ở Thu chi). */
export interface TripCosts {
  fuel: number; // tiền dầu
  toll: number; // cầu đường, bến bãi
  other: number;
  note?: string;
}

export interface TripLoad {
  orderId: string;
  lineIndex: number;
  productId: string;
  quantity: number;
  warehouseId?: string; // trống = dịch vụ, không xuất kho
}

export interface TripConfirmation {
  orderId: string;
  confirmedAt: string;
  lines: { lineIndex: number; received: number }[];
  note?: string;
}

export type VehicleType = 'XE_TAI' | 'XE_VAN' | 'XE_BA_GAC' | 'XE_MAY' | 'KHAC';
export type VehicleStatus = 'DANG_DUNG' | 'BAO_TRI' | 'NGUNG_DUNG';

/** Xe của công ty (xe thuê ngoài không khai — lập chuyến gõ thẳng biển số). */
export interface Vehicle {
  id: string;
  code: string;
  plateNumber: string;
  name?: string; // tên gọi
  type: VehicleType;
  loadCapacity?: number; // kg
  status: VehicleStatus; // "đang ở chuyến nào" suy ra từ chuyến, không lưu ở đây
  registrationExpiry?: string; // hạn đăng kiểm
  insuranceExpiry?: string; // hạn bảo hiểm
  driverUserId?: string; // tài xế thường chạy: nhân viên trong hệ thống…
  usualDriver?: string; // …hoặc tên tài xế (thuê ngoài); khi gắn nhân viên thì là tên nhân viên
  driverPhone?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type CashAccountType = 'TIEN_MAT' | 'NGAN_HANG';

export interface CashAccount {
  id: string;
  name: string;
  type: CashAccountType;
  balance: number; // số dư hiện tại = số dư đầu kỳ + thu − chi (phiếu chưa huỷ); CashVoucherService giữ đồng bộ
  code?: string; // TM, TCB-9999…
  bankName?: string;
  /** Mã BIN NAPAS của ngân hàng (6 số) — có thì in được mã VietQR chuyển khoản (Pha 2). */
  bankBin?: string | null;
  accountNumber?: string;
  accountHolder?: string;
  branch?: string;
  openingBalance?: number; // số dư trước khi dùng phần mềm
  sortOrder?: number;
  note?: string;
  isDefault?: boolean; // chọn sẵn khi lập phiếu
  isActive?: boolean; // false = ngừng dùng
}

/** Loại thu chi — quyết định phiếu gắn khách hàng, nhà cung cấp hay không gắn đối tác. */
export interface CashCategory {
  code: string;
  name: string;
  kind: VoucherKind;
  partnerType: 'KHACH_HANG' | 'NHA_CUNG_CAP' | 'KHAC';
  isDefault?: boolean;
  isActive: boolean;
  isSystem?: boolean; // loại mặc định của hệ thống: không đổi được cách gắn đối tác
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
  /** Đối trừ "Chọn tay": số tiền trừ vào từng chứng từ (mã đơn). Phần còn lại đối trừ cũ nhất trước. */
  allocations?: CashAllocation[];
  isCancelled: boolean;
  cancelReason?: string;
  cancelledAt?: string;
  createdBy: string;
  createdAt?: string;
}

export interface CashAllocation {
  ref: string; // mã chứng từ công nợ (DN…/DH…)
  amount: number;
}

export interface DebtAgingBucket {
  notDue: number;
  overdue1to30: number;
  overdue31to60: number;
  overdue61to90: number;
  overdueOver90: number;
  total: number;
}

export type TagColorKey =
  | 'gray' | 'red' | 'orange' | 'amber' | 'lime' | 'emerald' | 'teal' | 'cyan' | 'blue' | 'indigo' | 'violet' | 'pink';

/** Thẻ đánh dấu — một danh mục dùng chung cho đơn hàng bán và khách hàng. */
export interface Tag {
  id: string;
  name: string;
  color?: TagColorKey; // mặc định Xanh dương
  sortOrder: number;
  orderCount?: number; // legacy; counts are derived from orders / customers
  customerCount?: number;
  isActive: boolean;
}

export interface CompanyInfo {
  name: string;
  address?: string;
  taxCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo?: string; // data: URL, PNG/JPEG đã thu nhỏ (giữ trong trình duyệt tới khi có backend upload)
}

// A tag colour is a hue (0–360) or 'neutral' (grey). Lightness and chroma are fixed by the
// design tokens (--tag-*), so every choice stays readable in light and dark mode.
export type TagColor = number | 'neutral';

/** Màu hiển thị the company changed, `${groupId}:${key}` → colour (GET /company/display-colors). */
export type TagColors = Record<string, TagColor>;

export interface Role {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  userCount: number;
  permissionCount: number;
  totalPermissionCount: number;
  permissions: string[]; // mã quyền đã cấp (danh mục: core/data/permission-catalog.ts)
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
  status: 'ACTIVE' | 'DISABLED'; // Đang hoạt động / Đã khoá
  phone?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
  passwordUpdatedAt?: string; // mật khẩu không bao giờ lưu ở frontend — chỉ ghi lúc đổi
  mustChangePassword?: boolean; // bắt đổi mật khẩu ở lần đăng nhập tới
  lockedAt?: string;
  lockedReason?: string;
}

/** Bảng giá riêng gán cho khách (Pha 1.6): giá theo mặt hàng và ĐVT ("" = ĐVT chính). */
export interface PriceListItem {
  productId: string;
  unitName: string;
  price: number;
}

export interface PriceList {
  id: string;
  name: string;
  note?: string | null;
  isActive: boolean;
  items: PriceListItem[];
  customerCount: number;
  updatedAt?: string;
}

export type PromotionKind = 'GIAM_HANG' | 'GIAM_DON' | 'BAC_THANG' | 'TANG_HANG';
export type DiscountType = 'PHAN_TRAM' | 'SO_TIEN';
export type PromotionScope = 'TAT_CA' | 'LOAI_KHACH' | 'BANG_GIA';

/**
 * Khuyến mãi KM…: áp theo ngày chứng từ cho phạm vi khách. Số lượng tính theo ĐVT chính; giảm SO_TIEN của GIAM_HANG /
 * BAC_THANG là số tiền mỗi ĐVT chính. Productids và categoryIds đều trống = mọi mặt hàng.
 */
export interface Promotion {
  id: string;
  code: string;
  name: string;
  kind: PromotionKind;
  startDate: string;
  endDate?: string | null;
  isActive: boolean;
  note?: string | null;
  scope: PromotionScope;
  customerTypes: CustomerType[];
  priceListIds: string[];
  productIds: string[];
  categoryIds: string[];
  discountType: DiscountType;
  discountValue: number;
  minOrderValue: number;
  tiers: { minQuantity: number; value: number }[];
  buyQuantity: number;
  giftProductId?: string | null;
  giftQuantity: number;
  createdBy?: string;
  updatedAt?: string;
}
