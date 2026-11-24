// Hệ thống tài khoản: thêm / sửa / ngừng dùng / xoá. TK chuẩn (seed TT133, isSystem) chỉ đổi được tên và không xoá được;
// TK người dùng tự thêm thì sửa/xoá đầy đủ, nhưng không xoá khi đã có số dư đầu kỳ / bút toán / TK con.
// Chạy trên database riêng nt_qa_accounts (tạo lại mỗi lần).
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { createDatabase } from '../src/platform/platform-db.service.js';
import { withDatabase } from '../src/platform/secret-box.js';
import { errorTail, migrateDeploy, runScript } from '../src/platform/tenant-commands.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const MAIN_URL = process.env.DATABASE_URL!;
const QA_DB = 'nt_qa_accounts';
const QA_URL = withDatabase(MAIN_URL, QA_DB);
const PASSWORD = 'QaMatKhau2026';

async function freshQaDatabase(): Promise<void> {
  const c = new pg.Client({ connectionString: MAIN_URL });
  await c.connect();
  await c.query(`DROP DATABASE IF EXISTS "${QA_DB}" WITH (FORCE)`);
  await c.end();
  await createDatabase(MAIN_URL, QA_DB);
  const steps = [
    () => migrateDeploy(QA_URL),
    () => runScript('prisma/seed.ts', { DATABASE_URL: QA_URL, SEED_ADMIN_PASSWORD: PASSWORD }),
    () => runScript('prisma/seed-demo.ts', { DATABASE_URL: QA_URL, DEMO_USER_PASSWORD: PASSWORD, SEED_DEMO: 'true', NODE_ENV: 'test' }),
  ];
  for (const step of steps) {
    const r = await step();
    if (!r.ok) throw new Error(errorTail(r.output));
  }
}

describe('Hệ thống tài khoản — CRUD (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let savedUrl: string | undefined;
  const api = () => request(app.getHttpServer());
  async function as(email: string) {
    const token = (await api().post('/api/auth/login').send({ email, password: PASSWORD }).expect(200)).body.accessToken;
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    return {
      get: (url: string) => auth(api().get(url)),
      post: (url: string, body: object = {}) => auth(api().post(url)).send(body),
      patch: (url: string, body: object = {}) => auth(api().patch(url)).send(body),
      del: (url: string) => auth(api().delete(url)),
    };
  }
  let manager: Awaited<ReturnType<typeof as>>;
  let sale: Awaited<ReturnType<typeof as>>;

  beforeAll(async () => {
    await freshQaDatabase();
    savedUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = QA_URL;
    delete process.env.PLATFORM_DATABASE_URL;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    manager = await as('quan.ly@ninhtrang.local');
    sale = await as('sale1@ninhtrang.local');
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    process.env.DATABASE_URL = savedUrl;
  });

  const find = async (code: string) => {
    const rows = (await manager.get('/api/accounting/accounts').expect(200)).body as { code: string; isSystem: boolean; isActive: boolean; name: string; kind: string }[];
    return rows.find((r) => r.code === code);
  };

  it('tài khoản seed đều là tài khoản hệ thống', async () => {
    const a111 = await find('111');
    expect(a111?.isSystem).toBe(true);
  });

  it('thêm được tài khoản mới (isSystem = false)', async () => {
    const r = await manager.post('/api/accounting/accounts', { code: '9998', name: 'TK thử nghiệm', kind: 'TAI_SAN', normalSide: 'NO', isDetail: true }).expect(201);
    expect(r.body.isSystem).toBe(false);
    expect((await find('9998'))?.name).toBe('TK thử nghiệm');
  });

  it('không cho trùng số hiệu, không cho số hiệu sai định dạng', async () => {
    await manager.post('/api/accounting/accounts', { code: '9998', name: 'x', kind: 'TAI_SAN', normalSide: 'NO', isDetail: true }).expect(409);
    await manager.post('/api/accounting/accounts', { code: 'ab', name: 'x', kind: 'TAI_SAN', normalSide: 'NO', isDetail: true }).expect(400);
  });

  it('sửa được tài khoản tự thêm', async () => {
    await manager.patch('/api/accounting/accounts/9998', { name: 'TK thử nghiệm 2', kind: 'DOANH_THU', normalSide: 'CO', isDetail: true }).expect(200);
    const a = await find('9998');
    expect(a?.name).toBe('TK thử nghiệm 2');
    expect(a?.kind).toBe('DOANH_THU');
  });

  it('TK chuẩn chỉ đổi được tên, không đổi cấu trúc', async () => {
    await manager.patch('/api/accounting/accounts/111', { name: 'Tiền mặt (sửa)', kind: 'DOANH_THU', normalSide: 'CO', isDetail: false }).expect(200);
    const a = await find('111');
    expect(a?.name).toBe('Tiền mặt (sửa)');
    expect(a?.kind).toBe('TAI_SAN'); // cấu trúc giữ nguyên
  });

  it('ngừng dùng / dùng lại', async () => {
    await manager.patch('/api/accounting/accounts/9998/active', { isActive: false }).expect(200);
    expect((await find('9998'))?.isActive).toBe(false);
    await manager.patch('/api/accounting/accounts/9998/active', { isActive: true }).expect(200);
    expect((await find('9998'))?.isActive).toBe(true);
  });

  it('không xoá được khi còn số dư đầu kỳ', async () => {
    await manager.post('/api/accounting/opening-balances', { period: '2026', rows: [{ accountCode: '9998', debit: 100000, credit: 0 }] }).expect(201);
    await manager.del('/api/accounting/accounts/9998').expect(409);
    // Gỡ số dư rồi xoá được.
    await prisma.openingBalance.deleteMany({ where: { accountCode: '9998' } });
    await manager.del('/api/accounting/accounts/9998').expect(204);
    expect(await find('9998')).toBeUndefined();
  });

  it('không xoá được tài khoản chuẩn', async () => {
    await manager.del('/api/accounting/accounts/111').expect(409);
    expect(await find('111')).toBeDefined();
  });

  it('người không có quyền manage_account bị từ chối', async () => {
    await sale.post('/api/accounting/accounts', { code: '9990', name: 'x', kind: 'TAI_SAN', normalSide: 'NO', isDetail: true }).expect(403);
  });
});
