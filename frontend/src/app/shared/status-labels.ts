import {
  CustomerType, DeliveryTripStatus, ProductionOrderStatus, ProductType, PurchaseOrderStatus, SalesOrderStatus,
} from '../core/models/domain.models';
import { tagClass } from './tag-class';

export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  VAT_TU: 'Vật tư hàng hoá',
  THANH_PHAM: 'Thành phẩm',
  DICH_VU: 'Dịch vụ',
};

// Colour class per tính chất — the colour itself is set in Thiết lập → Màu hiển thị.
export const PRODUCT_TYPE_CLASS: Record<ProductType, string> = {
  VAT_TU: tagClass('product-type', 'VAT_TU'),
  THANH_PHAM: tagClass('product-type', 'THANH_PHAM'),
  DICH_VU: tagClass('product-type', 'DICH_VU'),
};

export const businessStatusClass = (isActive: boolean) => tagClass('business-status', isActive ? 'ACTIVE' : 'INACTIVE');
export const CUSTOMER_TYPE_SHORT: Record<CustomerType, string> = { LE: 'Lẻ', SI: 'Sỉ', DROPSHIP: 'Dropship' };
export const customerTypeClass = (t: CustomerType) => tagClass('customer-type', t);
export const customerStatusClass = (isActive: boolean) => tagClass('customer-status', isActive ? 'ACTIVE' : 'INACTIVE');
export const customerStatusLabel = (isActive: boolean) => (isActive ? 'Đang theo dõi' : 'Ngừng theo dõi');
export const supplierStatusClass = (isActive: boolean) => tagClass('supplier-status', isActive ? 'ACTIVE' : 'INACTIVE');
export const supplierStatusLabel = (isActive: boolean) => (isActive ? 'Còn hợp tác' : 'Ngừng hợp tác');
export const salesOrderStatusClass = (s: SalesOrderStatus) => tagClass('sales-order', s);
export const purchaseOrderStatusClass = (s: PurchaseOrderStatus) => tagClass('purchase-order', s);
export const productionOrderStatusClass = (s: ProductionOrderStatus) => tagClass('production-order', s);
export const deliveryTripStatusClass = (s: DeliveryTripStatus) => tagClass('delivery-trip', s);

// Nhãn trạng thái tiếng Việt, theo docs/crawl (04, 06, 09, 10).
export const SALES_ORDER_STATUS_LABEL: Record<SalesOrderStatus, string> = {
  CHO_SAN_XUAT: 'Chờ sản xuất',
  DANG_SAN_XUAT: 'Đang sản xuất',
  CHO_GIAO_HANG: 'Chờ giao hàng',
  DANG_GIAO: 'Đang giao',
  HOAN_THANH: 'Hoàn thành',
  GIAO_MOT_PHAN: 'Giao một phần',
  TRA_TOAN_BO: 'Trả toàn bộ',
  HUY: 'Đã huỷ',
};

export const PURCHASE_ORDER_STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  NHAP: 'Nháp',
  DA_GUI_NCC: 'Đã gửi NCC',
  NHAN_MOT_PHAN: 'Nhận một phần',
  DA_NHAN_DU: 'Đã nhận đủ',
  HOAN_TAT: 'Hoàn tất',
  HUY: 'Đã huỷ',
};

export const PRODUCTION_ORDER_STATUS_LABEL: Record<ProductionOrderStatus, string> = {
  NHAP: 'Nháp',
  DANG_SAN_XUAT: 'Đang sản xuất',
  HOAN_TAT: 'Hoàn tất',
  HUY: 'Đã huỷ',
};

export const DELIVERY_TRIP_STATUS_LABEL: Record<DeliveryTripStatus, string> = {
  GOM_DON: 'Đang gom đơn',
  DA_XUAT_KHO: 'Đã xuất kho',
  XE_VE_KHO: 'Xe đã về kho',
  HOAN_TAT: 'Hoàn tất',
  HUY: 'Đã huỷ',
};
