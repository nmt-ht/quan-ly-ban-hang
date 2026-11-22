// Giảm giá hàng bán (TK 5213): phiếu GG… giảm công nợ, doanh thu và thuế GTGT đầu ra vào ngày giảm, không động tới kho; huỷ thì về như cũ.
// Chạy trên database riêng nt_qa_allow (tạo lại mỗi lần) với năm 2019, xa dữ liệu demo. Số liệu tính tay từ đơn 10 × 100.000, VAT 10%.
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
const QA_DB = 'nt_qa_allow';
const QA_URL = withDatabase(MAIN_URL, QA_DB);
const PASSWORD = 'QaMatKhau2026';
const WH = 'wh-ninhtrang';
const ORDER_DAY = '2019-03-01';
const DAY = '2019-03-10';

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

interface Row { label: string; amount: number }

describe('Giảm giá hàng bán (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let savedUrl: string | undefined;
  const api = () => request(app.getHttpServer());
  async function as(email: string) {
    const token = (await api().post('/api/auth/login').send({ email, password: PASSWORD }).expect(200)).body.accessToken;
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    return { get: (url: string) => auth(api().get(url)), post: (url: string, body: object = {}) => auth(api().post(url)).send(body) };
  }
  let manager: Awaited<ReturnType<typeof as>>;
  let sale: Awaited<ReturnType<typeof as>>;
  let productId = '';
  let customerId = '';
  let orderId = '';
  let orderCode = '';
  let lineId = '';

  const owed = async () => {
    const rows = (await manager.get('/api/receivables').expect(200)).body as { partnerId: string; balance: number }[];
    return rows.find((r) => r.partnerId === customerId)?.balance ?? 0;
  };
  const stock = async () => Number((await prisma.stockLevel.findUnique({ where: { productId_warehouseId: { productId, warehouseId: WH } } }))?.quantity ?? 0);
  const trial = async (code: string) => {
    const rows = (await manager.get('/api/accounting/trial-balance?period=2019').expect(200)).body.rows as { code: string; debit: number; credit: number; closingNo: number; closingCo: number }[];
    return rows.find((r) => r.code === code);
  };
  const income = async (start: string) => ((await manager.get('/api/accounting/income-statement?period=2019').expect(200)).body.items as Row[]).find((r) => r.label.startsWith(start))!.amount;
  const create = (body: object) => manager.post(`/api/sales-orders/${orderId}/allowances`, body);

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

    await manager.post('/api/accounting/settings', { ledgerStartDate: '2019-01-01' }).expect(201);
    productId = (await manager.post('/api/products', { name: 'E2E Hàng giảm giá', type: 'VAT_TU', baseUnit: 'Cái', retailPrice: 100_000 }).expect(201)).body.id;
    customerId = (await manager.post('/api/customers', { name: 'E2E Khách giảm giá', type: 'LE', creditDays: 0, tagIds: [] }).expect(201)).body.id;
    await manager.post('/api/warehouse-vouchers', { type: 'NHAP', date: '2019-02-01', warehouseId: WH, lines: [{ productId, quantity: 10 }] }).expect(201);
    const o = (await manager.post('/api/sales-orders', {
      customerId, tagIds: [], orderDate: ORDER_DAY, discountAmount: 0,
      lines: [{ productId, unit: 'Cái', quantity: 10, unitPrice: 100_000, vatRate: 10, warehouseId: WH }],
    }).expect(201)).body;
    orderId = o.id;
    orderCode = o.code;
    lineId = o.lines[0].id;
    await manager.post(`/api/sales-orders/${orderId}/deliver`, { date: ORDER_DAY, items: [{ lineIndex: 0, quantity: 10, warehouseId: WH }] }).expect(200);
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    process.env.DATABASE_URL = savedUrl;
  });

  it('giao đủ: công nợ 1.100.000, doanh thu 1.000.000 và thuế đầu ra 100.000 trên sổ cái', async () => {
    expect(await owed()).toBe(1_100_000);
    expect(await trial('511')).toMatchObject({ credit: 1_000_000 });
    expect(await trial('3331')).toMatchObject({ closingCo: 100_000 });
    const limits = (await manager.post(`/api/sales-orders/${orderId}/allowances/limits`).expect(200)).body as { orderLineId: string; max: number }[];
    expect(limits).toEqual([{ orderLineId: lineId, max: 1_000_000 }]);
  });

  it('kiểm tra đầu vào: quyền, ngày, số tiền vượt phần khách đã nhận', async () => {
    const body = { date: DAY, reason: 'Hàng xước nhẹ', lines: [{ orderLineId: lineId, taxable: 100_000 }] };
    await sale.post(`/api/sales-orders/${orderId}/allowances`, body).expect(403);
    await create({ ...body, date: vnDay(new Date(Date.now() + 86_400_000)) }).expect(400); // sau hôm nay
    await create({ ...body, date: '2019-02-01' }).expect(400); // trước ngày đặt đơn
    await create({ ...body, lines: [{ orderLineId: lineId, taxable: 0 }] }).expect(400); // không dòng nào
    await create({ ...body, lines: [{ orderLineId: 'khong-co', taxable: 1000 }] }).expect(400); // dòng lạ
    const over = await create({ ...body, lines: [{ orderLineId: lineId, taxable: 1_000_001 }] }).expect(400);
    expect(over.body.message).toContain('tối đa');
    expect(await owed()).toBe(1_100_000);
  });

  let allowanceId = '';
  it('giảm 100.000 chưa thuế: công nợ giảm 110.000, kho không đổi, Nợ 5213 + Nợ 3331 / Có 131, doanh thu và nhật ký', async () => {
    const a = (await create({ date: DAY, reason: 'Hàng xước nhẹ', lines: [{ orderLineId: lineId, taxable: 100_000 }] }).expect(201)).body;
    allowanceId = a.id;
    expect(a.code).toMatch(/^GG\d{7}$/);
    expect(a).toMatchObject({ taxable: 100_000, amount: 110_000, isCancelled: false });
    expect(await owed()).toBe(990_000);
    expect(await stock()).toBe(0);

    const o = (await manager.get(`/api/sales-orders/${orderId}`).expect(200)).body;
    expect(o.allowedValue).toBe(110_000);
    expect(o.allowances).toHaveLength(1);

    expect(await trial('5213')).toMatchObject({ debit: 100_000, closingNo: 100_000 });
    expect(await trial('3331')).toMatchObject({ debit: 10_000, closingCo: 90_000 });
    expect((await trial('131'))!.closingNo).toBe(990_000);

    const rev = (await manager.get(`/api/reports/revenue-lines?from=${ORDER_DAY}&to=${DAY}`).expect(200)).body.lines as { orderCode: string; total: number; net: number; returnCode?: string }[];
    const mine = rev.filter((l) => l.orderCode === orderCode);
    expect(mine.reduce((s, l) => s + l.total, 0)).toBe(990_000);
    expect(mine.find((l) => l.returnCode === a.code)).toMatchObject({ net: -100_000, total: -110_000 });

    const log = await prisma.auditLog.findFirst({ where: { action: 'sales_order.allowance', entityId: orderId } });
    expect(log?.summary).toContain(a.code);
  });

  it('báo cáo: giảm trừ doanh thu vào kết quả kinh doanh (B02 mã 02), kết chuyển, giới hạn còn lại', async () => {
    expect(await income('- Các khoản giảm trừ')).toBe(100_000);
    expect(await income('2.')).toBe(900_000);
    const b02 = (await manager.get('/api/accounting/statements/income-statement?from=2019-01-01&to=2019-12-31').expect(200)).body.lines as { code: string; amount: number }[];
    expect(b02.find((l) => l.code === '01')!.amount).toBe(1_000_000);
    expect(b02.find((l) => l.code === '02')!.amount).toBe(100_000);
    expect(b02.find((l) => l.code === '10')!.amount).toBe(900_000);

    const preview = (await manager.get('/api/accounting/closing/preview?date=2019-06-30').expect(200)).body as { revenue: number; accounts: { code: string }[] };
    expect(preview.revenue).toBe(900_000); // doanh thu 1.000.000 trừ giảm giá 100.000
    expect(preview.accounts.map((a) => a.code)).toContain('5213');

    const limits = (await manager.post(`/api/sales-orders/${orderId}/allowances/limits`).expect(200)).body as { max: number }[];
    expect(limits[0].max).toBe(900_000);
    await create({ date: DAY, reason: 'Quá mức', lines: [{ orderLineId: lineId, taxable: 900_001 }] }).expect(400);
  });

  it('khoá sổ chặn giảm giá và huỷ; hết khoá thì huỷ phiếu đưa công nợ, doanh thu và 3331 về như cũ', async () => {
    await prisma.companyInfo.update({ where: { id: 1 }, data: { lockDate: new Date('2019-03-31') } });
    await create({ date: DAY, reason: 'Trong kỳ khoá sổ', lines: [{ orderLineId: lineId, taxable: 1000 }] }).expect(400);
    await manager.post(`/api/sales-orders/${orderId}/allowances/${allowanceId}/cancel`, { reason: 'Nhập nhầm' }).expect(400);
    await prisma.companyInfo.update({ where: { id: 1 }, data: { lockDate: null } });

    const c = (await manager.post(`/api/sales-orders/${orderId}/allowances/${allowanceId}/cancel`, { reason: 'Nhập nhầm' }).expect(200)).body;
    expect(c).toMatchObject({ isCancelled: true, cancelReason: 'Nhập nhầm' });
    await manager.post(`/api/sales-orders/${orderId}/allowances/${allowanceId}/cancel`, {}).expect(400); // đã huỷ

    expect(await owed()).toBe(1_100_000);
    expect(await trial('5213')).toMatchObject({ closingNo: 0 });
    expect(await trial('3331')).toMatchObject({ closingCo: 100_000 });
    expect((await manager.get(`/api/sales-orders/${orderId}`).expect(200)).body.allowedValue).toBe(0);
    expect(await income('2.')).toBe(1_000_000);
    expect(((await manager.post(`/api/sales-orders/${orderId}/allowances/limits`).expect(200)).body as { max: number }[])[0].max).toBe(1_000_000);
  });
});
