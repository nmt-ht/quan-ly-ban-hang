import { NavIconName } from './nav-icon/nav-icon.component';

export interface NavLink {
  label: string;
  path: string;
  icon: NavIconName;
}

/** Phân hệ: each has its own hue (tokens.css › [data-module]); none = the moss brand (Tổng quan, Báo cáo). */
export type ModuleKey = 'sell' | 'stock' | 'purchase' | 'cash' | 'settings';

export interface NavGroup {
  label: string | null; // null = ungrouped top-level links
  module?: ModuleKey;
  links: NavLink[];
}

// Names follow MISA (phân hệ Kho · Mua hàng · Bán hàng · Quỹ & ngân hàng · Danh mục · Hệ thống). URLs stay as they were.
export const NAV_GROUPS: NavGroup[] = [
  { label: null, links: [
    { label: 'Tổng quan', path: '/tong-quan', icon: 'dashboard' },
    { label: 'Báo cáo', path: '/bao-cao', icon: 'report' },
  ]},
  { label: 'Kho', module: 'stock', links: [
    { label: 'Vật tư hàng hoá', path: '/hang-hoa', icon: 'product' },
    { label: 'Tồn kho', path: '/kho/ton-kho', icon: 'stock' },
    { label: 'Nhập, xuất kho', path: '/kho/phieu', icon: 'arrows-inout' },
    { label: 'Lệnh sản xuất', path: '/san-xuat', icon: 'factory' },
  ]},
  { label: 'Mua hàng', module: 'purchase', links: [
    { label: 'Nhà cung cấp', path: '/nha-cung-cap', icon: 'supplier' },
    { label: 'Đơn mua hàng', path: '/mua-hang', icon: 'cart' },
    { label: 'Công nợ phải trả', path: '/cong-no/nha-cung-cap', icon: 'ledger-out' },
  ]},
  { label: 'Bán hàng', module: 'sell', links: [
    { label: 'Khách hàng', path: '/khach-hang', icon: 'customers' },
    { label: 'Báo giá', path: '/bao-gia', icon: 'voucher' },
    { label: 'Chính sách giá', path: '/bang-gia', icon: 'tag' },
    { label: 'Chương trình khuyến mại', path: '/khuyen-mai', icon: 'percent' },
    { label: 'Chứng từ bán hàng', path: '/don-hang', icon: 'receipt' },
    { label: 'Chuyến giao hàng', path: '/giao-hang', icon: 'truck' },
    { label: 'Danh mục xe', path: '/xe', icon: 'car' },
    { label: 'Công nợ phải thu', path: '/cong-no/khach-hang', icon: 'ledger-in' },
    { label: 'Nhắc nợ', path: '/cong-no/nhac-no', icon: 'bell' },
  ]},
  { label: 'Quỹ & ngân hàng', module: 'cash', links: [
    { label: 'Thu, chi tiền', path: '/thu-chi', icon: 'cash' },
    { label: 'Phân tích tuổi nợ', path: '/cong-no/tuoi-no', icon: 'hourglass' },
  ]},
  { label: 'Kế toán', module: 'cash', links: [
    { label: 'Tổng quan kế toán', path: '/ke-toan', icon: 'receipt' },
    { label: 'Sổ nhật ký chung', path: '/ke-toan/so-nhat-ky', icon: 'table' },
    { label: 'Bảng cân đối phát sinh', path: '/ke-toan/can-doi-phat-sinh', icon: 'report' },
    { label: 'Kết quả kinh doanh', path: '/ke-toan/ket-qua-kinh-doanh', icon: 'trending-up' },
    { label: 'Bảng cân đối kế toán', path: '/ke-toan/can-doi-ke-toan', icon: 'table' },
    { label: 'Tài sản cố định', path: '/ke-toan/tai-san', icon: 'grid' },
    { label: 'Công cụ dụng cụ', path: '/ke-toan/cong-cu-dung-cu', icon: 'tag' },
    { label: 'Giá thành sản xuất', path: '/ke-toan/gia-thanh', icon: 'factory' },
    { label: 'Nhân viên', path: '/ke-toan/nhan-vien', icon: 'user' },
    { label: 'Bảng lương', path: '/ke-toan/luong', icon: 'money-out' },
    { label: 'Hệ thống tài khoản', path: '/ke-toan/tai-khoan', icon: 'folder' },
    { label: 'Số dư đầu kỳ', path: '/ke-toan/so-du-dau-ky', icon: 'calendar' },
  ]},
  { label: 'Danh mục', module: 'settings', links: [
    { label: 'Kho', path: '/thiet-lap/kho', icon: 'warehouse' },
    { label: 'Nhóm VTHH', path: '/thiet-lap/nhom-hang', icon: 'folder' },
    { label: 'Thẻ đánh dấu', path: '/thiet-lap/the', icon: 'bookmark' },
  ]},
  { label: 'Hệ thống', module: 'settings', links: [
    { label: 'Thông tin doanh nghiệp', path: '/thiet-lap/cong-ty', icon: 'company' },
    { label: 'Email gửi đi', path: '/thiet-lap/email', icon: 'mail' },
    { label: 'Quản lý người dùng', path: '/thiet-lap/nguoi-dung', icon: 'user' },
    { label: 'Vai trò và quyền hạn', path: '/thiet-lap/chuc-vu', icon: 'shield' },
    { label: 'Màu hiển thị', path: '/thiet-lap/mau-hien-thi', icon: 'palette' },
    { label: 'Nhật ký truy cập', path: '/thiet-lap/nhat-ky', icon: 'history' },
  ]},
];

/**
 * The phân hệ of a URL: the group of the menu link with the longest matching path (/don-hang/them-moi → Bán hàng,
 * /thiet-lap/kho → Danh mục, /cong-no/tuoi-no → Quỹ & ngân hàng). Null for pages outside the menu and the moss pages.
 */
export function moduleOf(url: string): ModuleKey | null {
  return menuEntryOf(url)?.module ?? null;
}

/** The menu link a URL belongs to (longest matching path) and its phân hệ — e.g. to draw a link with the menu's icon. */
export function menuEntryOf(url: string): { link: NavLink; module: ModuleKey | null } | null {
  const path = url.split(/[?#]/)[0];
  let best: { link: NavLink; module: ModuleKey | null } | null = null;
  for (const g of NAV_GROUPS) {
    for (const l of g.links) {
      if ((path === l.path || path.startsWith(l.path + '/')) && l.path.length > (best?.link.path.length ?? 0)) best = { link: l, module: g.module ?? null };
    }
  }
  return best;
}
