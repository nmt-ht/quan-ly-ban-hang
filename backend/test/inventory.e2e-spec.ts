// Đợt 2 — kho, end to end against the seeded local DB (see catalog.e2e-spec.ts). Works on its own
// test products, so demo stock is untouched; everything created here is removed in afterAll.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { vnDay } from '../src/common/text.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
const today = vnDay();

describe('Kho (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const products: string[] = [];

  const api = () => request(app.getHttpServer());
  async function as(email: string, password = DEMO_PASSWORD) {
    const token = (await api().post('/api/auth/login').send({ email, password }).expect(200)).body.accessToken;
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    return {
      get: (url: string) => auth(api().get(url)),
      post: (url: string, body: object = {}) => auth(api().post(url)).send(body),
      put: (url: string, body: object) => auth(api().put(url)).send(body),
    };
  }
  let manager: Awaited<ReturnType<typeof as>>;
  let storekeeper: Awaited<ReturnType<typeof as>>;
  let sale: Awaited<ReturnType<typeof as>>;
  let accountant: Awaited<ReturnType<typeof as>>;
  let itemId = '';

  async function stock(productId: string, warehouseId: string): Promise<number> {
    const rows = (await manager.get('/api/stock-levels').expect(200)).body as { productId: string; warehouseId: string; quantity: number }[];
    return rows.find((s) => s.productId === productId && s.warehouseId === warehouseId)?.quantity ?? 0;
  }
  const voucher = (type: string, lines: object[], extra: object = {}) => ({ type, date: today, warehouseId: 'wh-vattu', lines, ...extra });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    manager = await as('quan.ly@ninhtrang.local');
    storekeeper = await as('thu.kho@ninhtrang.local');
    sale = await as('sale1@ninhtrang.local');
    accountant = await as('ke.toan@ninhtrang.local');
    const item = (await manager.post('/api/products', { name: 'E2E Kho', type: 'VAT_TU', baseUnit: 'Cái', minStock: 5 }).expect(201)).body;
    products.push(item.id);
    itemId = item.id;
  });

  afterAll(async () => {
    await prisma.warehouseVoucher.deleteMany({ where: { lines: { some: { productId: { in: products } } } } });
    await prisma.stockLevel.deleteMany({ where: { productId: { in: products } } });
    await prisma.product.deleteMany({ where: { id: { in: products } } });
    await app.close();
  });

  it('nhập, xuất (kể cả quá tồn), chuyển kho move stock; codes come from the sequence', async () => {
    const pnk = (await manager.post('/api/warehouse-vouchers', voucher('NHAP', [{ productId: itemId, quantity: 20, unitPrice: 12000, unitName: 'Hộp', unitQuantity: 2 }])).expect(201)).body;
    expect(pnk).toMatchObject({ code: expect.stringMatching(/^PNK\d{7}$/), date: today, createdBy: 'quan.ly@ninhtrang.local' });
    expect(pnk.lines[0]).toMatchObject({ quantity: 20, delta: 20, unitPrice: 12000, unitName: 'Hộp', unitQuantity: 2 });
    expect(await stock(itemId, 'wh-vattu')).toBe(20);

    await manager.post('/api/warehouse-vouchers', voucher('CHUYEN', [{ productId: itemId, quantity: 8 }], { targetWarehouseId: 'wh-phukien' })).expect(201);
    expect(await stock(itemId, 'wh-vattu')).toBe(12);
    expect(await stock(itemId, 'wh-phukien')).toBe(8);
    await manager.post('/api/warehouse-vouchers', voucher('CHUYEN', [{ productId: itemId, quantity: 1 }], { targetWarehouseId: 'wh-vattu' })).expect(400);

    // Xuất quá tồn is allowed by default (stock is sometimes recorded late): the level goes negative.
    await manager.post('/api/warehouse-vouchers', voucher('XUAT', [{ productId: itemId, quantity: 15 }])).expect(201);
    expect(await stock(itemId, 'wh-vattu')).toBe(-3);
  });

  it('thiết lập không cho xuất quá số tồn: chỉ quyền "Xuất vượt tồn kho" xuất được; phiếu không được đề ngày tương lai', async () => {
    const tomorrow = vnDay(new Date(Date.now() + 86_400_000));
    expect((await manager.post('/api/warehouse-vouchers', voucher('NHAP', [{ productId: itemId, quantity: 1 }], { date: tomorrow })).expect(400)).body.message).toContain('sau hôm nay');
    // Thiết lập công ty: company.update (CEO).
    const ceo = await as('admin@ninhtrang.local', process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!');
    await manager.put('/api/company/stock-policy', { allowNegativeStock: false }).expect(403);
    expect((await ceo.put('/api/company/stock-policy', { allowNegativeStock: false }).expect(200)).body.allowNegativeStock).toBe(false);
    try {
      await manager.post('/api/warehouse-vouchers', voucher('NHAP', [{ productId: itemId, quantity: 5 }])).expect(201);
      const have = await stock(itemId, 'wh-vattu');
      const refused = (await storekeeper.post('/api/warehouse-vouchers', voucher('XUAT', [{ productId: itemId, quantity: have + 2 }])).expect(400)).body;
      expect(refused.message).toContain('không đủ tồn — thiếu 2');
      expect(await stock(itemId, 'wh-vattu')).toBe(have); // nothing moved
      await storekeeper.post('/api/warehouse-vouchers', voucher('XUAT', [{ productId: itemId, quantity: have }])).expect(201); // đúng bằng tồn
      await manager.post('/api/warehouse-vouchers', voucher('XUAT', [{ productId: itemId, quantity: 1 }])).expect(201); // Quản lý có stock.overdraw
      expect(await stock(itemId, 'wh-vattu')).toBe(-1);
    } finally {
      await ceo.put('/api/company/stock-policy', { allowNegativeStock: true }).expect(200);
    }
  });

  it('kiểm kê records the difference to the book stock at the moment of saving', async () => {
    const pkk = (await storekeeper.post('/api/warehouse-vouchers', voucher('KIEM_KE', [{ productId: itemId, quantity: 4 }], { warehouseId: 'wh-phukien' })).expect(201)).body;
    expect(pkk.lines[0]).toMatchObject({ quantity: 4, bookQuantity: 8, delta: -4 });
    expect(await stock(itemId, 'wh-phukien')).toBe(4);
    // The same count again changes nothing.
    const again = (await storekeeper.post('/api/warehouse-vouchers', voucher('KIEM_KE', [{ productId: itemId, quantity: 4 }], { warehouseId: 'wh-phukien' })).expect(201)).body;
    expect(again.lines[0].delta).toBe(0);
  });

  it('huỷ phiếu puts stock back; only once, and never for a voucher made by another document', async () => {
    const before = await stock(itemId, 'wh-vattu');
    const pnk = (await manager.post('/api/warehouse-vouchers', voucher('NHAP', [{ productId: itemId, quantity: 6 }])).expect(201)).body;
    expect(await stock(itemId, 'wh-vattu')).toBe(before + 6);
    const cancelled = (await storekeeper.post(`/api/warehouse-vouchers/${pnk.id}/cancel`, { reason: 'Nhập nhầm' }).expect(200)).body;
    expect(cancelled).toMatchObject({ isCancelled: true, cancelReason: 'Nhập nhầm' });
    expect(await stock(itemId, 'wh-vattu')).toBe(before);
    await storekeeper.post(`/api/warehouse-vouchers/${pnk.id}/cancel`).expect(400);

    const fromProduction = (await manager.get('/api/warehouse-vouchers').expect(200)).body.find((v: any) => /LSX\d+/.test(v.reason ?? ''));
    await storekeeper.post(`/api/warehouse-vouchers/${fromProduction.id}/cancel`).expect(400);
  });

  it('permissions: each kind needs its own; Thủ kho cannot set purchase prices', async () => {
    await sale.post('/api/warehouse-vouchers', voucher('NHAP', [{ productId: itemId, quantity: 1 }])).expect(403);
    const pnk = (await storekeeper.post('/api/warehouse-vouchers', voucher('NHAP', [{ productId: itemId, quantity: 1, unitPrice: 99000 }])).expect(201)).body;
    expect(pnk.lines[0].unitPrice).toBe(0);
    await accountant.post(`/api/warehouse-vouchers/${pnk.id}/cancel`).expect(403);
    await sale.get('/api/stock-levels').expect(200);
  });

  it('refuses services, duplicate lines and unknown warehouses', async () => {
    const svc = (await manager.post('/api/products', { name: 'E2E Dịch vụ', type: 'DICH_VU', baseUnit: 'Lần' }).expect(201)).body;
    products.push(svc.id);
    await manager.post('/api/warehouse-vouchers', voucher('NHAP', [{ productId: svc.id, quantity: 1 }])).expect(400);
    await manager.post('/api/warehouse-vouchers', voucher('NHAP', [{ productId: itemId, quantity: 1 }, { productId: itemId, quantity: 2 }])).expect(400);
    await manager.post('/api/warehouse-vouchers', voucher('NHAP', [{ productId: itemId, quantity: 1 }], { warehouseId: 'wh-khong-co' })).expect(400);
    await manager.post('/api/warehouse-vouchers', voucher('NHAP', [])).expect(400);
  });
});
