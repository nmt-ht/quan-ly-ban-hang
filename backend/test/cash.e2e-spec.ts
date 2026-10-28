// Đợt 6 — phiếu thu chi, đối trừ công nợ and số dư quỹ, end to end against the seeded local DB.
// Works on its own customer, product and orders; everything created here is removed in afterAll.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { vnDay } from '../src/common/text.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
const today = vnDay();

describe('Phiếu thu chi & đối trừ (e2e)', () => {
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
  let manager: Client, accountant: Client, sale: Client, storekeeper: Client;

  const balance = async (id: string) => (await manager.get('/api/cash-accounts').expect(200)).body.find((a: any) => a.id === id).balance as number;
  const row = async () => (await accountant.get('/api/receivables').expect(200)).body.find((r: any) => r.partnerId === customerId);
  async function deliveredOrder(quantity: number, unitPrice: number) {
    const o = (await manager.post('/api/sales-orders', {
      customerId, tagIds: [], orderDate: today, discountAmount: 0, salesRep: 'quan.ly@ninhtrang.local',
      lines: [{ productId, unit: 'Cái', quantity, unitPrice, warehouseId: 'wh-ninhtrang' }],
    }).expect(201)).body;
    orders.push(o.id);
    await storekeeper.post(`/api/sales-orders/${o.id}/deliver`, { date: today, items: [{ lineIndex: 0, quantity, warehouseId: 'wh-ninhtrang' }] }).expect(200);
    return o;
  }
  const receipt = (amount: number, extra: object = {}) => ({
    kind: 'THU', date: today, category: 'Thu tiền khách hàng', partnerType: 'KHACH_HANG', partnerId: customerId, accountId: 'acc-bank', amount, description: 'E2E', ...extra,
  });

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
    storekeeper = await as('thu.kho@ninhtrang.local');
    customerId = (await manager.post('/api/customers', { name: 'E2E Khách nợ', type: 'LE', creditDays: 0, tagIds: [] }).expect(201)).body.id;
    productId = (await manager.post('/api/products', { name: 'E2E Hàng thu tiền', type: 'VAT_TU', baseUnit: 'Cái', retailPrice: 100000 }).expect(201)).body.id;
    await manager.post('/api/warehouse-vouchers', { type: 'NHAP', date: today, warehouseId: 'wh-ninhtrang', lines: [{ productId, quantity: 20 }] }).expect(201);
  });

  afterAll(async () => {
    await prisma.cashVoucher.deleteMany({ where: { OR: [{ customerId }, { description: 'E2E' }] } });
    await prisma.warehouseVoucher.deleteMany({ where: { lines: { some: { productId } } } });
    await prisma.salesOrder.deleteMany({ where: { id: { in: orders } } });
    await prisma.stockLevel.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await app.close();
  });

  it('a phiếu thu settles công nợ (tự động FIFO or chọn tay), moves số dư quỹ, and huỷ reopens both', async () => {
    const o1 = await deliveredOrder(3, 100000); // 300 000 owed
    expect(await row()).toMatchObject({ balance: 300_000, items: [{ ref: o1.code, amount: 300_000 }] });
    const bankBefore = await balance('acc-bank');

    await sale.post('/api/cash-vouchers', receipt(100000)).expect(403); // Sale may not lập phiếu thu
    const pt1 = (await accountant.post('/api/cash-vouchers', receipt(120000, { settledAmount: 120000 })).expect(201)).body;
    expect(pt1).toMatchObject({ code: expect.stringMatching(/^PT\d{7}$/), kind: 'THU', partnerId: customerId, amount: 120_000, createdBy: 'ke.toan@ninhtrang.local', date: today });
    expect(await balance('acc-bank')).toBe(bankBefore + 120_000);
    expect((await row()).balance).toBe(180_000);

    // Chọn tay: the money goes to the named order first, even though o1 is due earlier.
    const o2 = await deliveredOrder(1, 100000);
    await accountant.post('/api/cash-vouchers', receipt(50000, { allocations: [{ ref: o2.code, amount: 50000 }] })).expect(201);
    const r = await row();
    expect(r.items).toEqual([
      expect.objectContaining({ ref: o1.code, amount: 180_000 }),
      expect.objectContaining({ ref: o2.code, amount: 50_000 }),
    ]);

    await accountant.post('/api/cash-vouchers', receipt(10000, { allocations: [{ ref: 'DH9999999', amount: 10000 }] })).expect(400); // not this customer's
    await accountant.post('/api/cash-vouchers', receipt(10000, { allocations: [{ ref: o1.code, amount: 20000 }] })).expect(400); // more than the phiếu
    await accountant.post('/api/cash-vouchers', receipt(10000, { category: 'Thu khác' })).expect(400); // Thu khác is not tied to a customer

    const cancelled = (await accountant.post(`/api/cash-vouchers/${pt1.id}/cancel`, { reason: 'Ghi nhầm' }).expect(200)).body;
    expect(cancelled).toMatchObject({ isCancelled: true, cancelReason: 'Ghi nhầm' });
    await accountant.post(`/api/cash-vouchers/${pt1.id}/cancel`).expect(400);
    expect(await balance('acc-bank')).toBe(bankBefore + 50_000);
    expect((await row()).balance).toBe(350_000); // 300 000 + 100 000 − the 50 000 still standing
  });

  it('a phiếu not tied to anyone only moves số dư quỹ; the list is readable by those who need it', async () => {
    const cashBefore = await balance('acc-cash');
    const pc = (await accountant.post('/api/cash-vouchers', {
      kind: 'CHI', date: today, category: 'Chi khác', partnerType: 'KHAC', accountId: 'acc-cash', amount: 75000, description: 'E2E',
    }).expect(201)).body;
    expect(pc).toMatchObject({ code: expect.stringMatching(/^PC\d{7}$/), partnerType: 'KHAC', settledAmount: 0 });
    const tomorrow = vnDay(new Date(Date.now() + 86_400_000));
    expect((await accountant.post('/api/cash-vouchers', {
      kind: 'CHI', date: tomorrow, category: 'Chi khác', partnerType: 'KHAC', accountId: 'acc-cash', amount: 1000, description: 'E2E',
    }).expect(400)).body.message).toContain('sau hôm nay');
    expect(await balance('acc-cash')).toBe(cashBefore - 75_000);
    expect((await accountant.get('/api/cash-vouchers').expect(200)).body.some((v: any) => v.id === pc.id)).toBe(true);
    await storekeeper.get('/api/cash-vouchers').expect(403); // Thủ kho has no voucher, debt or report rights
  });

  it('huỷ phiếu thu không được làm quỹ âm, trừ khi có quyền chi vượt tồn quỹ', async () => {
    const account = await prisma.cashAccount.create({ data: { name: 'E2E Quỹ huỷ thu', type: 'TIEN_MAT', openingBalance: 0 } });
    try {
      const khac = (kind: 'THU' | 'CHI', amount: number) => ({
        kind, date: today, category: kind === 'THU' ? 'Thu khác' : 'Chi khác', partnerType: 'KHAC', accountId: account.id, amount, description: 'E2E',
      });
      const pt = (await accountant.post('/api/cash-vouchers', khac('THU', 100_000)).expect(201)).body;
      await accountant.post('/api/cash-vouchers', khac('CHI', 60_000)).expect(201); // quỹ còn 40.000
      const refused = (await accountant.post(`/api/cash-vouchers/${pt.id}/cancel`, { reason: 'E2E' }).expect(400)).body;
      expect(refused.message).toMatch(/quỹ âm/);
      // Quản lý có voucher.overdraw: huỷ được, nhật ký ghi lại.
      await manager.post(`/api/cash-vouchers/${pt.id}/cancel`, { reason: 'E2E' }).expect(200);
      expect(await balance(account.id)).toBe(-60_000);
      const log = await prisma.auditLog.findFirst({ where: { action: 'cash_voucher.cancel', entityId: pt.id } });
      expect(log?.summary).toContain('huỷ làm quỹ âm');
    } finally {
      await prisma.cashVoucher.deleteMany({ where: { accountId: account.id } });
      await prisma.cashAccount.delete({ where: { id: account.id } });
    }
  });
});
