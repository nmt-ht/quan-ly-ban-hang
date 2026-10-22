// Đợt 1 — danh mục, end to end against the database in .env (the local dev DB with the demo seed:
// npm run prisma:seed && DEMO_USER_PASSWORD=demo1234 npm run prisma:seed:demo).
// Everything the suite creates carries "E2E" in its name and is removed in afterAll.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

describe('Danh mục (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const created = { customers: [] as string[], products: [] as string[], vehicles: [] as string[], tags: [] as string[], accounts: [] as string[], categories: [] as string[], users: [] as string[], roles: [] as string[] };

  const api = () => request(app.getHttpServer());
  async function login(email: string, password = DEMO_PASSWORD): Promise<string> {
    const res = await api().post('/api/auth/login').send({ email, password }).expect(200);
    return res.body.accessToken;
  }
  const as = (token: string) => ({
    get: (url: string) => api().get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string, body?: object) => api().post(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
    put: (url: string, body: object) => api().put(url).set('Authorization', `Bearer ${token}`).send(body),
    patch: (url: string, body: object) => api().patch(url).set('Authorization', `Bearer ${token}`).send(body),
    delete: (url: string) => api().delete(url).set('Authorization', `Bearer ${token}`),
  });

  let admin: ReturnType<typeof as>;
  let manager: ReturnType<typeof as>;
  let storekeeper: ReturnType<typeof as>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    admin = as(await login('admin@ninhtrang.local', ADMIN_PASSWORD));
    manager = as(await login('quan.ly@ninhtrang.local'));
    storekeeper = as(await login('thu.kho@ninhtrang.local'));
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.role.deleteMany({ where: { id: { in: created.roles } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: created.vehicles } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customers } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.tag.deleteMany({ where: { id: { in: created.tags } } });
    await prisma.cashAccount.deleteMany({ where: { id: { in: created.accounts } } });
    await prisma.cashAccount.update({ where: { id: 'acc-cash' }, data: { isDefault: true } });
    await prisma.cashCategory.deleteMany({ where: { code: { in: created.categories } } });
    await app.close();
  });

  it('reads are open to any signed-in user and come back as plain JSON numbers', async () => {
    const res = await storekeeper.get('/api/products').expect(200);
    const p = res.body.find((x: any) => x.code === 'VT0000001');
    expect(typeof p.retailPrice).toBe('number');
    expect(p.unitConversions[0]).not.toHaveProperty('productId');
    for (const url of ['/api/customers', '/api/suppliers', '/api/vehicles', '/api/tags', '/api/warehouses', '/api/categories', '/api/cash-accounts', '/api/cash-categories', '/api/company', '/api/users/directory', '/api/bom-lines']) {
      await storekeeper.get(url).expect(200);
    }
    await storekeeper.get('/api/users').expect(403); // full accounts need user.view
    await api().get('/api/customers').expect(401);
  });

  it('khách hàng: tags and addresses travel with the customer, exactly one default address', async () => {
    const body = {
      name: 'E2E Khách', type: 'SI', creditDays: 15, email: '', tagIds: ['tag-vip'],
      addresses: [{ address: '1 Đường A', isDefault: false }, { address: '2 Đường B', isDefault: true }],
    };
    await storekeeper.post('/api/customers', body).expect(403);
    const c = (await manager.post('/api/customers', body).expect(201)).body;
    created.customers.push(c.id);
    expect(c.code).toMatch(/^KH\d{7}$/);
    expect(c.email).toBeNull();
    expect(c.tagIds).toEqual(['tag-vip']);
    expect(c.addresses.map((a: any) => a.isDefault)).toEqual([false, true]);

    const updated = (await manager.put(`/api/customers/${c.id}`, { ...body, name: 'E2E Khách sửa', tagIds: [], addresses: [] }).expect(200)).body;
    expect(updated).toMatchObject({ name: 'E2E Khách sửa', tagIds: [], addresses: [] });

    const withAddr = (await manager.put(`/api/customers/${c.id}/addresses`, { addresses: [{ id: 'e2e-a1', address: '3 Đường C', isDefault: false }] }).expect(200)).body;
    expect(withAddr.addresses).toEqual([expect.objectContaining({ id: 'e2e-a1', isDefault: true })]);

    expect((await manager.patch(`/api/customers/${c.id}/active`, { isActive: false }).expect(200)).body.isActive).toBe(false);
  });

  it('hàng hoá: giá bán needs product.update_price; units and images are replaced as a whole', async () => {
    const p = (await manager.post('/api/products', {
      name: 'E2E Hàng', type: 'VAT_TU', baseUnit: 'Cái', retailPrice: 10000,
      unitConversions: [{ unitName: 'Hộp', ratioToBaseUnit: 10, price: 95000 }],
    }).expect(201)).body;
    created.products.push(p.id);
    expect(p.code).toMatch(/^VT\d{7}$/);

    // A role that may edit products but not prices.
    const role = (await admin.post('/api/roles', { name: 'E2E Sửa hàng' }).expect(201)).body;
    created.roles.push(role.id);
    await admin.put(`/api/roles/${role.id}/permissions`, { codes: ['product.view', 'product.update', 'khong.co'] }).expect(200);
    const editor = (await admin.post('/api/users', { name: 'E2E Người sửa', email: 'e2e.sua@ninhtrang.local', roleId: role.id, password: 'E2esua123' }).expect(201)).body;
    created.users.push(editor.id);
    expect(editor).not.toHaveProperty('passwordHash');
    const asEditor = as(await login('e2e.sua@ninhtrang.local', 'E2esua123'));

    const base = { name: 'E2E Hàng', type: 'VAT_TU', baseUnit: 'Cái', retailPrice: 10000, unitConversions: [{ unitName: 'Hộp', ratioToBaseUnit: 10, price: 95000 }] };
    await asEditor.put(`/api/products/${p.id}`, { ...base, retailPrice: 12000 }).expect(403);
    const renamed = (await asEditor.put(`/api/products/${p.id}`, { ...base, name: 'E2E Hàng mới', images: [{ url: 'https://example.com/a.png', name: 'a.png', width: 10, height: 10 }] }).expect(200)).body;
    expect(renamed.name).toBe('E2E Hàng mới');
    expect(renamed.images).toHaveLength(1);
    await asEditor.put(`/api/products/${p.id}`, { ...base, type: 'DICH_VU' }).expect(400);

    const units = (await manager.put(`/api/products/${p.id}`, { ...base, unitConversions: [{ unitName: 'Thùng', ratioToBaseUnit: 24, price: 200000 }] }).expect(200)).body;
    expect(units.unitConversions.map((u: any) => u.unitName)).toEqual(['Thùng']);
    expect(units.images).toHaveLength(1); // not sent → kept
  });

  it('xe: duplicate plates are refused whatever the punctuation; dates stay YYYY-MM-DD', async () => {
    const v = (await manager.post('/api/vehicles', { plateNumber: '99z-999.99', type: 'XE_VAN', name: 'E2E Xe', registrationExpiry: '2027-01-31' }).expect(201)).body;
    created.vehicles.push(v.id);
    expect(v).toMatchObject({ plateNumber: '99Z-999.99', registrationExpiry: '2027-01-31', code: expect.stringMatching(/^XE\d{7}$/) });
    await manager.post('/api/vehicles', { plateNumber: '99Z 99999', type: 'XE_TAI' }).expect(409);
    expect((await manager.patch(`/api/vehicles/${v.id}/status`, { status: 'BAO_TRI' }).expect(200)).body.status).toBe('BAO_TRI');
  });

  it('tài khoản tiền và loại thu chi: one default, renames carry over', async () => {
    const a = (await manager.post('/api/cash-accounts', { name: 'E2E Quỹ', type: 'TIEN_MAT', openingBalance: 500000, isDefault: true }).expect(201)).body;
    created.accounts.push(a.id);
    expect(a.balance).toBe(500000);
    const accounts = (await manager.get('/api/cash-accounts').expect(200)).body;
    expect(accounts.filter((x: any) => x.isDefault).map((x: any) => x.id)).toEqual([a.id]);
    await manager.post('/api/cash-accounts', { name: 'E2E Ngân hàng', type: 'NGAN_HANG', openingBalance: 0 }).expect(400); // no account number

    const moved = (await manager.put(`/api/cash-accounts/${a.id}`, { name: 'E2E Quỹ', type: 'TIEN_MAT', openingBalance: 600000, isDefault: true }).expect(200)).body;
    expect(moved.balance).toBe(600000);

    created.categories.push('THU_E2E');
    await manager.put('/api/cash-categories/THU_E2E', { name: 'E2E Thu', kind: 'THU', partnerType: 'KHAC' }).expect(200);
    await manager.put('/api/cash-categories/THU_KH', { name: 'Thu tiền khách hàng', kind: 'THU', partnerType: 'KHAC' }).expect(400); // system category
    await manager.put('/api/cash-categories/THU_E2E', { name: 'thu tien khach hang', kind: 'THU', partnerType: 'KHAC' }).expect(409);
  });

  it('thẻ: a tag in use cannot be deleted', async () => {
    await manager.delete('/api/tags/tag-vip').expect(409);
    const t = (await manager.post('/api/tags', { name: 'E2E Thẻ', color: 'teal', sortOrder: 99, isActive: true }).expect(201)).body;
    created.tags.push(t.id);
    await manager.post('/api/tags', { name: 'e2e the', sortOrder: 1, isActive: true }).expect(409);
    await manager.delete(`/api/tags/${t.id}`).expect(204);
  });

  it('người dùng: locking and ending sessions revoke tokens at once; the last CEO is protected', async () => {
    const role = (await admin.get('/api/roles').expect(200)).body.find((r: any) => r.id === 'role-sale');
    expect(role.permissionCount).toBe(16);
    const u = (await admin.post('/api/users', { name: 'E2E Sale', email: 'E2E.Sale@ninhtrang.local', roleId: 'role-sale', password: 'Sale12345' }).expect(201)).body;
    created.users.push(u.id);
    expect(u).toMatchObject({ email: 'e2e.sale@ninhtrang.local', mustChangePassword: true });
    await admin.post('/api/users', { name: 'Trùng', email: 'e2e.sale@ninhtrang.local', roleId: 'role-sale', password: 'Sale12345' }).expect(409);
    await admin.post('/api/users', { name: 'Yếu', email: 'e2e.yeu@ninhtrang.local', roleId: 'role-sale', password: 'abcdefgh' }).expect(400);

    const sale = as(await login('e2e.sale@ninhtrang.local', 'Sale12345'));
    await sale.get('/api/auth/me').expect(200);
    // jsonwebtoken stamps iat in whole seconds; wait one so the revocation lands strictly after it.
    await new Promise((r) => setTimeout(r, 1100));
    await admin.post(`/api/users/${u.id}/end-sessions`).expect(200);
    await sale.get('/api/auth/me').expect(401);

    const again = as(await login('e2e.sale@ninhtrang.local', 'Sale12345'));
    await new Promise((r) => setTimeout(r, 1100));
    await admin.post(`/api/users/${u.id}/lock`, { reason: 'E2E' }).expect(200);
    await again.get('/api/auth/me').expect(401);
    await api().post('/api/auth/login').send({ email: 'e2e.sale@ninhtrang.local', password: 'Sale12345' }).expect(401);
    await admin.post(`/api/users/${u.id}/unlock`).expect(200);
    await admin.post(`/api/users/${u.id}/reset-password`, { password: 'Moi123456', mustChange: false }).expect(200);
    await login('e2e.sale@ninhtrang.local', 'Moi123456');

    const me = (await admin.get('/api/auth/me').expect(200)).body;
    await admin.post(`/api/users/${me.id}/lock`, {}).expect(400);
  });
});
