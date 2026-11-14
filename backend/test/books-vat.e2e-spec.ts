// Đợt 1 kế toán — sổ sách TT133, thuế GTGT, hoá đơn NCC trên lần nhận hàng, hoá đơn mua không qua kho (HM…).
// Chạy trên database riêng nt_qa_books (tạo lại mỗi lần: migrate + seed + dữ liệu demo) nên không chạm dữ liệu đang dùng.
// Cần Postgres cho phép tạo database (máy local, CI). Số liệu mong đợi được tính tay từ chính các dòng đã nhập.
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
const QA_DB = 'nt_qa_books';
const QA_URL = withDatabase(MAIN_URL, QA_DB);
const DEMO_PASSWORD = 'QaMatKhau2026';

async function freshQaDatabase(): Promise<void> {
  const c = new pg.Client({ connectionString: MAIN_URL });
  await c.connect();
  await c.query(`DROP DATABASE IF EXISTS "${QA_DB}" WITH (FORCE)`);
  await c.end();
  await createDatabase(MAIN_URL, QA_DB);
  const steps = [
    () => migrateDeploy(QA_URL),
    () => runScript('prisma/seed.ts', { DATABASE_URL: QA_URL, SEED_ADMIN_PASSWORD: DEMO_PASSWORD }),
    () => runScript('prisma/seed-demo.ts', { DATABASE_URL: QA_URL, DEMO_USER_PASSWORD: DEMO_PASSWORD, SEED_DEMO: 'true', NODE_ENV: 'test' }),
  ];
  for (const step of steps) {
    const r = await step();
    if (!r.ok) throw new Error(errorTail(r.output));
  }
}

const today = vnDay();
const year = today.slice(0, 4);
const tag = `E2E${Date.now().toString().slice(-6)}`;

describe('Sổ sách, thuế GTGT và hoá đơn mua hàng (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const api = () => request(app.getHttpServer());
  async function as(email: string) {
    const token = (await api().post('/api/auth/login').send({ email, password: DEMO_PASSWORD }).expect(200)).body.accessToken;
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    return {
      get: (url: string) => auth(api().get(url)),
      post: (url: string, body: object = {}) => auth(api().post(url)).send(body),
      put: (url: string, body: object) => auth(api().put(url)).send(body),
    };
  }
  let manager: Awaited<ReturnType<typeof as>>;
  let sale: Awaited<ReturnType<typeof as>>;
  let storekeeper: Awaited<ReturnType<typeof as>>;
  let accountant: Awaited<ReturnType<typeof as>>;

  let savedUrl: string | undefined;
  let supplierId = '';
  let productId = '';
  let orderId = '';
  let cashAccountId = '';
  let receiptIds: string[] = [];

  const closing = async (code: string) => {
    const tb = (await manager.get(`/api/accounting/trial-balance?period=${year}`).expect(200)).body.rows as { code: string; closingNo: number; closingCo: number }[];
    const r = tb.find((x) => x.code === code);
    return { no: r?.closingNo ?? 0, co: r?.closingCo ?? 0 };
  };

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
    manager = await as('quan.ly@ninhtrang.local');
    sale = await as('sale1@ninhtrang.local');
    storekeeper = await as('thu.kho@ninhtrang.local');
    accountant = await as('ke.toan@ninhtrang.local');

    await manager.post('/api/accounting/settings', { ledgerStartDate: `${year}-01-01` }).expect(201);
    supplierId = (await manager.post('/api/suppliers', { name: `${tag} NCC`, taxCode: '0312345678', creditDays: 0 }).expect(201)).body.id;
    productId = (await manager.post('/api/products', { name: `${tag} Vật tư`, type: 'VAT_TU', baseUnit: 'Cái' }).expect(201)).body.id;
    cashAccountId = (await prisma.cashAccount.create({ data: { name: `${tag} Quỹ`, type: 'TIEN_MAT', openingBalance: 100_000_000 } })).id;
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    process.env.DATABASE_URL = savedUrl;
  });

  it('nhận hàng ghi hoá đơn NCC và tách thuế theo thuế suất; hoá đơn bổ sung sau được', async () => {
    // 10 × 100.000 @10% = 1.000.000 + 100.000 · 5 × 200.000 @8% = 1.000.000 + 80.000 → công nợ 2.180.000
    const o = (await manager.post('/api/purchase-orders', {
      supplierId, date: today, note: tag,
      lines: [
        { productId, quantity: 10, unitPrice: 100_000, vatRate: 10, warehouseId: 'wh-vattu' },
        { productId, quantity: 5, unitPrice: 200_000, vatRate: 8, warehouseId: 'wh-vattu' },
      ],
    }).expect(201)).body;
    orderId = o.id;
    await manager.post(`/api/purchase-orders/${o.id}/send`).expect(200);

    // Ngày hoá đơn không được ở tương lai; ký hiệu / ngày mà thiếu số hoá đơn là nhập thiếu.
    const tomorrow = vnDay(new Date(Date.now() + 86_400_000));
    const item = [{ lineIndex: 0, quantity: 1, warehouseId: 'wh-vattu' }];
    await manager.post(`/api/purchase-orders/${o.id}/receive`, { date: today, invoiceDate: tomorrow, invoiceNo: 'X', items: item }).expect(400);
    await manager.post(`/api/purchase-orders/${o.id}/receive`, { date: today, invoiceSeries: 'C26TAA', items: item }).expect(400);

    // Lần 1: nhận cả dòng 1 (10 cái @10%) kèm hoá đơn.
    const first = (await manager.post(`/api/purchase-orders/${o.id}/receive`, {
      date: today, invoiceSeries: 'C26TAA', invoiceNo: `${tag}-1`, invoiceDate: today, items: [{ lineIndex: 0, quantity: 10, warehouseId: 'wh-vattu' }],
    }).expect(200)).body;
    expect(first.receipts).toHaveLength(1);
    expect(first.receipts[0]).toMatchObject({ amount: 1_100_000, invoiceSeries: 'C26TAA', invoiceNo: `${tag}-1`, invoiceDate: today });

    // Lần 2: nhận dòng 2 (5 cái @8%) chưa có hoá đơn.
    const second = (await manager.post(`/api/purchase-orders/${o.id}/receive`, { date: today, items: [{ lineIndex: 1, quantity: 5, warehouseId: 'wh-vattu' }] }).expect(200)).body;
    expect(second.receipts).toHaveLength(2);
    expect(second.receipts[1]).toMatchObject({ amount: 1_080_000 });
    expect(second.receipts[1].invoiceNo).toBeNull();
    receiptIds = second.receipts.map((r: { id: string }) => r.id);

    // Thủ kho (chỉ có purchase.receive) không thấy giá trị nhưng bổ sung được hoá đơn — người không có quyền thì không.
    await sale.put(`/api/purchase-orders/${o.id}/receipts/${receiptIds[1]}/invoice`, { invoiceNo: 'Z' }).expect(403);
    // Kế toán (không có quyền nhận hàng nhưng có quyền ghi sổ) nhập được hoá đơn NCC.
    await accountant.put(`/api/purchase-orders/${o.id}/receipts/${receiptIds[1]}/invoice`, { invoiceSeries: 'C26TAA', invoiceNo: `${tag}-0` }).expect(200);
    await manager.put(`/api/purchase-orders/${o.id}/receipts/${receiptIds[1]}/invoice`, { invoiceNo: 'X', invoiceDate: tomorrow }).expect(400);
    const fixed = (await storekeeper.put(`/api/purchase-orders/${o.id}/receipts/${receiptIds[1]}/invoice`, { invoiceSeries: 'C26TAA', invoiceNo: `${tag}-2`, invoiceDate: today }).expect(200)).body;
    expect(fixed.receipts[1]).toMatchObject({ invoiceNo: `${tag}-2` });
    expect(fixed.receipts[1].amount).toBeNull(); // thủ kho không thấy giá trị
  });

  it('bảng kê mua vào gom đúng thuế suất và chỉ kê khoản có hoá đơn; khoản thiếu hoá đơn nằm riêng', async () => {
    // Bỏ hoá đơn của lần nhận 2 để kiểm tra nhánh "chưa có hoá đơn".
    await manager.put(`/api/purchase-orders/${orderId}/receipts/${receiptIds[1]}/invoice`, {}).expect(200);
    const res = (await manager.get(`/api/accounting/vat/inputs?from=${today}&to=${today}`).expect(200)).body;
    const mine = res.rows.filter((r: { supplierName: string }) => r.supplierName === `${tag} NCC`);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ kind: 'HOA_DON', series: 'C26TAA', number: `${tag}-1`, taxable: 1_000_000, vat: 100_000 });
    expect(mine[0].buckets).toEqual([{ rate: 10, taxable: 1_000_000, vat: 100_000 }]);
    const missing = res.uninvoiced.filter((r: { supplierName: string }) => r.supplierName === `${tag} NCC`);
    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({ source: 'NHAN_HANG', taxable: 1_000_000, vat: 80_000, known: true });

    // Có lại hoá đơn thì khoản đó vào bảng kê.
    await manager.put(`/api/purchase-orders/${orderId}/receipts/${receiptIds[1]}/invoice`, { invoiceSeries: 'C26TAA', invoiceNo: `${tag}-2`, invoiceDate: today }).expect(200);
    const again = (await manager.get(`/api/accounting/vat/inputs?from=${today}&to=${today}`).expect(200)).body;
    const rows = again.rows.filter((r: { supplierName: string }) => r.supplierName === `${tag} NCC`);
    expect(rows.map((r: { number: string }) => r.number).sort()).toEqual([`${tag}-1`, `${tag}-2`]);
    expect(rows.reduce((s: number, r: { vat: number }) => s + r.vat, 0)).toBe(180_000);
  });

  it('hoá đơn mua không qua kho: tính thuế, ghi công nợ phải trả, chống trùng, kiểm tra tài khoản', async () => {
    const body = (extra: object = {}) => ({
      supplierId, date: today, description: 'E2E điện + vận chuyển', invoiceSeries: 'C26TAA', invoiceNo: `${tag}-HM1`, invoiceDate: today,
      lines: [
        { accountCode: '642', description: 'Tiền điện', amount: 500_000, vatRate: 10 },
        { accountCode: '641', description: 'Vận chuyển', amount: 200_000, vatRate: 8 },
      ], ...extra,
    });
    await sale.post('/api/purchase-bills', body()).expect(403);
    // 156 là hàng tồn kho — đi qua phiếu nhập kho, không qua hoá đơn này.
    await manager.post('/api/purchase-bills', body({ lines: [{ accountCode: '156', description: 'Hàng', amount: 1000, vatRate: 10 }] })).expect(400);
    await manager.post('/api/purchase-bills', body({ lines: [{ accountCode: '642', description: 'Sai thuế', amount: 1000, vatRate: 7 }] })).expect(400);
    await manager.post('/api/purchase-bills', body({ invoiceNo: undefined })).expect(400); // có ký hiệu mà thiếu số hoá đơn

    const bill = (await manager.post('/api/purchase-bills', body()).expect(201)).body;
    // 500.000 + 50.000 (10%) + 200.000 + 16.000 (8%) = 766.000
    expect(bill).toMatchObject({ code: expect.stringMatching(/^HM\d{7}$/), taxable: 700_000, vat: 66_000, total: 766_000, isCancelled: false });
    await manager.post('/api/purchase-bills', body()).expect(409); // cùng hoá đơn của cùng NCC

    // Công nợ phải trả: 2.180.000 (hai lần nhận) + 766.000.
    const payable = ((await manager.get('/api/payables').expect(200)).body as { partnerId: string; balance: number; items: { ref: string; amount: number }[] }[]).find((p) => p.partnerId === supplierId)!;
    expect(payable.balance).toBe(2_946_000);
    expect(payable.items.some((i) => i.ref === bill.code && i.amount === 766_000)).toBe(true);

    // Sổ cái: Nợ 642 500.000 + 641 200.000 + 133 66.000 / Có 331 766.000.
    const entry = await prisma.journalEntry.findFirstOrThrow({ where: { refType: 'PurchaseBill', refId: bill.id }, include: { lines: true } });
    const by = (code: string) => entry.lines.filter((l) => l.accountCode === code);
    expect(by('642')[0].debit.toNumber()).toBe(500_000);
    expect(by('641')[0].debit.toNumber()).toBe(200_000);
    expect(by('133')[0].debit.toNumber()).toBe(66_000);
    expect(by('331')[0].credit.toNumber()).toBe(766_000);
    expect(by('331')[0].supplierId).toBe(supplierId);

    // Bảng kê mua vào có hoá đơn HM với đúng tách thuế.
    const inputs = (await manager.get(`/api/accounting/vat/inputs?from=${today}&to=${today}`).expect(200)).body;
    const row = inputs.rows.find((r: { number: string }) => r.number === `${tag}-HM1`);
    expect(row).toMatchObject({ taxable: 700_000, vat: 66_000 });
    expect(row.buckets).toEqual([{ rate: 8, taxable: 200_000, vat: 16_000 }, { rate: 10, taxable: 500_000, vat: 50_000 }]);
  });

  it('sổ chi tiết công nợ 331 theo NCC và bảng tổng hợp công nợ khớp công nợ phải trả', async () => {
    const book = (await manager.get(`/api/accounting/books/account?code=331&from=${year}-01-01&to=${today}&partnerId=${supplierId}`).expect(200)).body;
    expect(book.account).toMatchObject({ code: '331', normalSide: 'CO' });
    expect(book.openingNo + book.openingCo).toBe(0);
    expect(book.totalCredit).toBe(2_946_000); // 1.100.000 + 1.080.000 + 766.000
    expect(book.totalDebit).toBe(0);
    expect(book.closingCo).toBe(2_946_000);
    expect(book.rows.at(-1).balance).toBe(2_946_000);
    expect(book.rows.every((r: { partner: string }) => r.partner === `${tag} NCC`)).toBe(true);

    const sum = (await manager.get(`/api/accounting/books/partners?code=331&from=${year}-01-01&to=${today}`).expect(200)).body;
    const mine = sum.rows.find((r: { partnerId: string }) => r.partnerId === supplierId);
    expect(mine).toMatchObject({ debit: 0, credit: 2_946_000, closingCo: 2_946_000, closingNo: 0 });

    // Sổ quỹ: phiếu chi trả NCC giảm 331, ghi giảm quỹ.
    const bill = await prisma.purchaseBill.findFirstOrThrow({ where: { supplierId } });
    const pc = (await manager.post('/api/cash-vouchers', {
      kind: 'CHI', date: today, category: 'Chi trả nhà cung cấp', partnerType: 'NHA_CUNG_CAP', partnerId: supplierId, accountId: cashAccountId, amount: 766_000,
      description: `${tag} trả HM`, allocations: [{ ref: bill.code, amount: 766_000 }],
    }).expect(201)).body;
    const after = (await manager.get(`/api/accounting/books/account?code=331&from=${year}-01-01&to=${today}&partnerId=${supplierId}`).expect(200)).body;
    expect(after.totalDebit).toBe(766_000);
    expect(after.closingCo).toBe(2_180_000);
    // Đã đối trừ bằng phiếu chi thì không huỷ hoá đơn được.
    expect((await manager.post(`/api/purchase-bills/${bill.id}/cancel`, { reason: 'E2E' }).expect(400)).body.message).toContain(pc.code);

    // Đầu vào hợp lệ + lỗi.
    await manager.get('/api/accounting/books/account?code=331&from=2025-12-31&to=2026-01-02').expect(400); // khác năm
    await manager.get(`/api/accounting/books/account?code=111&from=${today}&to=${today}&partnerId=${supplierId}`).expect(400); // 111 không theo đối tượng
    await manager.get('/api/accounting/books/partners?code=111&from=2026-01-01&to=2026-01-31').expect(400);
    await sale.get(`/api/accounting/books/account?code=111&from=${year}-01-01&to=${today}`).expect(403);
    await storekeeper.get(`/api/accounting/vat/summary?from=${today}&to=${today}`).expect(403);
  });

  it('huỷ hoá đơn mua đảo bút toán và bỏ khỏi công nợ', async () => {
    const bill = (await manager.post('/api/purchase-bills', {
      supplierId, date: today, invoiceSeries: 'C26TAA', invoiceNo: `${tag}-HM2`,
      lines: [{ accountCode: '642', description: 'Thuê ngoài', amount: 1_000_000, vatRate: 10 }],
    }).expect(201)).body;
    const before =((await manager.get('/api/payables').expect(200)).body as { partnerId: string; balance: number }[]).find((p) => p.partnerId === supplierId)!.balance;
    expect(bill.total).toBe(1_100_000);
    const cancelled = (await manager.post(`/api/purchase-bills/${bill.id}/cancel`, { reason: 'E2E nhập nhầm' }).expect(200)).body;
    expect(cancelled).toMatchObject({ isCancelled: true, cancelReason: 'E2E nhập nhầm' });
    await manager.post(`/api/purchase-bills/${bill.id}/cancel`, {}).expect(400);
    const after = ((await manager.get('/api/payables').expect(200)).body as { partnerId: string; balance: number }[]).find((p) => p.partnerId === supplierId)!.balance;
    expect(after).toBe(before - 1_100_000);
    // Bút toán gốc và bút toán đảo cùng ghi — số dư các TK bị đảo triệt tiêu.
    const entries = await prisma.journalEntry.findMany({ where: { refType: 'PurchaseBill', refId: bill.id }, include: { lines: true } });
    expect(entries).toHaveLength(2);
    expect(entries.filter((e) => e.isReversal)).toHaveLength(1);
    // Hoá đơn đã huỷ không còn trong bảng kê.
    const inputs = (await manager.get(`/api/accounting/vat/inputs?from=${today}&to=${today}`).expect(200)).body;
    expect(inputs.rows.some((r: { number: string }) => r.number === `${tag}-HM2`)).toBe(false);
  });

  it('bảng kê bán ra tách thuế theo thuế suất từ dòng hoá đơn điện tử đã phát hành', async () => {
    const user = await prisma.user.findFirstOrThrow();
    let orderOk: string | null = null;
    for (const o of await prisma.salesOrder.findMany({ take: 60, select: { id: true } })) {
      if ((await prisma.eInvoice.count({ where: { orderId: o.id } })) === 0) { orderOk = o.id; break; }
    }
    if (!orderOk) return; // dữ liệu local không có đơn nào chưa xuất hoá đơn — bỏ qua
    const inv = await prisma.eInvoice.create({
      data: {
        kind: 'ORIGINAL', status: 'ISSUED', orderId: orderOk, partnerKey: `${tag}-out`, provider: 'e2e', templateCode: '1', series: 'C26TAA', number: `${tag}`.slice(-7),
        issueDate: new Date(`${today}T00:00:00.000Z`), buyer: { companyName: `${tag} Khách`, name: '', taxCode: '0101234567' },
        // 1.000.000 @10% + 500.000 @8% → thuế 100.000 + 40.000
        lines: [{ amount: 1_000_000, vat: '10' }, { amount: 500_000, vat: '8' }], taxable: 1_500_000, vat: 140_000, total: 1_640_000, createdById: user.id,
      },
    });
    const out = (await manager.get(`/api/accounting/vat/outputs?from=${today}&to=${today}`).expect(200)).body;
    const row = out.rows.find((r: { id: string }) => r.id === inv.id);
    expect(row).toMatchObject({ buyerName: `${tag} Khách`, buyerTaxCode: '0101234567', taxable: 1_500_000, vat: 140_000, total: 1_640_000 });
    expect(row.buckets).toEqual([{ rate: 8, taxable: 500_000, vat: 40_000 }, { rate: 10, taxable: 1_000_000, vat: 100_000 }]);

    // Hoá đơn chưa phát hành / đã bị thay thế không vào bảng kê.
    await prisma.eInvoice.update({ where: { id: inv.id }, data: { status: 'REPLACED' } });
    const replaced = (await manager.get(`/api/accounting/vat/outputs?from=${today}&to=${today}`).expect(200)).body;
    expect(replaced.rows.some((r: { id: string }) => r.id === inv.id)).toBe(false);
    await prisma.eInvoice.update({ where: { id: inv.id }, data: { status: 'ISSUED' } });

    const summary = (await manager.get(`/api/accounting/vat/summary?from=${today}&to=${today}`).expect(200)).body;
    expect(summary.output.vat).toBeGreaterThanOrEqual(140_000);
    expect(summary.input.vat).toBeGreaterThanOrEqual(246_000); // 100.000 + 80.000 + 66.000
    // Đối chiếu sổ cái: thuế đầu vào khớp bảng kê (HM2 đã huỷ được trừ bằng bút toán đảo); chưa có bán hàng nào ghi 3331.
    expect(summary.reconciliation).toMatchObject({ inputVatLedger: 246_000, inputVatListed: 246_000, inputDifference: 0, outputVatLedger: 0 });
    expect(summary.payable - summary.carryOver).toBe(summary.output.vat - summary.input.vat - summary.carryForward);
    await manager.get('/api/accounting/vat/summary?from=2026-02-01&to=2026-01-01').expect(400);
  });

  it('khấu trừ thuế GTGT: Nợ 3331 / Có 133 bằng số nhỏ hơn của hai số dư', async () => {
    // Tạo số dư Có 3331 để có cái khấu trừ.
    await manager.post('/api/accounting/journal', {
      date: today, description: `${tag} thuế đầu ra`, lines: [{ accountCode: '131', debit: 300_000 }, { accountCode: '3331', credit: 300_000 }],
    }).expect(201);
    const [b133, b3331]= await Promise.all([closing('133'), closing('3331')]);
    const expected = Math.min(b133.no, b3331.co);
    expect(expected).toBeGreaterThan(0);

    await sale.post('/api/accounting/vat/offset', { date: today }).expect(403);
    const res = (await manager.post('/api/accounting/vat/offset', { date: today }).expect(200)).body;
    expect(res.amount).toBe(expected);
    const [a133, a3331] = await Promise.all([closing('133'), closing('3331')]);
    expect(a133.no).toBe(b133.no - expected);
    expect(a3331.co).toBe(b3331.co - expected);
    await manager.post('/api/accounting/vat/offset', { date: today }).expect(409); // mỗi ngày một lần
  });
});
