// Đợt 1 hoá đơn — ghi nhận số hoá đơn phát hành ngoài phần mềm (cổng MISA…), xuất dữ liệu để nhập lên cổng, nhập số về từ file.
// Chạy trên database riêng nt_qa_inv (tạo lại mỗi lần: migrate + seed + dữ liệu demo) nên không chạm dữ liệu đang dùng.
// Số liệu mong đợi tính tay: 1 cái 100.000 ₫ thuế 10% → đợt 3 cái 330.000, đợt 1 cái 110.000.
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
import { releaseDeliveries } from '../src/modules/einvoice/einvoice-guards.js';

const MAIN_URL = process.env.DATABASE_URL!;
const QA_DB = 'nt_qa_inv';
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

const day = (offset: number) => vnDay(new Date(Date.now() + offset * 86_400_000));
const today = day(0);
const WH = 'wh-ninhtrang';
const SERIES = `C${today.slice(2, 4)}TAA`;

describe('Hoá đơn phát hành ngoài phần mềm: ghi nhận, xuất dữ liệu, nhập số về (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let savedUrl: string | undefined;
  let item = '';
  let customerId = '';
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
  type Client = Awaited<ReturnType<typeof as>>;
  let manager: Client, accountant: Client, sale: Client, storekeeper: Client;

  /** Đơn 4 cái × 100.000 ₫ thuế 10%, giao hai đợt: 3 cái (hôm nay −2) và 1 cái (hôm nay). */
  async function deliveredOrder() {
    const o = (await manager.post('/api/sales-orders', {
      customerId, tagIds: [], orderDate: day(-5), discountAmount: 0, salesRep: 'quan.ly@ninhtrang.local',
      lines: [{ productId: item, unit: 'Cái', quantity: 4, unitPrice: 100_000, vatRate: 10, warehouseId: WH }],
    }).expect(201)).body;
    await manager.post(`/api/sales-orders/${o.id}/deliver`, { date: day(-2), items: [{ lineIndex: 0, quantity: 3 }] }).expect(200);
    await manager.post(`/api/sales-orders/${o.id}/deliver`, { date: today, items: [{ lineIndex: 0, quantity: 1 }] }).expect(200);
    return (await manager.get(`/api/sales-orders/${o.id}`).expect(200)).body as { id: string; code: string; updatedAt: string; deliveries: { id: string; amount: number }[] };
  }
  const record = (c: Client, orderId: string, deliveryId: string | undefined, number: string, issueDate: string, series = SERIES) =>
    c.post('/api/einvoice/record', { orderId, deliveryId, templateCode: '1', series, number, issueDate });

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
    accountant = await as('ke.toan@ninhtrang.local');
    sale = await as('sale1@ninhtrang.local');
    storekeeper = await as('thu.kho@ninhtrang.local');
    item = (await manager.post('/api/products', { name: 'E2E Hoá đơn ngoài', type: 'VAT_TU', baseUnit: 'Cái', retailPrice: 100_000, defaultWarehouseId: WH }).expect(201)).body.id;
    await manager.post('/api/warehouse-vouchers', { type: 'NHAP', date: day(-5), warehouseId: WH, lines: [{ productId: item, quantity: 50, unitPrice: 50_000 }] }).expect(201);
    customerId = (await manager.post('/api/customers', {
      name: 'Anh Nam', companyName: 'E2E Công ty Hoá Đơn', companyTaxCode: '0101234567', type: 'SI', creditDays: 0, tagIds: [],
      addresses: [{ address: '12 Phố Huế, Hà Nội', isDefault: true }],
    }).expect(201)).body.id;
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    process.env.DATABASE_URL = savedUrl;
  });

  let a: Awaited<ReturnType<typeof deliveredOrder>>;

  it('danh sách cần lập hoá đơn và dữ liệu xuất cho cổng: mỗi đợt một dòng, mã tham chiếu đi kèm', async () => {
    a = await deliveredOrder();
    const out = (await accountant.get(`/api/einvoice/outstanding?from=${day(-10)}&to=${today}`).expect(200)).body;
    const mine = out.items.filter((i: { orderId: string }) => i.orderId === a.id);
    expect(mine.map((i: { ref: string; amount: number; date: string }) => [i.ref, i.amount, i.date])).toEqual([[`${a.code}#1`, 330_000, day(-2)], [`${a.code}#2`, 110_000, today]]);
    expect(mine[0]).toMatchObject({ customerName: 'E2E Công ty Hoá Đơn', taxCode: '0101234567', deliveryId: a.deliveries[0].id });
    // Lọc theo khách / từ khoá; khoảng ngày không có đợt giao thì rỗng.
    expect((await accountant.get(`/api/einvoice/outstanding?from=${day(-10)}&to=${today}&search=${a.code}`).expect(200)).body.items).toHaveLength(2);
    expect((await accountant.get(`/api/einvoice/outstanding?from=${day(-30)}&to=${day(-20)}`).expect(200)).body.items).toHaveLength(0);
    await accountant.get('/api/einvoice/outstanding?from=2026-13-40').expect(400);

    const data = (await accountant.post('/api/einvoice/export-data', { items: mine.map((i: { orderId: string; deliveryId: string }) => ({ orderId: i.orderId, deliveryId: i.deliveryId })) }).expect(200)).body;
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({ ref: `${a.code}#1`, orderCode: a.code, invoice: { taxable: 300_000, vatAmount: 30_000, total: 330_000, issueDate: day(-2), buyer: { taxCode: '0101234567' } } });
    expect(data[0].invoice.lines).toEqual([expect.objectContaining({ nature: 1, quantity: 3, unitPrice: 100_000, amount: 300_000, vat: '10' })]);
    expect(data[1].invoice.total).toBe(110_000);
    // Thủ kho không có quyền xem hoá đơn; Sale xem được nhưng không ghi nhận được.
    await storekeeper.get(`/api/einvoice/outstanding?from=${day(-10)}&to=${today}`).expect(403);
    await sale.post('/api/einvoice/export-data', { items: [{ orderId: a.id }] }).expect(200);
    await record(sale, a.id, a.deliveries[0].id, '101', day(-2)).expect(403);
  });

  it('ghi nhận số hoá đơn từng đợt; kiểm tra ký hiệu, ngày, số, trùng', async () => {
    const [d1, d2] = a.deliveries;
    // Sai: năm ký hiệu khác năm hoá đơn · số 0 · số quá dài · ngày sau hôm nay · ngày trước ngày giao hàng.
    await record(accountant, a.id, d1.id, '101', day(-2), 'C25TAA').expect(400);
    await record(accountant, a.id, d1.id, '0', day(-2)).expect(400);
    await record(accountant, a.id, d1.id, '123456789', day(-2)).expect(400);
    await record(accountant, a.id, d1.id, '101', day(1)).expect(400);
    await record(accountant, a.id, d1.id, '101', day(-3)).expect(400);
    expect(await prisma.eInvoice.count({ where: { orderId: a.id } })).toBe(0);

    const r1 = (await record(accountant, a.id, d1.id, '0000101', day(-2)).expect(200)).body;
    expect(r1).toMatchObject({ kind: 'ORIGINAL', status: 'ISSUED', provider: 'EXTERNAL', number: '0000101', series: SERIES, templateCode: '1', total: 330_000, taxable: 300_000, vat: 30_000, issueDate: day(-2) });
    // Cùng đợt lần nữa; đợt khác nhưng cùng số (0000101 = 101); cả đơn khi đã có hoá đơn theo đợt.
    await record(accountant, a.id, d1.id, '0000102', day(-2)).expect(409);
    await record(accountant, a.id, d2.id, '101', today).expect(409);
    await record(accountant, a.id, undefined, '0000103', today).expect(409);
    const r2 = (await record(manager, a.id, d2.id, '0000102', today).expect(200)).body;
    expect(r2).toMatchObject({ status: 'ISSUED', total: 110_000, number: '0000102' });

    // Hết đợt cần lập; đợt đã có hoá đơn không bỏ chốt giao được.
    const out = (await accountant.get(`/api/einvoice/outstanding?from=${day(-10)}&to=${today}`).expect(200)).body;
    expect(out.items.filter((i: { orderId: string }) => i.orderId === a.id)).toHaveLength(0);
    await expect(prisma.$transaction((tx) => releaseDeliveries(tx, a.id, [d1.id], a.code))).rejects.toThrow('không bỏ chốt giao');

    // Bảng kê bán ra lấy được hoá đơn ghi nhận: 300.000 + 100.000 chịu thuế 10%, thuế 40.000.
    const vat = (await accountant.get(`/api/accounting/vat/outputs?from=${day(-2)}&to=${today}`).expect(200)).body;
    const rows = vat.rows.filter((x: { orderCode: string }) => x.orderCode === a.code);
    expect(rows.map((x: { number: string; total: number }) => [x.number, x.total])).toEqual([['0000101', 330_000], ['0000102', 110_000]]);
    expect(rows.reduce((s: number, x: { vat: number }) => s + x.vat, 0)).toBe(40_000);

    // Danh sách hoá đơn.
    const list = (await accountant.get(`/api/einvoice?from=${day(-2)}&to=${today}&search=${a.code}`).expect(200)).body;
    expect(list.rows.map((x: { number: string }) => x.number).sort()).toEqual(['0000101', '0000102']);
    expect(list.rows[0]).toMatchObject({ orderCode: a.code, customerName: 'E2E Công ty Hoá Đơn' });
  });

  it('gỡ ghi nhận: cần lý do và quyền; đợt đó lập lại được; bảng kê bỏ hoá đơn đã gỡ', async () => {
    const [, d2] = a.deliveries;
    const inv = await prisma.eInvoice.findFirstOrThrow({ where: { deliveryId: d2.id } });
    await sale.post(`/api/einvoice/${inv.id}/void`, { reason: 'Nhập nhầm số' }).expect(403);
    await accountant.post(`/api/einvoice/${inv.id}/void`, { reason: 'ab' }).expect(400);
    const voided = (await accountant.post(`/api/einvoice/${inv.id}/void`, { reason: 'Nhập nhầm số hoá đơn' }).expect(200)).body;
    expect(voided).toMatchObject({ status: 'VOID', reason: 'Nhập nhầm số hoá đơn' });
    await accountant.post(`/api/einvoice/${inv.id}/void`, { reason: 'Gỡ lần hai' }).expect(400);

    const vat = (await accountant.get(`/api/accounting/vat/outputs?from=${day(-2)}&to=${today}`).expect(200)).body;
    expect(vat.rows.filter((x: { orderCode: string }) => x.orderCode === a.code).map((x: { number: string }) => x.number)).toEqual(['0000101']);
    const out = (await accountant.get(`/api/einvoice/outstanding?from=${day(-10)}&to=${today}`).expect(200)).body;
    expect(out.items.filter((i: { orderId: string }) => i.orderId === a.id).map((i: { ref: string }) => i.ref)).toEqual([`${a.code}#2`]);

    // Số của hoá đơn đã gỡ dùng lại được; ghi nhận lại đúng số mới.
    const again = (await record(accountant, a.id, d2.id, '0000102', today).expect(200)).body;
    expect(again).toMatchObject({ status: 'ISSUED', number: '0000102' });
    // Hoá đơn đã gỡ vẫn lưu lại (VOID) bên cạnh hoá đơn ghi nhận lại.
    expect(await prisma.eInvoice.count({ where: { deliveryId: d2.id } })).toBe(2);
  });

  it('nhập số hoá đơn từ file: chạy thử không ghi; dòng lạ bỏ qua; dòng lỗi báo riêng; trùng số trong file', async () => {
    const b = await deliveredOrder();
    const [b1, b2] = b.deliveries;
    const rows = [
      { ref: `${b.code}#1`, number: '0000201', issueDate: day(-2) },
      { ref: `${b.code}#2`, number: '0000202', issueDate: today },
      { ref: 'KHONGCO999', number: '0000203', issueDate: today }, // không phải đơn của mình
      { ref: `${b.code}#9`, number: '0000204', issueDate: today }, // đợt không có
      { ref: `${b.code}`, number: '0000205', issueDate: today }, // cả đơn trong khi đơn giao theo đợt
      { ref: '', number: '0000206', issueDate: today },
    ];
    const body = (dryRun: boolean, extra: object = {}) => ({ dryRun, templateCode: '1', series: SERIES, rows, ...extra });
    const dry = (await accountant.post('/api/einvoice/record/import', body(true)).expect(200)).body;
    expect(dry.dryRun).toBe(true);
    expect(dry.results.map((r: { status: string }) => r.status)).toEqual(['OK', 'OK', 'SKIPPED', 'ERROR', 'ERROR', 'SKIPPED']);
    expect(dry.summary).toEqual({ ok: 2, skipped: 2, errors: 2 });
    expect(await prisma.eInvoice.count({ where: { orderId: b.id } })).toBe(0);

    // Thiếu ký hiệu: dòng không tự mang ký hiệu thì báo lỗi, không ghi.
    const noSeries = (await accountant.post('/api/einvoice/record/import', { ...body(true), series: undefined }).expect(200)).body;
    expect(noSeries.results[0]).toMatchObject({ status: 'ERROR', message: expect.stringContaining('ký hiệu') });

    // Cùng số hai lần trong một file: dòng sau báo lỗi, kể cả khi chạy thử.
    const dup = (await accountant.post('/api/einvoice/record/import', body(true, { rows: [rows[0], { ...rows[1], number: '201' }] })).expect(200)).body;
    expect(dup.results.map((r: { status: string }) => r.status)).toEqual(['OK', 'ERROR']);
    expect(dup.results[1].message).toContain('trùng');

    await sale.post('/api/einvoice/record/import', body(false)).expect(403);
    const real = (await accountant.post('/api/einvoice/record/import', body(false)).expect(200)).body;
    expect(real.summary).toEqual({ ok: 2, skipped: 2, errors: 2 });
    const saved = await prisma.eInvoice.findMany({ where: { orderId: b.id }, orderBy: { number: 'asc' } });
    expect(saved.map((x) => [x.deliveryId, x.number, x.status, x.provider])).toEqual([[b1.id, '0000201', 'ISSUED', 'EXTERNAL'], [b2.id, '0000202', 'ISSUED', 'EXTERNAL']]);

    // Chạy lại cùng file: hai dòng đầu đã có hoá đơn nên báo lỗi, không tạo thêm.
    const rerun = (await accountant.post('/api/einvoice/record/import', body(false)).expect(200)).body;
    expect(rerun.summary).toEqual({ ok: 0, skipped: 2, errors: 4 });
    expect(await prisma.eInvoice.count({ where: { orderId: b.id } })).toBe(2);
  });

  it('khoá sổ: không ghi nhận hay gỡ hoá đơn có ngày trong kỳ đã khoá', async () => {
    const c = await deliveredOrder();
    const start = day(-40);
    await manager.post('/api/accounting/settings', { ledgerStartDate: start }).expect(201);
    await prisma.companyInfo.updateMany({ data: { lockDate: new Date(`${day(-1)}T00:00:00Z`) } });
    await record(accountant, c.id, c.deliveries[0].id, '0000301', day(-2)).expect(400);
    await prisma.companyInfo.updateMany({ data: { lockDate: null } });
    const ok = (await record(accountant, c.id, c.deliveries[0].id, '0000301', day(-2)).expect(200)).body;
    await prisma.companyInfo.updateMany({ data: { lockDate: new Date(`${day(-1)}T00:00:00Z`) } });
    await accountant.post(`/api/einvoice/${ok.id}/void`, { reason: 'Thử gỡ trong kỳ khoá' }).expect(400);
    await prisma.companyInfo.updateMany({ data: { lockDate: null } });
  });
});
