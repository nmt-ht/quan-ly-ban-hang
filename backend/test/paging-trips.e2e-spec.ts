// Pha 1.1 — danh sách chuyến giao theo trang, nạp chuyến theo kỳ (chưa xong + 90 ngày), đọc chuyến cũ theo id.
// Needs the demo seed. Creates two chuyến (one made old and completed); removed in afterAll.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { vnDay } from '../src/common/text.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
const today = vnDay();
const DRIVER = 'E2E Tài Xế Phân Trang Đặc Biệt';

describe('Phân trang chuyến giao (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tripIds: string[] = [];
  let openTripId = '';
  let oldTripId = '';

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

    const makeTrip = async () => {
      const t = (await manager.post('/api/delivery-trips', { date: today, driverName: DRIVER, plateNumber: '51C-999.99' }).expect(201)).body;
      tripIds.push(t.id);
      return t.id as string;
    };
    openTripId = await makeTrip(); // còn gom đơn (GOM_DON)
    oldTripId = await makeTrip();
    // Chuyến cũ: hoàn tất và lập từ 2025 (ngoài cửa sổ 90 ngày, đã đóng).
    await prisma.deliveryTrip.update({ where: { id: oldTripId }, data: { status: 'HOAN_TAT', date: new Date('2025-01-15') } });
  });

  afterAll(async () => {
    await prisma.deliveryTrip.deleteMany({ where: { id: { in: tripIds } } });
    await app.close();
  });

  it('một trang: tìm theo tài xế, đếm theo trạng thái / tài xế, cắt trang', async () => {
    const res = (await manager.get(`/api/delivery-trips/page?q=${encodeURIComponent(DRIVER)}&sort=date&dir=desc&pageSize=1`).expect(200)).body;
    expect(res.total).toBe(2);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].id).toBe(openTripId); // mới nhất trước
    expect(res.statusCounts.GOM_DON).toBe(1);
    expect(res.statusCounts.HOAN_TAT).toBe(1);
    expect(res.driverCounts[DRIVER]).toBe(2);
    const second = (await manager.get(`/api/delivery-trips/page?q=${encodeURIComponent(DRIVER)}&sort=date&dir=desc&pageSize=1&page=2`).expect(200)).body;
    expect(second.rows.map((t: { id: string }) => t.id)).toEqual([oldTripId]);
  });

  it('lọc theo trạng thái: chỉ lấy đúng trạng thái, số đếm trạng thái không bị che', async () => {
    const res = (await manager.get(`/api/delivery-trips/page?q=${encodeURIComponent(DRIVER)}&status=HOAN_TAT`).expect(200)).body;
    expect(res.total).toBe(1);
    expect(res.rows[0].id).toBe(oldTripId);
    expect(res.statusCounts.GOM_DON).toBe(1);
  });

  it('nạp theo kỳ: chưa xong + 90 ngày không có chuyến cũ đã hoàn tất; đọc được theo id', async () => {
    const recent = (await manager.get('/api/delivery-trips?recentDays=90').expect(200)).body as { id: string }[];
    const ids = recent.map((t) => t.id);
    expect(ids).toContain(openTripId);
    expect(ids).not.toContain(oldTripId);
    const byId = (await manager.get(`/api/delivery-trips?ids=${oldTripId}`).expect(200)).body as { id: string }[];
    expect(byId.map((t) => t.id)).toContain(oldTripId);
  });
});
