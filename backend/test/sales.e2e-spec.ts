// Đợt 4 — đơn hàng bán, lệnh sản xuất, công nợ phải thu, end to end against the seeded local DB.
// Works on its own test products, role, user and orders; everything created here is removed in afterAll.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
const today = new Date().toISOString().slice(0, 10);

describe('Bán hàng, sản xuất & công nợ phải thu (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const products: string[] = [];
  const orders: string[] = [];
  let roleId = '';
  let userId = '';
  let cashBefore = 0;

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
  type Client = Awaited<ReturnType<typeof as>>;
  let admin: Client, manager: Client, sale: Client, storekeeper: Client, accountant: Client;
  let tp = '', item = '', service = '', material = '';

  async function stock(productId: string, warehouseId: string): Promise<number> {
    const rows = (await manager.get('/api/stock-levels').expect(200)).body as { productId: string; warehouseId: string; quantity: number }[];
    return rows.find((s) => s.productId === productId && s.warehouseId === warehouseId)?.quantity ?? 0;
  }
  const product = async (body: object) => {
    const p = (await manager.post('/api/products', body).expect(201)).body;
    products.push(p.id);
    return p.id as string;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    admin = await as('admin@ninhtrang.local', ADMIN_PASSWORD);
    manager = await as('quan.ly@ninhtrang.local');
    sale = await as('sale1@ninhtrang.local');
    storekeeper = await as('thu.kho@ninhtrang.local');
    accountant = await as('ke.toan@ninhtrang.local');

    material = await product({ name: 'E2E Vật tư', type: 'VAT_TU', baseUnit: 'Cây', defaultWarehouseId: 'wh-vattu' });
    tp = await product({ name: 'E2E Thành phẩm', type: 'THANH_PHAM', baseUnit: 'Cái', retailPrice: 100000 });
    item = await product({ name: 'E2E Hàng bán', type: 'VAT_TU', baseUnit: 'Cái', retailPrice: 50000 });
    service = await product({ name: 'E2E Dịch vụ', type: 'DICH_VU', baseUnit: 'Lần', retailPrice: 20000 });
    await manager.put('/api/bom-lines', { replacements: [{ finishedProductId: tp, lines: [{ componentId: material, quantityPerUnit: 2 }] }] }).expect(200);
    await manager.post('/api/warehouse-vouchers', { type: 'NHAP', date: today, warehouseId: 'wh-vattu', lines: [{ productId: material, quantity: 100 }] }).expect(201);
    await manager.post('/api/warehouse-vouchers', { type: 'NHAP', date: today, warehouseId: 'wh-ninhtrang', lines: [{ productId: item, quantity: 10 }] }).expect(201);
    cashBefore = (await manager.get('/api/cash-accounts').expect(200)).body.find((a: any) => a.id === 'acc-cash').balance;
  });

  afterAll(async () => {
    const receipts = await prisma.cashVoucher.findMany({ where: { allocations: { some: { ref: { in: (await prisma.salesOrder.findMany({ where: { id: { in: orders } } })).map((o) => o.code) } } } } });
    await prisma.cashVoucher.deleteMany({ where: { id: { in: receipts.map((r) => r.id) } } });
    await prisma.warehouseVoucher.deleteMany({ where: { lines: { some: { productId: { in: products } } } } });
    await prisma.productionOrder.deleteMany({ where: { sourceOrderId: { in: orders } } });
    await prisma.salesOrder.deleteMany({ where: { id: { in: orders } } });
    await prisma.stockLevel.deleteMany({ where: { productId: { in: products } } });
    await prisma.bomLine.deleteMany({ where: { finishedProductId: { in: products } } });
    await prisma.product.deleteMany({ where: { id: { in: products } } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
    if (roleId) await prisma.role.delete({ where: { id: roleId } });
    await app.close();
  });

  const order = (lines: object[], extra: object = {}) => ({
    customerId: 'kh-01', tagIds: [], orderDate: today, salesRep: 'sale1@ninhtrang.local', discountAmount: 0, lines, ...extra,
  });

  it('runs a whole order: lập → lệnh SX → bắt đầu (xuất vật tư) → nghiệm thu (nhập TP) → giao một phần + thu tiền ngay → kết thúc', async () => {
    const lines = [
      { productId: tp, unit: 'Cái', quantity: 3, unitPrice: 100000 },
      { productId: item, unit: 'Cái', quantity: 4, unitPrice: 50000, discountRate: 10 },
      { productId: service, unit: 'Lần', quantity: 1, unitPrice: 20000, vatRate: 10 },
    ];
    // Chiết khấu ngoài khuyến mãi needs order.discount: Sale is refused, Quản lý lập the đơn for Sale's khách.
    await sale.post('/api/sales-orders', order(lines, { discountAmount: 30000, payNowAccountId: 'acc-cash' })).expect(403);
    const o = (await manager.post('/api/sales-orders', order(lines, { discountAmount: 30000, payNowAccountId: 'acc-cash' })).expect(201)).body;
    orders.push(o.id);
    // gross 520 000; CK dòng 20 000; CK đơn 30 000 chia 18 000 / 10 800 / 1 200; VAT 10% of 18 800 on the service.
    expect(o).toMatchObject({
      code: expect.stringMatching(/^DH\d{7}$/), status: 'CHO_SAN_XUAT', totalGoods: 520_000, vatAmount: 1_880, totalOrder: 471_880,
      receivedValue: 0, salesRep: 'sale1@ninhtrang.local', createdBy: 'quan.ly@ninhtrang.local',
    });
    expect(o.lines[1]).toMatchObject({ discountRate: 10, discountAmount: 20_000, lineTotal: 200_000 });

    await storekeeper.post(`/api/sales-orders/${o.id}/deliver`, { date: today, items: [{ lineIndex: 1, quantity: 1, warehouseId: 'wh-ninhtrang' }] }).expect(400);

    const made = (await manager.post(`/api/sales-orders/${o.id}/production-orders`).expect(201)).body;
    expect(made.created).toHaveLength(1);
    const lsx = made.created[0];
    expect(lsx).toMatchObject({ code: expect.stringMatching(/^LSX\d{7}$/), status: 'NHAP', quantity: 3, createdDate: today, bomSnapshot: [{ componentId: material, quantityPerUnit: 2 }] });
    await manager.post(`/api/sales-orders/${o.id}/production-orders`).expect(400);

    // Editing while the lệnh is still Nháp carries the new quantity over to it.
    const fresh = (await sale.get(`/api/sales-orders/${o.id}`).expect(200)).body;
    await sale.put(`/api/sales-orders/${o.id}`, order(lines.map((l, i) => (i === 0 ? { ...l, quantity: 5 } : l)), { discountAmount: 30000, payNowAccountId: 'acc-cash', updatedAt: '2020-01-01T00:00:00.000Z' })).expect(409);
    await sale.put(`/api/sales-orders/${o.id}`, order(lines.map((l, i) => (i === 0 ? { ...l, quantity: 5 } : l)), { discountAmount: 30000, payNowAccountId: 'acc-cash', updatedAt: fresh.updatedAt })).expect(200);
    expect((await manager.get('/api/production-orders').expect(200)).body.find((x: any) => x.id === lsx.id).quantity).toBe(5);

    const started = (await manager.post(`/api/production-orders/${lsx.id}/start`).expect(200)).body;
    expect(started.productionOrder).toMatchObject({ status: 'DANG_SAN_XUAT', startDate: today });
    expect(started.order.status).toBe('DANG_SAN_XUAT');
    expect(await stock(material, 'wh-vattu')).toBe(90); // 2 × 5 cây
    await sale.put(`/api/sales-orders/${o.id}`, order(lines, { updatedAt: started.order.updatedAt })).expect(400); // production started

    const done = (await manager.post(`/api/production-orders/${lsx.id}/complete`, { producedQuantity: 4 }).expect(200)).body;
    expect(done.productionOrder).toMatchObject({ status: 'HOAN_TAT', producedQuantity: 4, completeDate: today });
    expect(done.order.status).toBe('CHO_GIAO_HANG');
    expect(await stock(tp, 'wh-thanhpham')).toBe(4);

    const delivered = (await storekeeper.post(`/api/sales-orders/${o.id}/deliver`, {
      date: today, note: 'E2E',
      items: [
        { lineIndex: 0, quantity: 2, warehouseId: 'wh-thanhpham' },
        { lineIndex: 1, quantity: 4, warehouseId: 'wh-ninhtrang' },
        { lineIndex: 2, quantity: 1, warehouseId: '' },
      ],
    }).expect(200)).body;
    // 5 TP now, so the CK đơn splits 21 429 / 7 714 / 857: 478 571 × 2/5 + 172 286 + (19 143 + VAT 1 914)
    expect(delivered.order).toMatchObject({ status: 'GIAO_MOT_PHAN', receivedValue: 384_771, deliveredDate: today });
    expect(await stock(tp, 'wh-thanhpham')).toBe(2);
    expect(await stock(item, 'wh-ninhtrang')).toBe(6);
    expect(delivered.receipts).toHaveLength(1);
    expect(delivered.receipts[0]).toMatchObject({
      code: expect.stringMatching(/^PT\d{7}$/), kind: 'THU', amount: 384_771, partnerId: 'kh-01', accountId: 'acc-cash',
      allocations: [{ ref: o.code, amount: 384_771 }],
    });
    const cash = (await manager.get('/api/cash-accounts').expect(200)).body.find((a: any) => a.id === 'acc-cash').balance;
    expect(cash).toBe(cashBefore + 384_771);

    // Công nợ phải thu: the order is owed for what was received, and the phiếu thu settled it.
    await sale.get('/api/receivables').expect(403);
    const row = (await accountant.get('/api/receivables').expect(200)).body.find((r: any) => r.partnerId === 'kh-01');
    expect(row.entries.find((e: any) => e.ref === o.code)).toMatchObject({ kind: 'PHAT_SINH', amount: 384_771, remaining: 0, sourceId: o.id });
    expect(row.items.find((i: any) => i.ref === o.code)).toBeUndefined();

    await sale.post(`/api/sales-orders/${o.id}/cancel`).expect(400); // already delivered
    const closed = (await sale.post(`/api/sales-orders/${o.id}/close`).expect(200)).body;
    expect(closed.closedDate).toBe(today);
    await storekeeper.post(`/api/sales-orders/${o.id}/deliver`, { date: today, items: [{ lineIndex: 0, quantity: 1, warehouseId: 'wh-thanhpham' }] }).expect(400);
  });

  it('huỷ: cancelling an order cancels its open lệnh; cancelling the lệnh alone sends the order back to Chờ sản xuất', async () => {
    const a = (await sale.post('/api/sales-orders', order([{ productId: tp, unit: 'Cái', quantity: 1, unitPrice: 100000 }])).expect(201)).body;
    orders.push(a.id);
    const lsxA = (await manager.post(`/api/sales-orders/${a.id}/production-orders`).expect(201)).body.created[0];
    expect((await sale.post(`/api/sales-orders/${a.id}/cancel`, { reason: 'E2E' }).expect(200)).body).toMatchObject({ status: 'HUY', cancelReason: 'E2E' });
    expect((await manager.get('/api/production-orders').expect(200)).body.find((x: any) => x.id === lsxA.id).status).toBe('HUY');

    const b = (await sale.post('/api/sales-orders', order([{ productId: tp, unit: 'Cái', quantity: 1, unitPrice: 100000 }])).expect(201)).body;
    orders.push(b.id);
    const lsxB = (await manager.post(`/api/sales-orders/${b.id}/production-orders`).expect(201)).body.created[0];
    await manager.post(`/api/production-orders/${lsxB.id}/start`).expect(200);
    const cancelled = (await manager.post(`/api/production-orders/${lsxB.id}/cancel`, { reason: 'Hỏng máy' }).expect(200)).body;
    expect(cancelled.productionOrder).toMatchObject({ status: 'HUY', cancelReason: 'Hỏng máy' });
    expect(cancelled.order.status).toBe('CHO_SAN_XUAT');
  });

  it('loại bán hàng (MISA): mặc định trong nước; xuất khẩu thuế GTGT 0%, ngoại tệ phải có tỷ giá', async () => {
    const line = (vatRate: number) => [{ productId: item, unit: 'Cái', quantity: 2, unitPrice: 50000, vatRate }];
    const domestic = (await sale.post('/api/sales-orders', order(line(10))).expect(201)).body;
    orders.push(domestic.id);
    expect(domestic).toMatchObject({ saleType: 'TRONG_NUOC', currency: null, exchangeRate: null, vatAmount: 10000 });

    const refused = async (body: object, message: RegExp) =>
      expect((await sale.post('/api/sales-orders', body).expect(400)).body.message).toMatch(message);
    await refused(order(line(10), { saleType: 'XUAT_KHAU' }), /thuế GTGT 0%/);
    await refused(order(line(0), { saleType: 'XUAT_KHAU', currency: 'USD' }), /tỷ giá/);
    await refused(order(line(10), { currency: 'USD', exchangeRate: 25400 }), /trong nước/);
    await sale.post('/api/sales-orders', order(line(0), { saleType: 'NHAP_KHAU' })).expect(400);

    const exported = (await sale.post('/api/sales-orders', order(line(0), { saleType: 'XUAT_KHAU', currency: 'usd', exchangeRate: 25400 })).expect(201)).body;
    orders.push(exported.id);
    expect(exported).toMatchObject({ saleType: 'XUAT_KHAU', currency: 'USD', exchangeRate: 25400, vatAmount: 0, totalOrder: 100000 });

    // Về trong nước: bỏ ngoại tệ, thuế suất theo mặt hàng; Nhật ký ghi đổi loại bán hàng.
    const back = (await sale.put(`/api/sales-orders/${exported.id}`, { ...order(line(10)), updatedAt: exported.updatedAt }).expect(200)).body;
    expect(back).toMatchObject({ saleType: 'TRONG_NUOC', currency: null, exchangeRate: null, vatAmount: 10000 });
    const log = await prisma.auditLog.findFirst({ where: { entityId: exported.id, action: 'sales_order.update' } });
    expect(log?.changes).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'saleType', from: 'Xuất khẩu', to: 'Bán trong nước' })]));
  });

  it('đơn giá: without order.update_price a line must keep the list price for the customer type', async () => {
    const role = (await admin.post('/api/roles', { name: 'E2E Bán không sửa giá' }).expect(201)).body;
    roleId = role.id;
    await admin.put(`/api/roles/${role.id}/permissions`, { codes: ['order.view', 'order.create', 'order.update'] }).expect(200);
    const u = (await admin.post('/api/users', { name: 'E2E Bán', email: 'e2e.ban@ninhtrang.local', roleId: role.id, password: 'E2eban123' }).expect(201)).body;
    userId = u.id;
    // A new account picks its own password first; the server refuses everything else until then.
    const first = (await api().post('/api/auth/login').send({ email: 'e2e.ban@ninhtrang.local', password: 'E2eban123' }).expect(200)).body.accessToken;
    await api().post('/api/auth/change-password').set('Authorization', `Bearer ${first}`).send({ currentPassword: 'E2eban123', newPassword: 'E2eban456' }).expect(200);
    const seller = await as('e2e.ban@ninhtrang.local', 'E2eban456');
    await seller.post('/api/sales-orders', order([{ productId: item, unit: 'Cái', quantity: 1, unitPrice: 45000 }])).expect(403);
    const ok = (await seller.post('/api/sales-orders', order([{ productId: item, unit: 'Cái', quantity: 1, unitPrice: 50000 }])).expect(201)).body;
    orders.push(ok.id);
    expect(ok.status).toBe('CHO_GIAO_HANG'); // no thành phẩm: nothing to produce
  });
});
