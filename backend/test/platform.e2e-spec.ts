// Nhiều doanh nghiệp: quản trị nền tảng (mật khẩu + mã xác thực), tạo doanh nghiệp mới trên một database
// riêng, đăng nhập theo mã doanh nghiệp, cách ly dữ liệu và phiên, tạm ngưng / mở lại, cấp lại mật khẩu.
// Needs a Postgres that lets DATABASE_URL's user CREATE DATABASE (the local one does; `prisma dev` does not —
// then this file skips). It creates nt_e2e_platform and nt_e2e_a, and drops both before each run.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { requestId } from '../src/monitoring/request-id.js';
import { withDatabase } from '../src/platform/secret-box.js';
import { totpCode, totpStep } from '../src/platform/totp.js';

const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
const MAIN_URL = process.env.DATABASE_URL!;
const PLATFORM_URL = withDatabase(MAIN_URL, 'nt_e2e_platform');
const OWNER = { email: 'owner@e2e.local', password: 'owner-pass-e2e-123' };
const ENV = {
  PLATFORM_DATABASE_URL: PLATFORM_URL,
  PLATFORM_SECRET: 'e2e-platform-secret-0123456789abcdef-xyz',
  PLATFORM_OWNER_EMAIL: OWNER.email,
  PLATFORM_OWNER_PASSWORD: OWNER.password,
  DEFAULT_TENANT_CODE: 'ninhtrang',
};

async function canCreateDatabases(): Promise<boolean> {
  const c = new pg.Client({ connectionString: MAIN_URL });
  try {
    await c.connect();
    const { rows } = await c.query('SELECT rolcreatedb OR rolsuper AS ok FROM pg_roles WHERE rolname = current_user');
    return rows[0]?.ok === true;
  } catch {
    return false;
  } finally {
    await c.end().catch(() => undefined);
  }
}

async function dropTestDatabases() {
  const c = new pg.Client({ connectionString: MAIN_URL });
  await c.connect();
  for (const db of ['nt_e2e_platform', 'nt_e2e_a']) await c.query(`DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`);
  await c.end();
}

const enabled = await canCreateDatabases();

describe.skipIf(!enabled)('Nhiều doanh nghiệp (e2e)', () => {
  let app: INestApplication;
  let owner = '';
  let secret = '';
  let usedStep = 0;
  const saved: Record<string, string | undefined> = {};

  const api = () => request(app.getHttpServer());
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const tenant = (code: string) => ({ 'X-Tenant': code });
  // A code no earlier request used: the platform refuses a replayed one.
  const nextCode = () => {
    usedStep = Math.max(usedStep + 1, totpStep() - 1);
    if (usedStep > totpStep() + 1) throw new Error('hết mã TOTP hợp lệ trong cửa sổ hiện tại');
    return totpCode(secret, usedStep);
  };

  beforeAll(async () => {
    await dropTestDatabases();
    for (const [k, v] of Object.entries(ENV)) {
      saved[k] = process.env[k];
      process.env[k] = v;
    }
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.use(requestId);
    app.setGlobalPrefix('api');
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('API của doanh nghiệp đòi mã doanh nghiệp; doanh nghiệp đầu tiên là database hiện có', async () => {
    expect((await api().get('/api/client-config').expect(200)).body.multiTenant).toBe(true);
    await api().get('/api/health').expect(200);
    const missing = await api().post('/api/auth/login').send({ email: 'admin@ninhtrang.local', password: ADMIN_PASSWORD }).expect(400);
    expect(missing.body.message).toContain('mã doanh nghiệp');
    await api().post('/api/auth/login').set(tenant('khong-co')).send({ email: 'admin@ninhtrang.local', password: ADMIN_PASSWORD }).expect(404);

    const res = await api().post('/api/auth/login').set(tenant('ninhtrang')).send({ email: 'admin@ninhtrang.local', password: ADMIN_PASSWORD }).expect(200);
    await api().get('/api/auth/me').set(tenant('ninhtrang')).set(bearer(res.body.accessToken)).expect(200);
  });

  it('Chủ nền tảng: mật khẩu, rồi đăng ký và nhập mã xác thực; mã đã dùng bị từ chối', async () => {
    await api().get('/api/platform/tenants').expect(401);
    expect((await api().get('/api/platform/status').expect(200)).body).toEqual({ multiTenant: true, ownerConfigured: true });
    await api().post('/api/platform/login').send({ email: OWNER.email, password: 'sai-mat-khau-123' }).expect(401);

    const enroll = await api().post('/api/platform/login').send(OWNER).expect(200);
    expect(enroll.body.step).toBe('enroll');
    expect(enroll.body.otpauthUrl).toContain(`secret=${enroll.body.secret}`);
    secret = enroll.body.secret;
    usedStep = totpStep() - 2;
    await api().post('/api/platform/login').send({ ...OWNER, code: '000000' === totpCode(secret, totpStep()) ? '111111' : '000000' }).expect(401);
    const first = await api().post('/api/platform/login').send({ ...OWNER, code: nextCode() }).expect(200);
    expect(first.body.step).toBe('done');

    expect((await api().post('/api/platform/login').send(OWNER).expect(200)).body).toEqual({ step: 'totp' });
    await api().post('/api/platform/login').send({ ...OWNER, code: totpCode(secret, usedStep) }).expect(401); // replay
    const again = await api().post('/api/platform/login').send({ ...OWNER, code: nextCode() }).expect(200);
    owner = again.body.accessToken;

    const list = await api().get('/api/platform/tenants').set(bearer(owner)).expect(200);
    expect(list.body.tenants.map((t: { code: string }) => t.code)).toEqual(['ninhtrang']);
    expect(list.body.tenants[0]).toMatchObject({ status: 'ACTIVE', managed: false, needsMigration: false });
    expect(JSON.stringify(list.body)).not.toMatch(/postgres(ql)?:\/\//);
  });

  it('Phiên doanh nghiệp không vào được quản trị nền tảng, và ngược lại', async () => {
    const t = (await api().post('/api/auth/login').set(tenant('ninhtrang')).send({ email: 'admin@ninhtrang.local', password: ADMIN_PASSWORD })).body.accessToken;
    await api().get('/api/platform/tenants').set(bearer(t)).expect(401);
    await api().get('/api/auth/me').set(tenant('ninhtrang')).set(bearer(owner)).expect(401);
  });

  it('Tạo doanh nghiệp mới: kiểm tra mã, tạo database, đăng nhập riêng, dữ liệu tách biệt', async () => {
    const body = { code: 'e2e-a', name: 'Công ty E2E A', adminEmail: 'giam.doc@e2e-a.local' };
    await api().post('/api/platform/tenants').set(bearer(owner)).send({ ...body, code: 'E2E A' }).expect(400);
    await api().post('/api/platform/tenants').set(bearer(owner)).send({ ...body, code: 'admin' }).expect(400);
    await api().post('/api/platform/tenants').set(bearer(owner)).send({ ...body, code: 'ninhtrang' }).expect(409);

    const created = await api().post('/api/platform/tenants').set(bearer(owner)).send(body).expect(201);
    expect(created.body.tenant).toMatchObject({ code: 'e2e-a', status: 'PROVISIONING', managed: true, dbName: 'nt_e2e_a' });
    const password = created.body.adminPassword as string;
    expect(password).toMatch(/^(?=.*[a-zA-Z])(?=.*\d).{12}$/);

    // While it is being created nobody can sign in to it.
    await api().post('/api/auth/login').set(tenant('e2e-a')).send({ email: body.adminEmail, password }).expect(503);
    let status = 'PROVISIONING';
    for (let i = 0; i < 120 && status === 'PROVISIONING'; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const list = await api().get('/api/platform/tenants').set(bearer(owner));
      const row = list.body.tenants.find((t: { code: string }) => t.code === 'e2e-a');
      status = row.status;
      if (status === 'FAILED') throw new Error(row.lastError);
    }
    expect(status).toBe('ACTIVE');

    const login = await api().post('/api/auth/login').set(tenant('e2e-a')).send({ email: body.adminEmail, password }).expect(200);
    expect(login.body.user).toMatchObject({ roleId: 'role-ceo', mustChangePassword: true });
    // Same password, wrong doanh nghiệp: that account does not exist there.
    await api().post('/api/auth/login').set(tenant('ninhtrang')).send({ email: body.adminEmail, password }).expect(401);

    const changed = await api().post('/api/auth/change-password').set(tenant('e2e-a')).set(bearer(login.body.accessToken))
      .send({ currentPassword: password, newPassword: 'MatKhauMoi2026' }).expect(200);
    const a = changed.body.accessToken as string;
    expect((await api().get('/api/company').set(tenant('e2e-a')).set(bearer(a)).expect(200)).body.name).toBe('Công ty E2E A');
    expect((await api().get('/api/customers').set(tenant('e2e-a')).set(bearer(a)).expect(200)).body).toEqual([]);
    const warehouses = (await api().get('/api/warehouses').set(tenant('e2e-a')).set(bearer(a)).expect(200)).body;
    expect(warehouses.map((w: { name: string }) => w.name)).toEqual(['Kho chính']);

    // A token is bound to its doanh nghiệp: e2e-a's token is refused with X-Tenant ninhtrang.
    await api().get('/api/customers').set(tenant('ninhtrang')).set(bearer(a)).expect(401);
    const main = (await api().post('/api/auth/login').set(tenant('ninhtrang')).send({ email: 'admin@ninhtrang.local', password: ADMIN_PASSWORD })).body.accessToken;
    expect((await api().get('/api/customers').set(tenant('ninhtrang')).set(bearer(main)).expect(200)).body.length).toBeGreaterThan(0);
    await api().get('/api/customers').set(tenant('e2e-a')).set(bearer(main)).expect(401);
  }, 180_000);

  it('Tạm ngưng chặn đăng nhập và thao tác; mở lại thì dùng tiếp', async () => {
    await api().post('/api/platform/tenants/e2e-a/suspend').set(bearer(owner)).expect(200);
    const refused = await api().post('/api/auth/login').set(tenant('e2e-a')).send({ email: 'giam.doc@e2e-a.local', password: 'MatKhauMoi2026' }).expect(403);
    expect(refused.body.message).toContain('tạm ngưng');
    await api().post('/api/platform/tenants/e2e-a/suspend').set(bearer(owner)).expect(400);
    await api().post('/api/platform/tenants/e2e-a/reopen').set(bearer(owner)).expect(200);
    await api().post('/api/auth/login').set(tenant('e2e-a')).send({ email: 'giam.doc@e2e-a.local', password: 'MatKhauMoi2026' }).expect(200);
  });

  it('Đường /API viết hoa vẫn qua kiểm tra doanh nghiệp: doanh nghiệp đầu tiên tạm ngưng thì không vào được', async () => {
    const admin = { email: 'admin@ninhtrang.local', password: ADMIN_PASSWORD };
    const main = (await api().post('/api/auth/login').set(tenant('ninhtrang')).send(admin).expect(200)).body.accessToken as string;
    await api().post('/api/platform/tenants/ninhtrang/suspend').set(bearer(owner)).expect(200);
    try {
      for (const path of ['/API/auth/login', '/Api/Auth/Login']) {
        await api().post(path).send(admin).expect(400); // no X-Tenant: not a login on DATABASE_URL
        await api().post(path).set(tenant('ninhtrang')).send(admin).expect(403);
      }
      await api().get('/API/customers').set(bearer(main)).expect(400);
      await api().post('/API/customers').set(tenant('ninhtrang')).set(bearer(main)).send({ name: 'Không được tạo' }).expect(403);
    } finally {
      await api().post('/api/platform/tenants/ninhtrang/reopen').set(bearer(owner)).expect(200);
    }
    await api().get('/API/auth/me').set(tenant('ninhtrang')).set(bearer(main)).expect(200);
  });

  it('Cấp lại mật khẩu quản trị, đổi tên, cập nhật cấu trúc; mọi việc vào nhật ký nền tảng', async () => {
    const reset = await api().post('/api/platform/tenants/e2e-a/reset-password').set(bearer(owner)).send({}).expect(200);
    expect(reset.body.email).toBe('giam.doc@e2e-a.local');
    await api().post('/api/auth/login').set(tenant('e2e-a')).send({ email: 'giam.doc@e2e-a.local', password: 'MatKhauMoi2026' }).expect(401);
    const again = await api().post('/api/auth/login').set(tenant('e2e-a')).send({ email: 'giam.doc@e2e-a.local', password: reset.body.password }).expect(200);
    expect(again.body.user.mustChangePassword).toBe(true);
    await api().post('/api/platform/tenants/e2e-a/reset-password').set(bearer(owner)).send({ email: 'khong.co@e2e-a.local' }).expect(404);

    expect((await api().patch('/api/platform/tenants/e2e-a').set(bearer(owner)).send({ name: 'Công ty E2E A (mới)' }).expect(200)).body.name).toBe('Công ty E2E A (mới)');
    const migrated = await api().post('/api/platform/tenants/ninhtrang/migrate').set(bearer(owner)).expect(200);
    expect(migrated.body.needsMigration).toBe(false);

    const audit = (await api().get('/api/platform/audit').set(bearer(owner)).expect(200)).body as { action: string }[];
    const actions = new Set(audit.map((r) => r.action));
    for (const a of ['owner.login', 'owner.login_failed', 'owner.totp_enroll', 'tenant.create', 'tenant.ready', 'tenant.suspend', 'tenant.reopen', 'tenant.reset_password', 'tenant.rename', 'tenant.migrate']) {
      expect(actions.has(a), a).toBe(true);
    }
  }, 120_000);
});
