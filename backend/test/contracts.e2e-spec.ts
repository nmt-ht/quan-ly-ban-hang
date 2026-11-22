// Hợp đồng bán (HDB…) / mua (HDM…): lập, sửa, gắn đơn bán / đơn mua, tiến độ theo giá trị đơn, thanh lý và huỷ, quyền xem.
// Chạy trên database riêng nt_qa_contracts (tạo lại mỗi lần).
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
const QA_DB = 'nt_qa_contracts';
const QA_URL = withDatabase(MAIN_URL, QA_DB);
const PASSWORD = 'QaMatKhau2026';
const WH = 'wh-vattu';

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

describe('Hợp đồng bán / mua (e2e)', () => {
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
      put: (url: string, body: object = {}) => auth(api().put(url)).send(body),
    };
  }
  let manager: Awaited<ReturnType<typeof as>>;
  let sale: Awaited<ReturnType<typeof as>>;
  let customerA = '';
  let customerB = '';
  let supplierA = '';
  let supplierB = '';
  let productId = '';
  let sellContract: { id: string; code: string; updatedAt: string } = { id: '', code: '', updatedAt: '' };
  let buyContract: { id: string; code: string } = { id: '', code: '' };

  const contractBody = (extra: object = {}) => ({
    kind: 'BAN', title: 'Hợp đồng cung cấp vật tư 2019', customerId: customerA, signedDate: '2019-01-10', startDate: '2019-01-10', endDate: '2019-12-31', value: 10_000_000, ...extra,
  });
  const saleOrder = (extra: object = {}, who = manager) =>
    who.post('/api/sales-orders', {
      customerId: customerA, tagIds: [], orderDate: '2019-02-01', discountAmount: 0,
      lines: [{ productId, unit: 'Cái', quantity: 5, unitPrice: 100_000, vatRate: 10, warehouseId: WH }], ...extra,
    });
  const purchaseOrder = (extra: object = {}) =>
    manager.post('/api/purchase-orders', {
      supplierId: supplierA, date: '2019-02-01', lines: [{ productId, quantity: 10, unitPrice: 50_000, vatRate: 10, warehouseId: WH }], ...extra,
    });
  const one = async (id: string) => (await manager.get(`/api/contracts/${id}`).expect(200)).body;

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

    await manager.post('/api/accounting/settings', { ledgerStartDate: '2019-01-01' }).expect(201);
    productId = (await manager.post('/api/products', { name: 'E2E Hàng hợp đồng', type: 'VAT_TU', baseUnit: 'Cái', retailPrice: 100_000 }).expect(201)).body.id;
    customerA = (await manager.post('/api/customers', { name: 'E2E Khách A', type: 'LE', creditDays: 0, tagIds: [] }).expect(201)).body.id;
    customerB = (await manager.post('/api/customers', { name: 'E2E Khách B', type: 'LE', creditDays: 0, tagIds: [] }).expect(201)).body.id;
    supplierA = (await manager.post('/api/suppliers', { name: 'E2E NCC A', taxCode: '0312345678', creditDays: 0 }).expect(201)).body.id;
    supplierB = (await manager.post('/api/suppliers', { name: 'E2E NCC B', taxCode: '0312345679', creditDays: 0 }).expect(201)).body.id;
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    process.env.DATABASE_URL = savedUrl;
  });

  it('lập hợp đồng: cần quyền, đối tác đúng loại, ngày và giá trị hợp lệ', async () => {
    await sale.post('/api/contracts', contractBody()).expect(403);
    expect((await manager.post('/api/contracts', contractBody({ customerId: undefined })).expect(400)).body.message).toContain('khách hàng');
    expect((await manager.post('/api/contracts', contractBody({ supplierId: supplierA })).expect(400)).body.message).toContain('không có nhà cung cấp');
    expect((await manager.post('/api/contracts', contractBody({ kind: 'MUA', customerId: undefined })).expect(400)).body.message).toContain('nhà cung cấp');
    expect((await manager.post('/api/contracts', contractBody({ startDate: '2019-06-01', endDate: '2019-05-01' })).expect(400)).body.message).toContain('trước ngày bắt đầu');
    await manager.post('/api/contracts', contractBody({ value: -1 })).expect(400);
    await manager.post('/api/contracts', contractBody({ customerId: 'khong-co' })).expect(400);
    await manager.post('/api/contracts', contractBody({ owner: 'khong.co@x.vn' })).expect(400);
    await manager.post('/api/contracts', contractBody({ kind: 'KHAC' })).expect(400);
    expect(await prisma.contract.count()).toBe(0);
  });

  it('lập được hợp đồng bán (HDB…) và hợp đồng mua (HDM…), có nhật ký', async () => {
    const s = (await manager.post('/api/contracts', contractBody({ contractNo: '01/2019/HĐ', owner: 'sale1@ninhtrang.local' })).expect(201)).body;
    expect(s.code).toMatch(/^HDB\d{7}$/);
    expect(s).toMatchObject({ kind: 'BAN', status: 'DANG_THUC_HIEN', customerId: customerA, supplierId: null, partnerName: 'E2E Khách A', value: 10_000_000, owner: 'sale1@ninhtrang.local', orderCount: 0, percent: 0, remaining: 10_000_000, over: false });
    sellContract = s;
    const m = (await manager.post('/api/contracts', { kind: 'MUA', title: 'Hợp đồng mua vật tư', supplierId: supplierA, signedDate: '2019-01-15', value: 0 }).expect(201)).body;
    expect(m.code).toMatch(/^HDM\d{7}$/);
    expect(m).toMatchObject({ kind: 'MUA', customerId: null, supplierId: supplierA, percent: null, remaining: null });
    buyContract = m;
    const log = (await manager.get(`/api/audit-logs/entity/Contract/${s.id}`)).body;
    expect(JSON.stringify(log)).toContain('contract.create');
  });

  it('quyền xem: người bán chỉ thấy hợp đồng bán; hợp đồng mua (giá nhập) là 404', async () => {
    const list = (await sale.get('/api/contracts').expect(200)).body as { kind: string }[];
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((c) => c.kind === 'BAN')).toBe(true);
    await sale.get(`/api/contracts/${sellContract.id}`).expect(200);
    await sale.get(`/api/contracts/${buyContract.id}`).expect(404);
    expect(((await manager.get('/api/contracts').expect(200)).body as unknown[]).length).toBe(2);
  });

  it('gắn đơn bán: đúng khách, đúng loại; tiến độ bằng giá trị đơn (gồm thuế) trên giá trị hợp đồng', async () => {
    expect((await saleOrder({ customerId: customerB, contractId: sellContract.id }).expect(400)).body.message).toContain('khách hàng khác');
    expect((await saleOrder({ contractId: buyContract.id }).expect(400)).body.message).toContain('hợp đồng mua');
    await saleOrder({ contractId: 'khong-co' }).expect(400);
    const o = (await saleOrder({ contractId: sellContract.id }).expect(201)).body;
    expect(o.contractId).toBe(sellContract.id);
    const c = await one(sellContract.id);
    // 5 × 100.000 + VAT 10% = 550.000 trên 10.000.000.
    expect(c).toMatchObject({ orderCount: 1, orderValue: 550_000, percent: 5.5, remaining: 9_450_000, over: false });
    expect(c.orders).toEqual([expect.objectContaining({ id: o.id, code: o.code, total: 550_000, received: 0 })]);
  });

  it('người bán chỉ thấy đơn của mình trong hợp đồng, nhưng tổng giá trị là của cả hợp đồng', async () => {
    const mine = (await saleOrder({ contractId: sellContract.id }, sale).expect(201)).body;
    const seen = (await sale.get(`/api/contracts/${sellContract.id}`).expect(200)).body;
    expect(seen.orderCount).toBe(2);
    expect(seen.orderValue).toBe(1_100_000);
    expect((seen.orders as { id: string }[]).map((x) => x.id)).toEqual([mine.id]);
    expect(((await one(sellContract.id)).orders as unknown[]).length).toBe(2);
  });

  it('đơn bị huỷ không tính vào giá trị đã thực hiện; hợp đồng bị vượt giá trị thì báo', async () => {
    const extra = (await saleOrder({ contractId: sellContract.id, lines: [{ productId, unit: 'Cái', quantity: 100, unitPrice: 100_000, vatRate: 10, warehouseId: WH }] }).expect(201)).body;
    expect(await one(sellContract.id)).toMatchObject({ orderCount: 3, orderValue: 12_100_000, over: true, remaining: -2_100_000 });
    await manager.post(`/api/sales-orders/${extra.id}/cancel`, { reason: 'Khách đổi ý' }).expect(200);
    expect(await one(sellContract.id)).toMatchObject({ orderCount: 2, orderValue: 1_100_000, over: false });
  });

  it('gắn đơn mua: đúng nhà cung cấp; giá trị đơn mua theo giá nhập', async () => {
    expect((await purchaseOrder({ supplierId: supplierB, contractId: buyContract.id }).expect(400)).body.message).toContain('nhà cung cấp khác');
    expect((await purchaseOrder({ contractId: sellContract.id }).expect(400)).body.message).toContain('hợp đồng bán');
    const o = (await purchaseOrder({ contractId: buyContract.id }).expect(201)).body;
    expect(o.contractId).toBe(buyContract.id);
    // 10 × 50.000 + VAT 10% = 550.000; hợp đồng không ấn định giá trị nên không có phần trăm.
    expect(await one(buyContract.id)).toMatchObject({ orderCount: 1, orderValue: 550_000, percent: null, over: false });
    // Sửa đơn nháp: đổi sang không gắn hợp đồng, rồi gắn lại.
    await manager.put(`/api/purchase-orders/${o.id}`, { supplierId: supplierA, date: '2019-02-01', updatedAt: o.updatedAt, lines: [{ productId, quantity: 10, unitPrice: 50_000, vatRate: 10, warehouseId: WH }] }).expect(200);
    expect(await one(buyContract.id)).toMatchObject({ orderCount: 0, orderValue: 0 });
  });

  it('sửa hợp đồng: không đổi loại, không đổi đối tác khi đã có đơn, bản cũ bị từ chối', async () => {
    const before = await one(sellContract.id);
    expect((await manager.put(`/api/contracts/${sellContract.id}`, contractBody({ kind: 'MUA', customerId: undefined, supplierId: supplierA })).expect(400)).body.message).toContain('Không đổi được loại');
    expect((await manager.put(`/api/contracts/${sellContract.id}`, contractBody({ customerId: customerB })).expect(400)).body.message).toContain('đã có đơn gắn vào');
    await manager.put(`/api/contracts/${sellContract.id}`, contractBody({ updatedAt: '2018-01-01T00:00:00.000Z' })).expect(409);
    const saved = (await manager.put(`/api/contracts/${sellContract.id}`, contractBody({ title: 'Hợp đồng đã gia hạn', endDate: '2020-06-30', value: 20_000_000, updatedAt: before.updatedAt })).expect(200)).body;
    expect(saved).toMatchObject({ title: 'Hợp đồng đã gia hạn', endDate: '2020-06-30', value: 20_000_000, percent: 5.5 });
    sellContract.updatedAt = saved.updatedAt;
    const log = JSON.stringify((await manager.get(`/api/audit-logs/entity/Contract/${sellContract.id}`)).body);
    expect(log).toContain('contract.update');
    expect(log).toContain('Giá trị hợp đồng');
  });

  it('thanh lý: không trước ngày ký, không sau hôm nay; xong thì không nhận thêm đơn và không sửa, đơn đã gắn vẫn sửa được', async () => {
    await sale.post(`/api/contracts/${sellContract.id}/liquidate`, { date: '2019-12-01' }).expect(403);
    expect((await manager.post(`/api/contracts/${sellContract.id}/liquidate`, { date: '2019-01-01' }).expect(400)).body.message).toContain('trước ngày ký');
    expect((await manager.post(`/api/contracts/${sellContract.id}/liquidate`, { date: '2099-01-01' }).expect(400)).body.message).toContain('sau hôm nay');
    const done = (await manager.post(`/api/contracts/${sellContract.id}/liquidate`, { date: '2019-12-01', note: 'Hai bên đã nghiệm thu' }).expect(200)).body;
    expect(done).toMatchObject({ status: 'DA_THANH_LY', closedDate: '2019-12-01', closeNote: 'Hai bên đã nghiệm thu' });

    expect((await manager.post(`/api/contracts/${sellContract.id}/liquidate`, { date: '2019-12-02' }).expect(400)).body.message).toContain('thanh lý rồi');
    expect((await manager.post(`/api/contracts/${sellContract.id}/cancel`, { date: '2019-12-02' }).expect(400)).body.message).toContain('thanh lý rồi');
    expect((await manager.put(`/api/contracts/${sellContract.id}`, contractBody()).expect(400)).body.message).toContain('không sửa được');
    expect((await saleOrder({ contractId: sellContract.id }).expect(400)).body.message).toContain('đã thanh lý');

    // Đơn vốn đã gắn hợp đồng vẫn sửa được (đổi ghi chú), hợp đồng giữ nguyên.
    const linked = ((await one(sellContract.id)).orders as { id: string; status: string }[]).find((x) => x.status !== 'HUY')!;
    const order = (await manager.get(`/api/sales-orders/${linked.id}`).expect(200)).body;
    const edit = await manager.put(`/api/sales-orders/${linked.id}`, {
      customerId: customerA, tagIds: [], orderDate: '2019-02-01', discountAmount: 0, description: 'Đổi ghi chú sau thanh lý', contractId: sellContract.id,
      updatedAt: order.updatedAt, lines: [{ productId, unit: 'Cái', quantity: 5, unitPrice: 100_000, vatRate: 10, warehouseId: WH }],
    });
    expect(edit.status, edit.body.message).toBe(200);
    expect((await manager.get(`/api/sales-orders/${linked.id}`).expect(200)).body.contractId).toBe(sellContract.id);
  });

  it('huỷ hợp đồng mua: một chiều, có lý do, đơn mua mới không gắn được', async () => {
    const done = (await manager.post(`/api/contracts/${buyContract.id}/cancel`, { date: '2019-03-01', note: 'Nhà cung cấp không giao được' }).expect(200)).body;
    expect(done).toMatchObject({ status: 'HUY', closedDate: '2019-03-01', closeNote: 'Nhà cung cấp không giao được' });
    expect((await purchaseOrder({ contractId: buyContract.id }).expect(400)).body.message).toContain('đã huỷ');
    const log = JSON.stringify((await manager.get(`/api/audit-logs/entity/Contract/${buyContract.id}`)).body);
    expect(log).toContain('contract.cancel');
  });
});
