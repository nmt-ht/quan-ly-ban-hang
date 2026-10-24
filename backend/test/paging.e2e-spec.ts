// Pha 1.1 — danh sách đơn bán theo trang trên máy chủ, nạp đơn theo kỳ, thống kê khách và số lần dùng thẻ trên toàn bộ
// lịch sử. Needs the demo seed. Creates one customer with three orders (one old and closed); removed in afterAll.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
const today = new Date().toISOString().slice(0, 10);

describe('Phân trang đơn bán (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let productId = '';
  let customerId = '';
  const orderIds: string[] = [];
  let oldOrderId = '';

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
  let manager: Client;

  const order = (qty: number, price: number) => ({
    customerId, tagIds: [], orderDate: today, discountAmount: 0, lines: [{ productId, unit: 'Lần', quantity: qty, unitPrice: price }],
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    manager = await as('quan.ly@ninhtrang.local');
    productId = (await manager.post('/api/products', { name: 'E2E Dịch vụ phân trang', type: 'DICH_VU', baseUnit: 'Lần', retailPrice: 100_000 }).expect(201)).body.id;
    customerId = (await manager.post('/api/customers', { name: 'E2E Khách Phân Trang Đặc Biệt', type: 'LE', creditDays: 0, tagIds: [] }).expect(201)).body.id;
    for (const [q, p] of [[1, 100_000], [3, 100_000], [2, 100_000]]) orderIds.push((await manager.post('/api/sales-orders', order(q, p)).expect(201)).body.id);
    // The first one: delivered in full long ago (closed, outside the 90-day window).
    oldOrderId = orderIds[0];
    await manager.post(`/api/sales-orders/${oldOrderId}/deliver`, { date: today, items: [{ lineIndex: 0, quantity: 1 }] }).expect(200);
    await prisma.salesOrder.update({ where: { id: oldOrderId }, data: { orderDate: new Date('2025-01-15') } });
  });

  afterAll(async () => {
    await prisma.salesOrder.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await app.close();
  });

  it('một trang: lọc theo khách, sắp xếp theo giá trị, tổng của mọi đơn khớp', async () => {
    const res = (await manager.get(`/api/sales-orders/page?customerId=${customerId}&sort=totalOrder&dir=desc&pageSize=2`).expect(200)).body;
    expect(res.total).toBe(3);
    expect(res.rows).toHaveLength(2);
    expect(res.rows.map((o: { totalOrder: number }) => o.totalOrder)).toEqual([300_000, 200_000]);
    expect(res.totals).toMatchObject({ value: 600_000, received: 100_000 });
    expect(res.statusCounts.HOAN_THANH).toBe(1);
    const second = (await manager.get(`/api/sales-orders/page?customerId=${customerId}&sort=totalOrder&dir=desc&pageSize=2&page=2`).expect(200)).body;
    expect(second.rows.map((o: { totalOrder: number }) => o.totalOrder)).toEqual([100_000]);
  });

  it('tìm không dấu, lọc trạng thái và khoảng giá trị', async () => {
    const found = (await manager.get('/api/sales-orders/page?q=khach phan trang dac biet').expect(200)).body;
    expect(found.total).toBe(3);
    const done = (await manager.get(`/api/sales-orders/page?customerId=${customerId}&status=HOAN_THANH`).expect(200)).body;
    expect(done.rows.map((o: { id: string }) => o.id)).toEqual([oldOrderId]);
    const mid = (await manager.get(`/api/sales-orders/page?customerId=${customerId}&min=150000&max=250000`).expect(200)).body;
    expect(mid.rows.map((o: { totalOrder: number }) => o.totalOrder)).toEqual([200_000]);
    await manager.get('/api/sales-orders/page?sort=khong-co').expect(400);
  });

  it('nạp theo kỳ: đơn cũ đã xong không có trong ?recentDays=90 nhưng vẫn mở được theo id', async () => {
    const recent = (await manager.get('/api/sales-orders?recentDays=90').expect(200)).body as { id: string }[];
    expect(recent.some((o) => o.id === oldOrderId)).toBe(false);
    expect(recent.some((o) => o.id === orderIds[1])).toBe(true);
    await manager.get(`/api/sales-orders/${oldOrderId}`).expect(200);
  });

  it('thống kê khách và số lần dùng thẻ tính trên toàn bộ lịch sử', async () => {
    const stats = (await manager.get('/api/sales-orders/customer-stats').expect(200)).body;
    expect(stats[customerId]).toMatchObject({ orderCount: 3, receivedOrders: 1, revenue: 100_000, openOrders: 2 });
    const usage = (await manager.get('/api/tags/usage').expect(200)).body;
    expect(typeof usage).toBe('object');
  });
});
