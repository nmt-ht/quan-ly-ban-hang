// Đợt 3 — đơn nhập hàng and công nợ phải trả, end to end against the seeded local DB.
// Works on its own test products and orders; everything created here is removed in afterAll.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
const today = new Date().toISOString().slice(0, 10);

describe('Đơn nhập hàng & công nợ phải trả (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const products: string[] = [];
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
  let manager: Awaited<ReturnType<typeof as>>;
  let storekeeper: Awaited<ReturnType<typeof as>>;
  let accountant: Awaited<ReturnType<typeof as>>;
  let sale: Awaited<ReturnType<typeof as>>;
  let boxed = '';
  let loose = '';

  async function stock(productId: string, warehouseId: string): Promise<number> {
    const rows = (await manager.get('/api/stock-levels').expect(200)).body as { productId: string; warehouseId: string; quantity: number }[];
    return rows.find((s) => s.productId === productId && s.warehouseId === warehouseId)?.quantity ?? 0;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    manager = await as('quan.ly@ninhtrang.local');
    storekeeper = await as('thu.kho@ninhtrang.local');
    accountant = await as('ke.toan@ninhtrang.local');
    sale = await as('sale1@ninhtrang.local');
    for (const name of ['E2E Nhập hộp', 'E2E Nhập lẻ']) {
      const p = (await manager.post('/api/products', { name, type: 'VAT_TU', baseUnit: 'Cái' }).expect(201)).body;
      products.push(p.id);
    }
    [boxed, loose] = products;
  });

  afterAll(async () => {
    await prisma.warehouseVoucher.deleteMany({ where: { purchaseOrderId: { in: orders } } });
    await prisma.purchaseOrder.deleteMany({ where: { id: { in: orders } } });
    await prisma.stockLevel.deleteMany({ where: { productId: { in: products } } });
    await prisma.product.deleteMany({ where: { id: { in: products } } });
    await app.close();
  });

  const draft = (lines: object[], extra: object = {}) => ({ supplierId: 'ncc-1', date: today, note: 'E2E', lines, ...extra });

  it('runs the whole life of an order: nháp → gửi NCC → nhận từng phần → nhận đủ → hoàn tất', async () => {
    await sale.post('/api/purchase-orders', draft([{ productId: loose, quantity: 1, unitPrice: 1 }])).expect(403);

    const o = (await manager.post('/api/purchase-orders', draft([
      { productId: boxed, quantity: 10, unitPrice: 120000, unitName: 'Hộp', ratioToBase: 12, vatRate: 10, warehouseId: 'wh-vattu' },
      { productId: loose, quantity: 5, unitPrice: 1000 },
    ])).expect(201)).body;
    orders.push(o.id);
    expect(o).toMatchObject({ code: expect.stringMatching(/^DN\d{7}$/), status: 'NHAP', totalValue: 1_325_000, receivedValue: 0, createdBy: 'quan.ly@ninhtrang.local' });

    // Someone else saved in between: the stale editor is told to reload.
    await manager.put(`/api/purchase-orders/${o.id}`, draft(o.lines, { updatedAt: '2020-01-01T00:00:00.000Z' })).expect(409);
    const edited = (await manager.put(`/api/purchase-orders/${o.id}`, draft(o.lines, { updatedAt: o.updatedAt, note: 'E2E sửa' })).expect(200)).body;
    expect(edited.note).toBe('E2E sửa');

    await storekeeper.post(`/api/purchase-orders/${o.id}/receive`, { date: today, items: [{ lineIndex: 0, quantity: 1, warehouseId: 'wh-vattu' }] }).expect(400);
    const sent = (await manager.post(`/api/purchase-orders/${o.id}/send`).expect(200)).body;
    expect(sent).toMatchObject({ status: 'DA_GUI_NCC', sentDate: today });
    await manager.put(`/api/purchase-orders/${o.id}`, draft(o.lines)).expect(400); // no longer Nháp

    const part = (await storekeeper.post(`/api/purchase-orders/${o.id}/receive`, {
      date: today, note: 'đợt 1',
      items: [{ lineIndex: 0, quantity: 4, warehouseId: 'wh-vattu' }, { lineIndex: 1, quantity: 5, warehouseId: 'wh-phukien' }],
    }).expect(200)).body;
    expect(part).toMatchObject({ status: 'NHAN_MOT_PHAN', receivedValue: 533_000, receivedDate: today });
    expect(await stock(boxed, 'wh-vattu')).toBe(48); // 4 hộp × 12
    expect(await stock(loose, 'wh-phukien')).toBe(5);

    const pnk = (await manager.get('/api/warehouse-vouchers').expect(200)).body.filter((v: any) => v.purchaseOrderId === o.id);
    expect(pnk).toHaveLength(2);
    const boxedLine = pnk.flatMap((v: any) => v.lines).find((l: any) => l.productId === boxed);
    expect(boxedLine).toMatchObject({ quantity: 48, unitPrice: 10_000 }); // giá nhập per Cái
    expect(pnk[0].reason).toContain(o.code);
    await storekeeper.post(`/api/warehouse-vouchers/${pnk[0].id}/cancel`).expect(400); // cancel from the order, not the phiếu

    // More than ordered is capped at what is left.
    const full = (await storekeeper.post(`/api/purchase-orders/${o.id}/receive`, { date: today, items: [{ lineIndex: 0, quantity: 100, warehouseId: 'wh-vattu' }] }).expect(200)).body;
    expect(full).toMatchObject({ status: 'DA_NHAN_DU', receivedValue: 1_325_000 });
    expect(await stock(boxed, 'wh-vattu')).toBe(120);
    await storekeeper.post(`/api/purchase-orders/${o.id}/receive`, { date: today, items: [{ lineIndex: 0, quantity: 1, warehouseId: 'wh-vattu' }] }).expect(400);

    await manager.post(`/api/purchase-orders/${o.id}/cancel`, { reason: 'E2E' }).expect(400); // goods are in
    expect((await manager.post(`/api/purchase-orders/${o.id}/complete`).expect(200)).body.status).toBe('HOAN_TAT');
  });

  it('cancels an order that has received nothing', async () => {
    const o = (await manager.post('/api/purchase-orders', draft([{ productId: loose, quantity: 2, unitPrice: 500 }])).expect(201)).body;
    orders.push(o.id);
    await storekeeper.post(`/api/purchase-orders/${o.id}/cancel`).expect(403);
    expect((await manager.post(`/api/purchase-orders/${o.id}/cancel`, { reason: 'Đặt nhầm' }).expect(200)).body).toMatchObject({ status: 'HUY', cancelReason: 'Đặt nhầm' });
    await manager.post(`/api/purchase-orders/${o.id}/send`).expect(400);
  });

  it('công nợ phải trả: received goods are owed, due after the supplier\'s credit days', async () => {
    await sale.get('/api/payables').expect(403);
    const rows = (await accountant.get('/api/payables').expect(200)).body;
    const ncc1 = rows.find((r: any) => r.partnerId === 'ncc-1');
    const order = (await accountant.get(`/api/purchase-orders/${orders[0]}`).expect(200)).body;
    const entry = ncc1.entries.find((e: any) => e.ref === order.code);
    expect(entry).toMatchObject({ kind: 'PHAT_SINH', amount: 1_325_000, dueDate: addDays(today, 30), sourceId: order.id });
    // The balance is what is still open minus money paid ahead.
    const open = ncc1.items.reduce((s: number, i: any) => s + i.amount, 0);
    expect(ncc1.balance).toBe(open - ncc1.prepaid);
    expect(ncc1.entries.at(-1).balance).toBe(ncc1.balance);
  });
});

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
