#!/usr/bin/env node
// Sinh dữ liệu mẫu (FAKE) cho Ninh Trang ERP từ MỘT nguồn duy nhất.
// Chạy:  node tools/gen-demo-data.mjs
// Ghi ra:
//   backend/prisma/demo-data.json                    (cho prisma/seed-demo.ts)
//   frontend/src/app/core/data/demo-data.ts          (cho MockDataService)
// Dữ liệu cố định (seeded PRNG) nên chạy lại cho cùng kết quả.
// Toàn bộ tên, số điện thoại, mã số thuế, biển số bên dưới đều là GIẢ.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TODAY = '2026-10-19';
const START = '2026-08-01';

// ---------- tiện ích ----------
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261019);
const r2 = (x) => Math.round(x * 100) / 100;
const r4 = (x) => Math.round(x * 10000) / 10000;
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const minDate = (a, b) => (a < b ? a : b);
const code = (prefix, n) => prefix + String(n).padStart(7, '0');
const iso = (d, t = '02:00:00') => `${d}T${t}.000Z`; // 09:00 giờ Việt Nam
const clean = (o) => JSON.parse(JSON.stringify(o)); // bỏ undefined

// ---------- danh mục cố định (khớp seed gốc & MockDataService) ----------
const WAREHOUSES = [
  { id: 'wh-ninhtrang', name: 'Kho Ninh Trang' },
  { id: 'wh-phukien', name: 'Kho phụ kiện' },
  { id: 'wh-thanhpham', name: 'Kho thành phẩm' },
  { id: 'wh-vattu', name: 'Kho vật tư hàng hoá' },
];
const CATEGORIES = [
  { id: 'cat-hh', name: 'HH' }, { id: 'cat-khung', name: 'Khung tranh' },
  { id: 'cat-kinh', name: 'Kính - Mica - Hậu' }, { id: 'cat-nep', name: 'Nẹp trang trí' },
  { id: 'cat-nhom', name: 'Nhôm' }, { id: 'cat-nvl', name: 'NVL' },
  { id: 'cat-pk', name: 'Phụ kiện' }, { id: 'cat-tp', name: 'TP' },
];
const ACCOUNTS = [
  { id: 'acc-cash', name: 'Quỹ tiền mặt', type: 'TIEN_MAT' },
  { id: 'acc-bank', name: 'Tài khoản ngân hàng', type: 'NGAN_HANG' },
];
// Thông tin hiển thị của tài khoản tiền (giả — không dùng số tài khoản thật).
const ACCOUNT_INFO = {
  'acc-cash': { code: 'TM', note: 'Tiền mặt tại quỹ', isDefault: true, sortOrder: 0 },
  'acc-bank': { code: 'NH-9999', bankName: 'Ngân hàng TMCP (demo)', accountNumber: '0000 9999 0000', accountHolder: 'CONG TY NINH TRANG', branch: 'Chi nhánh TP.HCM', sortOrder: 1 },
};
const TAGS = [
  { id: 'tag-vip', name: 'VIP', color: 'amber', sortOrder: 1 },
  { id: 'tag-quen', name: 'Khách quen', color: 'emerald', sortOrder: 2 },
  { id: 'tag-si', name: 'Tranh sỉ', color: 'blue', sortOrder: 3 },
  { id: 'tag-gap', name: 'Đơn gấp', color: 'red', sortOrder: 4 },
  { id: 'tag-shopee', name: 'Dropship Shopee', color: 'orange', sortOrder: 5 },
].map((t) => ({ ...t, isActive: true }));

const USERS = [
  { id: 'user-admin', name: 'Quản trị hệ thống', email: 'admin@ninhtrang.local', role: 'CEO', lastLogin: '2026-10-19T08:15:00', status: 'ACTIVE', sessions: 1 },
  { id: 'user-quanly', name: 'Nguyễn Minh Quân', email: 'quan.ly@ninhtrang.local', role: 'Quản lý', lastLogin: '2026-10-18T17:40:00', status: 'ACTIVE', sessions: 0 },
  { id: 'user-ketoan', name: 'Lê Thị Hoa', email: 'ke.toan@ninhtrang.local', role: 'Kế toán', lastLogin: '2026-10-19T08:50:00', status: 'ACTIVE', sessions: 1 },
  { id: 'user-sale1', name: 'Trần Văn Nam', email: 'sale1@ninhtrang.local', role: 'Sale', lastLogin: '2026-10-19T09:05:00', status: 'ACTIVE', sessions: 2 },
  { id: 'user-sale2', name: 'Phạm Thị Lan', email: 'sale2@ninhtrang.local', role: 'Sale', lastLogin: '2026-10-18T16:20:00', status: 'ACTIVE', sessions: 0 },
  { id: 'user-thukho', name: 'Võ Văn Khoa', email: 'thu.kho@ninhtrang.local', role: 'Thủ kho', lastLogin: '2026-10-19T07:55:00', status: 'ACTIVE', sessions: 1 },
  { id: 'user-taixe', name: 'Đặng Văn Tài', email: 'tai.xe@ninhtrang.local', role: 'Nhân viên giao hàng', lastLogin: '2026-10-17T06:30:00', status: 'ACTIVE', sessions: 0 },
  { id: 'user-xuong', name: 'Hoàng Văn Xưởng', email: 'xuong@ninhtrang.local', role: 'Nhân viên xưởng', lastLogin: '2026-10-18T07:10:00', status: 'ACTIVE', sessions: 0 },
  { id: 'user-cu', name: 'Lâm Văn Cũ', email: 'nv.da.nghi@ninhtrang.local', role: 'Nhân viên giao hàng', lastLogin: '2026-08-30T10:00:00', status: 'DISABLED', sessions: 0 },
];
const userEmail = Object.fromEntries(USERS.map((u) => [u.id, u.email]));

// ---------- hàng hoá ----------
const P = (id, name, type, unit, cat, wh, min, o = {}) => ({
  id, name, type, baseUnit: unit, categoryId: cat, defaultWarehouseId: wh, minStock: min,
  vatRate: 8, warrantyMonths: 0, retailPrice: 0, wholesalePrice: 0, dropshipPrice: 0, buy: 0,
  isSellable: true, isActive: true, unitConversions: [], ...o,
});
const PRODUCTS = [
  P('vt-nep-soi', 'Nẹp gỗ sồi 2cm (cây 2,4m)', 'VAT_TU', 'Cây', 'cat-nep', 'wh-vattu', 100, { buy: 38000, retailPrice: 55000, wholesalePrice: 48000, dropshipPrice: 52000, origin: 'Việt Nam', unitConversions: [{ unitName: 'Bó', ratioToBaseUnit: 10, price: 480000 }], purchaseNote: 'Mua theo bó 10 cây. Hao hụt cắt góc khoảng 8%.' }),
  P('vt-nep-oc-cho', 'Nẹp gỗ óc chó 3cm (cây 2,4m)', 'VAT_TU', 'Cây', 'cat-nep', 'wh-vattu', 60, { buy: 72000, retailPrice: 105000, wholesalePrice: 92000, dropshipPrice: 98000, origin: 'Mỹ', unitConversions: [{ unitName: 'Bó', ratioToBaseUnit: 10, price: 1020000 }] }),
  P('vt-nhom-vang', 'Nẹp nhôm vàng 1,5cm (cây 2,5m)', 'VAT_TU', 'Cây', 'cat-nhom', 'wh-vattu', 120, { buy: 46000, retailPrice: 68000, wholesalePrice: 58000, dropshipPrice: 63000, origin: 'Việt Nam', unitConversions: [{ unitName: 'Bó', ratioToBaseUnit: 20, price: 1280000 }] }),
  P('vt-nhom-den', 'Nẹp nhôm đen 2cm (cây 2,5m)', 'VAT_TU', 'Cây', 'cat-nhom', 'wh-vattu', 120, { buy: 52000, retailPrice: 76000, wholesalePrice: 65000, dropshipPrice: 71000, origin: 'Việt Nam', unitConversions: [{ unitName: 'Bó', ratioToBaseUnit: 20, price: 1420000 }] }),
  P('vt-kinh-3ly', 'Kính trắng 3mm (tấm 1m × 2m)', 'VAT_TU', 'Tấm', 'cat-kinh', 'wh-vattu', 20, { buy: 165000, retailPrice: 240000, wholesalePrice: 205000, dropshipPrice: 225000, origin: 'Việt Nam' }),
  P('vt-mica-2ly', 'Mica trong 2mm (tấm 1,22m × 2,44m)', 'VAT_TU', 'Tấm', 'cat-kinh', 'wh-vattu', 15, { buy: 420000, retailPrice: 590000, wholesalePrice: 505000, dropshipPrice: 550000, origin: 'Đài Loan' }),
  P('vt-hau-mdf', 'Tấm hậu MDF 3mm (tấm 1,22m × 2,44m)', 'VAT_TU', 'Tấm', 'cat-kinh', 'wh-vattu', 25, { buy: 95000, retailPrice: 140000, wholesalePrice: 120000, dropshipPrice: 132000 }),
  P('vt-go-tho', 'Gỗ sồi thanh thô (cây 2,4m)', 'VAT_TU', 'Cây', 'cat-nvl', 'wh-vattu', 80, { buy: 30000, isSellable: false, vatRate: 0, purchaseNote: 'Nguyên liệu phay nẹp, không bán ra.' }),
  P('vt-moc-treo', 'Móc treo tranh số 3', 'VAT_TU', 'Cái', 'cat-pk', 'wh-phukien', 500, { buy: 600, retailPrice: 1500, wholesalePrice: 1000, dropshipPrice: 1200, unitConversions: [{ unitName: 'Hộp', ratioToBaseUnit: 100, price: 90000 }] }),
  P('vt-dinh-ghim', 'Đinh ghim hậu khung (hộp 500 cái)', 'VAT_TU', 'Hộp', 'cat-pk', 'wh-phukien', 10, { buy: 28000, retailPrice: 45000, wholesalePrice: 38000, dropshipPrice: 42000 }),
  P('vt-day-thep', 'Dây thép treo tranh 0,8mm', 'VAT_TU', 'Cuộn', 'cat-pk', 'wh-phukien', 15, { buy: 22000, retailPrice: 38000, wholesalePrice: 31000, dropshipPrice: 35000 }),
  P('vt-kep-kinh', 'Kẹp giữ kính inox', 'VAT_TU', 'Bộ', 'cat-pk', 'wh-phukien', 100, { buy: 3500, retailPrice: 6500, wholesalePrice: 5000, dropshipPrice: 5500 }),
  P('vt-keo-dan', 'Keo dán gỗ 1kg', 'VAT_TU', 'Chai', 'cat-pk', 'wh-phukien', 20, { buy: 42000, retailPrice: 65000, wholesalePrice: 55000, dropshipPrice: 60000 }),
  P('vt-den-led', 'Đèn rọi tranh LED 6W', 'VAT_TU', 'Cái', 'cat-hh', 'wh-ninhtrang', 10, { buy: 95000, retailPrice: 160000, wholesalePrice: 135000, dropshipPrice: 148000, warrantyMonths: 12, origin: 'Trung Quốc' }),
  P('vt-ve-sinh-kinh', 'Bộ vệ sinh kính', 'VAT_TU', 'Bộ', 'cat-hh', 'wh-ninhtrang', 20, { buy: 18000, retailPrice: 35000, wholesalePrice: 28000, dropshipPrice: 31000 }),
];
// Thành phẩm: khung tranh đóng sẵn theo cỡ
const FRAMES = [
  ['sp-khung-soi-20x30', 'Khung tranh gỗ sồi 20×30 cm', 'soi', 20, 30, 120000],
  ['sp-khung-soi-30x40', 'Khung tranh gỗ sồi 30×40 cm', 'soi', 30, 40, 185000],
  ['sp-khung-soi-40x60', 'Khung tranh gỗ sồi 40×60 cm', 'soi', 40, 60, 295000],
  ['sp-khung-soi-50x70', 'Khung tranh gỗ sồi 50×70 cm', 'soi', 50, 70, 420000],
  ['sp-khung-soi-60x90', 'Khung tranh gỗ sồi 60×90 cm', 'soi', 60, 90, 650000],
  ['sp-khung-nhom-vang-30x40', 'Khung tranh nhôm vàng 30×40 cm', 'nhom-vang', 30, 40, 210000],
  ['sp-khung-nhom-den-40x60', 'Khung tranh nhôm đen 40×60 cm', 'nhom-den', 40, 60, 330000],
  ['sp-khung-oc-cho-40x60', 'Khung tranh gỗ óc chó 40×60 cm', 'oc-cho', 40, 60, 480000],
];
const NEP_OF = { soi: ['vt-nep-soi', 2.4], 'oc-cho': ['vt-nep-oc-cho', 2.4], 'nhom-vang': ['vt-nhom-vang', 2.5], 'nhom-den': ['vt-nhom-den', 2.5] };
const k1000 = (x) => Math.round(x / 1000) * 1000;
const BOM = {}; // finishedId -> [{componentId, quantityPerUnit}]
for (const [id, name, mat, w, h, price] of FRAMES) {
  PRODUCTS.push(P(id, name, 'THANH_PHAM', 'Cái', 'cat-khung', 'wh-thanhpham', 8, {
    retailPrice: price, wholesalePrice: k1000(price * 0.85), dropshipPrice: k1000(price * 0.92),
    warrantyMonths: 6, description: 'Đóng khung hoàn chỉnh gồm nẹp, kính, hậu, móc treo.',
  }));
  const [nepId, nepLen] = NEP_OF[mat];
  const area = (w * h) / 10000;
  const lines = [
    { componentId: nepId, quantityPerUnit: r4((2 * (w + h) / 100 + 0.08) / nepLen) },
    { componentId: 'vt-kinh-3ly', quantityPerUnit: r4((area * 1.15) / 2) },
    { componentId: 'vt-hau-mdf', quantityPerUnit: r4((area * 1.15) / 2.977) },
    { componentId: 'vt-moc-treo', quantityPerUnit: 2 },
    { componentId: 'vt-dinh-ghim', quantityPerUnit: 0.02 },
  ];
  if (mat.startsWith('nhom')) lines.push({ componentId: 'vt-kep-kinh', quantityPerUnit: 1 });
  BOM[id] = lines;
}
PRODUCTS.push(P('sp-kinh-cat', 'Kính cắt theo cỡ 3mm', 'THANH_PHAM', 'Tấm', 'cat-tp', 'wh-thanhpham', 0, { retailPrice: 120000, wholesalePrice: 100000, dropshipPrice: 110000, saleNote: 'Nhập Dài × Rộng (cm) trên dòng đơn.' }));
BOM['sp-kinh-cat'] = [{ componentId: 'vt-kinh-3ly', quantityPerUnit: 0.25 }];
PRODUCTS.push(P('sp-mica-cat', 'Mica cắt theo cỡ 2mm', 'THANH_PHAM', 'Tấm', 'cat-tp', 'wh-thanhpham', 0, { retailPrice: 180000, wholesalePrice: 150000, dropshipPrice: 165000, saleNote: 'Nhập Dài × Rộng (cm) trên dòng đơn.' }));
BOM['sp-mica-cat'] = [{ componentId: 'vt-mica-2ly', quantityPerUnit: 0.15 }];
PRODUCTS.push(P('dv-cong-dong', 'Công đóng khung theo yêu cầu', 'DICH_VU', 'Lần', undefined, undefined, 0, { retailPrice: 50000, wholesalePrice: 45000, dropshipPrice: 48000 }));
PRODUCTS.push(P('dv-giao-hang', 'Phí giao hàng nội thành', 'DICH_VU', 'Chuyến', undefined, undefined, 0, { retailPrice: 30000, wholesalePrice: 30000, dropshipPrice: 30000 }));
{
  const n = { VAT_TU: 0, THANH_PHAM: 0, DICH_VU: 0 };
  const pre = { VAT_TU: 'VT', THANH_PHAM: 'SP', DICH_VU: 'DV' };
  for (const p of PRODUCTS) { n[p.type] += 1; p.code = code(pre[p.type], n[p.type]); }
}
const prodById = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
const hasStock = (pid) => prodById[pid].type !== 'DICH_VU';

// ---------- nhà cung cấp ----------
const SUPPLIERS = [
  { id: 'ncc-1', name: 'Công ty TNHH Gỗ Phú Thịnh', phone: '0901000101', tax: '0300000011', addr: '45 Đường số 7, KCN Vĩnh Lộc, TP.HCM', email: 'kinhdoanh@gophuthinh.demo', creditDays: 30, note: 'Giao hàng thứ 3 và thứ 6 hằng tuần.', credit: true, active: true, supplies: ['vt-nep-soi', 'vt-nep-oc-cho', 'vt-go-tho'] },
  { id: 'ncc-2', name: 'Nhôm Việt Phát', phone: '0901000102', tax: '0300000012', addr: '18 Quốc lộ 1A, Bình Tân, TP.HCM', email: 'banhang@nhomvietphat.demo', creditDays: 30, credit: true, active: true, supplies: ['vt-nhom-vang', 'vt-nhom-den'] },
  { id: 'ncc-3', name: 'Kính Hoàng Gia', phone: '0901000103', tax: '0300000013', addr: '112 Nguyễn Văn Linh, Quận 7, TP.HCM', creditDays: 15, note: 'Kính cắt theo khổ yêu cầu, báo trước 2 ngày.', credit: true, active: true, supplies: ['vt-kinh-3ly', 'vt-mica-2ly', 'vt-hau-mdf'] },
  { id: 'ncc-4', name: 'Phụ kiện Minh Tâm', phone: '0901000104', tax: '0300000014', addr: '9 Lý Chiêu Hoàng, Quận 6, TP.HCM', creditDays: 0, credit: false, active: true, supplies: ['vt-moc-treo', 'vt-dinh-ghim', 'vt-day-thep', 'vt-kep-kinh', 'vt-keo-dan', 'vt-den-led', 'vt-ve-sinh-kinh'] },
  { id: 'ncc-5', name: 'Xưởng gỗ Tư Hiển', phone: '0901000105', tax: undefined, addr: 'Ấp 3, Bình Chánh, TP.HCM', creditDays: 0, note: 'Ngừng hợp tác từ 08/2026 do giao hàng trễ.', credit: false, active: false, supplies: ['vt-go-tho'] },
].map((s, i) => ({ ...s, code: code('NCC', i + 1) }));
const supById = Object.fromEntries(SUPPLIERS.map((s) => [s.id, s]));

// ---------- khách hàng ----------
const CUSTOMERS = [
  { id: 'kh-01', name: 'Nguyễn Thị Mai Anh', type: 'LE', credit: 0, phone: '0912000001', tags: ['tag-quen'], email: 'maianh.demo@example.com' },
  { id: 'kh-02', name: 'Trần Quốc Bảo', type: 'LE', credit: 0, phone: '0912000002', tags: [] },
  { id: 'kh-03', name: 'Lê Ánh Dương', company: 'Cửa hàng Tranh Ánh Dương', type: 'SI', credit: 15, phone: '0912000003', tags: ['tag-vip', 'tag-si'], ctax: '8000000003', note: 'Khách sỉ lớn, thanh toán 15 ngày.' },
  { id: 'kh-04', name: 'Phạm Hồng Phúc', company: 'Công ty TNHH Studio Hình Xưa', type: 'SI', credit: 30, phone: '0912000004', tags: ['tag-vip', 'tag-si'], ctax: '0310000004', email: 'studio.demo@example.com' },
  { id: 'kh-05', name: 'Võ Thị Thu Hà', type: 'DROPSHIP', credit: 0, phone: '0912000005', tags: ['tag-shopee'] },
  { id: 'kh-06', name: 'Đặng Thuỳ Linh', company: 'Shop Decor Nhà Nhỏ', type: 'DROPSHIP', credit: 7, phone: '0912000006', tags: ['tag-shopee'] },
  { id: 'kh-07', name: 'Hoàng Văn Thắng', company: 'Công ty CP Khách sạn Hoa Sen', type: 'SI', credit: 30, phone: '0912000007', tags: ['tag-si'], ctax: '0311000007', note: 'Cần xuất hoá đơn VAT.' },
  { id: 'kh-08', name: 'Bùi Thị Cúc', company: 'Trường Mầm non Hướng Dương', type: 'SI', credit: 30, phone: '0912000008', tags: [] },
  { id: 'kh-09', name: 'Ngô Thanh Tùng', type: 'LE', credit: 0, phone: '0912000009', tags: ['tag-quen'] },
  { id: 'kh-10', name: 'Đỗ Minh Khôi', company: 'Phòng tranh Đồng Xanh', type: 'SI', credit: 15, phone: '0912000010', tags: ['tag-si'], ctax: '0312000010' },
  { id: 'kh-11', name: 'Lương Hải Yến', type: 'LE', credit: 0, phone: '0912000011', tags: [], active: false, note: 'Không còn liên lạc được.' },
  { id: 'kh-12', name: 'Trịnh Văn Lộc', company: 'Nhà hàng Bến Đò', type: 'SI', credit: 15, phone: '0912000012', tags: ['tag-si'] },
].map((c, i) => ({ ...c, code: code('KH', i + 1), active: c.active !== false }));
// Địa chỉ giao hàng (giả) — nhiều điểm giao cho một khách, một điểm mặc định.
const CUSTOMER_ADDRESSES = {
  'kh-01': [{ label: 'Nhà riêng', address: '25 Trần Hưng Đạo, Phường 1, Quận 5, TP.HCM' }],
  'kh-03': [
    { label: 'Cửa hàng', address: '88 Lê Văn Sỹ, Phường 13, Quận 3, TP.HCM', recipientName: 'Lê Ánh Dương', phone: '0912000003' },
    { label: 'Kho', address: '12/4 Bùi Quang Là, Phường 12, Gò Vấp, TP.HCM', recipientName: 'Anh Tài (thủ kho)', phone: '0912100003' },
  ],
  'kh-04': [{ label: 'Studio', address: '41 Nguyễn Thị Minh Khai, Phường Bến Nghé, Quận 1, TP.HCM', recipientName: 'Phạm Hồng Phúc' }],
  'kh-07': [{ label: 'Khách sạn', address: '9 Hoàng Diệu, Phường 12, Quận 4, TP.HCM', recipientName: 'Lễ tân Hoa Sen', phone: '0283900007' }],
  'kh-08': [{ label: 'Trường', address: '150 Phan Văn Trị, Phường 5, Gò Vấp, TP.HCM', recipientName: 'Cô Cúc' }],
  'kh-10': [{ label: 'Phòng tranh', address: '7 Đồng Khởi, Phường Bến Nghé, Quận 1, TP.HCM' }],
  'kh-12': [{ label: 'Nhà hàng', address: '2 Tôn Đức Thắng, Phường Bến Nghé, Quận 1, TP.HCM', recipientName: 'Quản lý ca', phone: '0912100012' }],
};
const custById = Object.fromEntries(CUSTOMERS.map((c) => [c.id, c]));

// ---------- xe & chuyến giao hàng ----------
const VEHICLES = [
  { id: 'xe-1', plate: '51C-123.45', type: 'Xe tải 1,5 tấn', cap: 1500, usual: 'Đặng Văn Tài', maint: false },
  { id: 'xe-2', plate: '51D-678.90', type: 'Xe tải 750kg', cap: 750, usual: 'Lý Văn Sáu', maint: false },
  { id: 'xe-3', plate: '59C-246.81', type: 'Xe ba gác máy', cap: 400, usual: undefined, maint: true },
].map((v, i) => ({ ...v, code: code('XE', i + 1) }));
const vehById = Object.fromEntries(VEHICLES.map((v) => [v.id, v]));
const TRIPS = [
  { id: 'ch-1', date: '2026-08-20', vehicle: 'xe-1', driver: 'Đặng Văn Tài', status: 'HOAN_TAT' },
  { id: 'ch-2', date: '2026-08-28', vehicle: 'xe-2', driver: 'Lý Văn Sáu', status: 'HOAN_TAT' },
  { id: 'ch-3', date: '2026-09-05', vehicle: 'xe-1', driver: 'Đặng Văn Tài', status: 'HOAN_TAT' },
  { id: 'ch-4', date: '2026-09-18', vehicle: 'xe-1', driver: 'Đặng Văn Tài', status: 'HOAN_TAT' },
  { id: 'ch-5', date: '2026-09-30', vehicle: 'xe-2', driver: 'Lý Văn Sáu', status: 'HOAN_TAT' },
  { id: 'ch-6', date: '2026-10-08', vehicle: undefined, plate: '60C-777.77', driver: 'Nguyễn Văn Bốn', status: 'HUY' }, // xe thuê ngoài, huỷ
  { id: 'ch-7', date: '2026-10-12', vehicle: 'xe-1', driver: 'Đặng Văn Tài', status: 'XE_VE_KHO' },
  { id: 'ch-8', date: '2026-10-17', vehicle: 'xe-2', driver: 'Lý Văn Sáu', status: 'DA_XUAT_KHO' },
  { id: 'ch-9', date: '2026-10-19', vehicle: 'xe-1', driver: 'Đặng Văn Tài', status: 'GOM_DON' },
  { id: 'ch-10', date: '2026-10-19', vehicle: undefined, driver: undefined, status: 'GOM_DON' },
];
const tripById = Object.fromEntries(TRIPS.map((t) => [t.id, t]));
const DELIVERED = ['HOAN_THANH', 'GIAO_MOT_PHAN', 'TRA_TOAN_BO'];

// ---------- đơn hàng bán (kịch bản) ----------
// L: [mã hàng, số lượng, {len, wid, unit, ratio, price, note}]; pays: thanh toán sau ngày giao `day` ngày
const SC = [
  { c: 'kh-01', d: '2026-08-12', rep: 'user-sale1', src: 'Zalo', tags: ['tag-quen'], st: 'HOAN_THANH', trip: 'ch-1', L: [['sp-khung-soi-30x40', 2], ['sp-khung-soi-40x60', 1]], desc: 'Khung treo phòng khách', pays: [{ day: 0, ratio: 1, acc: 'acc-cash' }] },
  { c: 'kh-03', d: '2026-08-13', rep: 'user-sale1', src: 'Khách quen', tags: ['tag-vip', 'tag-si'], st: 'HOAN_THANH', trip: 'ch-1', L: [['sp-khung-soi-40x60', 20], ['sp-khung-soi-50x70', 10]], disc: 500000, pays: [{ day: 16, ratio: 0.6, acc: 'acc-bank' }] },
  { c: 'kh-05', d: '2026-08-14', rep: 'user-sale2', src: 'Shopee', tags: ['tag-shopee'], st: 'HOAN_THANH', trip: 'ch-1', L: [['sp-khung-nhom-vang-30x40', 6], ['vt-den-led', 6]], rn: 'Nguyễn Thị Hạnh', rp: '0988000111', pays: [{ day: 0, ratio: 1, acc: 'acc-bank' }] },
  { c: 'kh-04', d: '2026-08-20', rep: 'user-sale1', src: 'Email', tags: ['tag-vip', 'tag-si'], st: 'HOAN_THANH', trip: 'ch-2', L: [['sp-khung-soi-60x90', 12], ['sp-khung-oc-cho-40x60', 8], ['sp-kinh-cat', 5, { len: 80, wid: 120 }]], disc: 1000000, pays: [{ day: 33, ratio: 1, acc: 'acc-bank' }] },
  { c: 'kh-07', d: '2026-08-18', rep: 'user-sale2', src: 'Điện thoại', tags: ['tag-si'], st: 'HOAN_THANH', trip: 'ch-2', L: [['sp-khung-soi-50x70', 30], ['sp-khung-nhom-den-40x60', 30]], desc: 'Khung tranh cho 60 phòng khách sạn', pays: [{ day: 20, ratio: 0.5, acc: 'acc-bank' }] },
  { c: 'kh-09', d: '2026-08-30', rep: 'user-sale1', src: 'Facebook', tags: ['tag-quen'], st: 'HOAN_THANH', trip: 'ch-3', L: [['sp-khung-soi-20x30', 4]], pays: [{ day: 0, ratio: 1, acc: 'acc-cash' }] },
  { c: 'kh-10', d: '2026-08-31', rep: 'user-sale2', src: 'Zalo', tags: ['tag-si'], st: 'GIAO_MOT_PHAN', trip: 'ch-3', L: [['sp-khung-soi-40x60', 10], ['sp-khung-soi-30x40', 10]], recv: [7, 10], desc: '3 khung 40×60 bị nứt góc, khách trả lại', pays: [{ day: 10, ratio: 1, acc: 'acc-bank' }] },
  { c: 'kh-02', d: '2026-09-01', rep: 'user-sale1', src: 'Facebook', tags: [], st: 'TRA_TOAN_BO', trip: 'ch-3', L: [['sp-khung-nhom-vang-30x40', 3]], desc: 'Khách đổi ý, trả toàn bộ' },
  { c: 'kh-12', d: '2026-09-10', rep: 'user-sale2', src: 'Điện thoại', tags: ['tag-si'], st: 'HOAN_THANH', trip: 'ch-4', L: [['sp-khung-soi-40x60', 15], ['sp-mica-cat', 6, { len: 60, wid: 90 }]], pays: [{ day: 22, ratio: 1, acc: 'acc-bank' }] },
  { c: 'kh-06', d: '2026-09-12', rep: 'user-sale2', src: 'Shopee', tags: ['tag-shopee'], st: 'HOAN_THANH', trip: 'ch-4', L: [['sp-khung-soi-20x30', 10], ['sp-khung-soi-30x40', 10]], rn: 'Phạm Văn Đức', rp: '0988000222', pays: [{ day: 9, ratio: 1, acc: 'acc-bank' }] },
  { c: 'kh-08', d: '2026-09-22', rep: 'user-sale1', src: 'Điện thoại', tags: [], st: 'HOAN_THANH', trip: 'ch-5', L: [['sp-khung-soi-40x60', 24], ['sp-khung-soi-50x70', 12], ['dv-cong-dong', 1]], disc: 800000, pays: [] },
  { c: 'kh-03', d: '2026-09-24', rep: 'user-sale1', src: 'Khách quen', tags: ['tag-vip', 'tag-si'], st: 'HOAN_THANH', trip: 'ch-5', L: [['sp-khung-oc-cho-40x60', 10], ['sp-khung-nhom-den-40x60', 10]], pays: [] },
  { c: 'kh-01', d: '2026-09-25', rep: 'user-sale2', src: 'Zalo', tags: ['tag-quen'], st: 'HOAN_THANH', trip: 'ch-5', L: [['sp-khung-soi-60x90', 1], ['sp-khung-soi-30x40', 1], ['vt-keo-dan', 1], ['vt-ve-sinh-kinh', 2]], pays: [{ day: 0, ratio: 1, acc: 'acc-bank' }] },
  { c: 'kh-04', d: '2026-10-05', rep: 'user-sale1', src: 'Email', tags: ['tag-vip', 'tag-si'], st: 'HOAN_THANH', trip: 'ch-7', L: [['sp-khung-soi-50x70', 16], ['sp-khung-soi-60x90', 10]], pays: [] },
  { c: 'kh-09', d: '2026-10-07', rep: 'user-sale1', src: 'Facebook', tags: ['tag-quen'], st: 'DANG_GIAO', trip: 'ch-7', L: [['sp-khung-nhom-vang-30x40', 2], ['sp-khung-soi-30x40', 3]] },
  { c: 'kh-05', d: '2026-10-12', rep: 'user-sale2', src: 'Shopee', tags: ['tag-shopee'], st: 'DANG_GIAO', trip: 'ch-8', L: [['sp-khung-nhom-vang-30x40', 8], ['sp-khung-soi-30x40', 8]], rn: 'Lý Thị Mận', rp: '0988000333' },
  { c: 'kh-12', d: '2026-10-13', rep: 'user-sale2', src: 'Điện thoại', tags: ['tag-si'], st: 'DANG_GIAO', trip: 'ch-8', L: [['sp-khung-soi-40x60', 12]] },
  { c: 'kh-10', d: '2026-10-14', rep: 'user-sale2', src: 'Zalo', tags: ['tag-si', 'tag-gap'], st: 'CHO_GIAO_HANG', trip: 'ch-9', L: [['sp-khung-soi-30x40', 20], ['vt-nep-soi', 2, { unit: 'Bó', ratio: 10, price: 408000 }]], desc: 'Khách cần gấp, giao trước thứ Năm' },
  { c: 'kh-07', d: '2026-10-15', rep: 'user-sale1', src: 'Điện thoại', tags: ['tag-si'], st: 'CHO_GIAO_HANG', L: [['sp-khung-nhom-den-40x60', 24]] },
  { c: 'kh-06', d: '2026-10-16', rep: 'user-sale2', src: 'Shopee', tags: ['tag-shopee'], st: 'CHO_GIAO_HANG', L: [['vt-den-led', 10], ['vt-moc-treo', 200]], rn: 'Hồ Thị Sen', rp: '0988000444' },
  { c: 'kh-03', d: '2026-10-14', rep: 'user-sale1', src: 'Khách quen', tags: ['tag-vip', 'tag-si'], st: 'DANG_SAN_XUAT', L: [['sp-khung-soi-40x60', 30], ['sp-khung-oc-cho-40x60', 10]], deposit: 5000000, desc: 'Khách đặt cọc 5.000.000 đ' },
  { c: 'kh-08', d: '2026-10-16', rep: 'user-sale1', src: 'Điện thoại', tags: [], st: 'DANG_SAN_XUAT', L: [['sp-khung-soi-50x70', 20], ['sp-kinh-cat', 10, { len: 100, wid: 150 }]] },
  { c: 'kh-02', d: '2026-10-17', rep: 'user-sale1', src: 'Facebook', tags: [], st: 'CHO_SAN_XUAT', lsx: 'NHAP', L: [['sp-khung-soi-60x90', 2], ['sp-khung-soi-20x30', 3]] },
  { c: 'kh-04', d: '2026-10-17', rep: 'user-sale1', src: 'Email', tags: ['tag-vip', 'tag-si'], st: 'CHO_SAN_XUAT', L: [['sp-khung-soi-40x60', 40], ['sp-mica-cat', 12, { len: 70, wid: 100 }]] },
  { c: 'kh-09', d: '2026-10-10', rep: 'user-sale1', src: 'Facebook', tags: ['tag-quen'], st: 'HUY', lsx: 'HUY', L: [['sp-khung-soi-30x40', 1]], desc: 'Khách huỷ vì đổi cỡ tranh' },
  { c: 'kh-01', d: '2026-10-18', rep: 'user-sale2', src: 'Zalo', tags: ['tag-quen'], st: 'CHO_SAN_XUAT', L: [['sp-khung-oc-cho-40x60', 1], ['dv-cong-dong', 1]] },
];
const orders = SC.map((s, i) => {
  const n = i + 1;
  const id = `dh-${String(n).padStart(2, '0')}`;
  const cust = custById[s.c];
  const priceOf = (p) => (cust.type === 'SI' ? p.wholesalePrice : cust.type === 'DROPSHIP' ? p.dropshipPrice : p.retailPrice);
  const lines = s.L.map(([pid, qty, x = {}], j) => {
    const p = prodById[pid];
    const price = x.price ?? priceOf(p);
    return { id: `${id}-l${j + 1}`, productId: pid, unit: x.unit ?? p.baseUnit, ratio: x.ratio ?? 1, quantity: qty, unitPrice: price, lineTotal: qty * price, length: x.len, width: x.wid, note: x.note, receivedQuantity: 0 };
  });
  if (s.st === 'HOAN_THANH') lines.forEach((l) => { l.receivedQuantity = l.quantity; });
  if (s.st === 'GIAO_MOT_PHAN') lines.forEach((l, j) => { l.receivedQuantity = s.recv[j]; });
  const totalGoods = lines.reduce((a, l) => a + l.lineTotal, 0);
  const discount = s.disc ?? 0;
  const receivedGoods = lines.reduce((a, l) => a + l.receivedQuantity * l.unitPrice, 0);
  const receivedValue = receivedGoods > 0 ? Math.round(receivedGoods - (discount * receivedGoods) / totalGoods) : 0;
  const deliveredDate = DELIVERED.includes(s.st) ? tripById[s.trip].date : undefined;
  return {
    id, code: code('DH', n), customerId: s.c, recipientName: s.rn, recipientPhone: s.rp, description: s.desc, source: s.src,
    tagIds: s.tags, orderDate: s.d, neededByDate: s.st === 'HUY' ? undefined : addDays(s.d, 10), status: s.st, lines,
    discountAmount: discount, totalGoods, totalOrder: totalGoods - discount, salesRep: s.rep, createdBy: s.rep,
    tripId: s.trip, deliveredDate, receivedValue,
    dueDate: deliveredDate && receivedValue > 0 ? addDays(deliveredDate, cust.credit) : undefined, scenario: s,
  };
});
const orderById = Object.fromEntries(orders.map((o) => [o.id, o]));
const trips = TRIPS.map((t, i) => {
  const os = orders.filter((o) => o.tripId === t.id);
  const veh = t.vehicle ? vehById[t.vehicle] : undefined;
  return {
    id: t.id, code: code('CH', i + 1), date: t.date, driverName: t.driver, plateNumber: veh?.plate ?? t.plate, vehicleId: t.vehicle,
    status: t.status, orderIds: os.map((o) => o.id), totalValue: os.reduce((a, o) => a + o.totalOrder, 0),
    confirmedCount: os.filter((o) => DELIVERED.includes(o.status)).length, receivedValue: os.reduce((a, o) => a + o.receivedValue, 0),
    shipped: ['DA_XUAT_KHO', 'XE_VE_KHO', 'HOAN_TAT'].includes(t.status),
  };
});
const tripByCode = Object.fromEntries(trips.map((t) => [t.id, t]));

// ---------- lệnh sản xuất ----------
const lsx = [];
{
  let ln = 0;
  for (const o of orders) {
    const tp = o.lines.filter((l) => prodById[l.productId].type === 'THANH_PHAM');
    if (!tp.length) continue;
    let st;
    switch (o.status) {
      case 'CHO_SAN_XUAT': st = o.scenario.lsx === 'NHAP' ? 'NHAP' : null; break;
      case 'DANG_SAN_XUAT': st = 'DANG_SAN_XUAT'; break;
      case 'HUY': st = o.scenario.lsx === 'HUY' ? 'HUY' : null; break;
      default: st = 'HOAN_TAT';
    }
    if (!st) continue;
    const created = minDate(addDays(o.orderDate, 1), TODAY);
    for (const l of tp) {
      ln += 1;
      const trip = o.tripId ? tripById[o.tripId] : undefined;
      let complete;
      if (st === 'HOAN_TAT') complete = minDate(addDays(created, 3), trip ? addDays(trip.date, -1) : TODAY);
      lsx.push({
        id: `lsx-${String(ln).padStart(2, '0')}`, code: code('LSX', ln), sourceOrderId: o.id, productId: l.productId, quantity: l.quantity,
        status: st, createdDate: created, startDate: st === 'DANG_SAN_XUAT' || st === 'HOAN_TAT' ? created : undefined, completeDate: complete,
        bomSnapshot: BOM[l.productId],
      });
    }
  }
}

// ---------- đơn nhập hàng ----------
const POS_RAW = [
  { n: 1, sup: 'ncc-1', date: '2026-08-02', status: 'HOAN_TAT', recv: '2026-08-06', lines: [['vt-nep-soi', 300, 38000, 300], ['vt-nep-oc-cho', 100, 72000, 100], ['vt-go-tho', 150, 30000, 150]], pay: [{ date: '2026-08-08', ratio: 1, acc: 'acc-bank' }] },
  { n: 2, sup: 'ncc-2', date: '2026-08-04', status: 'HOAN_TAT', recv: '2026-08-09', lines: [['vt-nhom-vang', 200, 46000, 200], ['vt-nhom-den', 200, 52000, 200]], pay: [{ date: '2026-08-12', ratio: 1, acc: 'acc-bank' }] },
  { n: 3, sup: 'ncc-3', date: '2026-08-10', status: 'DA_NHAN_DU', recv: '2026-08-15', lines: [['vt-kinh-3ly', 60, 165000, 60], ['vt-mica-2ly', 30, 420000, 30], ['vt-hau-mdf', 80, 95000, 80]], pay: [{ date: '2026-08-20', ratio: 0.5, acc: 'acc-bank' }] },
  { n: 4, sup: 'ncc-4', date: '2026-08-20', status: 'HOAN_TAT', recv: '2026-08-23', lines: [['vt-moc-treo', 3000, 600, 3000], ['vt-dinh-ghim', 40, 28000, 40], ['vt-day-thep', 10, 22000, 10], ['vt-kep-kinh', 400, 3500, 400], ['vt-keo-dan', 30, 42000, 30]], pay: [{ date: '2026-08-23', ratio: 1, acc: 'acc-cash' }] },
  { n: 5, sup: 'ncc-1', date: '2026-09-15', status: 'NHAN_MOT_PHAN', recv: '2026-09-22', lines: [['vt-nep-soi', 400, 39000, 250], ['vt-nep-oc-cho', 120, 73000, 120]], pay: [{ date: '2026-09-25', ratio: 0.3, acc: 'acc-bank' }] },
  { n: 6, sup: 'ncc-3', date: '2026-10-05', status: 'DA_GUI_NCC', lines: [['vt-kinh-3ly', 80, 168000, 0], ['vt-mica-2ly', 40, 425000, 0], ['vt-hau-mdf', 100, 96000, 0]] },
  { n: 7, sup: 'ncc-2', date: '2026-10-14', status: 'NHAP', lines: [['vt-nhom-vang', 150, 47000, 0]] },
  { n: 8, sup: 'ncc-5', date: '2026-08-12', status: 'HUY', lines: [['vt-go-tho', 200, 31000, 0]] },
  { n: 9, sup: 'ncc-4', date: '2026-10-10', status: 'HOAN_TAT', recv: '2026-10-13', lines: [['vt-den-led', 30, 95000, 30], ['vt-ve-sinh-kinh', 15, 18000, 15]], pay: [{ date: '2026-10-13', ratio: 1, acc: 'acc-bank' }] },
];
const purchaseOrders = POS_RAW.map((p) => {
  const lines = p.lines.map(([pid, q, price, recv], j) => ({ id: `dn-${String(p.n).padStart(2, '0')}-l${j + 1}`, productId: pid, quantity: q, unitPrice: price, receivedQuantity: recv }));
  return {
    id: `dn-${String(p.n).padStart(2, '0')}`, code: code('DN', p.n), supplierId: p.sup, date: p.date, status: p.status, createdBy: 'user-quanly',
    receivedDate: p.recv, lines, totalValue: lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0),
    receivedValue: lines.reduce((a, l) => a + l.receivedQuantity * l.unitPrice, 0), pay: p.pay ?? [],
  };
});

// ---------- phiếu kho (nháp) ----------
const PRI = { NHAP: 1, CHUYEN: 2, KIEM_KE: 3, XUAT: 4 };
const rawV = [];
let vseq = 0;
const pushV = (v) => rawV.push({ cancelled: false, by: 'user-thukho', ...v, pri: PRI[v.type], _seq: vseq++ });
const costOf = (pid) => {
  const p = prodById[pid];
  if (p.type === 'VAT_TU') return p.buy;
  if (p.type === 'THANH_PHAM') return Math.round(BOM[pid].reduce((a, b) => a + b.quantityPerUnit * prodById[b.componentId].buy, 0));
  return 0;
};
// 1) nhận hàng theo đơn nhập
for (const po of purchaseOrders) {
  const got = po.lines.filter((l) => l.receivedQuantity > 0);
  if (!got.length) continue;
  const whs = new Set(got.map((l) => prodById[l.productId].defaultWarehouseId));
  if (whs.size !== 1) throw new Error(`Đơn nhập ${po.code} có hàng thuộc nhiều kho`);
  pushV({ type: 'NHAP', date: po.receivedDate, wh: [...whs][0], reason: `Nhập hàng theo đơn ${po.code}`, lines: got.map((l) => ({ productId: l.productId, quantity: l.receivedQuantity, unitPrice: l.unitPrice })) });
}
// 2) xuất vật tư khi bắt đầu lệnh sản xuất (gom theo ngày + kho)
{
  const m = new Map();
  for (const l of lsx.filter((x) => x.startDate)) {
    for (const b of BOM[l.productId]) {
      const wh = prodById[b.componentId].defaultWarehouseId;
      const k = `${l.startDate}|${wh}`;
      const e = m.get(k) ?? { date: l.startDate, wh, lines: new Map(), refs: [] };
      e.lines.set(b.componentId, (e.lines.get(b.componentId) ?? 0) + b.quantityPerUnit * l.quantity);
      if (!e.refs.includes(l.code)) e.refs.push(l.code);
      m.set(k, e);
    }
  }
  for (const e of m.values()) pushV({ type: 'XUAT', date: e.date, wh: e.wh, reason: `Xuất vật tư cho ${e.refs.join(', ')}`, lines: [...e.lines].map(([productId, q]) => ({ productId, quantity: r2(q), unitPrice: 0 })) });
}
// 3) nhập thành phẩm khi hoàn tất lệnh (gom theo ngày)
{
  const m = new Map();
  for (const l of lsx.filter((x) => x.completeDate)) {
    const e = m.get(l.completeDate) ?? { date: l.completeDate, lines: new Map(), refs: [] };
    e.lines.set(l.productId, (e.lines.get(l.productId) ?? 0) + l.quantity);
    e.refs.push(l.code);
    m.set(l.completeDate, e);
  }
  for (const e of m.values()) pushV({ type: 'NHAP', date: e.date, wh: 'wh-thanhpham', reason: `Nhập thành phẩm từ xưởng: ${e.refs.join(', ')}`, lines: [...e.lines].map(([productId, quantity]) => ({ productId, quantity, unitPrice: costOf(productId) })) });
}
// 4) xuất kho theo chuyến giao + nhập trả về
for (const t of trips) {
  if (!t.shipped) continue;
  const out = new Map();
  const back = new Map();
  const backRefs = [];
  for (const o of orders.filter((x) => x.tripId === t.id)) {
    for (const l of o.lines.filter((x) => hasStock(x.productId))) {
      const wh = prodById[l.productId].defaultWarehouseId;
      const eo = out.get(wh) ?? new Map();
      eo.set(l.productId, (eo.get(l.productId) ?? 0) + l.quantity * l.ratio);
      out.set(wh, eo);
      const ret = (l.quantity - l.receivedQuantity) * l.ratio;
      if (['GIAO_MOT_PHAN', 'TRA_TOAN_BO'].includes(o.status) && ret > 0) {
        const eb = back.get(wh) ?? new Map();
        eb.set(l.productId, (eb.get(l.productId) ?? 0) + ret);
        back.set(wh, eb);
        if (!backRefs.includes(o.code)) backRefs.push(o.code);
      }
    }
  }
  for (const [wh, mm] of out) pushV({ type: 'XUAT', date: t.date, wh, reason: `Xuất kho giao hàng — chuyến ${t.code}`, lines: [...mm].map(([productId, quantity]) => ({ productId, quantity, unitPrice: 0 })) });
  for (const [wh, mm] of back) pushV({ type: 'NHAP', date: t.date, wh, reason: `Nhập trả về — chuyến ${t.code} (${backRefs.join(', ')})`, lines: [...mm].map(([productId, quantity]) => ({ productId, quantity, unitPrice: 0 })) });
}
// 5) chuyển kho + kiểm kê định kỳ (số đếm thực tính sau khi biết tồn)
pushV({ type: 'CHUYEN', date: '2026-09-08', wh: 'wh-phukien', target: 'wh-vattu', reason: 'Chuyển đinh ghim ra xưởng đóng khung', lines: [{ productId: 'vt-dinh-ghim', quantity: 5, unitPrice: 0 }] });
pushV({ type: 'KIEM_KE', date: '2026-09-30', wh: 'wh-vattu', reason: 'Kiểm kê định kỳ cuối tháng 9', lines: [{ productId: 'vt-nep-soi', delta: -3, unitPrice: 0 }, { productId: 'vt-kinh-3ly', delta: -1, unitPrice: 0 }] });

// ---------- mô phỏng tồn kho để chọn tồn đầu kỳ ----------
const skey = (pid, wh) => `${pid}|${wh}`;
const moves = [];
for (const v of rawV) {
  for (const l of v.lines) {
    const base = { date: v.date, pri: v.pri, seq: v._seq };
    if (v.type === 'NHAP') moves.push({ ...base, key: skey(l.productId, v.wh), d: l.quantity });
    else if (v.type === 'XUAT') moves.push({ ...base, key: skey(l.productId, v.wh), d: -l.quantity });
    else if (v.type === 'CHUYEN') { moves.push({ ...base, key: skey(l.productId, v.wh), d: -l.quantity }); moves.push({ ...base, key: skey(l.productId, v.target), d: l.quantity }); }
    else if (v.type === 'KIEM_KE') moves.push({ ...base, key: skey(l.productId, v.wh), d: l.delta, ref: l });
  }
}
moves.sort((a, b) => a.date.localeCompare(b.date) || a.pri - b.pri || a.seq - b.seq);
const run1 = new Map();
const min1 = new Map();
for (const m of moves) {
  const cur = r2((run1.get(m.key) ?? 0) + m.d);
  run1.set(m.key, cur);
  min1.set(m.key, Math.min(min1.get(m.key) ?? 0, cur));
}
const LOW = new Set(['vt-kinh-3ly', 'vt-day-thep', 'vt-ve-sinh-kinh', 'sp-khung-soi-60x90']); // cố tình để dưới tồn tối thiểu
const opening = new Map();
for (const p of PRODUCTS) {
  if (!hasStock(p.id)) continue;
  const k = skey(p.id, p.defaultWarehouseId);
  const deficit = -(min1.get(k) ?? 0);
  const net = run1.get(k) ?? 0;
  let o = LOW.has(p.id) ? Math.max(deficit, Math.round(p.minStock * 0.5) - net) : deficit + Math.round(p.minStock * (0.8 + rnd() * 1.2));
  o = r2(Math.max(0, o));
  if (o > 0) opening.set(k, o);
}
for (const wh of WAREHOUSES) {
  const lines = [...opening].filter(([k]) => k.endsWith(`|${wh.id}`)).map(([k, q]) => { const pid = k.split('|')[0]; return { productId: pid, quantity: q, unitPrice: costOf(pid) }; });
  if (lines.length) { rawV.push({ type: 'KIEM_KE', date: START, wh: wh.id, reason: 'Kiểm kê, nhập tồn đầu kỳ', lines, cancelled: false, by: 'user-thukho', pri: 0, _seq: vseq++ }); }
}
// lượt 2: có tồn đầu kỳ → tính số đếm thực của phiếu kiểm kê định kỳ và tồn cuối
const run2 = new Map([...opening]);
for (const m of moves) {
  const cur = r2((run2.get(m.key) ?? 0) + m.d);
  if (m.ref) m.ref.counted = cur;
  run2.set(m.key, cur);
}
const stockLevels = [];
for (const [k, q] of run2) {
  if (q < -0.011) throw new Error(`Tồn âm ${k}: ${q}`);
  const [productId, warehouseId] = k.split('|');
  if (q > 0.0001) stockLevels.push({ productId, warehouseId, quantity: Math.max(0, q), minStock: prodById[productId].minStock });
}
stockLevels.sort((a, b) => a.productId.localeCompare(b.productId) || a.warehouseId.localeCompare(b.warehouseId));
rawV.sort((a, b) => a.date.localeCompare(b.date) || a.pri - b.pri || a._seq - b._seq);
const VPFX = { NHAP: 'PNK', XUAT: 'PXK', CHUYEN: 'PCK', KIEM_KE: 'PKK' };
const vcount = { NHAP: 0, XUAT: 0, CHUYEN: 0, KIEM_KE: 0 };
const warehouseVouchers = rawV.map((v) => {
  vcount[v.type] += 1;
  return {
    id: `pk-${v.type.toLowerCase()}-${String(vcount[v.type]).padStart(2, '0')}`, code: code(VPFX[v.type], vcount[v.type]), type: v.type, date: v.date,
    warehouseId: v.wh, targetWarehouseId: v.target, reason: v.reason, createdBy: v.by, isCancelled: v.cancelled,
    lines: v.lines.map((l) => ({ productId: l.productId, quantity: r2(l.counted ?? l.quantity), unitPrice: l.unitPrice ?? 0 })),
  };
});

// ---------- phiếu thu chi ----------
const rawC = [];
const pushC = (c) => rawC.push({ cancelled: false, settled: 0, by: 'user-ketoan', ...c });
for (const po of purchaseOrders) {
  for (const p of po.pay) pushC({ kind: 'CHI', date: p.date, category: 'Chi trả nhà cung cấp', partnerType: 'NHA_CUNG_CAP', partnerId: po.supplierId, acc: p.acc, amount: Math.round(p.ratio * po.receivedValue), settled: Math.round(p.ratio * po.receivedValue), desc: `Thanh toán đơn nhập ${po.code}` });
}
for (const o of orders) {
  for (const p of o.scenario.pays ?? []) {
    const amount = Math.round(p.ratio * o.receivedValue);
    pushC({ kind: 'THU', date: addDays(o.deliveredDate, p.day), category: 'Thu tiền khách hàng', partnerType: 'KHACH_HANG', partnerId: o.customerId, acc: p.acc, amount, settled: amount, desc: `Khách thanh toán đơn ${o.code}` });
  }
  if (o.scenario.deposit) pushC({ kind: 'THU', date: o.orderDate, category: 'Thu tiền khách hàng', partnerType: 'KHACH_HANG', partnerId: o.customerId, acc: 'acc-bank', amount: o.scenario.deposit, settled: 0, desc: `Khách đặt cọc đơn ${o.code}` });
}
for (const [id, amount] of [['ch-1', 520000], ['ch-2', 380000], ['ch-3', 640000], ['ch-4', 560000], ['ch-5', 610000], ['ch-7', 480000], ['ch-8', 430000]]) {
  const t = trips.find((x) => x.id === id);
  pushC({ kind: 'CHI', date: t.date, category: 'Chi khác', partnerType: 'KHAC', acc: 'acc-cash', amount, desc: `Tiền dầu chuyến ${t.code}` });
}
for (const [date, amount, desc] of [['2026-08-05', 18000000, 'Tiền thuê xưởng tháng 8'], ['2026-09-05', 18000000, 'Tiền thuê xưởng tháng 9'], ['2026-10-05', 18000000, 'Tiền thuê xưởng tháng 10']]) pushC({ kind: 'CHI', date, category: 'Chi khác', partnerType: 'KHAC', acc: 'acc-bank', amount, desc });
for (const [date, amount, desc] of [['2026-09-02', 3850000, 'Tiền điện nước tháng 8'], ['2026-10-02', 4120000, 'Tiền điện nước tháng 9']]) pushC({ kind: 'CHI', date, category: 'Chi khác', partnerType: 'KHAC', acc: 'acc-cash', amount, desc });
for (const [date, amount, desc] of [['2026-09-05', 62000000, 'Lương nhân viên tháng 8'], ['2026-10-05', 64000000, 'Lương nhân viên tháng 9']]) pushC({ kind: 'CHI', date, category: 'Chi khác', partnerType: 'KHAC', acc: 'acc-bank', amount, desc });
pushC({ kind: 'THU', date: '2026-09-20', category: 'Thu khác', partnerType: 'KHAC', acc: 'acc-cash', amount: 1350000, desc: 'Thanh lý phế liệu nhôm' });
pushC({ kind: 'CHI', date: '2026-09-12', category: 'Chi khác', partnerType: 'KHAC', acc: 'acc-cash', amount: 2000000, desc: 'Chi nhầm quỹ, đã lập lại phiếu khác', cancelled: true });
// vốn đầu kỳ: đủ để không tài khoản nào bị âm
{
  const bal = { 'acc-cash': 0, 'acc-bank': 0 };
  const minBal = { 'acc-cash': 0, 'acc-bank': 0 };
  for (const c of [...rawC].filter((x) => !x.cancelled).sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === 'THU' ? -1 : 1))) {
    bal[c.acc] += c.kind === 'THU' ? c.amount : -c.amount;
    minBal[c.acc] = Math.min(minBal[c.acc], bal[c.acc]);
  }
  for (const acc of ['acc-cash', 'acc-bank']) {
    const capital = Math.ceil((-minBal[acc] + 10000000) / 1000000) * 1000000;
    pushC({ kind: 'THU', date: START, category: 'Thu khác', partnerType: 'KHAC', acc, amount: capital, desc: 'Góp vốn đầu kỳ', by: 'user-admin' });
  }
}
rawC.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === 'THU' ? -1 : 1));
const ccount = { THU: 0, CHI: 0 };
const cashVouchers = rawC.map((c) => {
  ccount[c.kind] += 1;
  return {
    id: `${c.kind === 'THU' ? 'pt' : 'pc'}-${String(ccount[c.kind]).padStart(2, '0')}`, code: code(c.kind === 'THU' ? 'PT' : 'PC', ccount[c.kind]), date: c.date, kind: c.kind,
    category: c.category, partnerType: c.partnerType, partnerId: c.partnerId, accountId: c.acc, amount: c.amount, settledAmount: c.settled,
    description: c.desc, isCancelled: c.cancelled, createdBy: c.by,
  };
});
const accountBalance = (id) => cashVouchers.filter((c) => c.accountId === id && !c.isCancelled).reduce((a, c) => a + (c.kind === 'THU' ? c.amount : -c.amount), 0);

// ======================================================================
// XUẤT DỮ LIỆU
// ======================================================================
const ROLE_FE = { CEO: 'role-ceo', 'Quản lý': 'role-manager', 'Kế toán': 'role-accountant', Sale: 'role-sale', 'Thủ kho': 'role-thukho', 'Nhân viên giao hàng': 'role-giaohang', 'Nhân viên xưởng': 'role-xuong' };
const desc = (arr, f) => [...arr].sort((a, b) => f(b).localeCompare(f(a)));
const vnPhoneDate = (d) => d; // ngày dạng YYYY-MM-DD

// ---- frontend ----
const feProducts = PRODUCTS.map((p) => clean({
  id: p.id, code: p.code, name: p.name, type: p.type, baseUnit: p.baseUnit, categoryId: p.categoryId, defaultWarehouseId: p.defaultWarehouseId,
  minStock: p.minStock, vatRate: p.vatRate, warrantyMonths: p.warrantyMonths, origin: p.origin, retailPrice: p.retailPrice,
  wholesalePrice: p.wholesalePrice, dropshipPrice: p.dropshipPrice, unitConversions: p.unitConversions, purchaseNote: p.purchaseNote,
  saleNote: p.saleNote, description: p.description, isSellable: p.isSellable, isActive: p.isActive,
}));
const feSuppliers = SUPPLIERS.map((s) => clean({
  id: s.id, code: s.code, name: s.name, contactPhone: s.phone, email: s.email, taxCode: s.tax, address: s.addr, creditDays: s.creditDays,
  note: s.note, isActive: s.active, createdAt: iso(START),
}));
// Danh mục hàng theo NCC: giá mua = giá của đơn nhập gần nhất (nếu có), không thì giá mua chuẩn của mặt hàng.
const feSupplierProducts = SUPPLIERS.flatMap((s) => s.supplies.map((pid, j) => {
  const last = purchaseOrders.filter((p) => p.supplierId === s.id).sort((a, b) => b.date.localeCompare(a.date))
    .flatMap((p) => p.lines).find((l) => l.productId === pid);
  return clean({ supplierId: s.id, productId: pid, supplierCode: s.id === 'ncc-4' ? `MT-${String(j + 1).padStart(3, '0')}` : undefined, purchasePrice: last?.unitPrice ?? prodById[pid].buy });
}));
const fePurchaseOrders = desc(purchaseOrders, (p) => p.date + p.code).map((p) => clean({
  id: p.id, code: p.code, supplierId: p.supplierId, date: p.date, status: p.status, totalValue: p.totalValue, createdBy: userEmail[p.createdBy],
  receivedValue: p.receivedValue, receivedDate: p.receivedDate,
  lines: p.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, receivedQuantity: l.receivedQuantity })),
}));
const feCustomers = CUSTOMERS.map((c) => clean({
  id: c.id, code: c.code, name: c.name, companyName: c.company, type: c.type, creditDays: c.credit, phone: c.phone, email: c.email,
  companyTaxCode: c.ctax, note: c.note, tagIds: c.tags, orderCount: orders.filter((o) => o.customerId === c.id).length, isActive: c.active,
  createdAt: iso(START),
  addresses: (CUSTOMER_ADDRESSES[c.id] ?? []).map((a, j) => ({ id: `${c.id}-dc${j + 1}`, ...a, isDefault: j === 0 })),
}));
const feSalesOrders = desc(orders, (o) => o.orderDate + o.code).map((o) => clean({
  id: o.id, code: o.code, customerId: o.customerId, recipientName: o.recipientName, recipientPhone: o.recipientPhone, description: o.description,
  source: o.source, tagIds: o.tagIds, orderDate: o.orderDate, neededByDate: o.neededByDate, status: o.status,
  lines: o.lines.map((l) => ({ id: l.id, productId: l.productId, unit: l.unit, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: l.lineTotal, length: l.length, width: l.width, note: l.note, receivedQuantity: l.receivedQuantity })),
  discountAmount: o.discountAmount, totalGoods: o.totalGoods, totalOrder: o.totalOrder, salesRep: userEmail[o.salesRep], createdBy: userEmail[o.createdBy],
  tripId: o.tripId, deliveredDate: o.deliveredDate, receivedValue: o.receivedValue, dueDate: o.dueDate,
}));
// Chuyến: hàng xếp lên xe (loads) lúc xuất kho, kết quả chốt giao từng đơn, chi phí điều vận.
const TRIP_DRIVER_PHONE = { 'Đặng Văn Tài': '0903111222', 'Lý Văn Sáu': '0903333444', 'Nguyễn Văn Bốn': '0903555666' };
const feTrips = desc(trips, (t) => t.date + t.code).map((t, i) => {
  const os = orders.filter((o) => o.tripId === t.id);
  const back = ['XE_VE_KHO', 'HOAN_TAT'].includes(t.status);
  return clean({
    id: t.id, code: t.code, date: t.date, driverName: t.driverName, driverPhone: TRIP_DRIVER_PHONE[t.driverName], plateNumber: t.plateNumber,
    status: t.status, orderIds: t.orderIds, totalValue: t.totalValue, vehicleId: t.vehicleId, confirmedCount: t.confirmedCount,
    receivedValue: t.receivedValue, createdBy: userEmail['user-quanly'], shippedAt: t.shipped ? `${t.date}T08:30:00` : undefined,
    returnedAt: back ? `${t.date}T17:15:00` : undefined, completedAt: t.status === 'HOAN_TAT' ? `${t.date}T17:30:00` : undefined,
    cancelReason: t.status === 'HUY' ? 'Xe thuê ngoài báo hỏng, dời đơn sang chuyến sau' : undefined,
    costs: t.shipped ? { fuel: 220000 + (i % 4) * 35000, toll: i % 2 ? 40000 : 0, other: t.status === 'HOAN_TAT' && i % 3 === 0 ? 50000 : 0, note: i % 2 ? 'Qua trạm BOT An Sương' : undefined } : undefined,
    loads: t.shipped ? os.flatMap((o) => o.lines.map((l, j) => clean({
      orderId: o.id, lineIndex: j, productId: l.productId, quantity: l.quantity,
      warehouseId: hasStock(l.productId) ? prodById[l.productId].defaultWarehouseId : undefined,
    }))) : undefined,
    confirmations: t.shipped ? os.filter((o) => DELIVERED.includes(o.status)).map((o) => ({
      orderId: o.id, confirmedAt: `${t.date}T15:00:00`, lines: o.lines.map((l, j) => ({ lineIndex: j, received: l.receivedQuantity })),
    })) : undefined,
  });
});
// Xe: loại theo danh mục của production, tên gọi riêng; tình trạng chỉ là Đang dùng / Bảo trì / Ngừng dùng —
// "đang ở chuyến nào" suy ra từ chuyến.
const VEHICLE_EXTRA = {
  'xe-1': { type: 'XE_TAI', name: 'Xe tải 1,5 tấn', reg: '2027-03-15', ins: '2026-11-05', driverUser: 'user-taixe', phone: '0903111222' },
  'xe-2': { type: 'XE_TAI', name: 'Xe tải 750kg', reg: '2026-10-30', ins: '2027-06-01', phone: '0903333444', note: 'Thùng kín, chở được kính khổ lớn.' },
  'xe-3': { type: 'XE_BA_GAC', name: 'Ba gác máy', reg: '2026-09-30', note: 'Đang sửa hộp số.' },
};
const feVehicles = VEHICLES.map((v) => {
  const x = VEHICLE_EXTRA[v.id] ?? {};
  return clean({
    id: v.id, code: v.code, plateNumber: v.plate, name: x.name, type: x.type ?? 'KHAC', loadCapacity: v.cap,
    usualDriver: v.usual, driverUserId: x.driverUser, driverPhone: x.phone, registrationExpiry: x.reg, insuranceExpiry: x.ins,
    note: x.note, status: v.maint ? 'BAO_TRI' : 'DANG_DUNG', createdAt: iso(START),
  });
});
// Frontend lines also carry the stock change of the voucher's warehouse: a kiểm kê stores the
// counted quantity, so its change is the delta (the opening kiểm kê starts from 0).
const feVoucherLines = new Map(rawV.map((v, i) => [warehouseVouchers[i].id, v.lines.map((l) => ({
  productId: l.productId,
  quantity: r2(l.counted ?? l.quantity),
  delta: r2(v.type === 'KIEM_KE' ? (l.delta ?? l.quantity) : l.quantity),
}))]));
const feWarehouseVouchers = desc(warehouseVouchers, (v) => v.date + v.code).map((v) => clean({
  id: v.id, code: v.code, type: v.type, date: v.date, warehouseId: v.warehouseId, targetWarehouseId: v.targetWarehouseId, reason: v.reason,
  createdBy: userEmail[v.createdBy], isCancelled: v.isCancelled, lines: feVoucherLines.get(v.id),
}));
const feProduction = desc(lsx, (l) => l.createdDate + l.code).map((l) => clean({
  id: l.id, code: l.code, sourceOrderId: l.sourceOrderId, productId: l.productId, quantity: l.quantity, status: l.status, createdDate: l.createdDate,
  startDate: l.startDate, completeDate: l.completeDate, producedQuantity: l.status === 'HOAN_TAT' ? l.quantity : undefined,
  bomSnapshot: (l.bomSnapshot ?? []).map((b) => ({ componentId: b.componentId, quantityPerUnit: b.quantityPerUnit })),
  createdBy: userEmail['user-quanly'], cancelReason: l.status === 'HUY' ? 'Khách huỷ đơn' : undefined,
}));
const feCashAccounts = ACCOUNTS.map((a) => clean({ id: a.id, name: a.name, type: a.type, ...ACCOUNT_INFO[a.id], openingBalance: 0, balance: accountBalance(a.id), isActive: true }));
const feCashVouchers = desc(cashVouchers, (c) => c.date + c.code).map((c) => clean({
  id: c.id, code: c.code, date: c.date, kind: c.kind, category: c.category, partnerType: c.partnerType, partnerId: c.partnerId, accountId: c.accountId,
  amount: c.amount, settledAmount: c.settledAmount, description: c.description, isCancelled: c.isCancelled, createdBy: userEmail[c.createdBy],
}));
const feTags = TAGS.map((t) => ({ id: t.id, name: t.name, color: t.color, sortOrder: t.sortOrder, orderCount: orders.filter((o) => o.tagIds.includes(t.id)).length, customerCount: CUSTOMERS.filter((c) => c.tags.includes(t.id)).length, isActive: true }));
const feUsers = USERS.map((u) => ({ id: u.id, name: u.name, email: u.email, roleId: ROLE_FE[u.role], lastLoginAt: u.lastLogin, openSessions: u.sessions, status: u.status }));
const roleUserCount = {};
for (const u of feUsers) roleUserCount[u.roleId] = (roleUserCount[u.roleId] ?? 0) + 1;

const J = (x) => JSON.stringify(x, null, 2);
const tsOut = `/* eslint-disable */
// prettier-ignore
// FILE SINH TỰ ĐỘNG bởi tools/gen-demo-data.mjs — KHÔNG SỬA TAY (chạy lại: node tools/gen-demo-data.mjs).
// Toàn bộ dữ liệu là GIẢ, chỉ để thử giao diện.
import type {
  Product, StockLevel, WarehouseVoucher, ProductionOrder, Supplier, PurchaseOrder, Customer, SalesOrder,
  DeliveryTrip, Vehicle, CashAccount, CashVoucher, Tag, AppUser, BomLine, SupplierProduct,
} from '../models/domain.models';

export const DEMO_TODAY = '${TODAY}';
export const DEMO_PRODUCTS: Product[] = ${J(feProducts)};
export const DEMO_BOM_LINES: BomLine[] = ${J(Object.entries(BOM).flatMap(([finishedProductId, ls]) => ls.map((l) => ({ finishedProductId, componentId: l.componentId, quantityPerUnit: l.quantityPerUnit }))))};
export const DEMO_STOCK_LEVELS: StockLevel[] = ${J(stockLevels)};
export const DEMO_WAREHOUSE_VOUCHERS: WarehouseVoucher[] = ${J(feWarehouseVouchers)};
export const DEMO_PRODUCTION_ORDERS: ProductionOrder[] = ${J(feProduction)};
export const DEMO_SUPPLIERS: Supplier[] = ${J(feSuppliers)};
export const DEMO_SUPPLIER_PRODUCTS: SupplierProduct[] = ${J(feSupplierProducts)};
export const DEMO_PURCHASE_ORDERS: PurchaseOrder[] = ${J(fePurchaseOrders)};
export const DEMO_CUSTOMERS: Customer[] = ${J(feCustomers)};
export const DEMO_SALES_ORDERS: SalesOrder[] = ${J(feSalesOrders)};
export const DEMO_DELIVERY_TRIPS: DeliveryTrip[] = ${J(feTrips)};
export const DEMO_VEHICLES: Vehicle[] = ${J(feVehicles)};
export const DEMO_CASH_ACCOUNTS: CashAccount[] = ${J(feCashAccounts)};
export const DEMO_CASH_VOUCHERS: CashVoucher[] = ${J(feCashVouchers)};
export const DEMO_TAGS: Tag[] = ${J(feTags)};
export const DEMO_USERS: AppUser[] = ${J(feUsers)};
export const DEMO_ROLE_USER_COUNT: Record<string, number> = ${J(roleUserCount)};
`;

// ---- backend ----
const hiredNote = (t) => (t.vehicleId ? t.driverName : t.driverName ? `${t.driverName} (xe thuê ${t.plateNumber ?? ''})`.replace(' )', ')') : undefined);
const be = clean({
  meta: { generatedFor: TODAY, note: 'Dữ liệu GIẢ do tools/gen-demo-data.mjs sinh ra. Đừng sửa tay.' },
  // Danh mục: same objects (and ids) as the frontend demo, so both sides show the same catalog.
  warehouses: WAREHOUSES, categories: CATEGORIES, tags: TAGS,
  accounts: feCashAccounts.map(({ balance: _b, ...a }) => a),
  users: USERS.map((u) => ({ key: u.id, name: u.name, email: u.email, roleName: u.role, status: u.status, lastLoginAt: `${u.lastLogin}+07:00` })),
  products: PRODUCTS.map((p) => ({
    id: p.id, code: p.code, name: p.name, type: p.type, baseUnit: p.baseUnit, categoryKey: p.categoryId, warehouseKey: p.defaultWarehouseId, minStock: p.minStock,
    vatRate: p.vatRate, warrantyMonths: p.warrantyMonths, origin: p.origin, retailPrice: p.retailPrice, wholesalePrice: p.wholesalePrice, dropshipPrice: p.dropshipPrice,
    purchaseNote: p.purchaseNote, saleNote: p.saleNote, description: p.description, isSellable: p.isSellable, isActive: p.isActive, unitConversions: p.unitConversions,
  })),
  bomLines: Object.entries(BOM).flatMap(([finishedProductId, ls]) => ls.map((l) => ({ finishedProductId, componentId: l.componentId, quantityPerUnit: l.quantityPerUnit }))),
  suppliers: feSuppliers,
  supplierProducts: feSupplierProducts,
  customers: feCustomers.map(({ orderCount: _n, ...c }) => c),
  purchaseOrders: purchaseOrders.map((p) => ({ id: p.id, code: p.code, supplierId: p.supplierId, date: iso(p.date), status: p.status, createdByKey: p.createdBy, lines: p.lines })),
  salesOrders: orders.map((o) => ({
    id: o.id, code: o.code, customerId: o.customerId, recipientName: o.recipientName, recipientPhone: o.recipientPhone, description: o.description, source: o.source,
    orderDate: iso(o.orderDate), neededByDate: o.neededByDate ? iso(o.neededByDate) : undefined, status: o.status, discountAmount: o.discountAmount,
    salesRepKey: o.salesRep, createdByKey: o.createdBy, tagIds: o.tagIds,
    lines: o.lines.map((l) => ({ id: l.id, productId: l.productId, unit: l.unit, quantity: l.quantity, unitPrice: l.unitPrice, length: l.length, width: l.width, note: l.note, receivedQuantity: l.receivedQuantity })),
  })),
  productionOrders: lsx.map((l) => ({ id: l.id, code: l.code, sourceOrderId: l.sourceOrderId, productId: l.productId, quantity: l.quantity, status: l.status, bomSnapshot: l.bomSnapshot, createdAt: iso(l.createdDate) })),
  vehicles: feVehicles,
  deliveryTrips: trips.map((t) => ({ id: t.id, code: t.code, date: iso(t.date), driverName: hiredNote(t), vehicleId: t.vehicleId, status: t.status, orderIds: t.orderIds })),
  // Lines carry the stock change (delta) like the frontend's, plus the purchase price of phiếu nhập.
  warehouseVouchers: warehouseVouchers.map((v) => ({
    id: v.id, code: v.code, type: v.type, date: iso(v.date), warehouseKey: v.warehouseId, targetWarehouseKey: v.targetWarehouseId, reason: v.reason,
    isCancelled: v.isCancelled, createdByKey: v.createdBy,
    lines: feVoucherLines.get(v.id).map((l, j) => ({ ...l, unitPrice: v.lines[j]?.unitPrice ?? 0 })),
  })),
  stockLevels: stockLevels.map((s) => ({ productId: s.productId, warehouseKey: s.warehouseId, quantity: s.quantity })),
  cashVouchers: cashVouchers.map((c) => ({
    id: c.id, code: c.code, date: iso(c.date), kind: c.kind, category: c.category, partnerType: c.partnerType,
    customerId: c.partnerType === 'KHACH_HANG' ? c.partnerId : undefined, supplierId: c.partnerType === 'NHA_CUNG_CAP' ? c.partnerId : undefined,
    accountKey: c.accountId, amount: c.amount, settledAmount: c.settledAmount, description: c.description, isCancelled: c.isCancelled, createdByKey: c.createdBy,
  })),
  cashAccountBalances: Object.fromEntries(ACCOUNTS.map((a) => [a.id, accountBalance(a.id)])),
});

const w = (rel, content) => { const p = resolve(ROOT, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, content, 'utf8'); return p; };
w('backend/prisma/demo-data.json', JSON.stringify(be, null, 2) + '\n');
w('frontend/src/app/core/data/demo-data.ts', tsOut);

// ---- tóm tắt kiểm tra ----
const count = (arr, f) => arr.reduce((m, x) => { const k = f(x); m[k] = (m[k] ?? 0) + 1; return m; }, {});
const ar = CUSTOMERS.map((c) => {
  const gross = orders.filter((o) => o.customerId === c.id).reduce((a, o) => a + o.receivedValue, 0);
  const paid = cashVouchers.filter((v) => !v.isCancelled && v.kind === 'THU' && v.partnerType === 'KHACH_HANG' && v.partnerId === c.id).reduce((a, v) => a + v.amount, 0);
  return { c: c.code, gross, paid, bal: gross - paid };
}).filter((x) => x.bal !== 0);
const ap = SUPPLIERS.map((s) => {
  const gross = purchaseOrders.filter((p) => p.supplierId === s.id).reduce((a, p) => a + p.receivedValue, 0);
  const paid = cashVouchers.filter((v) => !v.isCancelled && v.kind === 'CHI' && v.partnerType === 'NHA_CUNG_CAP' && v.partnerId === s.id).reduce((a, v) => a + v.amount, 0);
  return { s: s.code, gross, paid, bal: gross - paid };
}).filter((x) => x.bal !== 0);
const lowStock = PRODUCTS.filter((p) => hasStock(p.id) && p.minStock > 0).filter((p) => stockLevels.filter((s) => s.productId === p.id).reduce((a, s) => a + s.quantity, 0) < p.minStock).map((p) => p.code);
console.log(JSON.stringify({
  hangHoa: PRODUCTS.length, khach: CUSTOMERS.length, ncc: SUPPLIERS.length, donBan: orders.length, donBanTheoTrangThai: count(orders, (o) => o.status),
  donNhap: purchaseOrders.length, donNhapTheoTrangThai: count(purchaseOrders, (o) => o.status), lenhSX: lsx.length, lenhSXTheoTrangThai: count(lsx, (l) => l.status),
  chuyen: trips.length, chuyenTheoTrangThai: count(trips, (t) => t.status), phieuKho: warehouseVouchers.length, phieuKhoTheoLoai: count(warehouseVouchers, (v) => v.type),
  phieuThuChi: cashVouchers.length, tonKhoDong: stockLevels.length, duoiTonToiThieu: lowStock,
  soDuQuy: Object.fromEntries(ACCOUNTS.map((a) => [a.name, accountBalance(a.id)])), phaiThu: ar, phaiTra: ap,
}, null, 2));
