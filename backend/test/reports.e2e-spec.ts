// Đợt 7 — tổng quan and báo cáo computed on the server, end to end against the seeded local DB.
// Works on its own customer, product and order; everything created here is removed in afterAll.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { isoDay } from '../src/modules/reports/report.rules.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
const today = isoDay();

describe('Tổng quan & báo cáo (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customerId = '';
  let productId = '';
  const orders: string[] = [];

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
  let manager: Client, sale: Client, storekeeper: Client;

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
    customerId = (await manager.post('/api/customers', { name: 'E2E Khách báo cáo', type: 'LE', creditDays: 0, tagIds: [] }).expect(201)).body.id;
    productId = (await manager.post('/api/products', { name: 'E2E Hàng báo cáo', type: 'VAT_TU', baseUnit: 'Cái', retailPrice: 100000 }).expect(201)).body.id;
    await manager.post('/api/warehouse-vouchers', { type: 'NHAP', date: today, warehouseId: 'wh-ninhtrang', lines: [{ productId, quantity: 10 }] }).expect(201);
  });

  afterAll(async () => {
    await prisma.cashVoucher.deleteMany({ where: { customerId } });
    await prisma.warehouseVoucher.deleteMany({ where: { lines: { some: { productId } } } });
    await prisma.salesOrder.deleteMany({ where: { id: { in: orders } } });
    await prisma.stockLevel.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await app.close();
  });

  it('a delivered order shows in doanh thu, lãi gộp, tồn kho and tổng quan — tied to công nợ phải thu', async () => {
    const before = (await manager.get(`/api/dashboard?from=${today}`).expect(200)).body;
    const o = (await manager.post('/api/sales-orders', {
      customerId, tagIds: [], orderDate: today, discountAmount: 0, salesRep: 'quan.ly@ninhtrang.local',
      lines: [{ productId, unit: 'Cái', quantity: 3, unitPrice: 100000, warehouseId: 'wh-ninhtrang' }],
    }).expect(201)).body;
    orders.push(o.id);
    await storekeeper.post(`/api/sales-orders/${o.id}/deliver`, { date: today, items: [{ lineIndex: 0, quantity: 3, warehouseId: 'wh-ninhtrang' }] }).expect(200);
    const owed = (await manager.get('/api/receivables').expect(200)).body.find((r: any) => r.partnerId === customerId).balance;

    const lines = (await manager.get(`/api/reports/revenue-lines?from=${today}`).expect(200)).body.lines.filter((l: any) => l.orderId === o.id);
    expect(lines).toEqual([expect.objectContaining({ productId, baseQty: 3, gross: 300_000, date: today })]);
    expect(lines[0].total).toBe(owed); // doanh thu = phải thu, to the đồng

    const profit = (await manager.get(`/api/reports/loi-nhuan?from=${today}&to=${today}&group=customer`).expect(200)).body;
    expect(profit.rows.find((r: any) => r.id === customerId)).toMatchObject({ net: lines[0].net, cost: 0, profit: lines[0].net, zero: 1, link: ['/khach-hang', customerId] });
    expect(profit.columns.find((c: any) => c.key === 'name')).toMatchObject({ label: 'Khách hàng', link: 'link' });

    const stock = (await manager.get('/api/reports/ton-kho?group=nonsense').expect(200)).body; // unknown cách nhóm → the default
    expect(stock.rows.find((r: any) => r.id === productId)).toMatchObject({ qty: 7, unit: 'Cái' });

    const after = (await manager.get(`/api/dashboard?from=${today}`).expect(200)).body;
    expect(after.range).toEqual({ from: today, to: today });
    expect(after.kpis.revenue).toBe(before.kpis.revenue + owed);
    expect(after.kpis.orders).toBe(before.kpis.orders + 1);
    expect(after.debt.receivableTotal).toBe(before.debt.receivableTotal + owed);
    expect(after.topProducts.some((t: any) => t.id === productId)).toBe(true);
  });

  it('shows each role only what its report rights allow', async () => {
    await sale.get('/api/reports/chiet-khau').expect(200);
    await sale.get('/api/reports/loi-nhuan').expect(403); // Sale may not see giá vốn
    await sale.get('/api/reports/so-quy').expect(403);
    const d = (await sale.get('/api/dashboard').expect(200)).body;
    expect(d.kpis.profit).toBeNull();
    expect(d.leaks.belowCostLines).toBeNull();
    expect(d.debt).toBeNull(); // no debt.view
    await storekeeper.get('/api/dashboard').expect(403);
    await manager.get('/api/reports/khong-co').expect(404);
    await manager.get('/api/reports/thu-chi?from=01/10/2026').expect(400);
  });
});
