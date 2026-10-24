import { NavIconName } from './nav-icon/nav-icon.component';

export interface NavLink {
  label: string;
  path: string;
  icon: NavIconName;
}

export interface NavGroup {
  label: string | null; // null = ungrouped top-level links
  links: NavLink[];
}

export const NAV_GROUPS: NavGroup[] = [
  { label: null, links: [
    { label: 'Tổng quan', path: '/tong-quan', icon: 'dashboard' },
    { label: 'Báo cáo', path: '/bao-cao', icon: 'report' },
  ]},
  { label: 'Nghiệp vụ', links: [
    { label: 'Hàng hoá', path: '/hang-hoa', icon: 'product' },
    { label: 'Tồn kho', path: '/kho/ton-kho', icon: 'stock' },
    { label: 'Phiếu kho', path: '/kho/phieu', icon: 'voucher' },
    { label: 'Lệnh sản xuất', path: '/san-xuat', icon: 'factory' },
  ]},
  { label: 'Mua hàng', links: [
    { label: 'Nhà cung cấp', path: '/nha-cung-cap', icon: 'supplier' },
    { label: 'Đơn nhập hàng', path: '/mua-hang', icon: 'cart' },
    { label: 'Công nợ phải trả', path: '/cong-no/nha-cung-cap', icon: 'money-out' },
  ]},
  { label: 'Bán hàng', links: [
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
  { label: 'Dòng tiền', links: [
    { label: 'Phiếu thu chi', path: '/thu-chi', icon: 'cash' },
    { label: 'Tuổi nợ', path: '/cong-no/tuoi-no', icon: 'clock' },
  ]},
  { label: 'Thiết lập', links: [
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
