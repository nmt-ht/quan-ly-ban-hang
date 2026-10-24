// Pha 0 — bảo mật: giá vốn theo quyền, đổi mật khẩu, giới hạn số lần đăng nhập.
// Needs the demo seed (npm run prisma:seed && DEMO_USER_PASSWORD=demo1234 npm run prisma:seed:demo).
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { requestId } from '../src/monitoring/request-id.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

describe('Bảo mật (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userIds: string[] = [];

  const api = () => request(app.getHttpServer());
  const login = async (email: string, password = DEMO_PASSWORD) => (await api().post('/api/auth/login').send({ email, password })).body.accessToken as string;
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.use(requestId);
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    delete process.env.E2E_THROTTLE;
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  async function makeUser(suffix: string, password: string, mustChange = false) {
    const u = await prisma.user.create({
      data: {
        name: `E2E ${suffix}`, email: `e2e.sec.${suffix}@ninhtrang.local`, roleId: 'role-sale',
        passwordHash: await bcrypt.hash(password, 10), mustChangePassword: mustChange,
      },
    });
    userIds.push(u.id);
    return u;
  }

  it('GET /product-costs: giá vốn chỉ cho chức vụ có quyền xem giá vốn / giá trị tồn', async () => {
    const admin = await login('admin@ninhtrang.local', ADMIN_PASSWORD);
    const res = await api().get('/api/product-costs').set(bearer(admin)).expect(200);
    expect(Object.keys(res.body).length).toBeGreaterThan(0);
    expect(Object.values(res.body).every((v) => typeof v === 'number')).toBe(true);

    for (const email of ['sale1@ninhtrang.local', 'thu.kho@ninhtrang.local']) {
      const token = await login(email);
      await api().get('/api/product-costs').set(bearer(token)).expect(403);
    }
    await api().get('/api/product-costs').expect(401);
  });

  it('đổi mật khẩu: sai mật khẩu cũ → 400, chính sách mật khẩu, phiên cũ bị thu hồi, token mới dùng được', async () => {
    const u = await makeUser('pw', 'OldPass123', true);
    const old = await login(u.email, 'OldPass123');
    const me = await api().get('/api/auth/me').set(bearer(old)).expect(200);
    expect(me.body.mustChangePassword).toBe(true);
    // Chưa đổi mật khẩu: mọi API khác bị chặn ở máy chủ, không chỉ ở giao diện.
    const blocked = await api().get('/api/customers').set(bearer(old)).expect(403);
    expect(blocked.body.message).toContain('đổi mật khẩu');

    await api().post('/api/auth/change-password').set(bearer(old)).send({ currentPassword: 'Sai12345', newPassword: 'NewPass123' }).expect(400);
    await api().post('/api/auth/change-password').set(bearer(old)).send({ currentPassword: 'OldPass123', newPassword: 'short1' }).expect(400);
    await api().post('/api/auth/change-password').set(bearer(old)).send({ currentPassword: 'OldPass123', newPassword: 'onlyletters' }).expect(400);
    await api().post('/api/auth/change-password').set(bearer(old)).send({ currentPassword: 'OldPass123', newPassword: 'OldPass123' }).expect(400);
    await api().post('/api/auth/change-password').send({ currentPassword: 'OldPass123', newPassword: 'NewPass123' }).expect(401);

    // wait out the second boundary so the "issued before revoke" check is unambiguous
    await new Promise((r) => setTimeout(r, 1100));
    const res = await api().post('/api/auth/change-password').set(bearer(old)).send({ currentPassword: 'OldPass123', newPassword: 'NewPass123' }).expect(200);
    expect(res.body.user.mustChangePassword).toBe(false);

    await api().get('/api/auth/me').set(bearer(old)).expect(401); // phiên cũ đã bị đăng xuất
    await api().get('/api/auth/me').set(bearer(res.body.accessToken)).expect(200);
    await api().get('/api/customers').set(bearer(res.body.accessToken)).expect(200);
    await api().post('/api/auth/login').send({ email: u.email, password: 'OldPass123' }).expect(401);
    await api().post('/api/auth/login').send({ email: u.email, password: 'NewPass123' }).expect(200);

    const log = await prisma.auditLog.findFirst({ where: { action: 'auth.change_password', entityId: u.id } });
    expect(log).not.toBeNull();
  });

  it('đăng nhập: quá giới hạn thử cho một tài khoản → 429, tài khoản khác vẫn vào được', async () => {
    process.env.E2E_THROTTLE = '1';
    const u = await makeUser('throttle', 'Throttle123');
    const other = await makeUser('throttle-other', 'Throttle123');
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) statuses.push((await api().post('/api/auth/login').send({ email: u.email, password: 'Wrong12345' })).status);
    expect(statuses.slice(0, 8).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(8)).toEqual([429, 429]);
    // even the right password is refused while the brake is on
    await api().post('/api/auth/login').send({ email: u.email, password: 'Throttle123' }).expect(429);
    await api().post('/api/auth/login').send({ email: other.email, password: 'Throttle123' }).expect(200);
    delete process.env.E2E_THROTTLE;
  });

  it('/api/health và /api/client-config mở công khai; mỗi phản hồi có X-Request-Id', async () => {
    const res = await api().get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'ok' });
    expect(res.headers['x-request-id']).toMatch(/^[\w.-]{8,64}$/);
    const mine = await api().get('/api/health').set('X-Request-Id', 'abc12345-test').expect(200);
    expect(mine.headers['x-request-id']).toBe('abc12345-test');
    const cfg = await api().get('/api/client-config').expect(200);
    expect(cfg.body).toHaveProperty('sentryDsn');
  });
});
