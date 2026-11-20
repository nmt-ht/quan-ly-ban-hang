// Pha 1.1 — danh sách lệnh sản xuất theo trang, nạp lệnh theo kỳ (còn mở + 90 ngày), đọc lệnh cũ theo id / theo đơn.
// Needs the demo seed. Creates one thành phẩm and two đơn bán (one lệnh made old and completed); removed in afterAll.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { vnDay } from '../src/common/text.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
const today = vnDay();

describe('Phân trang lệnh sản xuất (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let productId = '';
  const orderIds: string[] = [];
  let openLsxId = '';
  let oldLsxId = '';
  let oldOrderId = '';

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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    manager = await as('quan.ly@ninhtrang.local');
    productId = (await manager.post('/api/products', { name: 'E2E TP Phân Trang Lệnh', type: 'THANH_PHAM', baseUnit: 'Cái', retailPrice: 100_000 }).expect(201)).body.id;

    const makeOrderWithLsx = async () => {
      const o = (await manager.post('/api/sales-orders', {
        customerId: 'kh-01', tagIds: [], orderDate: today, discountAmount: 0, lines: [{ productId, unit: 'Cái', quantity: 2, unitPrice: 100_000 }],
      }).expect(201)).body;
      orderIds.push(o.id);
      const lsx = (await manager.post(`/api/sales-orders/${o.id}/production-orders`).expect(201)).body.created[0];
      return { orderId: o.id as string, lsxId: lsx.id as string };
    };
    openLsxId = (await makeOrderWithLsx()).lsxId; // còn mở (Nháp)
    const old = await makeOrderWithLsx();
    oldLsxId = old.lsxId;
    oldOrderId = old.orderId;
    // Lệnh cũ: hoàn tất và lập từ 2025 (ngoài cửa sổ 90 ngày, đã đóng).
    await prisma.productionOrder.update({ where: { id: oldLsxId }, data: { status: 'HOAN_TAT', createdAt: new Date('2025-01-15') } });
  });

  afterAll(async () => {
    await prisma.productionOrder.deleteMany({ where: { sourceOrderId: { in: orderIds } } });
    await prisma.salesOrder.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await app.close();
  });

  it('một trang: lọc theo thành phẩm, đếm theo trạng thái và thành phẩm, cắt trang', async () => {
    const res = (await manager.get(`/api/production-orders/page?productIds=${productId}&sort=createdDate&dir=desc&pageSize=1`).expect(200)).body;
    expect(res.total).toBe(2);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].id).toBe(openLsxId); // mới nhất trước
    expect(res.statusCounts.NHAP).toBe(1);
    expect(res.statusCounts.HOAN_TAT).toBe(1);
    expect(res.productCounts[productId]).toBe(2);
    const second = (await manager.get(`/api/production-orders/page?productIds=${productId}&sort=createdDate&dir=desc&pageSize=1&page=2`).expect(200)).body;
    expect(second.rows.map((x: { id: string }) => x.id)).toEqual([oldLsxId]);
  });

  it('lọc theo trạng thái: chỉ lấy đúng trạng thái, tổng và đếm vẫn của phần khớp các lọc khác', async () => {
    const res = (await manager.get(`/api/production-orders/page?productIds=${productId}&status=HOAN_TAT`).expect(200)).body;
    expect(res.total).toBe(1);
    expect(res.rows[0].id).toBe(oldLsxId);
    expect(res.statusCounts.NHAP).toBe(1); // số đếm tab không bị lọc trạng thái che
  });

  it('nạp theo kỳ: còn mở + 90 ngày không có lệnh cũ đã hoàn tất; đọc được theo id và theo đơn', async () => {
    const recent = (await manager.get('/api/production-orders?recentDays=90').expect(200)).body as { id: string }[];
    const ids = recent.map((x) => x.id);
    expect(ids).toContain(openLsxId);
    expect(ids).not.toContain(oldLsxId);
    const byId = (await manager.get(`/api/production-orders?ids=${oldLsxId}`).expect(200)).body as { id: string }[];
    expect(byId.map((x) => x.id)).toContain(oldLsxId);
    const ofOrder = (await manager.get(`/api/production-orders?sourceOrderId=${oldOrderId}`).expect(200)).body as { id: string }[];
    expect(ofOrder.map((x) => x.id)).toEqual([oldLsxId]);
  });
});
