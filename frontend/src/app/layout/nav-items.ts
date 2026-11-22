import { NavIconName } from './nav-icon/nav-icon.component';

export interface NavLink {
  label: string;
  path: string;
  icon: NavIconName;
  /** A heading inside a long group (Kế toán › Sổ sách): links that follow each other with the same section fold together under it. */
  section?: string;
}

export interface NavGroup {
  label: string | null; // null = ungrouped top-level links
  links: NavLink[];
  /** Where the group's name leads: the phân hệ's sơ đồ (features/feature-map). The chevron beside it still folds the group. */
  hub?: string;
}

// Names follow MISA (phân hệ Kho · Mua hàng · Bán hàng · Quỹ & ngân hàng · Danh mục · Hệ thống). URLs stay as they were.
export const NAV_GROUPS: NavGroup[] = [
  { label: null, links: [
    { label: 'Tổng quan', path: '/tong-quan', icon: 'dashboard' },
    { label: 'Báo cáo', path: '/bao-cao', icon: 'report' },
  ]},
  { label: 'Kho', hub: '/so-do/kho', links: [
    { label: 'Vật tư hàng hoá', path: '/hang-hoa', icon: 'product' },
    { label: 'Tồn kho', path: '/kho/ton-kho', icon: 'stock' },
    { label: 'Nhập, xuất kho', path: '/kho/phieu', icon: 'arrows-inout' },
    { label: 'Lệnh sản xuất', path: '/san-xuat', icon: 'factory' },
  ]},
  { label: 'Mua hàng', hub: '/so-do/mua-hang', links: [
    { label: 'Nhà cung cấp', path: '/nha-cung-cap', icon: 'supplier' },
    { label: 'Đơn mua hàng', path: '/mua-hang', icon: 'cart' },
    { label: 'Hợp đồng mua', path: '/hop-dong/mua', icon: 'voucher' },
    { label: 'Hoá đơn mua dịch vụ', path: '/hoa-don-mua', icon: 'receipt' },
    { label: 'Công nợ phải trả', path: '/cong-no/nha-cung-cap', icon: 'ledger-out' },
  ]},
  { label: 'Bán hàng', hub: '/so-do/ban-hang', links: [
    { section: 'Khách hàng và chào giá', label: 'Khách hàng', path: '/khach-hang', icon: 'customers' },
    { section: 'Khách hàng và chào giá', label: 'Báo giá', path: '/bao-gia', icon: 'voucher' },
    { section: 'Khách hàng và chào giá', label: 'Hợp đồng bán', path: '/hop-dong/ban', icon: 'voucher' },
    { section: 'Khách hàng và chào giá', label: 'Chính sách giá', path: '/bang-gia', icon: 'tag' },
    { section: 'Khách hàng và chào giá', label: 'Chương trình khuyến mại', path: '/khuyen-mai', icon: 'percent' },
    { section: 'Bán và giao hàng', label: 'Chứng từ bán hàng', path: '/don-hang', icon: 'receipt' },
    { section: 'Bán và giao hàng', label: 'Hoá đơn bán ra', path: '/hoa-don-ban', icon: 'receipt' },
    { section: 'Bán và giao hàng', label: 'Chuyến giao hàng', path: '/giao-hang', icon: 'truck' },
    { section: 'Bán và giao hàng', label: 'Danh mục xe', path: '/xe', icon: 'car' },
    { section: 'Công nợ', label: 'Công nợ phải thu', path: '/cong-no/khach-hang', icon: 'ledger-in' },
    { section: 'Công nợ', label: 'Nhắc nợ', path: '/cong-no/nhac-no', icon: 'bell' },
  ]},
  { label: 'Quỹ & ngân hàng', hub: '/so-do/quy', links: [
    { label: 'Thu, chi tiền', path: '/thu-chi', icon: 'cash' },
    { label: 'Chuyển tiền nội bộ', path: '/thu-chi/chuyen-tien', icon: 'arrows-inout' },
    { label: 'Kiểm kê quỹ', path: '/thu-chi/kiem-ke-quy', icon: 'table' },
    { label: 'Đối chiếu ngân hàng', path: '/thu-chi/doi-chieu-ngan-hang', icon: 'ledger-in' },
    { label: 'Phân tích tuổi nợ', path: '/cong-no/tuoi-no', icon: 'hourglass' },
  ]},
  { label: 'Kế toán', hub: '/so-do/ke-toan', links: [
    { label: 'Tổng quan kế toán', path: '/ke-toan', icon: 'receipt' },
    { section: 'Sổ sách', label: 'Sổ nhật ký chung', path: '/ke-toan/so-nhat-ky', icon: 'table' },
    { section: 'Sổ sách', label: 'Sổ chi tiết tài khoản', path: '/ke-toan/so-chi-tiet', icon: 'table' },
    { section: 'Sổ sách', label: 'Tổng hợp công nợ', path: '/ke-toan/tong-hop-cong-no', icon: 'ledger-in' },
    { section: 'Sổ sách', label: 'Bảng cân đối phát sinh', path: '/ke-toan/can-doi-phat-sinh', icon: 'report' },
    { section: 'Báo cáo và thuế', label: 'Bảng cân đối kế toán', path: '/ke-toan/can-doi-ke-toan', icon: 'table' },
    { section: 'Báo cáo và thuế', label: 'Kết quả kinh doanh', path: '/ke-toan/ket-qua-kinh-doanh', icon: 'trending-up' },
    { section: 'Báo cáo và thuế', label: 'Lưu chuyển tiền tệ', path: '/ke-toan/luu-chuyen-tien-te', icon: 'trending-up' },
    { section: 'Báo cáo và thuế', label: 'Thuế GTGT', path: '/ke-toan/thue-gtgt', icon: 'percent' },
    { section: 'Báo cáo và thuế', label: 'Thuế TNDN', path: '/ke-toan/thue-tndn', icon: 'percent' },
    { section: 'Tài sản và chi phí', label: 'Tài sản cố định', path: '/ke-toan/tai-san', icon: 'grid' },
    { section: 'Tài sản và chi phí', label: 'Công cụ dụng cụ', path: '/ke-toan/cong-cu-dung-cu', icon: 'tag' },
    { section: 'Tài sản và chi phí', label: 'Giá thành sản xuất', path: '/ke-toan/gia-thanh', icon: 'factory' },
    { section: 'Nhân sự và lương', label: 'Nhân viên', path: '/ke-toan/nhan-vien', icon: 'user' },
    { section: 'Nhân sự và lương', label: 'Bảng lương', path: '/ke-toan/luong', icon: 'money-out' },
    { section: 'Thiết lập sổ', label: 'Hệ thống tài khoản', path: '/ke-toan/tai-khoan', icon: 'folder' },
    { section: 'Thiết lập sổ', label: 'Số dư đầu kỳ', path: '/ke-toan/so-du-dau-ky', icon: 'calendar' },
    { section: 'Thiết lập sổ', label: 'Kết chuyển cuối kỳ', path: '/ke-toan/ket-chuyen', icon: 'lock' },
  ]},
  { label: 'Danh mục', links: [
    { label: 'Kho', path: '/thiet-lap/kho', icon: 'warehouse' },
    { label: 'Nhóm VTHH', path: '/thiet-lap/nhom-hang', icon: 'folder' },
    { label: 'Thẻ đánh dấu', path: '/thiet-lap/the', icon: 'bookmark' },
  ]},
  { label: 'Hệ thống', links: [
    { label: 'Thông tin doanh nghiệp', path: '/thiet-lap/cong-ty', icon: 'company' },
    { label: 'Email gửi đi', path: '/thiet-lap/email', icon: 'mail' },
    { label: 'Quản lý người dùng', path: '/thiet-lap/nguoi-dung', icon: 'user' },
    { label: 'Vai trò và quyền hạn', path: '/thiet-lap/chuc-vu', icon: 'shield' },
    { label: 'Màu hiển thị', path: '/thiet-lap/mau-hien-thi', icon: 'palette' },
    { label: 'Nhật ký truy cập', path: '/thiet-lap/nhat-ky', icon: 'history' },
  ]},
];

/** The menu link a URL belongs to (longest matching path) — e.g. to draw a link with the menu's icon. */
export function menuEntryOf(url: string): { link: NavLink } | null {
  const path = url.split(/[?#]/)[0];
  let best: { link: NavLink } | null = null;
  for (const g of NAV_GROUPS) {
    for (const l of g.links) {
      if ((path === l.path || path.startsWith(l.path + '/')) && l.path.length > (best?.link.path.length ?? 0)) best = { link: l };
    }
  }
  return best;
}
