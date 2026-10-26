// Kiểm tra từng trang giao diện theo chức vụ trên bản build production, kể cả trang chi tiết và trang sửa
// của từng chứng từ: mở bằng đường dẫn trực tiếp, chờ tải xong, đối chiếu với quyền trang trong
// frontend/src/app/core/auth/route-access.ts. Kết quả là ui.json cho tools/qa/build-report.mjs.
//
//   node tools/qa/ui-pages.mjs <file .json>
//
// Cần máy chủ đang phục vụ bản build (backend + frontend/dist) trên database kiểm thử, và:
//   QA_BASE_URL        mặc định http://localhost:3000
//   QA_ADMIN_EMAIL     mặc định admin@ninhtrang.local (chức vụ CEO, không bị buộc đổi mật khẩu)
//   QA_ADMIN_PASSWORD  bắt buộc
// Mỗi chức vụ đang dùng có một tài khoản qa.ui.<mã chức vụ>@qa.local; chạy lại thì đặt lại mật khẩu của nó.
// Chỉ chạy trên database kiểm thử: script tạo tài khoản và đặt lại mật khẩu.
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(join(ROOT, 'frontend/package.json'))('playwright');
// route-access.ts has no imports and only erasable types, so Node loads it as is.
const { permissionsForUrl } = await import(new URL('../../frontend/src/app/core/auth/route-access.ts', import.meta.url).href);

const [out] = process.argv.slice(2);
const BASE = (process.env.QA_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL ?? 'admin@ninhtrang.local';
const ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD;
if (!out || !ADMIN_PASSWORD) {
  console.error('Cách dùng: QA_ADMIN_PASSWORD=… node tools/qa/ui-pages.mjs <file .json>');
  process.exit(2);
}

// ---------------------------------------------------------------- API của máy chủ

async function call(token, method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

const login = await call(null, 'POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
if (login.user.mustChangePassword) throw new Error(`${ADMIN_EMAIL} đang bị buộc đổi mật khẩu: đổi trước rồi chạy lại.`);
const admin = (method, path, body) => call(login.accessToken, method, path, body);

const roles = (await admin('GET', '/roles')).filter((r) => r.isActive);
const users = await admin('GET', '/users');
const accounts = [];
for (const role of roles) {
  const email = `qa.ui.${role.id}@qa.local`;
  const password = `Qa-${randomBytes(9).toString('base64url')}9a`;
  let user = users.find((u) => u.email === email);
  if (!user) user = await admin('POST', '/users', { name: `QA giao diện ${role.name}`, email, roleId: role.id, password });
  else if (user.roleId !== role.id) await admin('PUT', `/users/${user.id}`, { name: user.name, email, roleId: role.id });
  if (user.isLocked) await admin('POST', `/users/${user.id}/unlock`);
  await admin('POST', `/users/${user.id}/reset-password`, { password, mustChange: false });
  accounts.push({ role, email, password });
}

// A seller without order.view_all sees only the đơn hàng and báo giá they sell or made: each such account gets one
// of each in its own name (made once, found again by the QA mark), and must not see anyone else's.
const QA_MARK = 'QA giao diện';
const sellerOnly = (role) => role.permissions.includes('order.create') && !role.permissions.includes('order.view_all');
const item = (await admin('GET', '/products')).find((p) => p.isActive && p.type === 'VAT_TU');
const customerId = (await admin('GET', '/customers')).find((c) => c.isActive)?.id;
const lines = [{ productId: item.id, unit: item.baseUnit, quantity: 1, unitPrice: item.retailPrice, warehouseId: item.defaultWarehouseId ?? 'wh-ninhtrang' }];
const today = new Date().toISOString().slice(0, 10);
async function ownDocs(salesRep) {
  const order = (await admin('GET', '/sales-orders')).find((o) => o.description === QA_MARK && o.salesRep === salesRep && o.status !== 'HUY')
    ?? await admin('POST', '/sales-orders', { customerId, tagIds: [], orderDate: today, discountAmount: 0, salesRep, description: QA_MARK, lines });
  const quote = (await admin('GET', '/quotations')).find((q) => q.description === QA_MARK && q.salesRep === salesRep && q.status === 'MOI')
    ?? await admin('POST', '/quotations', { customerId, quoteDate: today, discountAmount: 0, salesRep, description: QA_MARK, lines });
  return { salesOrder: order.id, salesOrderOpen: order.id, quotation: quote.id, quotationOpen: quote.id };
}
const adminDocs = await ownDocs(ADMIN_EMAIL);
for (const a of accounts) a.own = sellerOnly(a.role) ? await ownDocs(a.email) : {};

// One record of each kind to open; edit pages need one that can still be edited.
const first = async (path, ok = () => true) => (await admin('GET', path)).find(ok)?.id;
const ids = {
  product: await first('/products', (p) => p.isActive),
  warehouseVoucher: await first('/warehouse-vouchers'),
  productionOrder: await first('/production-orders'),
  supplier: await first('/suppliers', (s) => s.isActive),
  purchaseOrder: await first('/purchase-orders'),
  purchaseOrderDraft: await first('/purchase-orders', (o) => o.status === 'NHAP'),
  customer: await first('/customers', (c) => c.isActive),
  salesOrder: await first('/sales-orders'),
  salesOrderOpen: await first('/sales-orders', (o) => (o.status === 'CHO_GIAO_HANG' || o.status === 'CHO_SAN_XUAT') && !o.receivedValue),
  quotation: await first('/quotations'),
  quotationOpen: await first('/quotations', (q) => q.status === 'MOI'),
  trip: await first('/delivery-trips'),
  vehicle: await first('/vehicles'),
  cashVoucher: await first('/cash-vouchers'),
  warehouse: await first('/warehouses'),
  user: await first('/users', (u) => !u.email.startsWith('qa.')),
};

// ---------------------------------------------------------------- các trang

/**
 * [nhãn, mẫu đường dẫn, id để mở ('' = trang không cần id), của người khác?] → { label, pattern, path (null = thiếu
 * dữ liệu để mở), other }. `own` = đơn và báo giá đứng tên chính tài khoản này (người bán chỉ thấy của mình).
 */
const pagesFor = (own) => [
  ['Tổng quan', '/tong-quan'], ['Báo cáo', '/bao-cao'],
  ['Hàng hoá', '/hang-hoa'], ['Thêm hàng hoá', '/hang-hoa/them'],
  ['Chi tiết hàng hoá', '/hang-hoa/:id', ids.product], ['Sửa hàng hoá', '/hang-hoa/:id/sua', ids.product],
  ['Tồn kho', '/kho/ton-kho'], ['Phiếu kho', '/kho/phieu'],
  ['Lập phiếu nhập kho', '/kho/phieu/lap/in', ''], ['Lập phiếu xuất kho', '/kho/phieu/lap/out', ''],
  ['Lập phiếu chuyển kho', '/kho/phieu/lap/transfer', ''], ['Lập phiếu kiểm kê', '/kho/phieu/lap/adjust', ''],
  ['Chi tiết phiếu kho', '/kho/phieu/:id', ids.warehouseVoucher],
  ['Lệnh sản xuất', '/san-xuat'], ['Chi tiết lệnh sản xuất', '/san-xuat/:id', ids.productionOrder],
  ['Nhà cung cấp', '/nha-cung-cap'], ['Thêm nhà cung cấp', '/nha-cung-cap/them'],
  ['Chi tiết nhà cung cấp', '/nha-cung-cap/:id', ids.supplier], ['Sửa nhà cung cấp', '/nha-cung-cap/:id/sua', ids.supplier],
  ['Đơn nhập hàng', '/mua-hang'], ['Lập đơn nhập', '/mua-hang/them'],
  ['Chi tiết đơn nhập', '/mua-hang/:id', ids.purchaseOrder], ['Sửa đơn nhập (Nháp)', '/mua-hang/:id/sua', ids.purchaseOrderDraft],
  ['Công nợ phải trả', '/cong-no/nha-cung-cap'],
  ['Khách hàng', '/khach-hang'], ['Thêm khách hàng', '/khach-hang/them-moi'],
  ['Chi tiết khách hàng', '/khach-hang/:id', ids.customer], ['Sửa khách hàng', '/khach-hang/:id/sua', ids.customer],
  ['Đơn hàng bán', '/don-hang'], ['Lập đơn hàng', '/don-hang/them-moi'],
  ['Chi tiết đơn hàng', '/don-hang/:id', own.salesOrder ?? ids.salesOrder], ['Sửa đơn hàng (chưa giao)', '/don-hang/:id/sua', own.salesOrderOpen ?? ids.salesOrderOpen],
  ['Đơn hàng của người bán khác', '/don-hang/:id', adminDocs.salesOrder, true],
  ['Báo giá', '/bao-gia'], ['Lập báo giá', '/bao-gia/them-moi'],
  ['Chi tiết báo giá', '/bao-gia/:id', own.quotation ?? adminDocs.quotation], ['Sửa báo giá (Mới)', '/bao-gia/:id/sua', own.quotationOpen ?? adminDocs.quotationOpen],
  ['Báo giá của người bán khác', '/bao-gia/:id', adminDocs.quotation, true],
  ['Bảng giá', '/bang-gia'], ['Khuyến mãi', '/khuyen-mai'],
  ['Chuyến giao hàng', '/giao-hang'], ['Chi tiết chuyến', '/giao-hang/:id', ids.trip],
  ['Danh mục xe', '/xe'], ['Chi tiết xe', '/xe/:id', ids.vehicle],
  ['Công nợ phải thu', '/cong-no/khach-hang'], ['Tuổi nợ', '/cong-no/tuoi-no'], ['Nhắc nợ', '/cong-no/nhac-no'],
  ['Phiếu thu chi', '/thu-chi'], ['Lập phiếu thu', '/thu-chi/lap/thu', ''], ['Lập phiếu chi', '/thu-chi/lap/chi', ''],
  ['Chi tiết phiếu thu chi', '/thu-chi/:id', ids.cashVoucher],
  ['Tài khoản tiền', '/thu-chi/tai-khoan'], ['Loại thu chi', '/thu-chi/loai'],
  ['Thông tin công ty', '/thiet-lap/cong-ty'], ['Kho', '/thiet-lap/kho'], ['Chi tiết kho', '/thiet-lap/kho/:id', ids.warehouse],
  ['Nhóm hàng', '/thiet-lap/nhom-hang'], ['Thẻ đánh dấu', '/thiet-lap/the'],
  ['Người dùng', '/thiet-lap/nguoi-dung'], ['Chi tiết người dùng', '/thiet-lap/nguoi-dung/:id', ids.user],
  ['Chức vụ & phân quyền', '/thiet-lap/chuc-vu'], ['Màu hiển thị', '/thiet-lap/mau-hien-thi'], ['Nhật ký hoạt động', '/thiet-lap/nhat-ky'],
  ['Đổi mật khẩu', '/doi-mat-khau'],
].map(([label, pattern, id, other = false]) => ({
  label, pattern, other, path: id === undefined || id === '' ? (pattern.includes(':id') ? null : pattern) : pattern.replace(':id', id),
}));

// ---------------------------------------------------------------- chạy

const browser = await chromium.launch();
const cases = [];
const add = (c) => cases.push({ id: `GD-${String(cases.length + 1).padStart(3, '0')}`, ...c });

for (const { role, email, password, own } of accounts) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const problems = [];
  page.on('response', (r) => {
    if (r.url().includes('/api/') && (r.status() === 403 || r.status() >= 500)) problems.push(`${r.request().method()} ${new URL(r.url()).pathname} ${r.status()}`);
  });
  page.on('pageerror', (e) => problems.push(`lỗi trang: ${e.message.slice(0, 120)}`));

  await page.goto(`${BASE}/login`);
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
  await page.waitForLoadState('networkidle');

  for (const p of pagesFor(own)) {
    const need = permissionsForUrl(p.pattern.replace(':id', 'x'));
    const allowed = !need || need.some((code) => role.permissions.includes(code));
    // Allowed onto the page, but the record belongs to another seller: the server answers 404, the page says so.
    const hidden = allowed && p.other && sellerOnly(role);
    const steps = [`Đăng nhập ${email}`, `Mở ${p.path ?? p.pattern} (gõ đường dẫn trực tiếp)`, 'Chờ trang tải xong, ghi lại trang cuối cùng hiển thị và các lệnh API lỗi (403/5xx)'];
    const rule = need ? `quyền trang: ${need.join(' hoặc ')}` : 'mọi người đã đăng nhập';
    const expected = hidden ? `Trang báo "Không tìm thấy…": chức vụ không có order.view_all chỉ xem chứng từ mình bán hoặc lập (${rule})`
      : allowed ? `Mở được trang, không có lệnh API nào bị 403/5xx (${rule})` : `Không mở được: chuyển về trang chủ của chức vụ (${rule})`;
    if (!p.path) {
      add({ label: p.label, page: p.pattern, role: role.name, steps, expected, actual: 'Không có bản ghi phù hợp trong dữ liệu kiểm thử để mở', result: 'Không đạt' });
      continue;
    }
    problems.length = 0;
    await page.goto(`${BASE}${p.path}`);
    await page.waitForLoadState('networkidle');
    const final = new URL(page.url()).pathname;
    const notFound = await page.locator('h3', { hasText: /^\s*Không tìm thấy/ }).first().textContent({ timeout: 500 }).catch(() => null);
    const errors = [...problems];
    let actual;
    let ok;
    if (hidden) {
      ok = final === p.path && !!notFound && !errors.length;
      actual = notFound ? `Trang báo "${notFound.trim()}"` : final !== p.path ? `Bị chuyển về ${final}` : `Mở được chứng từ của người khác`;
    } else if (allowed) {
      ok = final === p.path && !errors.length && !notFound;
      actual = final !== p.path ? `Bị chuyển về ${final}` : notFound ? `Trang báo "${notFound.trim()}"` : `Mở được ${p.path}`;
    } else {
      ok = final !== p.path && !errors.some((e) => / 5\d\d$|lỗi trang/.test(e));
      actual = final !== p.path ? `Bị chuyển về ${final}` : `Vẫn mở được ${p.path}`;
    }
    if (errors.length) actual += `; lỗi: ${errors.join(', ')}`;
    add({ label: p.label, page: p.pattern, role: role.name, steps, expected, actual, result: ok ? 'Đạt' : 'Không đạt' });
  }
  await context.close();
  const mine = cases.filter((c) => c.role === role.name);
  console.log(`${role.name}: ${mine.filter((c) => c.result === 'Đạt').length}/${mine.length} đạt`);
}
await browser.close();

writeFileSync(out, JSON.stringify(cases, null, 2));
const failed = cases.filter((c) => c.result !== 'Đạt');
console.log(`Đã ghi ${out}: ${cases.length} ca, ${failed.length} không đạt.`);
for (const c of failed) console.log(`  ${c.id} ${c.role} ${c.page}: ${c.actual}`);
process.exit(failed.length ? 1 : 0);
