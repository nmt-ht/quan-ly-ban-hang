// Chặn các lỗ nghiệp vụ tìm được khi rà soát (25/10/2026): đơn trên chuyến, quyền trên đơn của người khác, kho khi giao,
// tỷ lệ quy đổi, chiết khấu ngoài khuyến mãi. Needs the demo seed. Works on its own products, orders, chuyến and
// khuyến mãi; removed in afterAll.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
const today = new Date().toISOString().slice(0, 10);
const WH = 'wh-ninhtrang';

describe('Toàn vẹn đơn hàng (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let item = ''; // hàng có ĐVT Thùng = 12 Cái
  let other = ''; // hàng không có kho trên dòng và không có kho ngầm định
  const products: string[] = [];
  const orders: string[] = [];
  const trips: string[] = [];
  const purchases: string[] = [];
  const promos: string[] = [];

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

  const stock = async (productId = item) =>
    ((await manager.get('/api/stock-levels').expect(200)).body as { productId: string; warehouseId: string; quantity: number }[])
      .find((s) => s.productId === productId && s.warehouseId === WH)?.quantity ?? 0;
  const line = (qty: number, extra: object = {}) => ({ productId: item, unit: 'Cái', quantity: qty, unitPrice: 50000, warehouseId: WH, ...extra });
  const draft = (lines: object[], extra: object = {}) => ({ customerId: 'kh-01', tagIds: [], orderDate: today, discountAmount: 0, lines, ...extra });
  async function newOrder(client: Client, lines: object[], extra: object = {}) {
    const o = (await client.post('/api/sales-orders', draft(lines, { salesRep: 'quan.ly@ninhtrang.local', ...extra })).expect(201)).body;
    orders.push(o.id);
    return o;
  }
  async function onTrip(orderId: string) {
    const t = (await manager.post('/api/delivery-trips', { date: today }).expect(201)).body;
    trips.push(t.id);
    await manager.post(`/api/delivery-trips/${t.id}/orders`, { orderIds: [orderId] }).expect(200);
    return t.id as string;
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
    item = (await manager.post('/api/products', {
      name: 'E2E Toàn vẹn đơn', type: 'VAT_TU', baseUnit: 'Cái', retailPrice: 50000, defaultWarehouseId: WH,
      unitConversions: [{ unitName: 'Thùng', ratioToBaseUnit: 12, price: 600000 }],
    }).expect(201)).body.id;
    other = (await manager.post('/api/products', { name: 'E2E Không kho', type: 'VAT_TU', baseUnit: 'Cái', retailPrice: 10000 }).expect(201)).body.id;
    products.push(item, other);
    await manager.post('/api/warehouse-vouchers', { type: 'NHAP', date: today, warehouseId: WH, lines: [{ productId: item, quantity: 500 }, { productId: other, quantity: 50 }] }).expect(201);
  });

  afterAll(async () => {
    await prisma.cashVoucher.deleteMany({ where: { allocations: { some: { ref: { in: (await prisma.salesOrder.findMany({ where: { id: { in: orders } } })).map((o) => o.code) } } } } });
    await prisma.warehouseVoucher.deleteMany({ where: { lines: { some: { productId: { in: products } } } } });
    await prisma.deliveryTrip.deleteMany({ where: { id: { in: trips } } });
    await prisma.salesOrder.deleteMany({ where: { OR: [{ id: { in: orders } }, { lines: { some: { productId: { in: products } } } }] } });
    await prisma.purchaseOrder.deleteMany({ where: { id: { in: purchases } } });
    await prisma.promotion.deleteMany({ where: { id: { in: promos } } });
    await prisma.stockLevel.deleteMany({ where: { productId: { in: products } } });
    await prisma.product.deleteMany({ where: { id: { in: products } } });
    await app.close();
  });

  it('lỗ 1: đơn nằm trên chuyến không huỷ được; đơn huỷ không bị xuất kho hay chốt giao', async () => {
    const o = await newOrder(manager, [line(3)]);
    const tripId = await onTrip(o.id);
    const res = await manager.post(`/api/sales-orders/${o.id}/cancel`, { reason: 'E2E' }).expect(400);
    expect(res.body.message).toContain('đang nằm trên chuyến');
    // A đơn huỷ by other means (older data) stops the xuất kho of the whole chuyến instead of leaving the kho.
    await prisma.salesOrder.update({ where: { id: o.id }, data: { status: 'HUY' } });
    const before = await stock();
    expect((await manager.post(`/api/delivery-trips/${tripId}/ship`).expect(400)).body.message).toContain('đã huỷ');
    expect(await stock()).toBe(before);
    expect((await manager.get(`/api/sales-orders/${o.id}`).expect(200)).body.status).toBe('HUY');
  });

  it('lỗ 2: hàng đang trên xe không giao tay được; chốt giao không vượt số còn phải giao', async () => {
    const o = await newOrder(manager, [line(2)]);
    const tripId = await onTrip(o.id);
    await manager.post(`/api/delivery-trips/${tripId}/ship`).expect(200);
    const afterShip = await stock();
    await manager.post(`/api/sales-orders/${o.id}/deliver`, { date: today, items: [{ lineIndex: 0, quantity: 2, warehouseId: WH }] }).expect(400);
    expect(await stock()).toBe(afterShip);
    // Older data: part already counted as received before the chốt — the chốt takes no more than what is still owed.
    await prisma.salesOrderLine.updateMany({ where: { orderId: o.id }, data: { receivedQuantity: 1 } });
    await manager.post(`/api/delivery-trips/${tripId}/orders/${o.id}/confirm`, { lines: [{ lineIndex: 0, received: 2 }] }).expect(200);
    const after = (await manager.get(`/api/sales-orders/${o.id}`).expect(200)).body;
    expect(after.lines[0].receivedQuantity).toBe(2);
    expect(after.receivedValue).toBe(after.totalOrder);
  });

  it('lỗ 3: Sale không sửa, huỷ, giao hay nhận trả được đơn của người bán khác', async () => {
    const o = await newOrder(manager, [line(1)]);
    await sale.get(`/api/sales-orders/${o.id}`).expect(404);
    await sale.put(`/api/sales-orders/${o.id}`, draft([line(2)], { salesRep: 'quan.ly@ninhtrang.local' })).expect(404);
    await sale.post(`/api/sales-orders/${o.id}/cancel`, { reason: 'E2E' }).expect(404);
    await sale.post(`/api/sales-orders/${o.id}/deliver`, { date: today, items: [{ lineIndex: 0, quantity: 1, warehouseId: WH }] }).expect(404);
    await manager.post(`/api/sales-orders/${o.id}/deliver`, { date: today, items: [{ lineIndex: 0, quantity: 1, warehouseId: WH }] }).expect(200);
    expect((await manager.get(`/api/sales-orders/${o.id}`).expect(200)).body.status).toBe('HOAN_THANH');
    // Their own orders still work.
    const mine = (await sale.post('/api/sales-orders', draft([line(1)], { salesRep: 'sale1@ninhtrang.local' })).expect(201)).body;
    orders.push(mine.id);
    await sale.post(`/api/sales-orders/${mine.id}/cancel`, { reason: 'E2E' }).expect(200);
  });

  it('lỗ 4: giao hàng hoá luôn trừ kho — kho trên dòng khi không chọn, không có kho thì từ chối', async () => {
    const o = await newOrder(manager, [line(4)]);
    const before = await stock();
    await manager.post(`/api/sales-orders/${o.id}/deliver`, { date: today, items: [{ lineIndex: 0, quantity: 4 }] }).expect(200);
    expect(await stock()).toBe(before - 4);
    const bare = await newOrder(manager, [{ productId: other, unit: 'Cái', quantity: 1, unitPrice: 10000 }]);
    const res = await manager.post(`/api/sales-orders/${bare.id}/deliver`, { date: today, items: [{ lineIndex: 0, quantity: 1 }] }).expect(400);
    expect(res.body.message).toContain('chọn kho xuất');
    expect((await manager.get(`/api/sales-orders/${bare.id}`).expect(200)).body.receivedValue).toBe(0);
  });

  it('lỗ 5: tỷ lệ quy đổi lấy từ mặt hàng, không theo số trình duyệt gửi', async () => {
    const o = await newOrder(manager, [line(1, { unit: 'Thùng', unitName: 'Thùng', ratioToBase: 0.01, unitPrice: 600000 })]);
    expect(o.lines[0].ratioToBase).toBe(12);
    const before = await stock();
    await manager.post(`/api/sales-orders/${o.id}/deliver`, { date: today, items: [{ lineIndex: 0, quantity: 1, warehouseId: WH }] }).expect(200);
    expect(await stock()).toBe(before - 12);
    await manager.post('/api/sales-orders', draft([line(1, { unit: 'Bao', unitName: 'Bao', unitPrice: 1 })])).expect(400);
    // Đơn nhập: same rule.
    const po = (await manager.post('/api/purchase-orders', {
      supplierId: 'ncc-1', date: today, lines: [{ productId: item, quantity: 1, unitPrice: 500000, unitName: 'Thùng', ratioToBase: 1000 }],
    }).expect(201)).body;
    purchases.push(po.id);
    expect(po.lines[0].ratioToBase).toBe(12);
    await manager.post('/api/purchase-orders', { supplierId: 'ncc-1', date: today, lines: [{ productId: item, quantity: 1, unitPrice: 1, unitName: 'Bao' }] }).expect(400);
  });

  it('lỗ 6: Sale chỉ chiết khấu / tặng hàng trong mức khuyến mãi; Quản lý thì được', async () => {
    const mine = (lines: object[], extra: object = {}) => draft(lines, { salesRep: 'sale1@ninhtrang.local', ...extra });
    // No khuyến mãi for this mặt hàng yet: no chiết khấu at all.
    await sale.post('/api/sales-orders', mine([line(5, { isGift: true })])).expect(403);
    await sale.post('/api/sales-orders', mine([line(5, { discountAmount: 1000 })])).expect(403);
    await sale.post('/api/sales-orders', mine([line(5, { discountRate: 100 })])).expect(403);
    await sale.post('/api/sales-orders', mine([line(5)], { discountAmount: 250000 })).expect(403); // cả đơn, beyond any GIAM_DON
    await sale.post('/api/quotations', { customerId: 'kh-01', quoteDate: today, discountAmount: 0, lines: [line(5, { discountRate: 50 })] }).expect(403);

    // Giảm 10% mặt hàng, tặng 1 khi mua đủ 5.
    for (const p of [
      { kind: 'GIAM_HANG', discountType: 'PHAN_TRAM', discountValue: 10 },
      { kind: 'TANG_HANG', buyQuantity: 5, giftProductId: item, giftQuantity: 1 },
    ]) {
      promos.push((await manager.post('/api/promotions', {
        name: 'E2E KM toàn vẹn', startDate: today, scope: 'TAT_CA', customerTypes: [], priceListIds: [], productIds: [item], categoryIds: [],
        discountType: 'PHAN_TRAM', discountValue: 0, ...p,
      }).expect(201)).body.id);
    }
    const ok = (await sale.post('/api/sales-orders', mine([
      line(5, { discountAmount: 25000, promotionId: promos[0] }), line(1, { isGift: true, promotionId: promos[1] }),
    ])).expect(201)).body;
    orders.push(ok.id);
    expect(ok.lines[1].discountAmount).toBe(50000);
    await sale.post('/api/sales-orders', mine([line(5, { discountAmount: 30000 })])).expect(403);
    await sale.post('/api/sales-orders', mine([line(5), line(2, { isGift: true })])).expect(403);
    // Editing keeps what the đơn already had.
    await sale.put(`/api/sales-orders/${ok.id}`, { ...mine([
      line(5, { discountAmount: 25000, promotionId: promos[0] }), line(1, { isGift: true, promotionId: promos[1] }),
    ], { description: 'Sửa diễn giải' }), updatedAt: ok.updatedAt }).expect(200);

    // Quản lý has order.discount.
    const free = await newOrder(manager, [line(5, { discountRate: 100 })], { discountAmount: 0 });
    expect(free.totalOrder).toBe(0);
  });
});
