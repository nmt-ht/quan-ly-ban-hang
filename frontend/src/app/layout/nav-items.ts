export interface NavLink {
  label: string;
  path: string;
}

export interface NavGroup {
  label: string | null; // null = ungrouped top-level links
  links: NavLink[];
}

export const NAV_GROUPS: NavGroup[] = [
  { label: null, links: [
    { label: 'Tổng quan', path: '/tong-quan' },
    { label: 'Báo cáo', path: '/bao-cao' },
  ]},
  { label: 'Nghiệp vụ', links: [
    { label: 'Hàng hoá', path: '/hang-hoa' },
    { label: 'Tồn kho', path: '/kho/ton-kho' },
    { label: 'Phiếu kho', path: '/kho/phieu' },
    { label: 'Lệnh sản xuất', path: '/san-xuat' },
  ]},
  { label: 'Mua hàng', links: [
    { label: 'Nhà cung cấp', path: '/nha-cung-cap' },
    { label: 'Đơn nhập hàng', path: '/mua-hang' },
    { label: 'Công nợ phải trả', path: '/cong-no/nha-cung-cap' },
  ]},
  { label: 'Bán hàng', links: [
    { label: 'Khách hàng', path: '/khach-hang' },
    { label: 'Đơn hàng bán', path: '/don-hang' },
    { label: 'Chuyến giao hàng', path: '/giao-hang' },
    { label: 'Danh mục xe', path: '/xe' },
    { label: 'Công nợ phải thu', path: '/cong-no/khach-hang' },
  ]},
  { label: 'Dòng tiền', links: [
    { label: 'Phiếu thu chi', path: '/thu-chi' },
    { label: 'Tuổi nợ', path: '/cong-no/tuoi-no' },
  ]},
  { label: 'Thiết lập', links: [
    { label: 'Thông tin công ty', path: '/thiet-lap/cong-ty' },
    { label: 'Thẻ đánh dấu', path: '/thiet-lap/the' },
    { label: 'Người dùng', path: '/thiet-lap/nguoi-dung' },
    { label: 'Chức vụ & phân quyền', path: '/thiet-lap/chuc-vu' },
  ]},
];
