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
  ]},
  { key: 'order', permissions: [
    { code: 'order.view', label: 'Xem đơn hàng' },
    { code: 'order.view_all', label: 'Xem đơn của mọi người bán' },
    { code: 'order.create', label: 'Tạo đơn hàng' },
    { code: 'order.update', label: 'Sửa đơn hàng' },
    { code: 'order.cancel', label: 'Huỷ đơn hàng' },
    { code: 'order.update_price', label: 'Sửa đơn giá trên đơn' },
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
  ]},
  { key: 'voucher', permissions: [
    { code: 'voucher.view', label: 'Xem phiếu thu chi' },
    { code: 'voucher.create_receipt', label: 'Lập phiếu thu' },
    { code: 'voucher.create_payment', label: 'Lập phiếu chi' },
    { code: 'voucher.cancel', label: 'Huỷ phiếu thu chi' },
    { code: 'voucher.manage_category', label: 'Quản lý loại thu chi' },
    { code: 'voucher.manage_account', label: 'Quản lý tài khoản tiền' },
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
];

const ALL_PERMISSION_CODES = PERMISSION_MODULES.flatMap((m) => m.permissions.map((p) => p.code));

// Coarse role -> permission-prefix mapping. Tune per module boundaries once
// real business rules are confirmed; counts here are illustrative, not exact
// matches to the source app's per-role totals.
const ROLE_PERMISSION_PREFIXES: Record<string, string[]> = {
  'Quản lý': ['*'].concat(['product.view_cost_price']), // everything except user/position admin — refined below
  'Kế toán': ['debt.', 'voucher.', 'report.', 'customer.view', 'supplier.view', 'product.view', 'product.view_cost_price', 'order.view', 'purchase.view'],
  Sale: ['customer.', 'order.', 'product.view', 'report.dashboard'],
  'Thủ kho': ['stock.', 'product.view', 'warehouse.', 'category.view', 'report.stock'],
  'Nhân viên giao hàng': ['trip.view', 'trip.deliver', 'trip.ship', 'vehicle.view', 'order.view'],
  'Nhân viên xưởng': ['production.view', 'production.update_progress'],
};

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

  const ceo = await prisma.role.upsert({
    where: { id: 'role-ceo' },
    update: {},
    create: { id: 'role-ceo', name: 'CEO', description: 'Toàn quyền hệ thống. Chức vụ hệ thống — không xoá, không gỡ quyền được.', isSystem: true },
  });
  await prisma.rolePermission.deleteMany({ where: { roleId: ceo.id } });
  await prisma.rolePermission.createMany({
    data: ALL_PERMISSION_CODES.map((code) => ({ roleId: ceo.id, permissionCode: code })),
  });

  const otherRoles: { name: string; description: string }[] = [
    { name: 'Quản lý', description: 'Duyệt đơn, duyệt lệnh sản xuất, xem toàn bộ báo cáo. Xem được giá vốn.' },
    { name: 'Kế toán', description: 'Phiếu thu/chi, công nợ, đối trừ, báo cáo tài chính. Xem được giá vốn.' },
    { name: 'Sale', description: 'Chăm sóc khách, chốt đơn — người đứng tên Người bán trên đơn. KHÔNG xem được giá vốn.' },
    { name: 'Thủ kho', description: 'Phiếu nhập/xuất kho, kiểm kê, chuyển kho. KHÔNG thấy giá nhập và giá vốn.' },
    { name: 'Nhân viên giao hàng', description: 'Xem đơn được giao, chốt giao nhận, nhập số lượng khách thực nhận.' },
    { name: 'Nhân viên xưởng', description: 'Cập nhật tiến độ lệnh sản xuất được giao.' },
  ];

  for (const r of otherRoles) {
    const role = await prisma.role.upsert({
      where: { id: `role-${r.name}` },
      update: {},
      create: { id: `role-${r.name}`, name: r.name, description: r.description, isSystem: false },
    });
    const prefixes = ROLE_PERMISSION_PREFIXES[r.name] ?? [];
    const codes = prefixes.includes('*')
      ? ALL_PERMISSION_CODES.filter((c) => !c.startsWith('user.') && !c.startsWith('position.'))
      : ALL_PERMISSION_CODES.filter((c) => prefixes.some((p) => c.startsWith(p) || c === p));
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({ data: codes.map((code) => ({ roleId: role.id, permissionCode: code })) });
  }

  await prisma.companyInfo.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: 'Công ty Ninh Trang' },
  });

  const warehouseNames = ['Kho Ninh Trang', 'Kho phụ kiện', 'Kho thành phẩm', 'Kho vật tư hàng hoá'];
  for (const name of warehouseNames) {
    const existing = await prisma.warehouse.findFirst({ where: { name } });
    if (!existing) await prisma.warehouse.create({ data: { name } });
  }

  const categoryNames = ['HH', 'Khung tranh', 'Kính - Mica - Hậu', 'Nẹp trang trí', 'Nhôm', 'NVL', 'Phụ kiện', 'TP'];
  for (const name of categoryNames) {
    const existing = await prisma.productCategory.findFirst({ where: { name } });
    if (!existing) await prisma.productCategory.create({ data: { name } });
  }

  const cashAccounts = [
    { name: 'Quỹ tiền mặt', type: 'TIEN_MAT' as const },
    { name: 'Tài khoản ngân hàng', type: 'NGAN_HANG' as const },
  ];
  for (const acc of cashAccounts) {
    const existing = await prisma.cashAccount.findFirst({ where: { name: acc.name } });
    if (!existing) await prisma.cashAccount.create({ data: acc });
  }

  const adminPasswordPlaceholder = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(adminPasswordPlaceholder, 10);
  await prisma.user.upsert({
    where: { email: 'admin@ninhtrang.local' },
    update: {},
    create: {
      name: 'Quản trị hệ thống',
      email: 'admin@ninhtrang.local',
      passwordHash,
      roleId: ceo.id,
      status: 'ACTIVE',
    },
  });

  console.log('Seed complete. Admin login: admin@ninhtrang.local / (see SEED_ADMIN_PASSWORD or default placeholder — rotate immediately).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
