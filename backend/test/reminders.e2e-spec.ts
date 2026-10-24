// Pha 2 — nhắc nợ: mỗi lần nhắc ghi kênh, hẹn trả và số nợ lúc nhắc (lấy từ công nợ, không gõ tay); mã BIN VietQR trên
// tài khoản ngân hàng. Needs the demo seed. Removes what it creates in afterAll.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

describe('Nhắc nợ & VietQR (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let productId = '';
  let customerId = '';
  let orderId = '';
  let accountId = '';

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
  let manager: Client, accountant: Client, sale: Client;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    manager = await as('quan.ly@ninhtrang.local');
    accountant = await as('ke.toan@ninhtrang.local');
    sale = await as('sale1@ninhtrang.local');
    productId = (await manager.post('/api/products', { name: 'E2E Dịch vụ nhắc nợ', type: 'DICH_VU', baseUnit: 'Lần', retailPrice: 200_000 }).expect(201)).body.id;
    customerId = (await manager.post('/api/customers', { name: 'E2E Khách nhắc nợ', type: 'LE', creditDays: 0, tagIds: [] }).expect(201)).body.id;
    orderId = (await manager.post('/api/sales-orders', {
      customerId, tagIds: [], orderDate: today, discountAmount: 0, lines: [{ productId, unit: 'Lần', quantity: 2, unitPrice: 200_000 }],
    }).expect(201)).body.id;
    await manager.post(`/api/sales-orders/${orderId}/deliver`, { date: today, items: [{ lineIndex: 0, quantity: 2 }] }).expect(200);
  });

  afterAll(async () => {
    await prisma.debtReminder.deleteMany({ where: { customerId } });
    await prisma.salesOrder.deleteMany({ where: { id: orderId } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    if (accountId) await prisma.cashAccount.deleteMany({ where: { id: accountId } });
    await app.close();
  });

  it('Sale (không có quyền nhắc nợ) bị chặn', async () => {
    await sale.post('/api/debt-reminders', { customerId, channel: 'ZALO' }).expect(403);
  });

  it('hẹn trả ngày đã qua bị từ chối', async () => {
    await accountant.post('/api/debt-reminders', { customerId, channel: 'ZALO', promisedDate: '2020-01-01' }).expect(400);
  });

  it('ghi lần nhắc: số nợ lấy từ công nợ lúc nhắc, có hẹn trả, nhật ký ghi lại', async () => {
    const r = (await accountant.post('/api/debt-reminders', {
      customerId, channel: 'GOI_DIEN', note: 'Khách hứa chuyển khoản', promisedDate: tomorrow, promisedAmount: 400_000,
    }).expect(201)).body;
    expect(r).toMatchObject({ channel: 'GOI_DIEN', balance: 400_000, overdue: 0, promisedDate: tomorrow, promisedAmount: 400_000, createdBy: 'ke.toan@ninhtrang.local' });
    const list = (await accountant.get(`/api/debt-reminders?customerId=${customerId}`).expect(200)).body;
    expect(list.map((x: { id: string }) => x.id)).toEqual([r.id]);
    const log = await prisma.auditLog.findFirst({ where: { action: 'debt.remind', entityId: customerId } });
    expect(log?.summary).toContain('Gọi điện');
    expect(log?.summary).toContain('400.000');
  });

  it('tài khoản ngân hàng nhận mã BIN 6 số cho VietQR', async () => {
    await manager.post('/api/cash-accounts', {
      name: 'E2E TK sai BIN', type: 'NGAN_HANG', accountNumber: '0123456789', bankBin: '97043', openingBalance: 0,
    }).expect(400);
    const a = (await manager.post('/api/cash-accounts', {
      name: 'E2E TK VietQR', type: 'NGAN_HANG', bankName: 'Vietcombank', bankBin: '970436', accountNumber: '0123456789', openingBalance: 0,
    }).expect(201)).body;
    accountId = a.id;
    expect(a.bankBin).toBe('970436');
  });
});
