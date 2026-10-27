// Pha 1.1 (đợt 2) — phiếu kho, phiếu thu chi và đơn nhập theo trang trên máy chủ, nạp theo kỳ, đọc theo id / chứng từ
// gốc và số đếm trên toàn bộ lịch sử. Needs the demo seed. Works on its own product and documents; removed in afterAll.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { vnDay } from '../src/common/text.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
const today = vnDay();
const OLD = new Date('2025-01-15T00:00:00Z');
const MARK = 'E2E phân trang chứng từ';

describe('Phân trang phiếu kho, thu chi, đơn nhập (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let productId = '';
  const voucherIds: string[] = [];
  const orderIds: string[] = [];
  const cashIds: string[] = [];

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
  let storekeeper: Client;
  let accountant: Client;

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
    productId = (await manager.post('/api/products', { name: 'E2E Vật tư phân trang', type: 'VAT_TU', baseUnit: 'Cái' }).expect(201)).body.id;

    // Phiếu kho: an old nhập (outside the window) and a xuất of today.
    for (const v of [
      { type: 'NHAP', warehouseId: 'wh-vattu', reason: MARK, lines: [{ productId, quantity: 10, unitPrice: 5000 }] },
      { type: 'XUAT', warehouseId: 'wh-vattu', reason: MARK, lines: [{ productId, quantity: 3 }] },
    ]) voucherIds.push((await manager.post('/api/warehouse-vouchers', { ...v, date: today }).expect(201)).body.id);
    await prisma.warehouseVoucher.update({ where: { id: voucherIds[0] }, data: { date: OLD } });

    // Đơn nhập: an old cancelled one and an open one (both kept by nhà cung cấp ncc-1).
    for (const qty of [2, 4]) {
      orderIds.push((await manager.post('/api/purchase-orders', { supplierId: 'ncc-1', date: today, note: MARK, lines: [{ productId, quantity: qty, unitPrice: 1000 }] }).expect(201)).body.id);
    }
    await manager.post(`/api/purchase-orders/${orderIds[0]}/cancel`, { reason: 'E2E' }).expect(200);
    await prisma.purchaseOrder.update({ where: { id: orderIds[0] }, data: { date: OLD } });
    await prisma.purchaseOrder.update({ where: { id: orderIds[1] }, data: { date: OLD } }); // old but still open

    // Phiếu chi: an old one and one of today.
    for (const amount of [11_000, 22_000]) {
      cashIds.push((await accountant.post('/api/cash-vouchers', {
        kind: 'CHI', date: today, category: 'Chi khác', partnerType: 'KHAC', accountId: 'acc-cash', amount, description: MARK,
      }).expect(201)).body.id);
    }
    await prisma.cashVoucher.update({ where: { id: cashIds[0] }, data: { date: OLD } });
  });

  afterAll(async () => {
    await prisma.cashVoucher.deleteMany({ where: { id: { in: cashIds } } });
    await prisma.purchaseOrder.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.warehouseVoucher.deleteMany({ where: { id: { in: voucherIds } } });
    await prisma.stockLevel.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await app.close();
  });

  it('phiếu kho: trang theo mặt hàng, số theo loại và kho, giá nhập ẩn với thủ kho', async () => {
    const res = (await manager.get(`/api/warehouse-vouchers/page?productId=${productId}&sort=date&dir=asc`).expect(200)).body;
    expect(res.total).toBe(2);
    expect(res.rows.map((v: { id: string }) => v.id)).toEqual(voucherIds);
    expect(res.kindCounts).toMatchObject({ NHAP: 1, XUAT: 1 });
    expect(res.warehouseCounts['wh-vattu']).toBe(2);
    expect(res.totals.value).toBe(50_000);
    const out = (await manager.get(`/api/warehouse-vouchers/page?productId=${productId}&kind=XUAT`).expect(200)).body;
    expect(out.rows.map((v: { id: string }) => v.id)).toEqual([voucherIds[1]]);
    const found = (await manager.get('/api/warehouse-vouchers/page?q=e2e%20phan%20trang%20chung%20tu').expect(200)).body;
    expect(found.total).toBe(2);
    const hidden = (await storekeeper.get(`/api/warehouse-vouchers/page?productId=${productId}`).expect(200)).body;
    expect(hidden.totals.value).toBe(0);
    expect(hidden.rows.every((v: { lines: { unitPrice: unknown }[] }) => v.lines.every((l) => l.unitPrice === null))).toBe(true);
    await manager.get('/api/warehouse-vouchers/page?kind=KHONG').expect(400);
  });

  it('phiếu kho: nạp theo kỳ, đọc theo id và số phiếu theo kho trên toàn bộ lịch sử', async () => {
    const recent = (await manager.get('/api/warehouse-vouchers?recentDays=90').expect(200)).body as { id: string }[];
    expect(recent.some((v) => v.id === voucherIds[0])).toBe(false);
    expect(recent.some((v) => v.id === voucherIds[1])).toBe(true);
    const picked = (await manager.get(`/api/warehouse-vouchers?ids=${voucherIds[0]}`).expect(200)).body as { id: string }[];
    expect(picked.map((v) => v.id)).toEqual([voucherIds[0]]);
    const usage = (await manager.get('/api/warehouse-vouchers/usage').expect(200)).body;
    expect(usage['wh-vattu'].vouchers).toBeGreaterThanOrEqual(2);
  });

  it('đơn nhập: đơn cũ còn mở vẫn được nạp, trang theo nhà cung cấp, giá trị ẩn với thủ kho', async () => {
    const recent = (await manager.get('/api/purchase-orders?recentDays=90').expect(200)).body as { id: string }[];
    expect(recent.some((o) => o.id === orderIds[0])).toBe(false); // old and cancelled
    expect(recent.some((o) => o.id === orderIds[1])).toBe(true); // old but open
    const res = (await manager.get('/api/purchase-orders/page?q=e2e%20phan%20trang%20chung%20tu&sort=totalValue&dir=desc').expect(200)).body;
    expect(res.total).toBe(2);
    expect(res.rows.map((o: { id: string }) => o.id)).toEqual([orderIds[1], orderIds[0]]);
    expect(res.statusCounts).toMatchObject({ NHAP: 1, HUY: 1 });
    expect(res.totals.value).toBe(4000); // đã huỷ không tính
    const open = (await manager.get('/api/purchase-orders/page?q=e2e%20phan%20trang%20chung%20tu&status=NHAP').expect(200)).body;
    expect(open.rows.map((o: { id: string }) => o.id)).toEqual([orderIds[1]]);
    const hidden = (await storekeeper.get('/api/purchase-orders/page?q=e2e%20phan%20trang%20chung%20tu').expect(200)).body;
    expect(hidden.totals.value).toBe(0);
    expect(hidden.rows[0].totalValue).toBeNull();
    const stats = (await manager.get('/api/purchase-orders/supplier-stats').expect(200)).body;
    expect(stats['ncc-1'].orderCount).toBeGreaterThanOrEqual(2);
  });

  it('phiếu thu chi: trang có thẻ tổng của kỳ, nạp theo kỳ, đọc theo id và số phiếu theo tài khoản', async () => {
    const res = (await accountant.get('/api/cash-vouchers/page?q=e2e%20phan%20trang%20chung%20tu&sort=amount&dir=desc').expect(200)).body;
    expect(res.total).toBe(2);
    expect(res.rows.map((v: { id: string }) => v.id)).toEqual([cashIds[1], cashIds[0]]);
    expect(res.cards).toMatchObject({ chi: 33_000, chiCash: 33_000, thu: 0, net: -33_000, count: 2 });
    expect(res.categoryCounts['Chi khác']).toBe(2);
    const period = (await accountant.get(`/api/cash-vouchers/page?q=e2e%20phan%20trang%20chung%20tu&from=${today}&to=${today}`).expect(200)).body;
    expect(period.rows.map((v: { id: string }) => v.id)).toEqual([cashIds[1]]);
    const recent = (await accountant.get('/api/cash-vouchers?recentDays=90').expect(200)).body as { id: string }[];
    expect(recent.some((v) => v.id === cashIds[0])).toBe(false);
    const picked = (await accountant.get(`/api/cash-vouchers?ids=${cashIds[0]}`).expect(200)).body as { id: string }[];
    expect(picked.map((v) => v.id)).toEqual([cashIds[0]]);
    const usage = (await accountant.get('/api/cash-vouchers/usage').expect(200)).body;
    expect(usage.accounts['acc-cash']).toBeGreaterThanOrEqual(2);
    expect(usage.categories['CHI|Chi khác']).toBeGreaterThanOrEqual(2);
  });
});
