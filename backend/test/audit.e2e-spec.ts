// Nhật ký hoạt động end to end: needs a migrated, seeded database (`npm run prisma:seed`) and the demo
// accounts (`DEMO_USER_PASSWORD=demo1234 npm run prisma:seed:demo`).
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
const today = new Date().toISOString().slice(0, 10);

describe('Nhật ký hoạt động (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const customers: string[] = [];
  const orders: string[] = [];
  const products: string[] = [];

  const api = () => request(app.getHttpServer());
  async function as(email: string, password = DEMO_PASSWORD) {
    const token = (await api().post('/api/auth/login').send({ email, password }).expect(200)).body.accessToken;
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    return {
      get: (url: string) => auth(api().get(url)),
      post: (url: string, body: object = {}) => auth(api().post(url)).send(body),
      put: (url: string, body: object) => auth(api().put(url)).send(body),
    };
  }
  let admin: Awaited<ReturnType<typeof as>>;
  let manager: Awaited<ReturnType<typeof as>>;
  let storekeeper: Awaited<ReturnType<typeof as>>;

  const history = async (who: typeof admin, type: string, id: string, code?: string) =>
    (await who.get(`/api/audit-logs/entity/${type}/${id}${code ? `?code=${code}` : ''}`).expect(200)).body as any[];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    admin = await as('admin@ninhtrang.local', ADMIN_PASSWORD);
    manager = await as('quan.ly@ninhtrang.local');
    storekeeper = await as('thu.kho@ninhtrang.local');
  });

  afterAll(async () => {
    await prisma.warehouseVoucher.deleteMany({ where: { purchaseOrderId: { in: orders } } });
    await prisma.purchaseOrder.deleteMany({ where: { id: { in: orders } } });
    await prisma.customer.deleteMany({ where: { id: { in: customers } } });
    await prisma.stockLevel.deleteMany({ where: { productId: { in: products } } });
    await prisma.product.deleteMany({ where: { id: { in: products } } });
    await app.close();
  });

  it('records sign-in, and a failed one with the real reason', async () => {
    await api().post('/api/auth/login').send({ email: 'thu.kho@ninhtrang.local', password: 'sai-mat-khau-1' }).expect(401);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'thu.kho@ninhtrang.local' } });
    const lines = await prisma.auditLog.findMany({ where: { entityType: 'User', entityId: user.id }, orderBy: { id: 'desc' }, take: 5 });
    expect(lines.map((l) => l.action)).toContain('auth.login_failed');
    expect(lines.find((l) => l.action === 'auth.login_failed')?.summary).toContain('sai mật khẩu');
    expect(lines.find((l) => l.action === 'auth.login')).toMatchObject({ userId: user.id, userName: user.name });
  });

  it('records who changed which field of a customer, with labels', async () => {
    const body = { name: 'E2E Nhật ký', type: 'LE', creditDays: 0, tagIds: [], addresses: [] };
    const c = (await manager.post('/api/customers', body).expect(201)).body;
    customers.push(c.id);
    await manager.put(`/api/customers/${c.id}`, { ...body, creditDays: 30, phone: '0901234567' }).expect(200);

    const lines = await history(manager, 'Customer', c.id);
    expect(lines.map((l) => l.action)).toEqual(['customer.create', 'customer.update']);
    const me = await prisma.user.findUniqueOrThrow({ where: { email: 'quan.ly@ninhtrang.local' } });
    expect(lines[1]).toMatchObject({ userId: me.id, userName: me.name, entityCode: c.code });
    expect(lines[1].changes).toEqual(expect.arrayContaining([
      { field: 'creditDays', label: 'Số ngày được nợ', from: 0, to: 30 },
      { field: 'phone', label: 'Điện thoại', from: null, to: '0901234567' },
    ]));
    expect(lines[1].requestId).toBeTruthy();
  });

  it('ties a nhận hàng to the phiếu nhập kho it wrote, and shows it on both records', async () => {
    const p = (await manager.post('/api/products', { name: 'E2E Nhật ký vật tư', type: 'VAT_TU', baseUnit: 'Cái' }).expect(201)).body;
    products.push(p.id);
    const o = (await manager.post('/api/purchase-orders', {
      supplierId: 'ncc-1', date: today, note: 'E2E nhật ký', lines: [{ productId: p.id, quantity: 2, unitPrice: 1000, warehouseId: 'wh-vattu' }],
    }).expect(201)).body;
    orders.push(o.id);
    await manager.post(`/api/purchase-orders/${o.id}/send`).expect(200);
    await storekeeper.post(`/api/purchase-orders/${o.id}/receive`, { date: today, items: [{ lineIndex: 0, quantity: 2, warehouseId: 'wh-vattu' }] }).expect(200);

    const lines = await history(manager, 'PurchaseOrder', o.id, o.code);
    expect(lines.map((l) => l.action)).toEqual(['purchase_order.create', 'purchase_order.send', 'purchase_order.receive']);
    const pnk = lines[2].related[0];
    expect(pnk).toMatch(/^PNK\d{7}$/);

    const voucher = await prisma.warehouseVoucher.findUniqueOrThrow({ where: { code: pnk } });
    const own = await history(storekeeper, 'WarehouseVoucher', voucher.id);
    expect(own[0]).toMatchObject({ action: 'warehouse_voucher.create', entityCode: pnk });
  });

  it('lets only audit.view read the whole log, and the history only with the record’s own view right', async () => {
    await storekeeper.get('/api/audit-logs').expect(403);
    const page = (await admin.get('/api/audit-logs?limit=5').expect(200)).body;
    expect(page.items).toHaveLength(5);
    expect(page.nextCursor).toMatch(/^\d+$/);
    const next = (await admin.get(`/api/audit-logs?limit=5&before=${page.nextCursor}`).expect(200)).body;
    expect(BigInt(next.items[0].id)).toBeLessThan(BigInt(page.items[4].id));

    const found = (await manager.get(`/api/audit-logs?q=E2E Nhật ký&entityType=Customer`).expect(200)).body;
    expect(found.items.length).toBeGreaterThan(0);

    // Thủ kho has no customer.view.
    await storekeeper.get(`/api/audit-logs/entity/Customer/${customers[0]}`).expect(403);
  });

  it('cannot be edited or deleted, even straight in the database', async () => {
    const last = await prisma.auditLog.findFirstOrThrow({ orderBy: { id: 'desc' } });
    await expect(prisma.$executeRaw`UPDATE "AuditLog" SET "summary" = 'sửa' WHERE "id" = ${last.id}`).rejects.toThrow();
    await expect(prisma.$executeRaw`DELETE FROM "AuditLog" WHERE "id" = ${last.id}`).rejects.toThrow();
    expect((await prisma.auditLog.findUniqueOrThrow({ where: { id: last.id } })).summary).toBe(last.summary);
  });
});
