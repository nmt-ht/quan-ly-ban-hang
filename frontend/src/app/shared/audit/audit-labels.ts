import { AuditLogEntry, AuditValue } from '../../core/services/audit-log.service';
import { DataStore } from '../../core/services/data-store.service';

/** Kinds of record in Nhật ký hoạt động, by the server's entityType (Prisma model name). */
export const ENTITY_LABEL: Record<string, string> = {
  SalesOrder: 'Đơn hàng bán', PurchaseOrder: 'Đơn nhập hàng', ProductionOrder: 'Lệnh sản xuất', DeliveryTrip: 'Chuyến giao hàng',
  WarehouseVoucher: 'Phiếu kho', CashVoucher: 'Phiếu thu chi', Customer: 'Khách hàng', Supplier: 'Nhà cung cấp',
  Product: 'Hàng hoá', Vehicle: 'Xe', User: 'Người dùng', Role: 'Chức vụ', Tag: 'Thẻ đánh dấu', CashAccount: 'Tài khoản tiền',
  CashCategory: 'Loại thu chi', CompanyInfo: 'Thông tin công ty', Warehouse: 'Kho', ProductCategory: 'Nhóm hàng', Api: 'API',
};

const DETAIL_ROUTE: Record<string, string> = {
  SalesOrder: '/don-hang', PurchaseOrder: '/mua-hang', ProductionOrder: '/san-xuat', DeliveryTrip: '/giao-hang',
  WarehouseVoucher: '/kho/phieu', CashVoucher: '/thu-chi', Customer: '/khach-hang', Supplier: '/nha-cung-cap',
  Product: '/hang-hoa', Vehicle: '/xe', User: '/thiet-lap/nguoi-dung',
};

const LIST_ROUTE: Record<string, string> = {
  Role: '/thiet-lap/chuc-vu', Tag: '/thiet-lap/the', CashAccount: '/thu-chi/tai-khoan', CashCategory: '/thu-chi/loai',
  CompanyInfo: '/thiet-lap/cong-ty',
};

/** Router link of the record a line is about, if it has a page. */
export function entityLink(e: Pick<AuditLogEntry, 'entityType' | 'entityId'>): unknown[] | null {
  if (DETAIL_ROUTE[e.entityType]) return [DETAIL_ROUTE[e.entityType], e.entityId];
  return LIST_ROUTE[e.entityType] ? [LIST_ROUTE[e.entityType]] : null;
}

/** Router link of a related code (PXK0000051, PT0000102, DH…) found in the loaded lists. */
export function codeLink(data: DataStore, code: string): unknown[] | null {
  const lists: [string, { id: string; code: string }[]][] = [
    ['/don-hang', data.salesOrders()], ['/mua-hang', data.purchaseOrders()], ['/san-xuat', data.productionOrders()],
    ['/giao-hang', data.deliveryTrips()], ['/kho/phieu', data.warehouseVouchers()], ['/thu-chi', data.cashVouchers()],
    ['/khach-hang', data.customers()], ['/nha-cung-cap', data.suppliers()], ['/hang-hoa', data.products()], ['/xe', data.vehicles()],
  ];
  for (const [route, rows] of lists) {
    const hit = rows.find((r) => r.code === code);
    // Hàng hoá are opened by mã (/hang-hoa/SP0000001); the other pages by id.
    if (hit) return [route, route === '/hang-hoa' ? hit.code : hit.id];
  }
  return null;
}

export type ActionTone = 'ok' | 'bad' | 'warn' | 'plain';

/** The verb chip of a line: what kind of thing happened, coloured by how much it matters. */
export function actionVerb(action: string): { label: string; tone: ActionTone } {
  const verb = action.split('.').pop() ?? action;
  if (action === 'auth.login') return { label: 'Đăng nhập', tone: 'plain' };
  if (action === 'auth.login_failed') return { label: 'Đăng nhập lỗi', tone: 'bad' };
  if (action === 'api.unaudited') return { label: 'Chưa mô tả', tone: 'warn' };
  if (verb === 'create' || verb.endsWith('_add') || verb === 'add_orders') return { label: 'Tạo', tone: 'ok' };
  if (verb === 'cancel' || verb === 'delete' || verb.endsWith('_remove') || verb === 'remove_order') return { label: verb === 'delete' ? 'Xoá' : 'Huỷ', tone: 'bad' };
  if (verb === 'lock' || verb === 'deactivate' || verb === 'end_sessions') return { label: 'Khoá / ngừng', tone: 'warn' };
  if (verb === 'unlock' || verb === 'activate') return { label: 'Mở lại', tone: 'ok' };
  if (verb === 'reset_password' || verb === 'set_permissions') return { label: 'Bảo mật', tone: 'warn' };
  if (verb === 'update_price') return { label: 'Đổi giá', tone: 'warn' };
  if (verb.startsWith('update') || verb === 'addresses' || verb === 'costs' || verb === 'bom' || verb === 'display_colors' || verb === 'set_status') {
    return { label: 'Sửa', tone: 'plain' };
  }
  return { label: 'Thao tác', tone: 'plain' };
}

const NUMBER = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 });

/** A value of a changed field as text: "(trống)", "Có / Không", numbers with dots, lists joined. */
export function formatAuditValue(v: AuditValue): string {
  if (v === null || v === undefined || v === '') return '(trống)';
  if (typeof v === 'boolean') return v ? 'Có' : 'Không';
  if (typeof v === 'number') return NUMBER.format(v);
  if (Array.isArray(v)) return v.length ? v.map(formatAuditValue).join('; ') : '(trống)';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split('-').reverse().join('/');
  return v;
}

/** List changes ("Dòng hàng", "Thêm quyền"…) are clearer as what was added and removed. */
export function listDelta(from: AuditValue, to: AuditValue): { added: string[]; removed: string[] } | null {
  if (!Array.isArray(from) && !Array.isArray(to)) return null;
  const a = (Array.isArray(from) ? from : []).map(formatAuditValue);
  const b = (Array.isArray(to) ? to : []).map(formatAuditValue);
  return { added: b.filter((x) => !a.includes(x)), removed: a.filter((x) => !b.includes(x)) };
}
