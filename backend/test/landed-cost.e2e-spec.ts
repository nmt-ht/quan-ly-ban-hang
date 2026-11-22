// Chi phí mua hàng phân bổ vào giá nhập: hoá đơn mua hàng có dòng GIA_NHAP gắn đơn nhập, chia theo giá trị hoặc số lượng, cộng vào giá
// bình quân phần hàng còn tồn, phần hàng đã bán vào 632; huỷ hoá đơn hoàn lại. Chạy trên database riêng nt_qa_landed (tạo lại mỗi lần).
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

const MAIN_URL = process.env.DATABASE_URL!;
const QA_DB = 'nt_qa_landed';
const QA_URL = withDatabase(MAIN_URL, QA_DB);
const PASSWORD = 'QaMatKhau2026';
const WH = 'wh-vattu';

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

describe('Chi phí mua hàng phân bổ vào giá nhập (e2e)', () => {
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
  let goodsSupplier = '';
  let freightSupplier = '';
  let productA = '';
  let productB = '';
  let orderId = '';
  let emptyOrderId = '';

  const avg = async (id: string) => (await prisma.product.findUniqueOrThrow({ where: { id } })).avgCost.toNumber();
  const trial = async (code: string) => {
    const rows = (await manager.get('/api/accounting/trial-balance?period=2019').expect(200)).body.rows as { code: string; debit: number; credit: number; closingNo: number; closingCo: number }[];
    return rows.find((r) => r.code === code) ?? { debit: 0, credit: 0, closingNo: 0, closingCo: 0 };
  };
  const bill = (extra: object = {}, lines: object[] = [{ accountCode: 'GIA_NHAP', description: 'Cước vận chuyển', amount: 300_000, vatRate: 10 }]) =>
    manager.post('/api/purchase-bills', { supplierId: freightSupplier, date: '2019-03-01', description: 'Cước vận chuyển lô hàng', purchaseOrderId: orderId, lines, ...extra });

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
    goodsSupplier = (await manager.post('/api/suppliers', { name: 'E2E NCC hàng', taxCode: '0312345678', creditDays: 0 }).expect(201)).body.id;
    freightSupplier = (await manager.post('/api/suppliers', { name: 'E2E NCC vận tải', taxCode: '0312345679', creditDays: 0 }).expect(201)).body.id;
    productA = (await manager.post('/api/products', { name: 'E2E Hàng A', type: 'VAT_TU', baseUnit: 'Cái' }).expect(201)).body.id;
    productB = (await manager.post('/api/products', { name: 'E2E Hàng B', type: 'VAT_TU', baseUnit: 'Cái' }).expect(201)).body.id;

    // Đơn nhập: A 10 × 100.000, B 5 × 200.000 (giá trị hàng bằng nhau: 1.000.000), nhận đủ ngày 01/02/2019.
    const o = (await manager.post('/api/purchase-orders', {
      supplierId: goodsSupplier, date: '2019-02-01',
      lines: [
        { productId: productA, quantity: 10, unitPrice: 100_000, vatRate: 10, warehouseId: WH },
        { productId: productB, quantity: 5, unitPrice: 200_000, vatRate: 10, warehouseId: WH },
      ],
    }).expect(201)).body;
    orderId = o.id;
    await manager.post(`/api/purchase-orders/${orderId}/send`).expect(200);
    await manager.post(`/api/purchase-orders/${orderId}/receive`, {
      date: '2019-02-01', items: [{ lineIndex: 0, quantity: 10, warehouseId: WH }, { lineIndex: 1, quantity: 5, warehouseId: WH }],
    }).expect(200);

    // Một đơn nữa chưa nhận gì.
    emptyOrderId = (await manager.post('/api/purchase-orders', {
      supplierId: goodsSupplier, date: '2019-02-05', lines: [{ productId: productA, quantity: 3, unitPrice: 100_000, vatRate: 10, warehouseId: WH }],
    }).expect(201)).body.id;
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    process.env.DATABASE_URL = savedUrl;
  });

  it('nhận hàng xong: giá bình quân là giá nhập', async () => {
    expect(await avg(productA)).toBe(100_000);
    expect(await avg(productB)).toBe(200_000);
  });

  it('kiểm tra đầu vào: quyền, thiếu đơn nhập, đơn chưa nhận hàng, gắn đơn mà không có dòng phân bổ', async () => {
    await sale.post('/api/purchase-bills', { supplierId: freightSupplier, date: '2019-03-01', purchaseOrderId: orderId, lines: [{ accountCode: 'GIA_NHAP', description: 'x', amount: 1000, vatRate: 0 }] }).expect(403);
    await bill({ purchaseOrderId: undefined }).expect(400);
    await bill({ purchaseOrderId: 'khong-co' }).expect(400);
    const empty = await bill({ purchaseOrderId: emptyOrderId }).expect(400);
    expect(empty.body.message).toContain('chưa nhận hàng');
    await bill({}, [{ accountCode: '642', description: 'Điện', amount: 1000, vatRate: 0 }]).expect(400); // gắn đơn nhưng không có dòng GIA_NHAP
    await bill({ allocationBasis: 'THEO_CAN_NANG' }).expect(400);
    expect(await avg(productA)).toBe(100_000);
  });

  it('phân bổ theo giá trị: 300.000 chia đều 150.000, cộng vào giá bình quân, Nợ 156 + Nợ 133 / Có 331 của nhà vận tải', async () => {
    const before156 = (await trial('156')).closingNo;
    const b = (await bill({ allocationBasis: 'GIA_TRI' }).expect(201)).body;
    expect(b).toMatchObject({ total: 330_000, vat: 30_000, purchaseOrderId: orderId, allocationBasis: 'GIA_TRI' });
    expect(b.allocations.map((a: { productId: string; amount: number; toStock: number; toCogs: number }) => [a.productId, a.amount, a.toStock, a.toCogs]).sort((a: unknown[], b: unknown[]) => String(a).localeCompare(String(b))))
      .toEqual([[productA, 150_000, 150_000, 0], [productB, 150_000, 150_000, 0]].sort((a, b) => String(a).localeCompare(String(b))));

    expect(await avg(productA)).toBe(115_000); // 100.000 + 150.000 / 10
    expect(await avg(productB)).toBe(230_000); // 200.000 + 150.000 / 5
    expect((await trial('156')).closingNo - before156).toBe(300_000);

    const payables = (await manager.get('/api/payables').expect(200)).body as { partnerId: string; balance: number }[];
    expect(payables.find((p) => p.partnerId === freightSupplier)?.balance).toBe(330_000);
  });

  it('phân bổ theo số lượng: 300.000 chia 10 : 5 thành 200.000 và 100.000', async () => {
    const b = (await bill({ allocationBasis: 'SO_LUONG' }).expect(201)).body;
    const by = Object.fromEntries(b.allocations.map((a: { productId: string; amount: number }) => [a.productId, a.amount]));
    expect(by).toEqual({ [productA]: 200_000, [productB]: 100_000 });
    expect(await avg(productA)).toBe(135_000); // 115.000 + 200.000 / 10
    expect(await avg(productB)).toBe(250_000); // 230.000 + 100.000 / 5
  });

  let lastBill = { id: '', code: '' };
  it('hàng đã bán bớt: phần chi phí của hàng đã bán vào 632, phần còn tồn vào 156 và giá bình quân', async () => {
    // Bán 4 cái A: còn 6 / 10.
    const customerId = (await manager.post('/api/customers', { name: 'E2E Khách mua A', type: 'LE', creditDays: 0, tagIds: [] }).expect(201)).body.id;
    const so = (await manager.post('/api/sales-orders', {
      customerId, tagIds: [], orderDate: '2019-03-05', discountAmount: 0,
      lines: [{ productId: productA, unit: 'Cái', quantity: 4, unitPrice: 300_000, vatRate: 10, warehouseId: WH }],
    }).expect(201)).body;
    await manager.post(`/api/sales-orders/${so.id}/deliver`, { date: '2019-03-05', items: [{ lineIndex: 0, quantity: 4, warehouseId: WH }] }).expect(200);
    expect(await avg(productA)).toBe(135_000);

    const before156 = (await trial('156')).closingNo;
    const before632 = (await trial('632')).closingNo;
    const b = (await bill({ date: '2019-03-10', allocationBasis: 'GIA_TRI' }, [{ accountCode: 'GIA_NHAP', description: 'Bốc xếp', amount: 100_000, vatRate: 0 }]).expect(201)).body;
    lastBill = { id: b.id, code: b.code };
    const a = b.allocations.find((x: { productId: string }) => x.productId === productA);
    const bb = b.allocations.find((x: { productId: string }) => x.productId === productB);
    expect(a).toMatchObject({ amount: 50_000, toStock: 30_000, toCogs: 20_000 }); // còn 6 / 10 cái A
    expect(bb).toMatchObject({ amount: 50_000, toStock: 50_000, toCogs: 0 });
    expect(await avg(productA)).toBe(140_000); // 135.000 + 30.000 / 6
    expect(await avg(productB)).toBe(260_000); // 250.000 + 50.000 / 5
    expect((await trial('156')).closingNo - before156).toBe(80_000);
    expect((await trial('632')).closingNo - before632).toBe(20_000);
  });

  it('huỷ hoá đơn: giá bình quân và sổ cái về như cũ; không huỷ hai lần', async () => {
    const before156 = (await trial('156')).closingNo;
    await manager.post(`/api/purchase-bills/${lastBill.id}/cancel`, { reason: 'Nhập nhầm' }).expect(200);
    expect(await avg(productA)).toBe(135_000);
    expect(await avg(productB)).toBe(250_000);
    expect(before156 - (await trial('156')).closingNo).toBe(80_000);
    await manager.post(`/api/purchase-bills/${lastBill.id}/cancel`, {}).expect(400);
  });

  it('hoá đơn hỗn hợp: dòng chi phí thường vào TK chi phí, dòng GIA_NHAP vào giá nhập, thuế đầu vào gộp', async () => {
    const before642 = (await trial('642')).closingNo;
    const before133 = (await trial('133')).closingNo;
    const b = (await bill({ date: '2019-03-12', allocationBasis: 'GIA_TRI' }, [
      { accountCode: 'GIA_NHAP', description: 'Cước', amount: 100_000, vatRate: 10 },
      { accountCode: '642', description: 'Phí giao dịch', amount: 50_000, vatRate: 10 },
    ]).expect(201)).body;
    expect(b).toMatchObject({ taxable: 150_000, vat: 15_000, total: 165_000 });
    expect((await trial('642')).closingNo - before642).toBe(50_000);
    expect((await trial('133')).closingNo - before133).toBe(15_000);
  });
});
