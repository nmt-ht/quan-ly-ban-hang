// Đợt 5 — chuyến giao hàng and the order.view_all filter, end to end against the seeded local DB.
// Works on its own test products, orders and chuyến; everything created here is removed in afterAll.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
const today = new Date().toISOString().slice(0, 10);

describe('Chuyến giao hàng (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const products: string[] = [];
  const orders: string[] = [];
  const trips: string[] = [];
  let cashBefore = 0;

  const api = () => request(app.getHttpServer());
  async function as(email: string) {
    const token = (await api().post('/api/auth/login').send({ email, password: DEMO_PASSWORD }).expect(200)).body.accessToken;
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    return {
      get: (url: string) => auth(api().get(url)),
      post: (url: string, body: object = {}) => auth(api().post(url)).send(body),
      put: (url: string, body: object) => auth(api().put(url)).send(body),
      delete: (url: string) => auth(api().delete(url)),
    };
  }
  type Client = Awaited<ReturnType<typeof as>>;
  let manager: Client, sale: Client, storekeeper: Client, driver: Client;
  let item = '', service = '';

  async function stock(productId: string, warehouseId: string): Promise<number> {
    const rows = (await manager.get('/api/stock-levels').expect(200)).body as { productId: string; warehouseId: string; quantity: number }[];
    return rows.find((s) => s.productId === productId && s.warehouseId === warehouseId)?.quantity ?? 0;
  }
  async function newOrder(client: Client, body: object) {
    const o = (await client.post('/api/sales-orders', { customerId: 'kh-01', tagIds: [], orderDate: today, discountAmount: 0, ...body }).expect(201)).body;
    orders.push(o.id);
    return o;
  }
  async function newTrip(body: object = {}) {
    const res = (await manager.post('/api/delivery-trips', { date: today, ...body }).expect(201)).body;
    trips.push(res.id);
    return res;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    manager = await as('quan.ly@ninhtrang.local');
    sale = await as('sale1@ninhtrang.local');
    storekeeper = await as('thu.kho@ninhtrang.local');
    driver = await as('tai.xe@ninhtrang.local');
    for (const p of [
      { name: 'E2E Giao hàng', type: 'VAT_TU', baseUnit: 'Cái', retailPrice: 50000, defaultWarehouseId: 'wh-ninhtrang' },
      { name: 'E2E Công lắp', type: 'DICH_VU', baseUnit: 'Lần', retailPrice: 20000 },
    ]) products.push((await manager.post('/api/products', p).expect(201)).body.id);
    [item, service] = products;
    await manager.post('/api/warehouse-vouchers', { type: 'NHAP', date: today, warehouseId: 'wh-ninhtrang', lines: [{ productId: item, quantity: 10 }] }).expect(201);
    cashBefore = (await manager.get('/api/cash-accounts').expect(200)).body.find((a: any) => a.id === 'acc-cash').balance;
  });

  afterAll(async () => {
    const codes = (await prisma.salesOrder.findMany({ where: { id: { in: orders } } })).map((o) => o.code);
    await prisma.cashVoucher.deleteMany({ where: { description: { in: codes.map((c) => `Thu tiền ngay đơn ${c}`) } } });
    await prisma.warehouseVoucher.deleteMany({ where: { lines: { some: { productId: { in: products } } } } });
    await prisma.deliveryTrip.deleteMany({ where: { id: { in: trips } } });
    await prisma.salesOrder.deleteMany({ where: { id: { in: orders } } });
    await prisma.stockLevel.deleteMany({ where: { productId: { in: products } } });
    await prisma.product.deleteMany({ where: { id: { in: products } } });
    await app.close();
  });

  it('runs a chuyến: gom đơn → xuất kho → chốt giao (bỏ chốt, chốt lại) → xe về kho nhập trả → hoàn tất', async () => {
    const o1 = await newOrder(sale, {
      salesRep: 'sale1@ninhtrang.local', payNowAccountId: 'acc-cash',
      lines: [{ productId: item, unit: 'Cái', quantity: 5, unitPrice: 50000 }, { productId: service, unit: 'Lần', quantity: 1, unitPrice: 20000 }],
    });
    const o2 = await newOrder(manager, { salesRep: 'quan.ly@ninhtrang.local', lines: [{ productId: item, unit: 'Cái', quantity: 2, unitPrice: 50000 }] });

    await sale.post('/api/delivery-trips', { date: today }).expect(403);
    const t = await newTrip({ vehicleId: 'xe-1', driverName: 'Đặng Văn Tài' });
    expect(t).toMatchObject({ code: expect.stringMatching(/^CH\d{7}$/), status: 'GOM_DON', plateNumber: '51C-123.45', orderIds: [] });

    let res = (await manager.post(`/api/delivery-trips/${t.id}/orders`, { orderIds: [o1.id, o2.id] }).expect(200)).body;
    expect(res.trip.orderIds).toEqual([o1.id, o2.id]);
    expect(res.trip.totalValue).toBe(370_000); // còn phải giao: 250 000 + 20 000 + 100 000
    const other = await newTrip();
    await manager.post(`/api/delivery-trips/${other.id}/orders`, { orderIds: [o1.id] }).expect(400); // already on a running chuyến
    await manager.delete(`/api/delivery-trips/${t.id}/orders/${o2.id}`).expect(200);
    await manager.post(`/api/delivery-trips/${t.id}/orders`, { orderIds: [o2.id] }).expect(200);
    await manager.put(`/api/delivery-trips/${t.id}/costs`, { fuel: 100000, toll: 20000, other: 0, note: 'E2E' }).expect(200);

    await driver.post(`/api/delivery-trips/${t.id}/orders/${o1.id}/confirm`, { lines: [] }).expect(400); // not shipped yet
    res = (await storekeeper.post(`/api/delivery-trips/${t.id}/ship`).expect(200)).body;
    expect(res.trip).toMatchObject({ status: 'DA_XUAT_KHO', costs: { fuel: 100000, toll: 20000, other: 0, note: 'E2E' } });
    expect(res.trip.loads).toEqual(expect.arrayContaining([
      expect.objectContaining({ orderId: o1.id, lineIndex: 0, quantity: 5, warehouseId: 'wh-ninhtrang' }),
      expect.objectContaining({ orderId: o1.id, lineIndex: 1, quantity: 1 }),
      expect.objectContaining({ orderId: o2.id, lineIndex: 0, quantity: 2, warehouseId: 'wh-ninhtrang' }),
    ]));
    expect(res.orders.map((o: any) => o.status)).toEqual(['DANG_GIAO', 'DANG_GIAO']);
    expect(await stock(item, 'wh-ninhtrang')).toBe(3);
    await manager.post(`/api/delivery-trips/${t.id}/cancel`).expect(400);
    await storekeeper.post(`/api/delivery-trips/${t.id}/return`).expect(400); // orders not confirmed yet

    res = (await driver.post(`/api/delivery-trips/${t.id}/orders/${o1.id}/confirm`, { lines: [{ lineIndex: 0, received: 3 }, { lineIndex: 1, received: 1 }] }).expect(200)).body;
    expect(res.orders.find((o: any) => o.id === o1.id)).toMatchObject({ status: 'GIAO_MOT_PHAN', receivedValue: 170_000, deliveredDate: today });
    expect(res.receipts).toEqual([expect.objectContaining({ kind: 'THU', amount: 170_000, allocations: [{ ref: o1.code, amount: 170_000 }] })]);
    await driver.post(`/api/delivery-trips/${t.id}/orders/${o1.id}/confirm`, { lines: [] }).expect(400); // once

    res = (await driver.post(`/api/delivery-trips/${t.id}/orders/${o1.id}/unconfirm`).expect(200)).body;
    expect(res.orders.find((o: any) => o.id === o1.id)).toMatchObject({ status: 'DANG_GIAO', receivedValue: 0 });
    expect(res.cancelledReceipts).toHaveLength(1);
    await driver.post(`/api/delivery-trips/${t.id}/orders/${o1.id}/confirm`, { lines: [{ lineIndex: 0, received: 3 }, { lineIndex: 1, received: 1 }] }).expect(200);
    res = (await driver.post(`/api/delivery-trips/${t.id}/orders/${o2.id}/confirm`, { lines: [{ lineIndex: 0, received: 0 }], note: 'Khách đi vắng' }).expect(200)).body;
    expect(res.orders.find((o: any) => o.id === o2.id).status).toBe('TRA_TOAN_BO');
    expect(res.trip).toMatchObject({ confirmedCount: 2, receivedValue: 170_000 });
    const cash = (await manager.get('/api/cash-accounts').expect(200)).body.find((a: any) => a.id === 'acc-cash').balance;
    expect(cash).toBe(cashBefore + 170_000); // one live receipt after the bỏ chốt / chốt lại

    res = (await storekeeper.post(`/api/delivery-trips/${t.id}/return`).expect(200)).body;
    expect(res.trip.status).toBe('XE_VE_KHO');
    expect(await stock(item, 'wh-ninhtrang')).toBe(7); // 2 + 2 back
    const back = (await manager.get('/api/warehouse-vouchers').expect(200)).body.find((v: any) => v.deliveryTripId === t.id && v.type === 'NHAP');
    expect(back.reason).toContain(`chuyến ${t.code}`);
    expect((await manager.post(`/api/delivery-trips/${t.id}/complete`).expect(200)).body.trip.status).toBe('HOAN_TAT');

    // A cancelled chuyến lets its orders go on another one.
    const o3 = await newOrder(sale, { salesRep: 'sale1@ninhtrang.local', lines: [{ productId: item, unit: 'Cái', quantity: 1, unitPrice: 50000 }] });
    await manager.post(`/api/delivery-trips/${other.id}/orders`, { orderIds: [o3.id] }).expect(200);
    expect((await manager.post(`/api/delivery-trips/${other.id}/cancel`, { reason: 'E2E' }).expect(200)).body.trip).toMatchObject({ status: 'HUY', orderIds: [] });
    const again = await newTrip();
    await manager.post(`/api/delivery-trips/${again.id}/orders`, { orderIds: [o3.id] }).expect(200);
  });

  it('order.view_all: a seller sees only their own orders; Thủ kho and Quản lý see all', async () => {
    const mine = await newOrder(sale, { salesRep: 'sale1@ninhtrang.local', lines: [{ productId: item, unit: 'Cái', quantity: 1, unitPrice: 50000 }] });
    const theirs = await newOrder(manager, { salesRep: 'quan.ly@ninhtrang.local', lines: [{ productId: item, unit: 'Cái', quantity: 1, unitPrice: 50000 }] });
    const seen = (await sale.get('/api/sales-orders').expect(200)).body.map((o: any) => o.id);
    expect(seen).toContain(mine.id);
    expect(seen).not.toContain(theirs.id);
    await sale.get(`/api/sales-orders/${theirs.id}`).expect(404);
    for (const c of [storekeeper, manager]) {
      expect((await c.get('/api/sales-orders').expect(200)).body.map((o: any) => o.id)).toEqual(expect.arrayContaining([mine.id, theirs.id]));
    }
  });
});
