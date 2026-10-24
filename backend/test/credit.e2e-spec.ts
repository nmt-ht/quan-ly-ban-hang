// Pha 1 — hạn mức công nợ theo khách: server chặn đơn làm vượt hạn mức, debt.adjust được cho qua và nhật ký ghi lại.
// Needs the demo seed. Works on its own customer, product and orders; all removed in afterAll.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
const today = new Date().toISOString().slice(0, 10);

describe('Hạn mức công nợ (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let productId = '';
  let customerId = '';
  const orders: string[] = [];

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
  let manager: Client, sale: Client;

  const order = (qty: number, extra: object = {}) => ({
    customerId, tagIds: [], orderDate: today, discountAmount: 0,
    lines: [{ productId, unit: 'Lần', quantity: qty, unitPrice: 100_000 }], ...extra,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    manager = await as('quan.ly@ninhtrang.local');
    sale = await as('sale1@ninhtrang.local');
    productId = (await manager.post('/api/products', { name: 'E2E Dịch vụ hạn mức', type: 'DICH_VU', baseUnit: 'Lần', retailPrice: 100_000 }).expect(201)).body.id;
    customerId = (await manager.post('/api/customers', { name: 'E2E Khách hạn mức', type: 'LE', creditDays: 0, creditLimit: 1_000_000, tagIds: [] }).expect(201)).body.id;
  });

  afterAll(async () => {
    await prisma.salesOrder.deleteMany({ where: { id: { in: orders } } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await app.close();
  });

  it('lưu hạn mức trên khách; 0 hoặc bỏ trống = không giới hạn', async () => {
    const c = (await manager.get(`/api/customers/${customerId}`).expect(200)).body;
    expect(c.creditLimit).toBe(1_000_000);
    const free = (await manager.post('/api/customers', { name: 'E2E Khách không hạn mức', type: 'LE', creditDays: 0, tagIds: [] }).expect(201)).body;
    expect(free.creditLimit).toBe(0);
    await prisma.customer.delete({ where: { id: free.id } });
  });

  it('chặn đơn làm tổng nợ + đơn đang mở + đơn này vượt hạn mức; đúng bằng hạn mức thì được', async () => {
    const a = (await manager.post('/api/sales-orders', order(6)).expect(201)).body; // 600.000
    orders.push(a.id);
    const tooBig = (await manager.post('/api/sales-orders', order(6)).expect(400)).body;
    expect(tooBig.message).toContain('Vượt hạn mức công nợ');
    expect(tooBig.message).toContain('đơn đang mở');
    const b = (await manager.post('/api/sales-orders', order(4)).expect(201)).body; // 400.000 → đúng 1.000.000
    orders.push(b.id);
    await manager.post('/api/sales-orders', order(1)).expect(400);
  });

  it('sửa đơn không tính chính nó hai lần', async () => {
    const [a, b] = orders;
    const current = (await manager.get(`/api/sales-orders/${a}`).expect(200)).body;
    await manager.put(`/api/sales-orders/${a}`, order(6, { updatedAt: current.updatedAt })).expect(200); // vẫn 600k
    const again = (await manager.get(`/api/sales-orders/${a}`).expect(200)).body;
    await manager.put(`/api/sales-orders/${a}`, order(7, { updatedAt: again.updatedAt })).expect(400); // 700k + 400k của đơn kia
    expect(b).toBeTruthy();
  });

  it('chỉ chức vụ có debt.adjust được lưu tiếp khi vượt; nhật ký ghi lại', async () => {
    await sale.post('/api/sales-orders', order(1, { overrideCreditLimit: true })).expect(403);
    const o = (await manager.post('/api/sales-orders', order(1, { overrideCreditLimit: true })).expect(201)).body;
    orders.push(o.id);
    const log = await prisma.auditLog.findFirst({ where: { action: 'sales_order.create', entityId: o.id } });
    expect(log?.summary).toContain('vượt hạn mức công nợ');
  });

  it('khách không đặt hạn mức không bị chặn', async () => {
    const free = (await manager.post('/api/customers', { name: 'E2E Khách tự do', type: 'LE', creditDays: 0, tagIds: [] }).expect(201)).body;
    const o = (await manager.post('/api/sales-orders', order(50, { customerId: free.id })).expect(201)).body;
    await prisma.salesOrder.delete({ where: { id: o.id } });
    await prisma.customer.delete({ where: { id: free.id } });
  });
});
