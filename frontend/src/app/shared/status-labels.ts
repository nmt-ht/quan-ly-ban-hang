import {
  DeliveryTripStatus, ProductionOrderStatus, PurchaseOrderStatus, SalesOrderStatus,
} from '../core/models/domain.models';

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
