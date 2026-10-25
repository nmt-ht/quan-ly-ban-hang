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

export const NAV_GROUPS: NavGroup[] = [
  { label: null, links: [
    { label: 'Tổng quan', path: '/tong-quan', icon: 'dashboard' },
    { label: 'Báo cáo', path: '/bao-cao', icon: 'report' },
  ]},
  { label: 'Nghiệp vụ', module: 'stock', links: [
    { label: 'Hàng hoá', path: '/hang-hoa', icon: 'product' },
    { label: 'Tồn kho', path: '/kho/ton-kho', icon: 'stock' },
    { label: 'Phiếu kho', path: '/kho/phieu', icon: 'voucher' },
    { label: 'Lệnh sản xuất', path: '/san-xuat', icon: 'factory' },
  ]},
  { label: 'Mua hàng', module: 'purchase', links: [
    { label: 'Nhà cung cấp', path: '/nha-cung-cap', icon: 'supplier' },
    { label: 'Đơn nhập hàng', path: '/mua-hang', icon: 'cart' },
    { label: 'Công nợ phải trả', path: '/cong-no/nha-cung-cap', icon: 'money-out' },
  ]},
  { label: 'Bán hàng', module: 'sell', links: [
    { label: 'Khách hàng', path: '/khach-hang', icon: 'customers' },
    { label: 'Báo giá', path: '/bao-gia', icon: 'voucher' },
    { label: 'Bảng giá', path: '/bang-gia', icon: 'money-in' },
    { label: 'Khuyến mãi', path: '/khuyen-mai', icon: 'tag' },
    { label: 'Đơn hàng bán', path: '/don-hang', icon: 'receipt' },
    { label: 'Chuyến giao hàng', path: '/giao-hang', icon: 'truck' },
    { label: 'Danh mục xe', path: '/xe', icon: 'car' },
    { label: 'Công nợ phải thu', path: '/cong-no/khach-hang', icon: 'money-in' },
    { label: 'Nhắc nợ', path: '/cong-no/nhac-no', icon: 'clock' },
  ]},
  { label: 'Dòng tiền', module: 'cash', links: [
    { label: 'Phiếu thu chi', path: '/thu-chi', icon: 'cash' },
    { label: 'Tuổi nợ', path: '/cong-no/tuoi-no', icon: 'clock' },
  ]},
  { label: 'Thiết lập', module: 'settings', links: [
    { label: 'Thông tin công ty', path: '/thiet-lap/cong-ty', icon: 'company' },
    { label: 'Kho', path: '/thiet-lap/kho', icon: 'stock' },
    { label: 'Nhóm hàng', path: '/thiet-lap/nhom-hang', icon: 'grid' },
    { label: 'Thẻ đánh dấu', path: '/thiet-lap/the', icon: 'tag' },
    { label: 'Người dùng', path: '/thiet-lap/nguoi-dung', icon: 'user' },
    { label: 'Chức vụ & phân quyền', path: '/thiet-lap/chuc-vu', icon: 'shield' },
    { label: 'Màu hiển thị', path: '/thiet-lap/mau-hien-thi', icon: 'palette' },
    { label: 'Nhật ký hoạt động', path: '/thiet-lap/nhat-ky', icon: 'clock' },
  ]},
];

/**
 * The phân hệ of a URL: the group of the menu link with the longest matching path (/don-hang/them-moi → Bán hàng,
 * /thiet-lap/kho → Thiết lập, /cong-no/tuoi-no → Dòng tiền). Null for pages outside the menu and the moss pages.
 */
export function moduleOf(url: string): ModuleKey | null {
  const path = url.split(/[?#]/)[0];
  let best: { len: number; module: ModuleKey | null } = { len: 0, module: null };
  for (const g of NAV_GROUPS) {
    for (const l of g.links) {
      if ((path === l.path || path.startsWith(l.path + '/')) && l.path.length > best.len) best = { len: l.path.length, module: g.module ?? null };
    }
  }
  return best.module;
}
