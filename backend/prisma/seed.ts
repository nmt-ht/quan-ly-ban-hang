// Seeds the permission catalog, default roles, base lookups, and one admin
// user. Run with: npm run prisma:seed
// SECURITY: the admin password below is a placeholder — rotate it immediately
// after first login in any non-local environment.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const PERMISSION_MODULES: { key: string; permissions: { code: string; label: string }[] }[] = [
  { key: 'user', permissions: [
    { code: 'user.view', label: 'Xem người dùng' },
    { code: 'user.create', label: 'Thêm người dùng' },
    { code: 'user.update', label: 'Sửa người dùng' },
    { code: 'user.delete', label: 'Xoá người dùng' },
    { code: 'user.reset_password', label: 'Đặt lại mật khẩu' },
  ]},
  { key: 'position', permissions: [
    { code: 'position.view', label: 'Xem chức vụ' },
    { code: 'position.create', label: 'Thêm chức vụ' },
    { code: 'position.update', label: 'Sửa chức vụ' },
    { code: 'position.delete', label: 'Xoá chức vụ' },
    { code: 'position.assign_permission', label: 'Phân quyền cho chức vụ' },
  ]},
  { key: 'company', permissions: [
    { code: 'company.view', label: 'Xem thông tin công ty' },
    { code: 'company.update', label: 'Sửa thông tin công ty' },
    { code: 'email.send', label: 'Gửi email chứng từ cho khách hàng / NCC' },
    { code: 'period.lock', label: 'Khoá sổ / bỏ khoá sổ kỳ kế toán' },
  ]},
  { key: 'einvoice', permissions: [
    { code: 'einvoice.view', label: 'Xem hoá đơn điện tử' },
    { code: 'einvoice.issue', label: 'Phát hành, điều chỉnh, thay thế hoá đơn điện tử' },
    { code: 'einvoice.settings', label: 'Thiết lập kết nối hoá đơn điện tử' },
  ]},
  { key: 'category', permissions: [
    { code: 'category.view', label: 'Xem nhóm hàng' },
    { code: 'category.create', label: 'Thêm nhóm hàng' },
    { code: 'category.update', label: 'Sửa nhóm hàng' },
    { code: 'category.delete', label: 'Xoá nhóm hàng' },
  ]},
  { key: 'warehouse', permissions: [
    { code: 'warehouse.view', label: 'Xem kho' },
    { code: 'warehouse.create', label: 'Thêm kho' },
    { code: 'warehouse.update', label: 'Sửa kho' },
    { code: 'warehouse.delete', label: 'Xoá kho' },
  ]},
  { key: 'tag', permissions: [
    { code: 'tag.view', label: 'Xem thẻ' },
    { code: 'tag.manage', label: 'Quản lý thẻ' },
  ]},
  { key: 'product', permissions: [
    { code: 'product.view', label: 'Xem hàng hoá' },
    { code: 'product.create', label: 'Thêm hàng hoá' },
    { code: 'product.update', label: 'Sửa hàng hoá' },
    { code: 'product.delete', label: 'Ngừng kinh doanh hàng hoá' },
    { code: 'product.import', label: 'Nhập hàng hoá từ Excel' },
    { code: 'product.export', label: 'Xuất danh mục hàng hoá' },
    { code: 'product.manage_image', label: 'Quản lý ảnh hàng hoá' },
  ]},
  { key: 'price', permissions: [
    { code: 'product.update_price', label: 'Sửa giá bán' },
    { code: 'product.view_cost_price', label: 'Xem giá vốn' },
    { code: 'pricelist.manage', label: 'Quản lý bảng giá' },
    { code: 'promotion.manage', label: 'Quản lý khuyến mãi' },
  ]},
  { key: 'bom', permissions: [
    { code: 'bom.view', label: 'Xem định mức' },
    { code: 'bom.manage', label: 'Khai báo định mức' },
  ]},
  { key: 'customer', permissions: [
    { code: 'customer.view', label: 'Xem khách hàng' },
    { code: 'customer.create', label: 'Thêm khách hàng' },
    { code: 'customer.update', label: 'Sửa khách hàng' },
    { code: 'customer.delete', label: 'Ngừng theo dõi khách hàng' },
  ]},
  { key: 'supplier', permissions: [
    { code: 'supplier.view', label: 'Xem nhà cung cấp' },
    { code: 'supplier.create', label: 'Thêm nhà cung cấp' },
    { code: 'supplier.update', label: 'Sửa nhà cung cấp' },
    { code: 'supplier.delete', label: 'Ngừng hợp tác nhà cung cấp' },
    { code: 'supplier.manage_product', label: 'Quản lý danh mục hàng của NCC' },
  ]},
  { key: 'stock', permissions: [
    { code: 'stock.view', label: 'Xem tồn kho' },
    { code: 'stock.view_value', label: 'Xem giá trị tồn kho' },
  ]},
  { key: 'stock_voucher', permissions: [
    { code: 'stock.import', label: 'Lập phiếu nhập kho' },
    { code: 'stock.import_price', label: 'Nhập đơn giá trên phiếu nhập' },
    { code: 'stock.export', label: 'Lập phiếu xuất kho' },
    { code: 'stock.transfer', label: 'Chuyển kho' },
    { code: 'stock.adjust', label: 'Điều chỉnh tồn kho' },
    { code: 'stock.cancel', label: 'Huỷ phiếu kho' },
    { code: 'stock.overdraw', label: 'Xuất vượt tồn kho' },
  ]},
  { key: 'stocktake', permissions: [
    { code: 'stock.stocktake', label: 'Kiểm kê kho' },
  ]},
  { key: 'purchase', permissions: [
    { code: 'purchase.view', label: 'Xem đơn nhập hàng' },
    { code: 'purchase.create', label: 'Tạo đơn nhập hàng' },
    { code: 'purchase.update', label: 'Sửa đơn nhập hàng' },
    { code: 'purchase.approve', label: 'Duyệt đơn nhập hàng' },
    { code: 'purchase.receive', label: 'Xác nhận nhận hàng' },
    { code: 'purchase.cancel', label: 'Huỷ đơn nhập hàng' },
    { code: 'purchase.return', label: 'Trả lại hàng mua' },
  ]},
  { key: 'order', permissions: [
    { code: 'order.view', label: 'Xem đơn hàng' },
    { code: 'order.view_all', label: 'Xem đơn của mọi người bán' },
    { code: 'order.create', label: 'Tạo đơn hàng' },
    { code: 'order.update', label: 'Sửa đơn hàng' },
    { code: 'order.cancel', label: 'Huỷ đơn hàng' },
    { code: 'order.update_price', label: 'Sửa đơn giá trên đơn' },
    { code: 'order.discount', label: 'Chiết khấu ngoài khuyến mãi' },
    { code: 'order.below_min_price', label: 'Bán dưới giá tối thiểu' },
    { code: 'order.return', label: 'Nhận hàng trả lại' },
  ]},
  { key: 'quote', permissions: [
    { code: 'quote.view', label: 'Xem báo giá' },
    { code: 'quote.create', label: 'Lập báo giá' },
    { code: 'quote.update', label: 'Sửa báo giá' },
    { code: 'quote.cancel', label: 'Huỷ báo giá' },
  ]},
  { key: 'vehicle', permissions: [
    { code: 'vehicle.view', label: 'Xem danh mục xe' },
    { code: 'vehicle.create', label: 'Thêm xe' },
    { code: 'vehicle.update', label: 'Sửa xe' },
    { code: 'vehicle.manage_cost', label: 'Nhập chi phí chuyến xe' },
  ]},
  { key: 'trip', permissions: [
    { code: 'trip.view', label: 'Xem chuyến giao hàng' },
    { code: 'trip.create', label: 'Tạo chuyến giao hàng' },
    { code: 'trip.update', label: 'Sửa chuyến giao hàng' },
    { code: 'trip.ship', label: 'Xuất kho cho chuyến' },
    { code: 'trip.deliver', label: 'Chốt giao hàng với khách' },
    { code: 'trip.return', label: 'Nhập lại kho hàng trả về' },
    { code: 'trip.cancel', label: 'Huỷ chuyến giao hàng' },
  ]},
  { key: 'production', permissions: [
    { code: 'production.view', label: 'Xem lệnh sản xuất' },
    { code: 'production.create', label: 'Tạo lệnh sản xuất' },
    { code: 'production.approve', label: 'Duyệt lệnh sản xuất' },
    { code: 'production.update_progress', label: 'Cập nhật tiến độ sản xuất' },
    { code: 'production.complete', label: 'Nghiệm thu, nhập kho thành phẩm' },
    { code: 'production.cancel', label: 'Huỷ lệnh sản xuất' },
  ]},
  { key: 'debt', permissions: [
    { code: 'debt.view', label: 'Xem công nợ' },
    { code: 'debt.settle', label: 'Đối trừ công nợ' },
    { code: 'debt.adjust', label: 'Điều chỉnh công nợ' },
    { code: 'debt.remind', label: 'Nhắc nợ khách hàng' },
  ]},
  { key: 'voucher', permissions: [
    { code: 'voucher.view', label: 'Xem phiếu thu chi' },
    { code: 'voucher.create_receipt', label: 'Lập phiếu thu' },
    { code: 'voucher.create_payment', label: 'Lập phiếu chi' },
    { code: 'voucher.cancel', label: 'Huỷ phiếu thu chi' },
    { code: 'voucher.manage_category', label: 'Quản lý loại thu chi' },
    { code: 'voucher.manage_account', label: 'Quản lý tài khoản tiền' },
    { code: 'voucher.overdraw', label: 'Chi vượt tồn quỹ' },
  ]},
  { key: 'dashboard', permissions: [
    { code: 'report.dashboard', label: 'Xem trang tổng quan' },
  ]},
  { key: 'report', permissions: [
    { code: 'report.sales', label: 'Báo cáo bán hàng' },
    { code: 'report.stock', label: 'Báo cáo kho' },
    { code: 'report.purchase', label: 'Báo cáo mua hàng' },
    { code: 'report.debt', label: 'Báo cáo công nợ' },
    { code: 'report.cashflow', label: 'Báo cáo dòng tiền' },
    { code: 'report.production', label: 'Báo cáo sản xuất' },
    { code: 'report.delivery', label: 'Báo cáo giao hàng' },
    { code: 'report.view_profit', label: 'Xem lợi nhuận, lãi gộp' },
  ]},
  { key: 'audit', permissions: [
    { code: 'audit.view', label: 'Xem nhật ký hoạt động' },
  ]},
  { key: 'accounting', permissions: [
    { code: 'accounting.view', label: 'Xem sổ sách kế toán (nhật ký, sổ cái, cân đối)' },
    { code: 'accounting.manual', label: 'Nhập bút toán thủ công' },
    { code: 'accounting.reverse', label: 'Đảo / huỷ bút toán' },
    { code: 'accounting.opening', label: 'Nhập số dư đầu kỳ' },
    { code: 'accounting.manage_account', label: 'Quản lý hệ thống tài khoản' },
    { code: 'accounting.payroll', label: 'Quản lý nhân viên, tính và chốt bảng lương' },
  ]},
];

const ALL_PERMISSION_CODES = PERMISSION_MODULES.flatMap((m) => m.permissions.map((p) => p.code));

// Default grants of the 7 built-in roles. Keep identical to the frontend's
// features/settings/roles-permissions/role.rules.ts (same ids, same codes):
// CEO 111 · Quản lý 102 · Kế toán 52 · Sale 20 · Thủ kho 19 · NV giao hàng 6 · NV xưởng 5.
const WITHOUT_ADMIN = [
  'user.create', 'user.update', 'user.delete', 'user.reset_password',
  'position.create', 'position.update', 'position.delete', 'position.assign_permission',
  'company.update',
];
const ACCOUNTANT = [
  'company.view', 'category.view', 'warehouse.view', 'tag.view',
  'product.view', 'product.export', 'product.view_cost_price', 'bom.view',
  'customer.view', 'customer.create', 'customer.update', 'customer.delete',
  'supplier.view', 'supplier.create', 'supplier.update', 'supplier.manage_product',
  'stock.view', 'stock.view_value',
  'purchase.view', 'purchase.create', 'purchase.update', 'purchase.approve', 'purchase.cancel', 'purchase.return', 'period.lock',
  'order.view', 'order.view_all', 'order.return', 'quote.view', 'vehicle.view', 'vehicle.manage_cost', 'trip.view', 'production.view',
  'debt.view', 'debt.settle', 'debt.adjust', 'debt.remind',
  'voucher.view', 'voucher.create_receipt', 'voucher.create_payment', 'voucher.cancel', 'voucher.manage_category', 'voucher.manage_account',
  'report.dashboard', 'report.sales', 'report.stock', 'report.purchase', 'report.debt', 'report.cashflow', 'report.production', 'report.delivery',
  'report.view_profit', 'einvoice.view', 'einvoice.issue',
  'accounting.view', 'accounting.manual', 'accounting.reverse', 'accounting.opening', 'accounting.manage_account', 'accounting.payroll',
];
const SALE = [
  'customer.view', 'customer.create', 'customer.update', 'customer.delete',
  'order.view', 'order.create', 'order.update', 'order.cancel', 'order.update_price',
  'quote.view', 'quote.create', 'quote.update', 'quote.cancel',
  'product.view', 'stock.view', 'tag.view', 'production.view', 'trip.view', 'report.dashboard', 'report.sales', 'einvoice.view',
];
const STOREKEEPER = [
  'warehouse.view', 'category.view', 'product.view', 'bom.view', 'supplier.view', 'order.view',
  'stock.view', 'stock.import', 'stock.export', 'stock.transfer', 'stock.adjust', 'stock.cancel', 'stock.stocktake',
  'purchase.view', 'purchase.receive', 'production.view', 'trip.view', 'trip.ship', 'trip.return',
];
const DELIVERY = ['order.view', 'customer.view', 'product.view', 'vehicle.view', 'trip.view', 'trip.deliver'];
const WORKSHOP = ['production.view', 'production.update_progress', 'bom.view', 'product.view', 'stock.view'];

const ROLES: { id: string; name: string; description: string; isSystem?: boolean; codes: string[] }[] = [
  { id: 'role-ceo', name: 'CEO', description: 'Toàn quyền hệ thống. Chức vụ hệ thống — không xoá, không gỡ quyền được.', isSystem: true, codes: ALL_PERMISSION_CODES },
  { id: 'role-manager', name: 'Quản lý', description: 'Duyệt đơn, duyệt lệnh sản xuất, xem toàn bộ báo cáo. Xem được giá vốn.', codes: ALL_PERMISSION_CODES.filter((c) => !WITHOUT_ADMIN.includes(c)) },
  { id: 'role-accountant', name: 'Kế toán', description: 'Phiếu thu/chi, công nợ, đối trừ, báo cáo tài chính. Xem được giá vốn.', codes: ACCOUNTANT },
  { id: 'role-sale', name: 'Sale', description: 'Chăm sóc khách, chốt đơn — người đứng tên Người bán trên đơn. KHÔNG xem được giá vốn.', codes: SALE },
  { id: 'role-thukho', name: 'Thủ kho', description: 'Phiếu nhập/xuất kho, kiểm kê, chuyển kho. KHÔNG thấy giá nhập và giá vốn.', codes: STOREKEEPER },
  { id: 'role-giaohang', name: 'Nhân viên giao hàng', description: 'Xem đơn được giao, chốt giao nhận, nhập số lượng khách thực nhận.', codes: DELIVERY },
  { id: 'role-xuong', name: 'Nhân viên xưởng', description: 'Cập nhật tiến độ lệnh sản xuất được giao.', codes: WORKSHOP },
];

const CASH_CATEGORIES = [
  { code: 'THU_KH', name: 'Thu tiền khách hàng', kind: 'THU', partnerType: 'KHACH_HANG', isDefault: true, sortOrder: 0, defaultAccountCode: '131' },
  { code: 'THU_KHAC', name: 'Thu khác', kind: 'THU', partnerType: 'KHAC', isDefault: false, sortOrder: 1, defaultAccountCode: '711' },
  { code: 'CHI_NCC', name: 'Chi trả nhà cung cấp', kind: 'CHI', partnerType: 'NHA_CUNG_CAP', isDefault: true, sortOrder: 2, defaultAccountCode: '331' },
  { code: 'CHI_KHAC', name: 'Chi khác', kind: 'CHI', partnerType: 'KHAC', isDefault: false, sortOrder: 3, defaultAccountCode: '642' },
  { code: 'CHI_LUONG', name: 'Chi lương nhân viên', kind: 'CHI', partnerType: 'KHAC', isDefault: false, sortOrder: 4, defaultAccountCode: '334' },
  { code: 'CHI_THUE', name: 'Nộp thuế GTGT', kind: 'CHI', partnerType: 'KHAC', isDefault: false, sortOrder: 5, defaultAccountCode: '3331' },
  { code: 'CHI_THUE_TNDN', name: 'Nộp thuế TNDN', kind: 'CHI', partnerType: 'KHAC', isDefault: false, sortOrder: 20, defaultAccountCode: '3334' },
  // Chuyển tiền nội bộ (CashTransfer): hai phiếu qua TK 113 tiền đang chuyển; tên khớp NOI_BO_CATEGORIES trong cash-transfers.ts.
  { code: 'CHI_NOIBO', name: 'Chuyển tiền nội bộ', kind: 'CHI', partnerType: 'KHAC', isDefault: false, sortOrder: 6, defaultAccountCode: '113' },
  { code: 'THU_NOIBO', name: 'Nhận tiền chuyển nội bộ', kind: 'THU', partnerType: 'KHAC', isDefault: false, sortOrder: 7, defaultAccountCode: '113' },
  // Kiểm kê quỹ: phiếu xử lý chênh lệch (CashCountsService.resolve); tên khớp COUNT_CATEGORY_NAMES.
  { code: 'CHI_THIEU_QUY_CHO_XL', name: 'Thiếu quỹ chờ xử lý', kind: 'CHI', partnerType: 'KHAC', isDefault: false, sortOrder: 8, defaultAccountCode: '1381' },
  { code: 'CHI_THIEU_QUY', name: 'Thiếu quỹ tính vào chi phí khác', kind: 'CHI', partnerType: 'KHAC', isDefault: false, sortOrder: 9, defaultAccountCode: '811' },
  { code: 'THU_THUA_QUY_CHO_XL', name: 'Thừa quỹ chờ giải quyết', kind: 'THU', partnerType: 'KHAC', isDefault: false, sortOrder: 10, defaultAccountCode: '3381' },
  { code: 'THU_THUA_QUY', name: 'Thừa quỹ tính vào thu nhập khác', kind: 'THU', partnerType: 'KHAC', isDefault: false, sortOrder: 11, defaultAccountCode: '711' },
] as const;

// Hệ thống tài khoản TT133 (bộ rút gọn cho nghiệp vụ hiện có). [code, name, parentCode, kind, normalSide, isDetail]
const CHART = [
  ['111', 'Tiền mặt', null, 'TAI_SAN', 'NO', true],
  ['112', 'Tiền gửi ngân hàng', null, 'TAI_SAN', 'NO', true],
  ['113', 'Tiền đang chuyển', null, 'TAI_SAN', 'NO', true],
  ['131', 'Phải thu của khách hàng', null, 'TAI_SAN', 'NO', true],
  ['133', 'Thuế GTGT được khấu trừ', null, 'TAI_SAN', 'NO', true],
  ['138', 'Phải thu khác', null, 'TAI_SAN', 'NO', false],
  ['1381', 'Tài sản thiếu chờ xử lý', '138', 'TAI_SAN', 'NO', true],
  ['141', 'Tạm ứng', null, 'TAI_SAN', 'NO', true],
  ['152', 'Nguyên liệu, vật liệu', null, 'TAI_SAN', 'NO', true],
  ['153', 'Công cụ, dụng cụ', null, 'TAI_SAN', 'NO', true],
  ['154', 'Chi phí sản xuất, kinh doanh dở dang', null, 'TAI_SAN', 'NO', true],
  ['155', 'Thành phẩm', null, 'TAI_SAN', 'NO', true],
  ['156', 'Hàng hóa', null, 'TAI_SAN', 'NO', true],
  ['211', 'Tài sản cố định', null, 'TAI_SAN', 'NO', true],
  ['214', 'Hao mòn tài sản cố định', null, 'TAI_SAN', 'CO', true],
  ['242', 'Chi phí trả trước', null, 'TAI_SAN', 'NO', true],
  ['331', 'Phải trả cho người bán', null, 'NO_PHAI_TRA', 'CO', true],
  ['333', 'Thuế và các khoản phải nộp Nhà nước', null, 'NO_PHAI_TRA', 'CO', false],
  ['3331', 'Thuế GTGT phải nộp', '333', 'NO_PHAI_TRA', 'CO', true],
  ['3334', 'Thuế thu nhập doanh nghiệp', '333', 'NO_PHAI_TRA', 'CO', true],
  ['3335', 'Thuế thu nhập cá nhân', '333', 'NO_PHAI_TRA', 'CO', true],
  ['338', 'Phải trả, phải nộp khác', null, 'NO_PHAI_TRA', 'CO', false],
  ['3381', 'Tài sản thừa chờ giải quyết', '338', 'NO_PHAI_TRA', 'CO', true],
  ['3382', 'Kinh phí công đoàn', '338', 'NO_PHAI_TRA', 'CO', true],
  ['3383', 'Bảo hiểm xã hội', '338', 'NO_PHAI_TRA', 'CO', true],
  ['3384', 'Bảo hiểm y tế', '338', 'NO_PHAI_TRA', 'CO', true],
  ['3385', 'Bảo hiểm thất nghiệp', '338', 'NO_PHAI_TRA', 'CO', true],
  ['334', 'Phải trả người lao động', null, 'NO_PHAI_TRA', 'CO', true],
  ['411', 'Vốn đầu tư của chủ sở hữu', null, 'VON_CSH', 'CO', true],
  ['421', 'Lợi nhuận sau thuế chưa phân phối', null, 'VON_CSH', 'CO', true],
  ['511', 'Doanh thu bán hàng và cung cấp dịch vụ', null, 'DOANH_THU', 'CO', true],
  ['515', 'Doanh thu hoạt động tài chính', null, 'DOANH_THU', 'CO', true],
  ['632', 'Giá vốn hàng bán', null, 'CHI_PHI', 'NO', true],
  ['635', 'Chi phí tài chính', null, 'CHI_PHI', 'NO', true],
  ['641', 'Chi phí bán hàng', null, 'CHI_PHI', 'NO', true],
  ['642', 'Chi phí quản lý kinh doanh', null, 'CHI_PHI', 'NO', true],
  ['711', 'Thu nhập khác', null, 'DOANH_THU', 'CO', true],
  ['811', 'Chi phí khác', null, 'CHI_PHI', 'NO', true],
  ['821', 'Chi phí thuế thu nhập doanh nghiệp', null, 'CHI_PHI', 'NO', true],
  ['911', 'Xác định kết quả kinh doanh', null, 'KQKD', 'NO', true],
] as const;

// Một doanh nghiệp mới tạo từ Quản trị nền tảng (src/platform/tenants.service.ts) passes:
//   SEED_PROFILE=tenant   one "Kho chính", no product groups (default "sample": Ninh Trang's warehouses and groups)
//   SEED_COMPANY_NAME     the company name on the documents (default "Công ty Ninh Trang")
//   SEED_ADMIN_EMAIL      the first CEO account (default admin@ninhtrang.local)
//   SEED_ADMIN_NAME       its display name
const PROFILE = process.env.SEED_PROFILE === 'tenant' ? 'tenant' : 'sample';
const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || 'admin@ninhtrang.local').trim().toLowerCase();

async function main() {
  for (const module of PERMISSION_MODULES) {
    for (const perm of module.permissions) {
      await prisma.permission.upsert({
        where: { code: perm.code },
        update: { label: perm.label, module: module.key },
        create: { code: perm.code, label: perm.label, module: module.key },
      });
    }
  }

  // Built-in roles get their default grants only when first created; later edits made in
  // Chức vụ & phân quyền survive a re-seed. CEO is always reset to every permission.
  for (const r of ROLES) {
    const existing = await prisma.role.findUnique({ where: { id: r.id } });
    if (!existing) {
      await prisma.role.create({ data: { id: r.id, name: r.name, description: r.description, isSystem: !!r.isSystem } });
    }
    if (!existing || r.isSystem) {
      await prisma.rolePermission.deleteMany({ where: { roleId: r.id } });
      await prisma.rolePermission.createMany({ data: r.codes.map((code) => ({ roleId: r.id, permissionCode: code })) });
    }
  }

  // Backfill quyền kế toán mới cho các vai trò mặc định đã tồn tại (chỉ THÊM, không gỡ — tôn trọng chỉnh sửa tay).
  const ACCOUNTING_CODES = ['accounting.view', 'accounting.manual', 'accounting.reverse', 'accounting.opening', 'accounting.manage_account', 'accounting.payroll'];
  for (const roleId of ['role-manager', 'role-accountant']) {
    if (await prisma.role.findUnique({ where: { id: roleId } })) {
      await prisma.rolePermission.createMany({ data: ACCOUNTING_CODES.map((permissionCode) => ({ roleId, permissionCode })), skipDuplicates: true });
    }
  }

  for (const c of CASH_CATEGORIES) {
    await prisma.cashCategory.upsert({ where: { code: c.code }, update: { defaultAccountCode: c.defaultAccountCode }, create: { ...c, isActive: true, isSystem: true } });
  }

  // Hệ thống tài khoản TT133
  for (const [code, name, parentCode, kind, normalSide, isDetail] of CHART) {
    await prisma.account.upsert({
      where: { code },
      update: { name, parentCode: parentCode ?? null, kind, normalSide, isDetail },
      create: { code, name, parentCode: parentCode ?? null, kind, normalSide, isDetail },
    });
  }

  await prisma.companyInfo.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: process.env.SEED_COMPANY_NAME?.trim() || 'Công ty Ninh Trang' },
  });

  if (PROFILE === 'tenant') {
    await prisma.warehouse.upsert({ where: { id: 'wh-main' }, update: {}, create: { id: 'wh-main', code: 'KHO0000001', name: 'Kho chính' } });
  } else {
    await sampleCatalog();
  }

  const cashAccounts = [
    { id: 'acc-cash', name: 'Quỹ tiền mặt', type: 'TIEN_MAT' as const, code: 'TM', isDefault: true, sortOrder: 0 },
    { id: 'acc-bank', name: 'Tài khoản ngân hàng', type: 'NGAN_HANG' as const, sortOrder: 1 },
  ];
  for (const a of cashAccounts) await prisma.cashAccount.upsert({ where: { id: a.id }, update: {}, create: a });

  const adminPasswordPlaceholder = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(adminPasswordPlaceholder, 10);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      id: 'user-admin', // same id as the frontend demo
      name: process.env.SEED_ADMIN_NAME?.trim() || 'Quản trị hệ thống',
      email: ADMIN_EMAIL,
      passwordHash,
      roleId: 'role-ceo',
      status: 'ACTIVE',
      // A doanh nghiệp's first admin gets a password from the platform owner: they choose their own.
      mustChangePassword: PROFILE === 'tenant',
    },
  });

  console.log(`Seed complete. Admin login: ${ADMIN_EMAIL} / (see SEED_ADMIN_PASSWORD or default placeholder — rotate immediately).`);
}

/** Ninh Trang's own warehouses and product groups, which the demo data refers to. */
async function sampleCatalog() {
  // Stable ids, the same as the frontend demo (wh-…, cat-…, acc-…), so data that refers to them lines up.
  const warehouses = [
    { id: 'wh-ninhtrang', code: 'KHO0000001', name: 'Kho Ninh Trang' },
    { id: 'wh-phukien', code: 'KHO0000002', name: 'Kho phụ kiện' },
    { id: 'wh-thanhpham', code: 'KHO0000003', name: 'Kho thành phẩm' },
    { id: 'wh-vattu', code: 'KHO0000004', name: 'Kho vật tư hàng hoá' },
  ];
  for (const w of warehouses) await prisma.warehouse.upsert({ where: { id: w.id }, update: {}, create: w });

  const categories = [
    { id: 'cat-hh', name: 'HH' }, { id: 'cat-khung', name: 'Khung tranh' }, { id: 'cat-kinh', name: 'Kính - Mica - Hậu' },
    { id: 'cat-nep', name: 'Nẹp trang trí' }, { id: 'cat-nhom', name: 'Nhôm' }, { id: 'cat-nvl', name: 'NVL' },
    { id: 'cat-pk', name: 'Phụ kiện' }, { id: 'cat-tp', name: 'TP' },
  ];
  for (const c of categories) await prisma.productCategory.upsert({ where: { id: c.id }, update: {}, create: c });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
