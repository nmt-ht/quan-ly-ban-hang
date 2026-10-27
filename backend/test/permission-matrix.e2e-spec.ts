// Kiểm thử phân quyền toàn bộ API: mọi route × mọi chức vụ (7 chức vụ mặc định, một chức vụ không có quyền nào,
// người chưa đăng nhập, tài khoản đang buộc đổi mật khẩu), cộng các kịch bản theo chức vụ (đăng nhập, khoá
// tài khoản, gỡ quyền có hiệu lực ngay, phạm vi dữ liệu Sale / Thủ kho, token giả, nhật ký đủ).
//
// Chạy trên database riêng nt_qa_matrix (tạo lại mỗi lần: migrate + seed + dữ liệu demo), nên các lệnh ghi
// không chạm dữ liệu đang dùng. Cần Postgres cho phép tạo database (máy local, CI); không được thì bỏ qua.
// QA_REPORT=<file.json> ghi lại từng test case (bước, kết quả mong đợi, kết quả thực tế) để xuất Excel.
import 'dotenv/config';
import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { ModulesContainer } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { ANY_PERMISSIONS_KEY, PERMISSIONS_KEY } from '../src/auth/permissions.decorator.js';
import { requestId } from '../src/monitoring/request-id.js';
import { OPS_DEFS } from '../src/modules/reports/defs/ops.defs.js';
import { SALES_DEFS } from '../src/modules/reports/defs/sales.defs.js';
import { STOCK_DEFS } from '../src/modules/reports/defs/stock.defs.js';
import { GROUP_PERMISSION } from '../src/modules/reports/report.types.js';
import { createDatabase } from '../src/platform/platform-db.service.js';
import { withDatabase } from '../src/platform/secret-box.js';
import { BACKEND_ROOT, errorTail, migrateDeploy, runScript } from '../src/platform/tenant-commands.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const MAIN_URL = process.env.DATABASE_URL!;
const QA_DB = 'nt_qa_matrix';
const QA_URL = withDatabase(MAIN_URL, QA_DB);
const QA_PASS = 'QaMatKhau2026';
const FAKE_ID = 'qa-khong-ton-tai';

// Seven built-in roles (prisma/seed.ts) and how many permissions each has by default.
const ROLES = [
  { id: 'role-ceo', name: 'CEO', count: 112 },
  { id: 'role-manager', name: 'Quản lý', count: 103 },
  { id: 'role-accountant', name: 'Kế toán', count: 52 },
  { id: 'role-sale', name: 'Sale', count: 20 },
  { id: 'role-thukho', name: 'Thủ kho', count: 19 },
  { id: 'role-giaohang', name: 'Nhân viên giao hàng', count: 6 },
  { id: 'role-xuong', name: 'Nhân viên xưởng', count: 5 },
];

// Copy of audit.controller.ts › VIEW_PERMISSION (not exported): who may read a record's Lịch sử tab.
const HISTORY_PERMISSION: Record<string, string> = {
  SalesOrder: 'order.view', ProductionOrder: 'production.view', PurchaseOrder: 'purchase.view',
  DeliveryTrip: 'trip.view', WarehouseVoucher: 'stock.view', CashVoucher: 'voucher.view',
  CashAccount: 'voucher.view', CashCategory: 'voucher.view', Customer: 'customer.view',
  Supplier: 'supplier.view', Product: 'product.view', Vehicle: 'vehicle.view', User: 'user.view',
  Role: 'position.view', Tag: 'tag.view', Warehouse: 'warehouse.view', ProductCategory: 'category.view',
  CompanyInfo: 'company.view',
};

const MODULE_NAMES: Record<string, string> = {
  auth: 'Đăng nhập', users: 'Người dùng', roles: 'Chức vụ & phân quyền', permissions: 'Chức vụ & phân quyền', company: 'Thông tin công ty',
  tags: 'Thẻ', categories: 'Nhóm hàng', warehouses: 'Kho', products: 'Hàng hoá', 'bom-lines': 'Định mức', 'price-lists': 'Bảng giá',
  promotions: 'Khuyến mãi', customers: 'Khách hàng', suppliers: 'Nhà cung cấp', 'supplier-products': 'Nhà cung cấp', vehicles: 'Xe',
  'cash-accounts': 'Thu chi', 'cash-categories': 'Thu chi', 'cash-vouchers': 'Thu chi', 'stock-levels': 'Kho', 'warehouse-vouchers': 'Kho',
  'purchase-orders': 'Mua hàng', 'purchase-returns': 'Mua hàng', 'sales-orders': 'Bán hàng', quotations: 'Báo giá', 'production-orders': 'Sản xuất',
  'delivery-trips': 'Giao hàng', receivables: 'Công nợ', payables: 'Công nợ', dashboard: 'Tổng quan', reports: 'Báo cáo',
  'product-costs': 'Giá vốn', 'audit-logs': 'Nhật ký hoạt động', health: 'Hệ thống', 'client-config': 'Hệ thống', platform: 'Nền tảng',
};

export interface QaCase {
  id: string;
  group: string;
  module: string;
  title: string;
  role: string;
  steps: string[];
  expected: string;
  actual: string;
  result: 'Đạt' | 'Không đạt';
  note?: string;
}

interface Route {
  method: string;
  path: string; // with :params, after the global prefix
  all: string[];
  any: string[];
  jwt: boolean;
  allowPending: boolean;
  controller: string;
}

interface Actor {
  key: string;
  label: string;
  token: string | null;
  perms: Set<string>;
  pending?: boolean; // mustChangePassword
}

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

async function freshQaDatabase(): Promise<void> {
  const c = new pg.Client({ connectionString: MAIN_URL });
  await c.connect();
  await c.query(`DROP DATABASE IF EXISTS "${QA_DB}" WITH (FORCE)`);
  await c.end();
  await createDatabase(MAIN_URL, QA_DB);
  const steps = [
    () => migrateDeploy(QA_URL),
    () => runScript('prisma/seed.ts', { DATABASE_URL: QA_URL, SEED_ADMIN_PASSWORD: QA_PASS }),
    () => runScript('prisma/seed-demo.ts', { DATABASE_URL: QA_URL, DEMO_USER_PASSWORD: QA_PASS, SEED_DEMO: 'true', NODE_ENV: 'test' }),
  ];
  for (const step of steps) {
    const r = await step();
    if (!r.ok) throw new Error(errorTail(r.output));
  }
}

const METHOD_NAME: Record<number, string> = {
  [RequestMethod.GET]: 'GET', [RequestMethod.POST]: 'POST', [RequestMethod.PUT]: 'PUT',
  [RequestMethod.PATCH]: 'PATCH', [RequestMethod.DELETE]: 'DELETE',
};

/** Every route the app serves, with the guards and permission codes Nest will apply to it. */
function routesOf(app: INestApplication): Route[] {
  const routes: Route[] = [];
  for (const mod of app.get(ModulesContainer).values()) {
    for (const wrapper of mod.controllers.values()) {
      const type = wrapper.metatype as (new (...a: unknown[]) => unknown) | null;
      if (!type) continue;
      const base = ([] as string[]).concat(Reflect.getMetadata(PATH_METADATA, type) ?? '')[0];
      const classGuards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, type) ?? [];
      for (const name of Object.getOwnPropertyNames(type.prototype)) {
        const handler = type.prototype[name];
        if (typeof handler !== 'function' || name === 'constructor') continue;
        const method = Reflect.getMetadata(METHOD_METADATA, handler);
        if (method === undefined) continue;
        const sub = ([] as string[]).concat(Reflect.getMetadata(PATH_METADATA, handler) ?? '')[0];
        const guards = [...classGuards, ...(Reflect.getMetadata(GUARDS_METADATA, handler) ?? [])].map((g) => (g as { name?: string }).name ?? '');
        const meta = <T>(key: string): T | undefined => Reflect.getMetadata(key, handler) ?? Reflect.getMetadata(key, type);
        const path = `/api/${[base, sub].filter(Boolean).join('/')}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/api';
        routes.push({
          method: METHOD_NAME[method] ?? String(method),
          path,
          all: meta<string[]>(PERMISSIONS_KEY) ?? [],
          any: meta<string[]>(ANY_PERMISSIONS_KEY) ?? [],
          jwt: guards.includes('JwtAuthGuard'),
          allowPending: meta<boolean>('allowPendingPassword') === true,
          controller: type.name,
        });
      }
    }
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

const moduleOf = (path: string) => MODULE_NAMES[path.split('/')[2] ?? ''] ?? path.split('/')[2] ?? '';
const permText = (r: { all: string[]; any: string[] }) =>
  [r.all.length ? `cần tất cả: ${r.all.join(', ')}` : '', r.any.length ? `cần một trong: ${r.any.join(', ')}` : ''].filter(Boolean).join('; ') ||
  'chỉ cần đăng nhập';

const enabled = await canCreateDatabases();

describe.skipIf(!enabled)('Ma trận phân quyền & kịch bản theo chức vụ (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cases: QaCase[] = [];
  const actors: Actor[] = [];
  const userIds: Record<string, string> = {};
  let savedUrl: string | undefined;
  let seq = 0;

  const api = () => request(app.getHttpServer());
  const bearer = (t: string | null) => (t ? { Authorization: `Bearer ${t}` } : {});
  const login = async (email: string, password = QA_PASS) => api().post('/api/auth/login').send({ email, password });
  const tokenOf = (key: string) => actors.find((a) => a.key === key)!.token!;

  /** One scenario: its steps, then `check` returns [passed, what actually happened]. */
  async function scenario(c: Omit<QaCase, 'id' | 'group' | 'actual' | 'result'>, check: () => Promise<[boolean, string]>) {
    let ok = false;
    let actual = '';
    try {
      [ok, actual] = await check();
    } catch (e) {
      actual = `Lỗi khi chạy: ${e instanceof Error ? e.message : String(e)}`;
    }
    cases.push({ id: `KB-${String(++seq).padStart(3, '0')}`, group: 'Kịch bản theo chức vụ', ...c, actual, result: ok ? 'Đạt' : 'Không đạt' });
    return ok;
  }

  beforeAll(async () => {
    await freshQaDatabase();
    savedUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = QA_URL;
    delete process.env.PLATFORM_DATABASE_URL;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.use(requestId);
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);

    // One account per built-in role, one for a role with no permission at all, one that must change its password.
    const hash = await bcrypt.hash(QA_PASS, 10);
    await prisma.role.create({ data: { id: 'role-qa-none', name: 'QA Không quyền', description: 'Chức vụ kiểm thử, không có quyền nào' } });
    const accounts = [...ROLES.map((r) => ({ key: r.id, label: r.name, roleId: r.id })), { key: 'role-qa-none', label: 'Chức vụ không có quyền', roleId: 'role-qa-none' }];
    for (const a of accounts) {
      const u = await prisma.user.create({ data: { name: `QA ${a.label}`, email: `qa.${a.key}@qa.local`, passwordHash: hash, roleId: a.roleId, status: 'ACTIVE' } });
      userIds[a.key] = u.id;
    }
    const pending = await prisma.user.create({
      data: { name: 'QA Buộc đổi mật khẩu', email: 'qa.pending@qa.local', passwordHash: hash, roleId: 'role-ceo', status: 'ACTIVE', mustChangePassword: true },
    });
    userIds.pending = pending.id;

    actors.push({ key: 'anon', label: 'Chưa đăng nhập', token: null, perms: new Set() });
    for (const a of accounts) {
      const res = await login(`qa.${a.key}@qa.local`);
      actors.push({ key: a.key, label: a.label, token: res.body.accessToken ?? null, perms: new Set<string>(res.body.user?.permissions ?? []) });
    }
    const p = await login('qa.pending@qa.local');
    actors.push({ key: 'pending', label: 'CEO buộc đổi mật khẩu', token: p.body.accessToken ?? null, perms: new Set<string>(p.body.user?.permissions ?? []), pending: true });
  }, 240_000);

  afterAll(async () => {
    if (process.env.QA_REPORT && prisma) {
      // The permission catalog and each role's grants as seeded, for the report's matrix sheet.
      const catalog = await prisma.permission.findMany({ select: { code: true, label: true, module: true }, orderBy: { code: 'asc' } });
      const roles = await prisma.role.findMany({ where: { id: { in: ROLES.map((r) => r.id) } }, include: { permissions: { select: { permissionCode: true } } } });
      const grants = ROLES.map((r) => ({ id: r.id, name: r.name, permissions: roles.find((x) => x.id === r.id)?.permissions.map((p) => p.permissionCode) ?? [] }));
      writeFileSync(process.env.QA_REPORT, JSON.stringify({ cases, catalog, roles: grants }, null, 2));
    }
    await app?.close();
    process.env.DATABASE_URL = savedUrl;
  });

  // ---------------------------------------------------------------- Kịch bản

  it('đăng nhập theo từng chức vụ: đúng chức vụ, đúng số quyền mặc định', async () => {
    const fails: string[] = [];
    for (const r of ROLES) {
      const ok = await scenario(
        {
          module: 'Đăng nhập', title: `Đăng nhập bằng tài khoản chức vụ ${r.name}`, role: r.name,
          steps: [`Tạo tài khoản qa.${r.id}@qa.local thuộc chức vụ ${r.name}`, 'POST /api/auth/login với email và mật khẩu đúng', 'GET /api/auth/me bằng token vừa nhận'],
          expected: `200, có token; /auth/me trả chức vụ ${r.name} với ${r.count} quyền, không có passwordHash`,
        },
        async () => {
          const me = await api().get('/api/auth/me').set(bearer(tokenOf(r.id)));
          const body = me.body as { roleName?: string; permissions?: string[] };
          const leak = JSON.stringify(me.body).includes('passwordHash');
          const actual = `HTTP ${me.status}, chức vụ "${body.roleName}", ${body.permissions?.length ?? 0} quyền${leak ? ', CÓ lộ passwordHash' : ''}`;
          return [me.status === 200 && body.roleName === r.name && body.permissions?.length === r.count && !leak, actual];
        },
      );
      if (!ok) fails.push(r.name);
    }
    expect(fails).toEqual([]);
  });

  it('đăng nhập sai: cùng một thông báo cho sai mật khẩu và email không tồn tại', async () => {
    const ok = await scenario(
      {
        module: 'Đăng nhập', title: 'Sai mật khẩu và email không tồn tại trả cùng thông báo', role: 'Chưa đăng nhập',
        steps: ['POST /api/auth/login với email Sale đúng, mật khẩu sai', 'POST /api/auth/login với email không tồn tại'],
        expected: 'Cả hai 401 với cùng câu "Sai email hoặc mật khẩu" (không lộ email nào có thật)',
      },
      async () => {
        const a = await login('qa.role-sale@qa.local', 'SaiMatKhau123');
        const b = await login('khong.co@qa.local', 'SaiMatKhau123');
        return [a.status === 401 && b.status === 401 && a.body.message === b.body.message, `HTTP ${a.status} "${a.body.message}" / HTTP ${b.status} "${b.body.message}"`];
      },
    );
    expect(ok).toBe(true);
  });

  it('token giả, token hết hạn, không gửi token: đều bị từ chối', async () => {
    const jwt = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET ?? 'dev-secret-change-me';
    const sale = userIds['role-sale'];
    const variants: [string, string, string][] = [
      ['Token ký bằng khoá khác', jwt.default.sign({ sub: userIds['role-ceo'] }, 'khoa-gia-mao'), 'Ký token với khoá bí mật sai, sub = id tài khoản CEO'],
      ['Token đã hết hạn', jwt.default.sign({ sub: sale, iat: Math.floor(Date.now() / 1000) - 7200, exp: Math.floor(Date.now() / 1000) - 3600 }, secret), 'Ký token đúng khoá nhưng exp đã qua 1 giờ'],
      ['Token của tài khoản không tồn tại', jwt.default.sign({ sub: 'user-khong-co' }, secret), 'Ký token đúng khoá cho id người dùng không có'],
      ['Không gửi token', '', 'Gọi API không có header Authorization'],
    ];
    const fails: string[] = [];
    for (const [title, token, step] of variants) {
      const ok = await scenario(
        { module: 'Bảo mật', title, role: 'Kẻ giả mạo', steps: [step, 'GET /api/customers với token đó'], expected: '401, không trả dữ liệu' },
        async () => {
          const res = await api().get('/api/customers').set(bearer(token || null));
          return [res.status === 401 && !Array.isArray(res.body), `HTTP ${res.status}`];
        },
      );
      if (!ok) fails.push(title);
    }
    expect(fails).toEqual([]);
  });

  it('gỡ quyền khỏi chức vụ có hiệu lực ngay, trả lại quyền thì dùng lại được', async () => {
    const ceo = tokenOf('role-ceo');
    const sale = tokenOf('role-sale');
    const ok = await scenario(
      {
        module: 'Chức vụ & phân quyền', title: 'Gỡ quyền "Thêm khách hàng" của Sale có hiệu lực ngay, không cần đăng nhập lại', role: 'CEO, Sale',
        steps: [
          'Sale gọi POST /api/customers (thân rỗng) → 400 (qua được kiểm quyền)',
          'CEO gọi PUT /api/roles/role-sale/permissions bỏ customer.create',
          'Sale (token cũ) gọi lại POST /api/customers',
          'CEO trả lại quyền customer.create, Sale gọi lại lần nữa',
        ],
        expected: 'Trước: 400; sau khi gỡ: 403; trả lại quyền: 400',
      },
      async () => {
        const before = await api().post('/api/customers').set(bearer(sale)).send({});
        const codes = [...actors.find((a) => a.key === 'role-sale')!.perms];
        const removed = await api().put('/api/roles/role-sale/permissions').set(bearer(ceo)).send({ codes: codes.filter((c) => c !== 'customer.create') });
        const during = await api().post('/api/customers').set(bearer(sale)).send({});
        const restored = await api().put('/api/roles/role-sale/permissions').set(bearer(ceo)).send({ codes });
        const after = await api().post('/api/customers').set(bearer(sale)).send({});
        const actual = `trước ${before.status}; gỡ quyền ${removed.status} → Sale ${during.status}; trả quyền ${restored.status} → Sale ${after.status}`;
        return [before.status === 400 && removed.status === 200 && during.status === 403 && after.status === 400, actual];
      },
    );
    expect(ok).toBe(true);
  });

  it('chức vụ CEO là chức vụ hệ thống: không gỡ quyền, không tắt được', async () => {
    const ceo = tokenOf('role-ceo');
    const ok = await scenario(
      {
        module: 'Chức vụ & phân quyền', title: 'Không gỡ quyền hay tắt chức vụ CEO', role: 'CEO',
        steps: ['PUT /api/roles/role-ceo/permissions với danh sách chỉ còn customer.view', 'PATCH /api/roles/role-ceo/active với isActive=false', 'GET /api/auth/me của CEO'],
        expected: 'Hai lệnh sửa bị từ chối (4xx); CEO vẫn đủ 112 quyền',
      },
      async () => {
        const a = await api().put('/api/roles/role-ceo/permissions').set(bearer(ceo)).send({ codes: ['customer.view'] });
        const b = await api().patch('/api/roles/role-ceo/active').set(bearer(ceo)).send({ isActive: false });
        const me = await api().get('/api/auth/me').set(bearer(ceo));
        const n = (me.body.permissions ?? []).length;
        return [a.status >= 400 && a.status < 500 && b.status >= 400 && b.status < 500 && n === 112, `gỡ quyền ${a.status}, tắt ${b.status}, CEO còn ${n} quyền`];
      },
    );
    expect(ok).toBe(true);
  });

  it('khoá tài khoản: token đang dùng bị từ chối ngay, không đăng nhập lại được; mở khoá thì vào được', async () => {
    const ceo = tokenOf('role-ceo');
    const hash = await bcrypt.hash(QA_PASS, 10);
    const u = await prisma.user.create({ data: { name: 'QA Khoá', email: 'qa.lock@qa.local', passwordHash: hash, roleId: 'role-sale', status: 'ACTIVE' } });
    const ok = await scenario(
      {
        module: 'Người dùng', title: 'Khoá tài khoản đang đăng nhập', role: 'CEO, Sale',
        steps: ['Sale qa.lock đăng nhập, gọi GET /api/customers → 200', 'CEO gọi POST /api/users/:id/lock', 'Sale gọi lại GET /api/customers bằng token cũ', 'Sale đăng nhập lại', 'CEO mở khoá (POST /api/users/:id/unlock), Sale đăng nhập lại'],
        expected: '200 → 401 → đăng nhập 401 → sau mở khoá đăng nhập 200',
      },
      async () => {
        const t = (await login('qa.lock@qa.local')).body.accessToken;
        const a = await api().get('/api/customers').set(bearer(t));
        const lock = await api().post(`/api/users/${u.id}/lock`).set(bearer(ceo)).send({});
        const b = await api().get('/api/customers').set(bearer(t));
        const c = await login('qa.lock@qa.local');
        const unlock = await api().post(`/api/users/${u.id}/unlock`).set(bearer(ceo)).send({});
        const d = await login('qa.lock@qa.local');
        const actual = `trước ${a.status}; khoá ${lock.status} → token cũ ${b.status}, đăng nhập ${c.status}; mở khoá ${unlock.status} → đăng nhập ${d.status}`;
        return [a.status === 200 && lock.status < 300 && b.status === 401 && c.status === 401 && d.status === 200, actual];
      },
    );
    expect(ok).toBe(true);
  });

  it('tắt chức vụ: người thuộc chức vụ đó không dùng được nữa', async () => {
    const ceo = tokenOf('role-ceo');
    const hash = await bcrypt.hash(QA_PASS, 10);
    await prisma.role.create({ data: { id: 'role-qa-temp', name: 'QA Tạm', description: 'Kiểm thử tắt chức vụ' } });
    await prisma.rolePermission.create({ data: { roleId: 'role-qa-temp', permissionCode: 'customer.view' } });
    await prisma.user.create({ data: { name: 'QA Tạm', email: 'qa.temp@qa.local', passwordHash: hash, roleId: 'role-qa-temp', status: 'ACTIVE' } });
    const ok = await scenario(
      {
        module: 'Chức vụ & phân quyền', title: 'Tắt một chức vụ đang có người dùng', role: 'CEO, chức vụ tạm',
        steps: [
          'Người dùng chức vụ "QA Tạm" (chỉ có quyền customer.view) đăng nhập',
          'CEO gọi PATCH /api/roles/role-qa-temp/active với isActive=false',
          'Người dùng gọi lại GET /api/auth/me, GET /api/customers, GET /api/products bằng token cũ, rồi đăng nhập lại',
          'CEO dùng lại chức vụ (isActive=true), người dùng đăng nhập lại',
        ],
        expected: 'Sau khi tắt: token cũ 401 ở mọi API, đăng nhập 401 (Nhật ký ghi "chức vụ không còn hiệu lực"). Dùng lại chức vụ: đăng nhập 200',
        note: 'Đã sửa 26/10/2026: trước đó người dùng vẫn đăng nhập và đọc được các danh mục mở cho mọi người (AuthService.loadUser).',
      },
      async () => {
        const t = (await login('qa.temp@qa.local')).body.accessToken;
        const off = await api().patch('/api/roles/role-qa-temp/active').set(bearer(ceo)).send({ isActive: false });
        const me = await api().get('/api/auth/me').set(bearer(t));
        const customers = await api().get('/api/customers').set(bearer(t));
        const products = await api().get('/api/products').set(bearer(t));
        const again = await login('qa.temp@qa.local');
        const on = await api().patch('/api/roles/role-qa-temp/active').set(bearer(ceo)).send({ isActive: true });
        const back = await login('qa.temp@qa.local');
        const logged = await prisma.auditLog.count({ where: { action: 'auth.login_failed', entityCode: 'qa.temp@qa.local', summary: { contains: 'chức vụ không còn hiệu lực' } } });
        const actual = `tắt ${off.status}; token cũ: /auth/me ${me.status}, khách hàng ${customers.status}, hàng hoá ${products.status}; đăng nhập lại ${again.status} "${again.body.message ?? ''}"; dùng lại ${on.status} → đăng nhập ${back.status}; nhật ký ghi lý do: ${logged ? 'có' : 'không'}`;
        const pass = logged > 0 && off.status === 200 && me.status === 401 && customers.status === 401 && products.status === 401 && again.status === 401 && on.status === 200 && back.status === 200;
        return [pass, actual];
      },
    );
    expect(ok).toBe(true);
  });

  it('phạm vi dữ liệu: Sale chỉ thấy đơn của mình, Quản lý thấy hết', async () => {
    const sale1 = (await login('sale1@ninhtrang.local')).body as { accessToken: string; user: { id: string } };
    const ok = await scenario(
      {
        module: 'Bán hàng', title: 'Sale chỉ xem được đơn mình bán hoặc mình lập', role: 'Sale (sale1), Quản lý',
        steps: ['sale1@ninhtrang.local (dữ liệu demo) gọi GET /api/sales-orders', 'Quản lý gọi GET /api/sales-orders', 'sale1 mở một đơn của người bán khác: GET /api/sales-orders/:id'],
        expected: 'Mọi đơn sale1 nhận có người bán hoặc người lập là sale1; Quản lý thấy nhiều đơn hơn; mở đơn người khác → 404',
      },
      async () => {
        type Row = { id: string; salesRep: string; createdBy: string };
        const me = 'sale1@ninhtrang.local';
        const own = (o: Row) => o.salesRep === me || o.createdBy === me;
        const mine = (await api().get('/api/sales-orders').set(bearer(sale1.accessToken))).body as Row[];
        const all = (await api().get('/api/sales-orders').set(bearer(tokenOf('role-manager')))).body as Row[];
        const foreign = all.find((o) => !own(o));
        const open = foreign ? await api().get(`/api/sales-orders/${foreign.id}`).set(bearer(sale1.accessToken)) : null;
        const strangers = mine.filter((o) => !own(o)).length;
        const actual = `sale1 thấy ${mine.length} đơn (${strangers} đơn không phải của mình), Quản lý thấy ${all.length}; mở đơn người khác: ${open?.status ?? 'không có đơn để thử'}`;
        return [mine.length > 0 && strangers === 0 && all.length > mine.length && open?.status === 404, actual];
      },
    );
    expect(ok).toBe(true);
  });

  it('phạm vi dữ liệu: Thủ kho và Sale không thấy giá nhập, Kế toán thấy', async () => {
    const ok = await scenario(
      {
        module: 'Mua hàng', title: 'Ẩn giá nhập trên đơn nhập với Thủ kho và Sale', role: 'Thủ kho, Sale, Kế toán',
        steps: ['Kế toán gọi GET /api/purchase-orders, chọn đơn có giá trị', 'Thủ kho và Sale gọi GET /api/purchase-orders/:id của đơn đó'],
        expected: 'Kế toán thấy đơn giá > 0; Thủ kho và Sale xem được đơn (200) nhưng unitPrice = null, totalValue = null',
      },
      async () => {
        const list = (await api().get('/api/purchase-orders').set(bearer(tokenOf('role-accountant')))).body as { id: string; totalValue: number }[];
        const priced = list.find((o) => o.totalValue > 0);
        if (!priced) return [false, 'Không có đơn nhập có giá trị trong dữ liệu demo'];
        const acc = await api().get(`/api/purchase-orders/${priced.id}`).set(bearer(tokenOf('role-accountant')));
        const kho = await api().get(`/api/purchase-orders/${priced.id}`).set(bearer(tokenOf('role-thukho')));
        const sale = await api().get(`/api/purchase-orders/${priced.id}`).set(bearer(tokenOf('role-sale')));
        const actual = `Kế toán ${acc.status} đơn giá ${acc.body.lines?.[0]?.unitPrice}; Thủ kho ${kho.status} đơn giá ${kho.body.lines?.[0]?.unitPrice} tổng ${kho.body.totalValue}; Sale ${sale.status} đơn giá ${sale.body.lines?.[0]?.unitPrice} tổng ${sale.body.totalValue}`;
        const hidden = (x: { status: number; body: { totalValue?: unknown; lines?: { unitPrice?: unknown }[] } }) => x.status === 200 && x.body.lines?.[0]?.unitPrice === null && x.body.totalValue === null;
        return [acc.body.lines?.[0]?.unitPrice > 0 && hidden(kho) && hidden(sale), actual];
      },
    );
    expect(ok).toBe(true);
  });

  it('phạm vi dữ liệu: Tổng quan của Sale không có lãi gộp, công nợ', async () => {
    const ok = await scenario(
      {
        module: 'Tổng quan', title: 'Tổng quan ẩn lãi gộp và công nợ với Sale', role: 'Sale, Quản lý',
        steps: ['Sale gọi GET /api/dashboard', 'Quản lý gọi GET /api/dashboard'],
        expected: 'Sale: kpis.profit = null, debt = null; Quản lý: có số lãi gộp và công nợ',
      },
      async () => {
        const s = (await api().get('/api/dashboard').set(bearer(tokenOf('role-sale')))).body;
        const m = (await api().get('/api/dashboard').set(bearer(tokenOf('role-manager')))).body;
        const actual = `Sale lãi gộp ${JSON.stringify(s.kpis?.profit)}, công nợ ${s.debt === null ? 'null' : 'có'}; Quản lý lãi gộp ${m.kpis?.profit === null ? 'null' : 'có'}, công nợ ${m.debt === null ? 'null' : 'có'}`;
        return [s.kpis?.profit === null && s.debt === null && m.kpis?.profit !== null && m.debt !== null, actual];
      },
    );
    expect(ok).toBe(true);
  });

  it('không lộ mật khẩu: danh sách người dùng và danh bạ không có passwordHash', async () => {
    const ok = await scenario(
      {
        module: 'Người dùng', title: 'API người dùng không trả mật khẩu đã băm', role: 'CEO, Sale',
        steps: ['CEO gọi GET /api/users', 'Sale gọi GET /api/users/directory'],
        expected: 'Không phản hồi nào chứa passwordHash',
      },
      async () => {
        const a = await api().get('/api/users').set(bearer(tokenOf('role-ceo')));
        const b = await api().get('/api/users/directory').set(bearer(tokenOf('role-sale')));
        const leak = JSON.stringify(a.body).includes('passwordHash') || JSON.stringify(b.body).includes('passwordHash');
        return [a.status === 200 && b.status === 200 && !leak, `users ${a.status}, directory ${b.status}, ${leak ? 'CÓ' : 'không'} lộ passwordHash`];
      },
    );
    expect(ok).toBe(true);
  });

  it('giao diện và máy chủ dùng cùng danh mục quyền và cùng quyền mặc định', async () => {
    const front = readFileSync(join(BACKEND_ROOT, '../frontend/src/app/core/data/permission-catalog.ts'), 'utf8');
    const frontCodes = new Set([...front.matchAll(/code: '([a-z_.]+)'/g)].map((m) => m[1]));
    const dbCodes = new Set((await prisma.permission.findMany({ select: { code: true } })).map((p) => p.code));
    const ok = await scenario(
      {
        module: 'Chức vụ & phân quyền', title: 'Danh mục quyền giao diện khớp máy chủ', role: '—',
        steps: ['Đọc mã quyền trong frontend/src/app/core/data/permission-catalog.ts', 'Đọc bảng Permission sau khi seed'],
        expected: 'Hai danh sách giống hệt nhau (112 mã)',
      },
      async () => {
        const onlyFront = [...frontCodes].filter((c) => !dbCodes.has(c));
        const onlyDb = [...dbCodes].filter((c) => !frontCodes.has(c));
        return [!onlyFront.length && !onlyDb.length, `giao diện ${frontCodes.size}, máy chủ ${dbCodes.size}; chỉ giao diện có: ${onlyFront.join(', ') || 'không'}; chỉ máy chủ có: ${onlyDb.join(', ') || 'không'}`];
      },
    );
    const comment = /\((\d+) quyền, (\d+) nhóm\)/.exec(front);
    await scenario(
      {
        module: 'Chức vụ & phân quyền', title: 'Ghi chú số quyền trong permission-catalog.ts đúng thực tế', role: '—',
        steps: ['Đọc dòng chú thích "Danh mục quyền của hệ thống (N quyền, M nhóm)"', 'Đếm mã quyền thực tế'],
        expected: 'N bằng số mã quyền thực tế',
        note: 'Chỉ là chú thích trong mã nguồn, không ảnh hưởng người dùng.',
      },
      async () => [!!comment && Number(comment[1]) === frontCodes.size, `chú thích ghi ${comment?.[1] ?? '?'} quyền, thực tế ${frontCodes.size}`],
    );
    expect(ok).toBe(true);
  });

  // ---------------------------------------------------------------- Ma trận

  it('ma trận: mọi API × mọi chức vụ trả đúng 401 / 403 / được phép', async () => {
    const routes = routesOf(app).filter((r) => !r.path.startsWith('/api/platform'));
    // Reads first, writes after: a write that does go through cannot change what a later read sees.
    const order = (r: Route) => (r.method === 'GET' ? 0 : 1);
    routes.sort((a, b) => order(a) - order(b));

    type Probe = { route: Route; url: string; all: string[]; any: string[]; label: string; special?: (a: Actor) => boolean | null };
    const probes: Probe[] = [];
    for (const r of routes) {
      if (r.path === '/api/reports/:slug') {
        for (const def of [...SALES_DEFS, ...STOCK_DEFS, ...OPS_DEFS]) {
          probes.push({ route: r, url: `/api/reports/${def.slug}`, all: [GROUP_PERMISSION[def.group]], any: [], label: `báo cáo "${def.slug}"` });
        }
        continue;
      }
      if (r.path === '/api/audit-logs/entity/:type/:id') {
        for (const [type, need] of Object.entries(HISTORY_PERMISSION)) {
          probes.push({
            route: r, url: `/api/audit-logs/entity/${type}/${FAKE_ID}`, all: [], any: ['audit.view', need], label: `lịch sử ${type}`,
            // A seller without order.view_all is refused another seller's đơn: the fake id is nobody's.
            special: type === 'SalesOrder' ? (a) => (a.perms.has('audit.view') ? true : a.perms.has('order.view_all') || !a.perms.has('order.create') ? null : false) : undefined,
          });
        }
        continue;
      }
      probes.push({ route: r, url: r.path.replace(/:[a-zA-Z]+/g, FAKE_ID), all: r.all, any: r.any, label: '' });
    }

    let n = 0;
    const mismatches: string[] = [];
    for (const p of probes) {
      const r = p.route;
      for (const actor of actors) {
        let expectStatus: 'public' | 401 | 403 | 'allowed';
        if (!r.jwt) expectStatus = 'public';
        else if (!actor.token) expectStatus = 401;
        else if (actor.pending && !r.allowPending) expectStatus = 403;
        else {
          const has = p.all.every((c) => actor.perms.has(c)) && (!p.any.length || p.any.some((c) => actor.perms.has(c)));
          const special = has ? p.special?.(actor) : null;
          expectStatus = has && special !== false ? 'allowed' : 403;
        }
        const call = api()[r.method.toLowerCase() as 'get'](p.url).set(bearer(actor.token));
        const res = r.method === 'GET' ? await call : await call.send({});
        const pass =
          expectStatus === 'public' ? res.status < 500 && res.status !== 401 && res.status !== 403
          : expectStatus === 'allowed' ? res.status !== 401 && res.status !== 403 && res.status < 500
          : res.status === expectStatus;
        const expectedText =
          expectStatus === 'public' ? 'API công khai: không 401/403, không lỗi 5xx'
          : expectStatus === 401 ? '401 (chưa đăng nhập)'
          : expectStatus === 403 ? actor.pending && !r.allowPending ? '403 (phải đổi mật khẩu trước)' : '403 (không có quyền)'
          : 'Được phép: không 401/403, không lỗi 5xx (400/404 là bình thường vì dữ liệu thử rỗng)';
        const msg = typeof res.body?.message === 'string' ? res.body.message : Array.isArray(res.body?.message) ? res.body.message[0] : '';
        cases.push({
          id: `PQ-${String(++n).padStart(4, '0')}`,
          group: 'Ma trận phân quyền API',
          module: moduleOf(r.path),
          title: `${r.method} ${r.path}${p.label ? ` (${p.label})` : ''}`,
          role: actor.label,
          steps: [
            actor.token ? `Đăng nhập bằng tài khoản ${actor.label}` : 'Không đăng nhập (không gửi token)',
            `${r.method} ${p.url}${r.method === 'GET' ? '' : ' với thân yêu cầu rỗng {}'}`,
          ],
          expected: `${expectedText}. Quyền của API: ${p.all.length || p.any.length ? permText(p) : r.jwt ? 'chỉ cần đăng nhập' : 'không cần đăng nhập'}`,
          actual: `HTTP ${res.status}${msg ? ` — ${String(msg).slice(0, 140)}` : ''}`,
          result: pass ? 'Đạt' : 'Không đạt',
        });
        if (!pass) mismatches.push(`${actor.label}: ${r.method} ${p.url} → ${res.status} (mong đợi ${expectStatus})`);
      }
    }
    expect(mismatches).toEqual([]);
  }, 600_000);

  it('mọi thao tác ghi thành công đều có dòng Nhật ký hoạt động', async () => {
    const ok = await scenario(
      {
        module: 'Nhật ký hoạt động', title: 'Không có thao tác ghi nào thiếu nhật ký trong toàn bộ lần kiểm thử', role: 'Tất cả',
        steps: ['Chạy toàn bộ kịch bản và ma trận ở trên', 'Đếm dòng AuditLog action = api.unaudited trong database QA'],
        expected: '0 dòng',
      },
      async () => {
        const rows = await prisma.auditLog.findMany({ where: { action: 'api.unaudited' }, select: { entityId: true } });
        return [rows.length === 0, rows.length ? `${rows.length} dòng: ${[...new Set(rows.map((r) => r.entityId))].join('; ')}` : '0 dòng'];
      },
    );
    expect(ok).toBe(true);
  });
});
