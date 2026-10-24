// Pha 1.3 — giá vốn bình quân gia quyền di động, chốt trên dòng phiếu kho lúc ghi: nhập kéo bình quân, xuất đi theo
// bình quân lúc xuất, hàng trả về nhập lại đúng giá đã xuất, huỷ phiếu nhập trả bình quân về như cũ; báo cáo lãi gộp
// dùng giá đã chốt. Needs the demo seed. Works on its own product, customer and order; removed in afterAll.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
const today = new Date().toISOString().slice(0, 10);
const WH = 'wh-ninhtrang';

describe('Giá vốn bình quân (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let productId = '';
  let customerId = '';
  let orderId = '';
  let lineId = '';
  let cheapId = '';

  const api = () => request(app.getHttpServer());
  async function as(email: string) {
    const token = (await api().post('/api/auth/login').send({ email, password: DEMO_PASSWORD }).expect(200)).body.accessToken;
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    return {
      get: (url: string) => auth(api().get(url)),
      post: (url: string, body: object = {}) => auth(api().post(url)).send(body),
    };
  }
  let manager: Awaited<ReturnType<typeof as>>;
  let sale: Awaited<ReturnType<typeof as>>;

  const avg = async () => (await manager.get('/api/product-costs').expect(200)).body[productId] as number;
  const nhap = async (quantity: number, unitPrice: number) =>
    (await manager.post('/api/warehouse-vouchers', { type: 'NHAP', date: today, warehouseId: WH, lines: [{ productId, quantity, unitPrice }] }).expect(201)).body.id as string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    manager = await as('quan.ly@ninhtrang.local');
    sale = await as('sale1@ninhtrang.local');
    productId = (await manager.post('/api/products', { name: 'E2E Giá vốn bình quân', type: 'VAT_TU', baseUnit: 'Cái', retailPrice: 200_000 }).expect(201)).body.id;
    customerId = (await manager.post('/api/customers', { name: 'E2E Khách giá vốn', type: 'LE', creditDays: 0, tagIds: [] }).expect(201)).body.id;
  });

  afterAll(async () => {
    await prisma.salesReturn.deleteMany({ where: { orderId } });
    await prisma.warehouseVoucher.deleteMany({ where: { lines: { some: { productId } } } });
    await prisma.salesOrder.deleteMany({ where: { id: orderId } });
    await prisma.stockLevel.deleteMany({ where: { productId } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await app.close();
  });

  it('nhập 10 × 100.000 rồi 10 × 130.000: bình quân 115.000', async () => {
    await nhap(10, 100_000);
    expect(await avg()).toBe(100_000);
    await nhap(10, 130_000);
    expect(await avg()).toBe(115_000);
  });

  it('chức vụ không xem giá vốn không đọc được, và phiếu kho không lộ giá vốn', async () => {
    await sale.get('/api/product-costs').expect(403);
    const vouchers = (await manager.get('/api/warehouse-vouchers').expect(200)).body as { lines: Record<string, unknown>[] }[];
    expect(vouchers.flatMap((v) => v.lines).some((l) => 'unitCost' in l)).toBe(false);
    const products = (await sale.get('/api/products').expect(200)).body as Record<string, unknown>[];
    expect(products.some((p) => 'avgCost' in p)).toBe(false);
  });

  it('giao 4: phiếu xuất chốt 115.000; nhập rẻ sau đó không đổi giá đã chốt', async () => {
    const o = (await manager.post('/api/sales-orders', {
      customerId, tagIds: [], orderDate: today, discountAmount: 0,
      lines: [{ productId, unit: 'Cái', quantity: 4, unitPrice: 200_000, vatRate: 0, warehouseId: WH }],
    }).expect(201)).body;
    orderId = o.id;
    lineId = o.lines[0].id;
    await manager.post(`/api/sales-orders/${orderId}/deliver`, { date: today, items: [{ lineIndex: 0, quantity: 4, warehouseId: WH }] }).expect(200);
    const out = await prisma.warehouseVoucherLine.findFirst({ where: { productId, voucher: { salesOrderId: orderId, type: 'XUAT' } } });
    expect(out?.unitCost?.toNumber()).toBe(115_000);

    cheapId = await nhap(20, 85_000);
    // 16 × 115.000 + 20 × 85.000 = 3.540.000 / 36
    expect(await avg()).toBeCloseTo(98_333.3333, 3);
  });

  it('khách trả 2: nhập lại đúng giá đã xuất (115.000)', async () => {
    const r = (await manager.post(`/api/sales-orders/${orderId}/returns`, {
      date: today, warehouseId: WH, reason: 'Thử giá vốn', lines: [{ orderLineId: lineId, quantity: 2 }],
    }).expect(201)).body;
    const back = await prisma.warehouseVoucherLine.findFirst({ where: { voucherId: r.voucherId } });
    expect(back?.unitCost?.toNumber()).toBe(115_000);
    // (36 × 98.333,3333 + 2 × 115.000) / 38
    expect(await avg()).toBeCloseTo(99_210.5263, 3);
  });

  it('huỷ phiếu nhập 20 × 85.000: bình quân về như chưa nhập', async () => {
    await manager.post(`/api/warehouse-vouchers/${cheapId}/cancel`, { reason: 'Nhập nhầm' }).expect(200);
    expect(await avg()).toBeCloseTo(115_000, 2);
  });

  it('lãi gộp dùng giá vốn đã chốt: bán 4 trả 2 → giá vốn 2 × 115.000', async () => {
    const res = (await manager.get(`/api/reports/loi-nhuan?from=${today}&to=${today}&group=product`).expect(200)).body as { rows: { id: string; cost: number; net: number }[] };
    const row = res.rows.find((r) => r.id === productId);
    expect(row?.net).toBe(400_000);
    expect(row?.cost).toBe(230_000);
  });
});
