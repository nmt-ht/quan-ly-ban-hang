// Pha 1.5 — trả hàng bán: hàng khách đã nhận nhập lại kho, giá trị trả giảm công nợ và doanh thu vào ngày trả;
// huỷ phiếu trả thì mọi thứ về như cũ. Needs the demo seed. Works on its own product, customer and order; removed in afterAll.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
const today = new Date().toISOString().slice(0, 10);
const WH = 'wh-ninhtrang';

describe('Trả hàng bán (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let productId = '';
  let customerId = '';
  let orderId = '';
  let orderCode = '';
  let lineId = '';

  const api = () => request(app.getHttpServer());
  async function as(email: string) {
    const token = (await api().post('/api/auth/login').send({ email, password: DEMO_PASSWORD }).expect(200)).body.accessToken;
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    return {
      get: (url: string) => auth(api().get(url)),
      post: (url: string, body: object = {}) => auth(api().post(url)).send(body),
    };
  }
  type Client = Awaited<ReturnType<typeof as>>;
  let manager: Client, sale: Client;

  const stock = async () => Number((await prisma.stockLevel.findUnique({ where: { productId_warehouseId: { productId, warehouseId: WH } } }))?.quantity ?? 0);
  const owed = async () => {
    const rows = (await manager.get('/api/receivables').expect(200)).body as { partnerId: string; balance: number }[];
    return rows.find((r) => r.partnerId === customerId)?.balance ?? 0;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    manager = await as('quan.ly@ninhtrang.local');
    sale = await as('sale1@ninhtrang.local');
    productId = (await manager.post('/api/products', { name: 'E2E Hàng trả lại', type: 'VAT_TU', baseUnit: 'Cái', retailPrice: 100_000 }).expect(201)).body.id;
    customerId = (await manager.post('/api/customers', { name: 'E2E Khách trả hàng', type: 'LE', creditDays: 0, tagIds: [] }).expect(201)).body.id;
    await manager.post('/api/warehouse-vouchers', { type: 'NHAP', date: today, warehouseId: WH, lines: [{ productId, quantity: 10 }] }).expect(201);
    const o = (await manager.post('/api/sales-orders', {
      customerId, tagIds: [], orderDate: today, discountAmount: 0,
      lines: [{ productId, unit: 'Cái', quantity: 10, unitPrice: 100_000, vatRate: 10, warehouseId: WH }],
    }).expect(201)).body;
    orderId = o.id;
    orderCode = o.code;
    lineId = o.lines[0].id;
    await manager.post(`/api/sales-orders/${orderId}/deliver`, { date: today, items: [{ lineIndex: 0, quantity: 10, warehouseId: WH }] }).expect(200);
  });

  afterAll(async () => {
    await prisma.salesReturn.deleteMany({ where: { orderId } });
    await prisma.warehouseVoucher.deleteMany({ where: { lines: { some: { productId } } } });
    await prisma.salesOrder.deleteMany({ where: { id: orderId } });
    await prisma.stockLevel.deleteMany({ where: { productId } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await app.close();
  });

  it('giao đủ: công nợ 1.100.000 (10 × 100.000 + VAT 10%), kho còn 0', async () => {
    expect(await owed()).toBe(1_100_000);
    expect(await stock()).toBe(0);
  });

  it('giá vốn đã chốt của đơn: có cho người xem giá vốn, chặn với Sale', async () => {
    const costs = (await manager.get(`/api/sales-orders/${orderId}/issued-costs`).expect(200)).body;
    expect(Object.keys(costs)).toEqual([productId]);
    expect(typeof costs[productId]).toBe('number');
    await sale.get(`/api/sales-orders/${orderId}/issued-costs`).expect(403);
  });

  it('chức vụ không có quyền Nhận hàng trả lại bị chặn', async () => {
    await sale.post(`/api/sales-orders/${orderId}/returns`, { date: today, warehouseId: WH, reason: 'Lỗi', lines: [{ orderLineId: lineId, quantity: 1 }] }).expect(403);
  });

  let returnId = '';
  it('trả 4 cái: nhập lại kho 4, công nợ giảm 440.000, doanh thu có dòng âm vào ngày trả, nhật ký ghi lại', async () => {
    const r = (await manager.post(`/api/sales-orders/${orderId}/returns`, {
      date: today, warehouseId: WH, reason: 'Khách đổi ý', lines: [{ orderLineId: lineId, quantity: 4 }],
    }).expect(201)).body;
    returnId = r.id;
    expect(r.code).toMatch(/^TH\d{7}$/);
    expect(r.amount).toBe(440_000);
    expect(r.voucherCode).toMatch(/^PNK/);
    expect(await stock()).toBe(4);
    expect(await owed()).toBe(660_000);

    const o = (await manager.get(`/api/sales-orders/${orderId}`).expect(200)).body;
    expect(o.returnedValue).toBe(440_000);
    expect(o.returns).toHaveLength(1);

    const rev = (await manager.get(`/api/reports/revenue-lines?from=${today}&to=${today}`).expect(200)).body.lines as { orderCode: string; total: number; returnCode?: string }[];
    const mine = rev.filter((l) => l.orderCode === orderCode);
    expect(mine.reduce((s, l) => s + l.total, 0)).toBe(660_000);
    expect(mine.find((l) => l.returnCode === r.code)?.total).toBe(-440_000);

    const log = await prisma.auditLog.findFirst({ where: { action: 'sales_order.return', entityId: orderId } });
    expect(log?.related).toEqual(expect.arrayContaining([r.code, r.voucherCode]));
  });

  it('không trả quá số khách đã nhận (còn 6)', async () => {
    await manager.post(`/api/sales-orders/${orderId}/returns`, {
      date: today, warehouseId: WH, reason: 'Thử', lines: [{ orderLineId: lineId, quantity: 7 }],
    }).expect(400);
  });

  it('huỷ phiếu trả: kho và công nợ về như trước khi trả', async () => {
    const r = (await manager.post(`/api/sales-orders/${orderId}/returns/${returnId}/cancel`, { reason: 'Nhập nhầm' }).expect(200)).body;
    expect(r.isCancelled).toBe(true);
    expect(await stock()).toBe(0);
    expect(await owed()).toBe(1_100_000);
    await manager.post(`/api/sales-orders/${orderId}/returns/${returnId}/cancel`, {}).expect(400);
  });
});
