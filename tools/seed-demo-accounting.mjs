#!/usr/bin/env node
/**
 * Dữ liệu GIẢ cho phần Kế toán, để thử sổ sách và báo cáo. Chạy trên máy dev (backend đang chạy, đã `prisma:seed` + `prisma:seed:demo`):
 *
 *   node tools/seed-demo-accounting.mjs            # nạp
 *   node tools/seed-demo-accounting.mjs --force    # nạp dù sổ đã có bút toán (sẽ thêm chồng lên)
 *
 * Biến môi trường: API_URL (mặc định http://localhost:3000/api), ADMIN_EMAIL (admin@ninhtrang.local), ADMIN_PASSWORD (SEED_ADMIN_PASSWORD của máy dev).
 * Từ chối chạy với API không phải localhost (trừ khi thêm --allow-remote): đây là dữ liệu giả, không dùng trên DB thật.
 *
 * Mọi thứ đi qua API như người dùng thật: bật sổ từ 01/01 năm nay, số dư đầu kỳ, nhập hàng và hoá đơn mua, bán hàng giao ngay / công nợ,
 * thu chi, lương, tài sản cố định, chi phí trả trước, bút toán tay — mỗi tháng từ tháng 1 đến hôm nay, nên các sổ và báo cáo có số liệu nhiều kỳ.
 * Không kết chuyển và không đóng sổ: để bạn thử các bước đó.
 */
const API = (process.env.API_URL ?? 'http://localhost:3000/api').replace(/\/+$/, '');
const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@ninhtrang.local';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';
const force = process.argv.includes('--force');

if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//.test(API + '/') && !process.argv.includes('--allow-remote')) {
  console.error(`Từ chối: ${API} không phải máy dev. Đây là dữ liệu giả.`);
  process.exit(1);
}

const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10); // giờ Việt Nam
const Y = Number(today.slice(0, 4));
const pad = (n) => String(n).padStart(2, '0');
const day = (m, d) => `${Y}-${pad(m)}-${pad(d)}`;
const lastDay = (m) => new Date(Y, m, 0).getDate();
/** Chỉ ngày đã qua: dữ liệu giả không ghi vào tương lai. */
const past = (iso) => iso <= today;
const money = (n) => Math.round(n).toLocaleString('vi-VN');
const monthsSoFar = Number(today.slice(5, 7));

let token = '';
const stats = { ok: 0, failed: 0 };
const problems = [];

async function call(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) {
    const msg = Array.isArray(json?.message) ? json.message.join('; ') : json?.message ?? text;
    throw new Error(`${method} ${path} → ${res.status} ${msg}`);
  }
  return json;
}

/** Một bước có thể lỗi (hết tồn, quỹ không đủ…): ghi lại rồi đi tiếp, không bỏ cả đợt. */
async function step(label, fn) {
  try {
    const r = await fn();
    stats.ok++;
    return r;
  } catch (e) {
    stats.failed++;
    problems.push(`${label}: ${e.message}`);
    return null;
  }
}

async function main() {
  const login = await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
  token = login.accessToken;

  const journal = await call('GET', '/accounting/journal');
  if (journal.length && !force) {
    console.error(`Sổ đã có ${journal.length} bút toán. Thêm --force nếu vẫn muốn nạp chồng lên.`);
    process.exit(1);
  }

  const [customers, suppliers, products, stock, categories, accounts] = await Promise.all([
    call('GET', '/customers'), call('GET', '/suppliers'), call('GET', '/products'), call('GET', '/stock-levels'),
    call('GET', '/cash-categories'), call('GET', '/cash-accounts'),
  ]);
  const cust = customers.filter((c) => c.isActive !== false).slice(0, 8);
  const sup = suppliers.filter((s) => s.isActive !== false).slice(0, 4);
  // Hàng giá cao trước: doanh thu đủ lớn để gánh lương, thuê mặt bằng và khấu hao.
  const goods = products.filter((p) => p.type === 'VAT_TU' && p.isSellable && p.isActive !== false && p.retailPrice >= 50_000)
    .sort((a, b) => b.retailPrice - a.retailPrice).slice(0, 7);
  const bank = accounts.find((a) => a.type === 'NGAN_HANG' && a.isActive !== false);
  const cash = accounts.find((a) => a.type === 'TIEN_MAT' && a.isActive !== false);
  if (!cust.length || !sup.length || goods.length < 3 || !bank || !cash) throw new Error('Thiếu dữ liệu nền (khách, NCC, hàng, tài khoản tiền): chạy prisma:seed:demo trước.');
  const category = (kind, partnerType, preferCode) =>
    categories.find((c) => c.code === preferCode) ?? categories.find((c) => c.kind === kind && c.partnerType === partnerType && c.isActive !== false);
  const catThuKhach = category('THU', 'KHACH_HANG');
  const catChiNcc = category('CHI', 'NHA_CUNG_CAP', 'CHI_NCC');
  const catChiKhac = category('CHI', 'KHAC', 'CHI_KHAC');
  const catLuong = categories.find((c) => /lương/i.test(c.name) && c.kind === 'CHI');
  const whOf = (p) => p.defaultWarehouseId ?? stock.find((s) => s.productId === p.id)?.warehouseId ?? 'wh-vattu';
  console.log(`Nền: ${cust.length} khách, ${sup.length} NCC, ${goods.length} mặt hàng, quỹ ${cash.name} + ${bank.name}. Năm ${Y}, đến ${today}.`);

  // 1. Bật sổ + số dư đầu kỳ (cân: Nợ 470 triệu = Có 470 triệu).
  await step('Bật sổ', () => call('POST', '/accounting/settings', { ledgerStartDate: day(1, 1) }));
  await step('Số dư đầu kỳ', () => call('POST', '/accounting/opening-balances', {
    period: String(Y),
    rows: [
      { accountCode: '111', debit: 20_000_000, credit: 0 }, { accountCode: '112', debit: 300_000_000, credit: 0 },
      { accountCode: '211', debit: 150_000_000, credit: 0 }, { accountCode: '214', debit: 0, credit: 30_000_000 },
      { accountCode: '411', debit: 0, credit: 440_000_000 },
    ],
  }));

  // 2. Nhân viên, tài sản, chi phí trả trước (ghi nhận trước, phân bổ / khấu hao theo tháng ở vòng dưới).
  const employees = [
    { name: 'Nguyễn Văn An', center: 'QUAN_LY', baseSalary: 18_000_000, allowance: 1_000_000, dependents: 0 },
    { name: 'Trần Thị Bình', center: 'BAN_HANG', baseSalary: 12_000_000, allowance: 1_500_000, dependents: 1 },
    { name: 'Lê Văn Cường', center: 'SAN_XUAT', baseSalary: 10_000_000, allowance: 500_000, dependents: 2 },
  ];
  for (const e of employees) await step(`NV ${e.name}`, () => call('POST', '/accounting/employees', e));
  const assets = [
    { name: 'Máy cắt CNC khung tranh', cost: 120_000_000, usageStartDate: day(2, 1), usefulLifeMonths: 60 },
    { name: 'Xe tải giao hàng 1,5 tấn', cost: 480_000_000, usageStartDate: day(4, 1), usefulLifeMonths: 84, expenseAccount: '641' },
  ];
  for (const a of assets) if (past(a.usageStartDate)) await step(`TSCĐ ${a.name}`, () => call('POST', '/accounting/assets', a));
  const prepaid = [
    { name: 'Bảo hiểm cháy nổ kho 12 tháng', cost: 24_000_000, startDate: day(3, 1), allocationMonths: 12, expenseAccount: '642', fundingAccount: '112' },
    { name: 'Bảng hiệu cửa hàng', cost: 9_000_000, startDate: day(6, 1), allocationMonths: 18, expenseAccount: '641', fundingAccount: '111' },
  ];
  for (const p of prepaid) if (past(p.startDate)) await step(`CCDC ${p.name}`, () => call('POST', '/accounting/prepaid', p));

  // 3. Từng tháng: nhập hàng, bán hàng, thu chi, hoá đơn dịch vụ, khấu hao / phân bổ, lương.
  let invoiceNo = 1000;
  const unpaid = []; // đơn bán công nợ, chờ khách trả ở tháng sau
  const payables = []; // đơn nhập, chờ trả NCC ở tháng sau
  for (let m = 1; m <= monthsSoFar; m++) {
    // Thanh toán công nợ của tháng trước (tiền về trước khi chi, để quỹ đủ).
    for (const o of unpaid.splice(0)) {
      const date = day(m, 10);
      if (!past(date)) { unpaid.push(o); continue; }
      const amount = Math.round(o.total * (m % 3 === 0 ? 0.7 : 1));
      await step(`Thu ${o.code}`, () => call('POST', '/cash-vouchers', {
        kind: 'THU', date, category: catThuKhach.name, partnerType: 'KHACH_HANG', partnerId: o.customerId, accountId: bank.id, amount,
        description: `Khách thanh toán ${o.code}`,
      }));
    }

    // Nhập hàng: 1 đơn / tháng, 2–3 mặt hàng, có hoá đơn GTGT.
    const supplier = sup[m % sup.length];
    const poLines = goods.map((p, i) => ({
      productId: p.id, quantity: 120 + ((m * 13 + i * 17) % 30), unitPrice: Math.round(p.retailPrice * 0.6 / 1000) * 1000 || 1000, vatRate: 8, warehouseId: whOf(p),
    }));
    const poDate = day(m, 5);
    if (past(poDate)) {
      const po = await step(`Đơn nhập T${m}`, () => call('POST', '/purchase-orders', { supplierId: supplier.id, date: poDate, note: `Nhập hàng tháng ${m} (dữ liệu giả)`, lines: poLines }));
      if (po) {
        await step(`Gửi NCC T${m}`, () => call('POST', `/purchase-orders/${po.id}/send`));
        const recvDate = day(m, 7);
        const got = past(recvDate) && await step(`Nhận hàng T${m}`, () => call('POST', `/purchase-orders/${po.id}/receive`, {
          date: recvDate, invoiceSeries: 'C26TAA', invoiceNo: String(++invoiceNo).padStart(7, '0'), invoiceDate: recvDate,
          items: poLines.map((l, i) => ({ lineIndex: i, quantity: l.quantity, warehouseId: l.warehouseId })),
        }));
        if (got) payables.push({ supplierId: supplier.id, code: po.code, total: got.receivedValue ?? got.totalValue ?? poLines.reduce((s, l) => s + l.quantity * l.unitPrice * 1.08, 0) });
      }
    }

    // Bán hàng: 2 đơn / tháng; đơn đầu thu tiền ngay vào ngân hàng, đơn sau ghi công nợ.
    for (const [k, d] of [[0, 12], [1, 22]]) {
      const date = day(m, d);
      if (!past(date)) continue;
      const customer = cust[(m * 2 + k) % cust.length];
      const lines = goods.slice((m + k) % 4, (m + k) % 4 + 3).map((p, i) => ({
        productId: p.id, unit: p.baseUnit, quantity: 100 + ((m * 5 + i * 9 + k * 7) % 40), unitPrice: p.retailPrice, vatRate: 8, warehouseId: whOf(p),
      }));
      const order = await step(`Đơn bán T${m}.${k + 1}`, () => call('POST', '/sales-orders', {
        customerId: customer.id, tagIds: [], orderDate: date, discountAmount: 0, lines, description: 'Dữ liệu giả cho kế toán',
        ...(k === 0 ? { payNowAccountId: bank.id } : {}),
      }));
      if (!order) continue;
      const delivered = await step(`Giao ${order.code}`, () => call('POST', `/sales-orders/${order.id}/deliver`, {
        date, items: lines.map((l, i) => ({ lineIndex: i, quantity: l.quantity, warehouseId: l.warehouseId })),
      }));
      if (delivered && k === 1) unpaid.push({ customerId: customer.id, code: order.code, total: order.totalOrder });
    }

    // Trả NCC đơn nhập của kỳ trước (60%), từ ngân hàng.
    for (const p of payables.splice(0, payables.length - 1)) {
      const date = day(m, 15);
      if (!past(date)) { payables.push(p); continue; }
      await step(`Trả NCC ${p.code}`, () => call('POST', '/cash-vouchers', {
        kind: 'CHI', date, category: catChiNcc.name, partnerType: 'NHA_CUNG_CAP', partnerId: p.supplierId, accountId: bank.id, amount: Math.round(p.total * 0.6),
        description: `Trả tiền hàng ${p.code}`,
      }));
    }

    // Chi phí vận hành hằng tháng.
    if (past(day(m, 3)) && catChiKhac) {
      await step(`Thuê mặt bằng T${m}`, () => call('POST', '/cash-vouchers', {
        kind: 'CHI', date: day(m, 3), category: catChiKhac.name, partnerType: 'KHAC', accountId: bank.id, amount: 8_000_000, description: `Tiền thuê mặt bằng tháng ${m}`,
      }));
    }
    if (past(day(m, 20))) {
      await step(`Điện T${m}`, () => call('POST', '/purchase-bills', {
        supplierId: sup[0].id, date: day(m, 20), description: `Tiền điện tháng ${m}`, invoiceSeries: 'C26TAA', invoiceNo: String(++invoiceNo).padStart(7, '0'), invoiceDate: day(m, 20),
        lines: [{ accountCode: '642', description: 'Tiền điện văn phòng và kho', amount: 2_800_000 + m * 40_000, vatRate: 10 }],
      }));
      if (past(day(m, 25))) await step(`Vận chuyển T${m}`, () => call('POST', '/purchase-bills', {
        supplierId: sup[1 % sup.length].id, date: day(m, 25), description: `Cước vận chuyển tháng ${m}`, invoiceSeries: 'C26TAA', invoiceNo: String(++invoiceNo).padStart(7, '0'), invoiceDate: day(m, 25),
        lines: [{ accountCode: '641', description: 'Vận chuyển giao hàng', amount: 1_900_000 + m * 60_000, vatRate: 8 }],
      }));
    }

    // Khấu hao và phân bổ cuối tháng (kỳ đã kết thúc).
    const period = `${Y}-${pad(m)}`;
    if (past(day(m, lastDay(m))) && m < monthsSoFar) {
      await step(`Khấu hao ${period}`, () => call('POST', '/accounting/assets/depreciate', { period }));
      await step(`Phân bổ ${period}`, () => call('POST', '/accounting/prepaid/allocate', { period }));
    }

    // Lương tháng đã kết thúc: tính, chốt, rồi chi lương từ quỹ.
    if (m >= 3 && m < monthsSoFar) {
      const run = await step(`Lương ${period}`, () => call('POST', '/accounting/payroll/run', { period }));
      if (run && catLuong) {
        const net = run.totals?.net ?? employees.reduce((s, e) => s + e.baseSalary + e.allowance, 0) * 0.9;
        const payDate = day(m + 1 <= 12 ? m + 1 : m, 5);
        if (past(payDate)) {
          await step(`Chi lương ${period}`, () => call('POST', '/cash-vouchers', {
            kind: 'CHI', date: payDate, category: catLuong.name, partnerType: 'KHAC', accountId: bank.id, amount: Math.round(net), description: `Chi lương tháng ${m}`,
          }));
        }
      }
    }
  }

  // 4. Bút toán tay rải rác (lãi tiền gửi, lãi vay, thu nhập khác, chi phí khác, thanh lý nhỏ).
  const manual = [
    { date: day(3, 31), description: 'Lãi tiền gửi ngân hàng quý 1', lines: [{ accountCode: '112', debit: 1_250_000 }, { accountCode: '515', credit: 1_250_000 }] },
    { date: day(6, 30), description: 'Lãi tiền gửi ngân hàng quý 2', lines: [{ accountCode: '112', debit: 1_480_000 }, { accountCode: '515', credit: 1_480_000 }] },
    { date: day(5, 15), description: 'Chi phí lãi vay tháng 5', lines: [{ accountCode: '635', debit: 3_200_000 }, { accountCode: '112', credit: 3_200_000 }] },
    { date: day(7, 20), description: 'Thu tiền phạt hợp đồng khách vi phạm', lines: [{ accountCode: '112', debit: 2_000_000 }, { accountCode: '711', credit: 2_000_000 }] },
    { date: day(8, 10), description: 'Chi phạt vi phạm hành chính', lines: [{ accountCode: '811', debit: 1_500_000 }, { accountCode: '111', credit: 1_500_000 }] },
    { date: day(9, 30), description: 'Lãi tiền gửi ngân hàng quý 3', lines: [{ accountCode: '112', debit: 1_390_000 }, { accountCode: '515', credit: 1_390_000 }] },
  ];
  for (const e of manual) if (past(e.date)) await step(`Bút toán ${e.description}`, () => call('POST', '/accounting/journal', e));

  // 5. Kiểm: sổ cân và hai vế bảng cân đối bằng nhau.
  const trial = await call('GET', `/accounting/trial-balance?period=${Y}`).catch(() => null);
  const entries = await call('GET', '/accounting/journal');
  console.log(`\nXong: ${stats.ok} bước thành công, ${stats.failed} bước bị bỏ qua. Sổ nhật ký có ${entries.length} bút toán (màn hình hiện 500 mới nhất).`);
  if (trial?.totals) console.log('Cân đối phát sinh:', JSON.stringify(trial.totals));
  if (problems.length) {
    console.log('\nCác bước bị bỏ qua (thường do hết tồn hoặc quỹ không đủ — dữ liệu giả vẫn dùng được):');
    for (const p of problems.slice(0, 25)) console.log(' -', p);
    if (problems.length > 25) console.log(` … và ${problems.length - 25} bước nữa`);
  }
}

main().catch((e) => {
  console.error('Lỗi:', e.message);
  process.exit(1);
});
