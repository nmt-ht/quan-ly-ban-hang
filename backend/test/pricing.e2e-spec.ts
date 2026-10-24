// Pha 1.6 — bảng giá riêng gán cho khách và khuyến mãi: quyền, kiểm tra dữ liệu, hàng tặng luôn chiết khấu 100%.
// Needs the demo seed. Works on its own product, customer, price list and promotions; removed in afterAll.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
const today = new Date().toISOString().slice(0, 10);

describe('Bảng giá & khuyến mãi (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let productId = '';
  let customerId = '';
  let listId = '';
  const promoIds: string[] = [];
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
  let manager: Client, sale: Client;

  const promo = (over: object = {}) => ({
    name: 'E2E KM', kind: 'GIAM_HANG', startDate: today, scope: 'TAT_CA', customerTypes: [], priceListIds: [],
    productIds: [productId], categoryIds: [], discountType: 'PHAN_TRAM', discountValue: 10, ...over,
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
    productId = (await manager.post('/api/products', {
      name: 'E2E Hàng bảng giá', type: 'DICH_VU', baseUnit: 'Cái', retailPrice: 100_000,
    }).expect(201)).body.id;
    customerId = (await manager.post('/api/customers', { name: 'E2E Khách bảng giá', type: 'LE', creditDays: 0, tagIds: [] }).expect(201)).body.id;
  });

  afterAll(async () => {
    await prisma.salesOrder.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.promotion.deleteMany({ where: { id: { in: promoIds } } });
    await prisma.priceList.deleteMany({ where: { id: listId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await app.close();
  });

  it('Sale đọc được bảng giá nhưng không lập được', async () => {
    await sale.get('/api/price-lists').expect(200);
    await sale.post('/api/price-lists', { name: 'E2E Đại lý', items: [] }).expect(403);
  });

  it('lập bảng giá: một giá mỗi mặt hàng + ĐVT, ĐVT phải có thật', async () => {
    const dup = await manager.post('/api/price-lists', {
      name: 'E2E Đại lý', items: [{ productId, price: 1 }, { productId, unitName: '', price: 2 }],
    }).expect(400);
    expect(dup.body.message).toContain('đã có giá');
    await manager.post('/api/price-lists', { name: 'E2E Đại lý', items: [{ productId, unitName: 'Thùng', price: 1 }] }).expect(400);
    const l = (await manager.post('/api/price-lists', { name: 'E2E Đại lý', items: [{ productId, price: 85_000 }] }).expect(201)).body;
    listId = l.id;
    expect(l.items).toEqual([{ productId, unitName: '', price: 85_000 }]);
    await manager.post('/api/price-lists', { name: 'e2e đại lý', items: [] }).expect(409);
  });

  it('gán bảng giá cho khách: nhật ký ghi tên bảng giá', async () => {
    const c = (await manager.get(`/api/customers/${customerId}`).expect(200)).body;
    const saved = (await manager.put(`/api/customers/${customerId}`, {
      name: c.name, type: c.type, creditDays: 0, tagIds: [], addresses: [], priceListId: listId,
    }).expect(200)).body;
    expect(saved.priceListId).toBe(listId);
    const log = await prisma.auditLog.findFirst({ where: { action: 'customer.update', entityId: customerId }, orderBy: { at: 'desc' } });
    expect(JSON.stringify(log?.changes)).toContain('E2E Đại lý');
  });

  it('khuyến mãi: kiểm tra theo kiểu, Sale không lập được', async () => {
    await sale.post('/api/promotions', promo()).expect(403);
    await manager.post('/api/promotions', promo({ discountValue: 120 })).expect(400);
    await manager.post('/api/promotions', promo({ kind: 'BAC_THANG', tiers: [] })).expect(400);
    await manager.post('/api/promotions', promo({ kind: 'TANG_HANG', buyQuantity: 5, giftQuantity: 1 })).expect(400); // thiếu hàng tặng
    await manager.post('/api/promotions', promo({ scope: 'BANG_GIA' })).expect(400);
    const p = (await manager.post('/api/promotions', promo({
      kind: 'BAC_THANG', tiers: [{ minQuantity: 10, value: 8 }, { minQuantity: 5, value: 5 }], scope: 'BANG_GIA', priceListIds: [listId],
    })).expect(201)).body;
    promoIds.push(p.id);
    expect(p.code).toMatch(/^KM\d{7}$/);
    expect(p.tiers).toEqual([{ minQuantity: 5, value: 5 }, { minQuantity: 10, value: 8 }]);
    expect((await sale.get('/api/promotions').expect(200)).body.some((x: { id: string }) => x.id === p.id)).toBe(true);
    const off = (await manager.post(`/api/promotions/${p.id}/active`, { isActive: false }).expect(200)).body;
    expect(off.isActive).toBe(false);
  });

  it('đơn ghi khuyến mãi đã áp; hàng tặng luôn chiết khấu 100% dù form gửi gì', async () => {
    const o = (await manager.post('/api/sales-orders', {
      customerId, tagIds: [], orderDate: today, discountAmount: 0, promotionId: promoIds[0],
      lines: [
        { productId, unit: 'Cái', quantity: 10, unitPrice: 85_000, discountAmount: 42_500, promotionId: promoIds[0] },
        { productId, unit: 'Cái', quantity: 1, unitPrice: 85_000, discountAmount: 0, isGift: true, promotionId: promoIds[0] },
      ],
    }).expect(201)).body;
    orderIds.push(o.id);
    expect(o.promotionId).toBe(promoIds[0]);
    expect(o.lines[0]).toMatchObject({ promotionId: promoIds[0], isGift: false, discountAmount: 42_500 });
    expect(o.lines[1]).toMatchObject({ isGift: true, discountAmount: 85_000 });
    expect(o.totalOrder).toBe(850_000 - 42_500);
  });
});
