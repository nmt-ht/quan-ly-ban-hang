// Đợt 2 — chuyển tiền nội bộ, kiểm kê quỹ, đối chiếu sao kê ngân hàng và báo cáo lưu chuyển tiền tệ.
// Chạy trên database riêng nt_qa_cash (tạo lại mỗi lần: migrate + seed + dữ liệu demo). Số liệu mong đợi tính tay.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { createDatabase } from '../src/platform/platform-db.service.js';
import { withDatabase } from '../src/platform/secret-box.js';
import { errorTail, migrateDeploy, runScript } from '../src/platform/tenant-commands.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { vnDay } from '../src/common/text.js';

const MAIN_URL = process.env.DATABASE_URL!;
const QA_DB = 'nt_qa_cash';
const QA_URL = withDatabase(MAIN_URL, QA_DB);
const PASSWORD = 'QaMatKhau2026';

async function freshQaDatabase(): Promise<void> {
  const c = new pg.Client({ connectionString: MAIN_URL });
  await c.connect();
  await c.query(`DROP DATABASE IF EXISTS "${QA_DB}" WITH (FORCE)`);
  await c.end();
  await createDatabase(MAIN_URL, QA_DB);
  const steps = [
    () => migrateDeploy(QA_URL),
    () => runScript('prisma/seed.ts', { DATABASE_URL: QA_URL, SEED_ADMIN_PASSWORD: PASSWORD }),
    () => runScript('prisma/seed-demo.ts', { DATABASE_URL: QA_URL, DEMO_USER_PASSWORD: PASSWORD, SEED_DEMO: 'true', NODE_ENV: 'test' }),
  ];
  for (const step of steps) {
    const r = await step();
    if (!r.ok) throw new Error(errorTail(r.output));
  }
}

const today = vnDay();
const year = today.slice(0, 4);
const tomorrow = vnDay(new Date(Date.now() + 86_400_000));

describe('Chuyển tiền nội bộ, kiểm kê quỹ, đối chiếu sao kê, lưu chuyển tiền tệ (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let savedUrl: string | undefined;
  const api = () => request(app.getHttpServer());
  async function as(email: string) {
    const token = (await api().post('/api/auth/login').send({ email, password: PASSWORD }).expect(200)).body.accessToken;
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    return { get: (url: string) => auth(api().get(url)), post: (url: string, body: object = {}) => auth(api().post(url)).send(body) };
  }
  let acc: Awaited<ReturnType<typeof as>>;
  let sale: Awaited<ReturnType<typeof as>>;
  let tm = '', nh = '', nh2 = '', customerId = '';

  const balance = async (id: string) => ((await acc.get('/api/cash-accounts').expect(200)).body as { id: string; balance: number }[]).find((a) => a.id === id)!.balance;
  const voucher = (extra: object) => ({ date: today, partnerType: 'KHAC', description: 'E2E', ...extra });
  const flow = async () => (await acc.get(`/api/accounting/cash-flow?from=${year}-01-01&to=${today}`).expect(200)).body as {
    items: { code: string; amount: number }[]; opening: number; closing: number; check: { difference: number };
  };
  const item = (f: Awaited<ReturnType<typeof flow>>, code: string) => f.items.find((i) => i.code === code)!.amount;

  beforeAll(async () => {
    await freshQaDatabase();
    savedUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = QA_URL;
    delete process.env.PLATFORM_DATABASE_URL;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    acc = await as('ke.toan@ninhtrang.local');
    sale = await as('sale1@ninhtrang.local');
    await acc.post('/api/accounting/settings', { ledgerStartDate: `${year}-01-01` }).expect(201);
    tm = (await prisma.cashAccount.create({ data: { name: 'E2E Quỹ TM', type: 'TIEN_MAT', openingBalance: 10_000_000 } })).id;
    nh = (await prisma.cashAccount.create({ data: { name: 'E2E NH 1', type: 'NGAN_HANG', openingBalance: 0 } })).id;
    nh2 = (await prisma.cashAccount.create({ data: { name: 'E2E NH 2', type: 'NGAN_HANG', openingBalance: 0 } })).id;
    customerId = (await prisma.customer.findFirstOrThrow()).id;
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    process.env.DATABASE_URL = savedUrl;
  });

  it('chuyển tiền nội bộ: số dư hai quỹ đổi chỗ, sổ cái Nợ 112 / Có 111 qua TK 113, không tính vào thu chi', async () => {
    const cardsBefore = (await acc.get('/api/cash-vouchers/page?pageSize=5').expect(200)).body.cards;
    const t = (await acc.post('/api/cash-transfers', { fromAccountId: tm, toAccountId: nh, date: today, amount: 3_000_000, description: 'E2E nộp tiền' }).expect(201)).body;
    expect(t).toMatchObject({ code: expect.stringMatching(/^CT\d{7}$/), amount: 3_000_000, isCancelled: false, fromAccountName: 'E2E Quỹ TM', toAccountName: 'E2E NH 1' });
    expect(await balance(tm)).toBe(7_000_000);
    expect(await balance(nh)).toBe(3_000_000);

    // Sổ cái: chi Nợ 113 / Có 111, thu Nợ 112 / Có 113 → 113 về 0.
    const lines = await prisma.journalLine.findMany({ where: { entry: { refType: 'CashVoucher', refId: { in: [t.outVoucherCode, t.inVoucherCode].length ? (await prisma.cashVoucher.findMany({ where: { code: { in: [t.outVoucherCode, t.inVoucherCode] } } })).map((v) => v.id) : [] } } } });
    const sum = (code: string, side: 'debit' | 'credit') => lines.filter((l) => l.accountCode === code).reduce((s, l) => s + l[side].toNumber(), 0);
    expect([sum('111', 'credit'), sum('112', 'debit'), sum('113', 'debit'), sum('113', 'credit')]).toEqual([3_000_000, 3_000_000, 3_000_000, 3_000_000]);

    // Thẻ tổng thu/chi không đổi (chỉ là đổi chỗ tiền); danh sách có thêm hai phiếu.
    const cardsAfter = (await acc.get('/api/cash-vouchers/page?pageSize=5').expect(200)).body.cards;
    expect({ thu: cardsAfter.thu, chi: cardsAfter.chi }).toEqual({ thu: cardsBefore.thu, chi: cardsBefore.chi });
    expect((await acc.get('/api/cash-transfers').expect(200)).body.some((x: { id: string }) => x.id === t.id)).toBe(true);
  });

  it('chuyển tiền nội bộ: kiểm tra đầu vào, quyền, chặn lập và huỷ phiếu lẻ', async () => {
    const body = (extra: object = {}) => ({ fromAccountId: tm, toAccountId: nh, date: today, amount: 1000, ...extra });
    await sale.post('/api/cash-transfers', body()).expect(403);
    await acc.post('/api/cash-transfers', body({ toAccountId: tm })).expect(400); // cùng một tài khoản
    await acc.post('/api/cash-transfers', body({ date: tomorrow })).expect(400); // ngày tương lai
    await acc.post('/api/cash-transfers', body({ amount: 0 })).expect(400);
    // Kế toán không có quyền chi vượt tồn quỹ: quỹ TM chỉ còn 7.000.000.
    expect((await acc.post('/api/cash-transfers', body({ amount: 50_000_000 })).expect(400)).body.message).toContain('Tồn quỹ');
    expect(await balance(tm)).toBe(7_000_000); // không ghi nửa chừng

    // Phiếu thu chi thường không được mang loại chuyển nội bộ; phiếu của chuyển tiền không huỷ lẻ được.
    await acc.post('/api/cash-vouchers', voucher({ kind: 'CHI', category: 'Chuyển tiền nội bộ', accountId: tm, amount: 1000 })).expect(400);
    const out = await prisma.cashVoucher.findFirstOrThrow({ where: { category: 'Chuyển tiền nội bộ', accountId: tm } });
    expect((await acc.post(`/api/cash-vouchers/${out.id}/cancel`, {}).expect(400)).body.message).toContain('chuyển tiền nội bộ');
  });

  it('huỷ chuyển tiền: hai phiếu cùng huỷ, số dư và sổ cái trở lại; bị chặn nếu quỹ nhận đã tiêu mất tiền', async () => {
    const t = (await acc.post('/api/cash-transfers', { fromAccountId: tm, toAccountId: nh2, date: today, amount: 2_000_000 }).expect(201)).body;
    expect(await balance(nh2)).toBe(2_000_000);
    // Quỹ nhận chi hết 1.500.000 → huỷ chuyển tiền sẽ làm quỹ nhận âm.
    await acc.post('/api/cash-vouchers', voucher({ kind: 'CHI', category: 'Chi khác', accountId: nh2, amount: 1_500_000 })).expect(201);
    expect((await acc.post(`/api/cash-transfers/${t.id}/cancel`, {}).expect(400)).body.message).toContain('Tồn quỹ');
    expect(await balance(tm)).toBe(5_000_000); // chưa đổi gì
    // Bù lại tiền cho quỹ nhận rồi huỷ được.
    await acc.post('/api/cash-vouchers', voucher({ kind: 'THU', category: 'Thu khác', accountId: nh2, amount: 1_500_000 })).expect(201);
    const done = (await acc.post(`/api/cash-transfers/${t.id}/cancel`, { reason: 'E2E nhầm' }).expect(200)).body;
    expect(done).toMatchObject({ isCancelled: true, cancelReason: 'E2E nhầm' });
    expect(await balance(tm)).toBe(7_000_000);
    expect(await balance(nh2)).toBe(0 + 1_500_000 - 1_500_000 + 0); // chi 1,5tr + thu bù 1,5tr, chuyển 2tr đã rút lại
    await acc.post(`/api/cash-transfers/${t.id}/cancel`, {}).expect(400);
    const vs = await prisma.cashVoucher.findMany({ where: { code: { in: [done.outVoucherCode, done.inVoucherCode] } } });
    expect(vs.every((v) => v.isCancelled)).toBe(true);
  });

  it('kiểm kê quỹ: đếm theo mệnh giá, so với số dư sổ, ghi thừa/thiếu', async () => {
    // Quỹ TM đang có 7.000.000 trên sổ. Đếm: 2 × 500.000 + 5 × 200.000 + 3 × 100.000 = 2.300.000.
    const book = (await acc.get(`/api/cash-counts/book/${tm}/${today}`).expect(200)).body;
    expect(book.bookAmount).toBe(7_000_000);
    const body = { accountId: tm, date: today, countedBy: 'Thủ quỹ', note: 'E2E', denominations: [{ value: 500_000, count: 2 }, { value: 200_000, count: 5 }, { value: 100_000, count: 3 }] };
    const c = (await acc.post('/api/cash-counts', body).expect(201)).body;
    expect(c).toMatchObject({ code: expect.stringMatching(/^KQ\d{7}$/), bookAmount: 7_000_000, countedAmount: 2_300_000, difference: -4_700_000, isCancelled: false });

    await sale.post('/api/cash-counts', body).expect(403);
    await acc.post('/api/cash-counts', { ...body, accountId: nh }).expect(400); // chỉ tiền mặt
    await acc.post('/api/cash-counts', { ...body, date: tomorrow }).expect(400);
    await acc.post('/api/cash-counts', { ...body, denominations: [{ value: 500_000, count: 1 }, { value: 500_000, count: 2 }] }).expect(400); // trùng mệnh giá
    await acc.post('/api/cash-counts', { ...body, denominations: [{ value: 1000.5, count: 1 }] }).expect(400);

    // Số dư sổ chốt lúc lưu: phát sinh sau đó không làm đổi biên bản cũ.
    await acc.post('/api/cash-vouchers', voucher({ kind: 'THU', category: 'Thu khác', accountId: tm, amount: 100_000 })).expect(201);
    const list = (await acc.get('/api/cash-counts').expect(200)).body as { id: string; bookAmount: number }[];
    expect(list.find((x) => x.id === c.id)!.bookAmount).toBe(7_000_000);
    expect((await acc.post(`/api/cash-counts/${c.id}/cancel`, { reason: 'E2E' }).expect(200)).body.isCancelled).toBe(true);
    await acc.post(`/api/cash-counts/${c.id}/cancel`, {}).expect(400);
  });

  it('đối chiếu sao kê: nhập, bỏ dòng trùng, tự khớp, khớp tay, bỏ khớp, huỷ phiếu làm dòng chưa khớp', async () => {
    // Quỹ NH 1 đang có 3.000.000 (phiếu thu từ chuyển tiền). Thêm thu khác 1.200.000 và chi khác 500.000.
    const thu = (await acc.post('/api/cash-vouchers', voucher({ kind: 'THU', category: 'Thu khác', accountId: nh, amount: 1_200_000 })).expect(201)).body;
    const chi = (await acc.post('/api/cash-vouchers', voucher({ kind: 'CHI', category: 'Chi khác', accountId: nh, amount: 500_000 })).expect(201)).body;
    const rows = [
      { date: today, description: 'NOP TIEN MAT', reference: 'B1', amountIn: 3_000_000 },
      { date: today, description: 'KH CK', reference: 'B2', amountIn: 1_200_000 },
      { date: today, description: 'CHI', reference: 'B3', amountOut: 500_000 },
      { date: today, description: 'PHI QUAN LY TK', reference: 'B4', amountOut: 77_000 }, // chưa ghi sổ
    ];
    await sale.post('/api/bank-reconciliation/import', { accountId: nh, rows }).expect(403);
    await acc.post('/api/bank-reconciliation/import', { accountId: tm, rows }).expect(400); // không phải tài khoản ngân hàng
    await acc.post('/api/bank-reconciliation/import', { accountId: nh, rows: [{ date: today, amountIn: 1, amountOut: 1 }] }).expect(400); // vừa vào vừa ra
    await acc.post('/api/bank-reconciliation/import', { accountId: nh, rows: [{ date: tomorrow, amountIn: 1 }] }).expect(400);
    expect((await acc.post('/api/bank-reconciliation/import', { accountId: nh, rows }).expect(201)).body).toEqual({ inserted: 4, skipped: 0 });
    expect((await acc.post('/api/bank-reconciliation/import', { accountId: nh, rows }).expect(201)).body).toEqual({ inserted: 0, skipped: 4 }); // nhập lại cùng sao kê

    const q = `accountId=${nh}&from=${today}&to=${today}`;
    const before = (await acc.get(`/api/bank-reconciliation?${q}`).expect(200)).body;
    expect(before.bookBalance).toBe(3_700_000); // 3.000.000 + 1.200.000 − 500.000
    expect(before.summary).toMatchObject({ lines: 4, matched: 0, unmatchedLines: 4, unmatchedVouchers: 3 });

    expect((await acc.post('/api/bank-reconciliation/auto-match', { accountId: nh, from: today, to: today }).expect(200)).body).toEqual({ matched: 3, lines: 4 });
    const after = (await acc.get(`/api/bank-reconciliation?${q}`).expect(200)).body;
    expect(after.summary).toMatchObject({ matched: 3, unmatchedLines: 1, unmatchedVouchers: 0, unmatchedLinesNet: -77_000, unmatchedVouchersNet: 0 });
    // Số dư sao kê = số dư sổ + dòng sao kê chưa ghi sổ: 3.700.000 − 77.000.
    expect(after.bookBalance + after.summary.unmatchedLinesNet).toBe(3_623_000);

    // Khớp tay: bỏ khớp dòng B3 rồi khớp lại; phiếu sai chiều/số tiền bị từ chối.
    const b3 = after.lines.find((l: { reference: string }) => l.reference === 'B3');
    expect(b3.voucherCode).toBe(chi.code);
    await acc.post(`/api/bank-reconciliation/lines/${b3.id}/unmatch`).expect(200);
    await acc.post(`/api/bank-reconciliation/lines/${b3.id}/unmatch`).expect(400); // đã bỏ khớp
    await acc.post(`/api/bank-reconciliation/lines/${b3.id}/match`, { voucherId: thu.id }).expect(400); // phiếu thu, dòng là tiền ra
    await acc.post(`/api/bank-reconciliation/lines/${b3.id}/match`, { voucherId: chi.id }).expect(200);

    // Huỷ phiếu chi: dòng sao kê đã khớp thành chưa khớp; xoá dòng sao kê phí chưa ghi sổ.
    await acc.post(`/api/cash-vouchers/${chi.id}/cancel`, {}).expect(200);
    const afterCancel = (await acc.get(`/api/bank-reconciliation?${q}`).expect(200)).body;
    expect(afterCancel.lines.find((l: { reference: string }) => l.reference === 'B3').voucherId).toBeNull();
    const fee = afterCancel.lines.find((l: { reference: string }) => l.reference === 'B4');
    await acc.post(`/api/bank-reconciliation/lines/${fee.id}/delete`).expect(200);
    expect((await acc.get(`/api/bank-reconciliation?${q}`).expect(200)).body.summary.lines).toBe(3);
  });

  it('lưu chuyển tiền tệ: phân loại theo tài khoản đối ứng, bỏ qua chuyển nội bộ, khớp số dư tiền trên sổ cái', async () => {
    const before = await flow();
    expect(before.check.difference).toBe(0);

    await acc.post('/api/cash-vouchers', { kind: 'THU', date: today, category: 'Thu tiền khách hàng', partnerType: 'KHACH_HANG', partnerId: customerId, accountId: tm, amount: 1_000_000, description: 'E2E' }).expect(201); // 131 → 01
    await acc.post('/api/cash-vouchers', { kind: 'CHI', date: today, category: 'Chi trả nhà cung cấp', partnerType: 'NHA_CUNG_CAP', partnerId: 'ncc-1', accountId: tm, amount: 400_000, description: 'E2E' }).expect(201); // 331 → 02
    await acc.post('/api/cash-vouchers', voucher({ kind: 'CHI', category: 'Chi khác', accountId: tm, amount: 50_000 })).expect(201); // 642 → 02
    await acc.post('/api/cash-vouchers', voucher({ kind: 'CHI', category: 'Chi lương nhân viên', accountId: tm, amount: 300_000 })).expect(201); // 334 → 03
    await acc.post('/api/cash-vouchers', voucher({ kind: 'CHI', category: 'Nộp thuế GTGT', accountId: tm, amount: 100_000 })).expect(201); // 3331 → 07
    await acc.post('/api/cash-vouchers', voucher({ kind: 'THU', category: 'Thu khác', accountId: tm, amount: 250_000 })).expect(201); // 711 → 06
    await acc.post('/api/cash-transfers', { fromAccountId: tm, toAccountId: nh2, date: today, amount: 600_000 }).expect(201); // không vào báo cáo

    const after = await flow();
    const delta = (c: string) => item(after, c) - item(before, c);
    expect(delta('01')).toBe(1_000_000);
    expect(delta('02')).toBe(-450_000);
    expect(delta('03')).toBe(-300_000);
    expect(delta('06')).toBe(250_000);
    expect(delta('07')).toBe(-100_000);
    expect(delta('20')).toBe(400_000); // 1.000.000 − 450.000 − 300.000 + 250.000 − 100.000
    expect(delta('50')).toBe(400_000);
    expect(after.closing - before.closing).toBe(400_000);
    expect(item(after, '70')).toBe(item(after, '50') + item(after, '60'));
    expect(after.check.difference).toBe(0); // tiền cuối kỳ khớp số dư 111 + 112 + 113 trên sổ cái

    await acc.get('/api/accounting/cash-flow?from=2025-12-01&to=2026-01-31').expect(400); // khác năm
    await sale.get(`/api/accounting/cash-flow?from=${year}-01-01&to=${today}`).expect(403);
  });
});
