// Pha 1.4 — báo giá: lập / sửa / huỷ, rồi Lập đơn (POST /sales-orders có quotationId) chốt báo giá và nối hai chứng từ.
// Needs the demo seed. Works on its own product and customers; removed in afterAll.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { vnDay } from '../src/common/text.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
const today = vnDay();

describe('Báo giá (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let productId = '';
  let customerId = '';
  let otherCustomerId = '';
  const orderIds: string[] = [];

  const api = () => request(app.getHttpServer());
  async function as(email: string) {
    const token = (await api().post('/api/auth/login').send({ email, password: DEMO_PASSWORD }).expect(200)).body.accessToken;
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    return {
      get: (url: string) => auth(api().get(url)),
      post: (url: string, body: object = {}) => auth(api().post(url)).send(body),
      put: (url: string, body: object = {}) => auth(api().put(url)).send(body),
    };
  }
  type Client = Awaited<ReturnType<typeof as>>;
  let manager: Client, sale: Client, accountant: Client;

  const quote = (over: object = {}) => ({
    customerId, quoteDate: today, discountAmount: 0,
    lines: [{ productId, unit: 'Cái', quantity: 10, unitPrice: 90_000, vatRate: 10 }],
    ...over,
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
    accountant = await as('ke.toan@ninhtrang.local');
    productId = (await manager.post('/api/products', { name: 'E2E Hàng báo giá', type: 'VAT_TU', baseUnit: 'Cái', retailPrice: 100_000 }).expect(201)).body.id;
    customerId = (await manager.post('/api/customers', { name: 'E2E Khách báo giá', type: 'LE', creditDays: 0, tagIds: [] }).expect(201)).body.id;
    otherCustomerId = (await manager.post('/api/customers', { name: 'E2E Khách khác', type: 'LE', creditDays: 0, tagIds: [] }).expect(201)).body.id;
  });

  afterAll(async () => {
    await prisma.quotation.deleteMany({ where: { customerId: { in: [customerId, otherCustomerId] } } });
    await prisma.salesOrder.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: [customerId, otherCustomerId] } } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await app.close();
  });

  it('Kế toán chỉ xem: không lập được báo giá', async () => {
    await accountant.post('/api/quotations', quote()).expect(403);
    await accountant.get('/api/quotations').expect(200);
  });

  it('ngày hiệu lực trước ngày báo giá bị từ chối', async () => {
    const res = await sale.post('/api/quotations', quote({ quoteDate: '2026-10-10', validUntil: '2026-10-01' })).expect(400);
    expect(res.body.message).toContain('hiệu lực');
  });

  let quoteId = '';
  let quoteCode = '';
  it('Sale lập báo giá: mã BG…, tổng tiền như đơn hàng, nhật ký ghi lại', async () => {
    const q = (await sale.post('/api/quotations', quote({ validUntil: today })).expect(201)).body;
    quoteId = q.id;
    quoteCode = q.code;
    expect(q.code).toMatch(/^BG\d{7}$/);
    expect(q.status).toBe('MOI');
    expect(q.totalOrder).toBe(990_000); // 10 × 90.000 + VAT 10%
    expect(q.salesRep).toBe('');
    expect(q.createdBy).toBe('sale1@ninhtrang.local');
    const log = await prisma.auditLog.findFirst({ where: { action: 'quotation.create', entityId: quoteId } });
    expect(log?.summary).toContain(quoteCode);
  });

  it('sửa báo giá: đổi số lượng, nhật ký ghi thay đổi dòng hàng', async () => {
    const current = (await sale.get(`/api/quotations/${quoteId}`).expect(200)).body;
    const q = (await sale.put(`/api/quotations/${quoteId}`, quote({
      validUntil: today, updatedAt: current.updatedAt, lines: [{ productId, unit: 'Cái', quantity: 12, unitPrice: 90_000, vatRate: 10 }],
    })).expect(200)).body;
    expect(q.totalOrder).toBe(1_188_000);
    const log = await prisma.auditLog.findFirst({ where: { action: 'quotation.update', entityId: quoteId } });
    expect(JSON.stringify(log?.changes)).toContain('× 12');
    // A save based on the old copy is refused.
    await sale.put(`/api/quotations/${quoteId}`, quote({ updatedAt: current.updatedAt })).expect(409);
  });

  it('lập đơn phải cùng khách với báo giá', async () => {
    const res = await manager.post('/api/sales-orders', {
      customerId: otherCustomerId, quotationId: quoteId, tagIds: [], orderDate: today, discountAmount: 0,
      lines: [{ productId, unit: 'Cái', quantity: 12, unitPrice: 90_000, vatRate: 10 }],
    }).expect(400);
    expect(res.body.message).toContain('cùng khách hàng');
  });

  it('lập đơn từ báo giá: báo giá Đã chốt, hai chứng từ nối với nhau', async () => {
    const o = (await manager.post('/api/sales-orders', {
      customerId, quotationId: quoteId, tagIds: [], orderDate: today, discountAmount: 0,
      lines: [{ productId, unit: 'Cái', quantity: 12, unitPrice: 90_000, vatRate: 10 }],
    }).expect(201)).body;
    orderIds.push(o.id);
    expect(o.quotationCode).toBe(quoteCode);
    const q = (await manager.get(`/api/quotations/${quoteId}`).expect(200)).body;
    expect(q.status).toBe('DA_CHOT');
    expect(q.orderId).toBe(o.id);
    expect(q.orderCode).toBe(o.code);
    const log = await prisma.auditLog.findFirst({ where: { action: 'quotation.convert', entityId: quoteId } });
    expect(log?.summary).toContain(o.code);
  });

  it('báo giá đã chốt: không lập đơn lần nữa, không sửa, không huỷ', async () => {
    await manager.post('/api/sales-orders', {
      customerId, quotationId: quoteId, tagIds: [], orderDate: today, discountAmount: 0,
      lines: [{ productId, unit: 'Cái', quantity: 1, unitPrice: 90_000 }],
    }).expect(400);
    await sale.put(`/api/quotations/${quoteId}`, quote()).expect(400);
    await sale.post(`/api/quotations/${quoteId}/cancel`, {}).expect(400);
  });

  it('huỷ báo giá: trạng thái Huỷ, không lập đơn từ nó được', async () => {
    const q = (await sale.post('/api/quotations', quote()).expect(201)).body;
    const cancelled = (await sale.post(`/api/quotations/${q.id}/cancel`, { reason: 'Khách chọn nơi khác' }).expect(200)).body;
    expect(cancelled.status).toBe('HUY');
    expect(cancelled.cancelReason).toBe('Khách chọn nơi khác');
    await manager.post('/api/sales-orders', {
      customerId, quotationId: q.id, tagIds: [], orderDate: today, discountAmount: 0,
      lines: [{ productId, unit: 'Cái', quantity: 1, unitPrice: 90_000 }],
    }).expect(400);
  });
});
