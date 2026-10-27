// Rà soát nghiệp vụ, đợt 2 (25/10/2026, as MISA): công nợ theo từng đợt giao / nhận (lỗ 7), trả lại hàng mua (8), khoá sổ
// kỳ kế toán (9), không chi vượt tồn quỹ (10), chốt giao đúng tài xế (12), xem đơn cần quyền (13). Needs the demo seed.
// Works on its own customer, supplier, products, account, role and documents; removed in afterAll.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const today = day(0);
const WH = 'wh-ninhtrang';

describe('Kỳ kế toán, công nợ theo đợt, trả lại hàng mua (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let item = '';
  let customerId = '';
  let supplierId = '';
  const products: string[] = [];
  const orders: string[] = [];
  const purchases: string[] = [];
  const trips: string[] = [];
  const accounts: string[] = [];
  const roleId = 'role-e2e-xuong';
  const workerEmail = 'e2e.xuong@ninhtrang.local';

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
  let manager: Client, accountant: Client, storekeeper: Client, driver: Client, sale: Client;

  const stock = async () =>
    ((await manager.get('/api/stock-levels').expect(200)).body as { productId: string; warehouseId: string; quantity: number }[])
      .find((s) => s.productId === item && s.warehouseId === WH)?.quantity ?? 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    manager = await as('quan.ly@ninhtrang.local');
    accountant = await as('ke.toan@ninhtrang.local');
    storekeeper = await as('thu.kho@ninhtrang.local');
    driver = await as('tai.xe@ninhtrang.local');
    sale = await as('sale1@ninhtrang.local');
    item = (await manager.post('/api/products', { name: 'E2E Kỳ kế toán', type: 'VAT_TU', baseUnit: 'Cái', retailPrice: 100000, defaultWarehouseId: WH }).expect(201)).body.id;
    products.push(item);
    customerId = (await manager.post('/api/customers', { name: 'E2E Khách nợ theo đợt', type: 'LE', creditDays: 10, tagIds: [] }).expect(201)).body.id;
    supplierId = (await manager.post('/api/suppliers', { name: 'E2E NCC trả hàng', creditDays: 15 }).expect(201)).body.id;
    await manager.post('/api/warehouse-vouchers', { type: 'NHAP', date: today, warehouseId: WH, lines: [{ productId: item, quantity: 100, unitPrice: 1000 }] }).expect(201);
  });

  afterAll(async () => {
    await prisma.companyInfo.update({ where: { id: 1 }, data: { lockDate: null } });
    const codes = (await prisma.salesOrder.findMany({ where: { id: { in: orders } } })).map((o) => o.code);
    await prisma.cashVoucher.deleteMany({ where: { OR: [{ customerId }, { supplierId }, { accountId: { in: accounts } }, { allocations: { some: { ref: { in: codes } } } }] } });
    await prisma.purchaseReturn.deleteMany({ where: { orderId: { in: purchases } } });
    await prisma.warehouseVoucher.deleteMany({ where: { lines: { some: { productId: { in: products } } } } });
    await prisma.deliveryTrip.deleteMany({ where: { id: { in: trips } } });
    await prisma.salesOrder.deleteMany({ where: { id: { in: orders } } });
    await prisma.purchaseOrder.deleteMany({ where: { id: { in: purchases } } });
    await prisma.cashAccount.deleteMany({ where: { id: { in: accounts } } });
    await prisma.stockLevel.deleteMany({ where: { productId: { in: products } } });
    await prisma.product.deleteMany({ where: { id: { in: products } } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.supplier.deleteMany({ where: { id: supplierId } });
    await prisma.user.deleteMany({ where: { email: workerEmail } });
    await prisma.rolePermission.deleteMany({ where: { roleId } });
    await prisma.role.deleteMany({ where: { id: roleId } });
    await app.close();
  });

  it('lỗ 7: giao hai đợt — hai khoản phải thu, mỗi khoản một hạn; Chọn tay theo đơn trả đợt đầu trước', async () => {
    const o = (await manager.post('/api/sales-orders', {
      customerId, tagIds: [], orderDate: day(-30), discountAmount: 0, salesRep: 'quan.ly@ninhtrang.local',
      lines: [{ productId: item, unit: 'Cái', quantity: 4, unitPrice: 100000, warehouseId: WH }],
    }).expect(201)).body;
    orders.push(o.id);
    await manager.post(`/api/sales-orders/${o.id}/deliver`, { date: day(-20), items: [{ lineIndex: 0, quantity: 1 }] }).expect(200);
    await manager.post(`/api/sales-orders/${o.id}/deliver`, { date: today, items: [{ lineIndex: 0, quantity: 3 }] }).expect(200);
    const row = (await accountant.get('/api/receivables').expect(200)).body.find((r: { partnerId: string }) => r.partnerId === customerId);
    expect(row.items).toEqual([
      { ref: o.code, dueDate: day(-10), amount: 100_000, overdueDays: 10 },
      { ref: `${o.code}·2`, dueDate: day(10), amount: 300_000, overdueDays: -10 },
    ]);
    expect(row.overdue).toBe(100_000);
    await accountant.post('/api/cash-vouchers', {
      kind: 'THU', date: today, category: 'Thu tiền khách hàng', partnerType: 'KHACH_HANG', partnerId: customerId, accountId: 'acc-bank',
      amount: 150_000, allocations: [{ ref: o.code, amount: 150_000 }],
    }).expect(201);
    const after = (await accountant.get('/api/receivables').expect(200)).body.find((r: { partnerId: string }) => r.partnerId === customerId);
    expect(after.items).toEqual([{ ref: `${o.code}·2`, dueDate: day(10), amount: 250_000, overdueDays: -10 }]);
  });

  it('lỗ 8: trả lại hàng mua — xuất kho theo giá mua, giảm công nợ phải trả; huỷ thì tính lại', async () => {
    const po = (await manager.post('/api/purchase-orders', {
      supplierId, date: day(-5), lines: [{ productId: item, quantity: 10, unitPrice: 2000, vatRate: 10, warehouseId: WH }],
    }).expect(201)).body;
    purchases.push(po.id);
    await manager.post(`/api/purchase-orders/${po.id}/send`).expect(200);
    await manager.post(`/api/purchase-orders/${po.id}/receive`, { date: day(-5), items: [{ lineIndex: 0, quantity: 10, warehouseId: WH }] }).expect(200);
    const avgBefore = (await prisma.product.findUniqueOrThrow({ where: { id: item } })).avgCost.toNumber();
    const s0 = await stock();
    const lineId = (await manager.get(`/api/purchase-orders/${po.id}`).expect(200)).body.lines[0].id;
    const body = (quantity: number) => ({ date: today, warehouseId: WH, reason: 'Hàng lỗi', lines: [{ orderLineId: lineId, quantity }] });
    await storekeeper.post(`/api/purchase-orders/${po.id}/returns`, body(3)).expect(403);
    await manager.post(`/api/purchase-orders/${po.id}/returns`, body(11)).expect(400);
    const r = (await manager.post(`/api/purchase-orders/${po.id}/returns`, body(3)).expect(201)).body;
    expect(r).toMatchObject({ code: expect.stringMatching(/^TLM\d{7}$/), amount: 6_600, voucherCode: expect.stringMatching(/^PXK/) });
    expect(await stock()).toBe(s0 - 3);
    // Out at giá mua 2 000: the average is taken back as if those 3 had never come in.
    const onHand = s0;
    const avgAfter = (await prisma.product.findUniqueOrThrow({ where: { id: item } })).avgCost.toNumber();
    expect(avgAfter).toBeCloseTo((onHand * avgBefore - 3 * 2000) / (onHand - 3), 2);
    const payable = async () => (await accountant.get('/api/payables').expect(200)).body.find((x: { partnerId: string }) => x.partnerId === supplierId)?.balance ?? 0;
    expect(await payable()).toBe(22_000 - 6_600);
    const order = (await manager.get(`/api/purchase-orders/${po.id}`).expect(200)).body;
    expect(order).toMatchObject({ returnedValue: 6_600, receivedValue: 22_000 });
    const hidden = (await storekeeper.get(`/api/purchase-orders/${po.id}`).expect(200)).body;
    expect(hidden.returns[0].amount).toBeNull();
    await manager.post(`/api/purchase-orders/${po.id}/returns/${r.id}/cancel`, { reason: 'E2E' }).expect(200);
    expect(await stock()).toBe(s0);
    expect(await payable()).toBe(22_000);
  });

  it('lỗ 7 (mua): nhận hai lần — hai khoản phải trả, mỗi khoản hạn từ ngày nhận', async () => {
    const po = (await manager.post('/api/purchase-orders', {
      supplierId, date: day(-40), lines: [{ productId: item, quantity: 4, unitPrice: 1000, warehouseId: WH }],
    }).expect(201)).body;
    purchases.push(po.id);
    await manager.post(`/api/purchase-orders/${po.id}/send`).expect(200);
    await manager.post(`/api/purchase-orders/${po.id}/receive`, { date: day(-30), items: [{ lineIndex: 0, quantity: 1, warehouseId: WH }] }).expect(200);
    await manager.post(`/api/purchase-orders/${po.id}/receive`, { date: today, items: [{ lineIndex: 0, quantity: 3, warehouseId: WH }] }).expect(200);
    const row = (await accountant.get('/api/payables').expect(200)).body.find((x: { partnerId: string }) => x.partnerId === supplierId);
    const mine = row.items.filter((i: { ref: string }) => i.ref.startsWith(po.code));
    expect(mine).toEqual([
      { ref: po.code, dueDate: day(-15), amount: 1_000, overdueDays: 15 },
      { ref: `${po.code}·2`, dueDate: day(15), amount: 3_000, overdueDays: -15 },
    ]);
  });

  it('lỗ 9: khoá sổ — chứng từ trong kỳ đã khoá không lập / huỷ được; chỉ người có quyền đổi ngày khoá', async () => {
    const v = (await manager.post('/api/warehouse-vouchers', { type: 'NHAP', date: day(-3), warehouseId: WH, lines: [{ productId: item, quantity: 1 }] }).expect(201)).body;
    await sale.put('/api/company/lock-date', { lockDate: day(-2) }).expect(403);
    expect((await accountant.put('/api/company/lock-date', { lockDate: day(-2) }).expect(200)).body.lockDate.slice(0, 10)).toBe(day(-2));
    try {
      const res = await manager.post('/api/warehouse-vouchers', { type: 'NHAP', date: day(-2), warehouseId: WH, lines: [{ productId: item, quantity: 1 }] }).expect(400);
      expect(res.body.message).toContain('kỳ đã khoá sổ');
      await manager.post(`/api/warehouse-vouchers/${v.id}/cancel`, { reason: 'E2E' }).expect(400);
      await accountant.post('/api/cash-vouchers', {
        kind: 'CHI', date: day(-3), category: 'Chi khác', partnerType: 'KHAC', accountId: 'acc-cash', amount: 1000, description: 'E2E khoá sổ',
      }).expect(400);
      await manager.post('/api/warehouse-vouchers', { type: 'NHAP', date: day(-1), warehouseId: WH, lines: [{ productId: item, quantity: 1 }] }).expect(201);
    } finally {
      await accountant.put('/api/company/lock-date', { lockDate: null }).expect(200);
    }
    await manager.post(`/api/warehouse-vouchers/${v.id}/cancel`, { reason: 'E2E' }).expect(200);
  });

  it('lỗ 10: không chi vượt tồn quỹ (tại ngày chứng từ và hiện tại); Quản lý chi vượt được', async () => {
    const acc = await prisma.cashAccount.create({ data: { name: 'E2E Quỹ nhỏ', type: 'TIEN_MAT', openingBalance: 100_000 } });
    accounts.push(acc.id);
    const chi = (amount: number, date = today) => ({ kind: 'CHI', date, category: 'Chi khác', partnerType: 'KHAC', accountId: acc.id, amount, description: 'E2E quỹ' });
    const res = await accountant.post('/api/cash-vouchers', chi(150_000)).expect(400);
    expect(res.body.message).toContain('Tồn quỹ E2E Quỹ nhỏ chỉ còn');
    await accountant.post('/api/cash-vouchers', chi(60_000)).expect(201);
    await accountant.post('/api/cash-vouchers', chi(60_000, day(-1))).expect(400); // the account then had 40 000 left in total
    await manager.post('/api/cash-vouchers', chi(60_000)).expect(201); // voucher.overdraw
  });

  it('lỗ 12: chỉ tài xế của chuyến (hoặc người điều phối) chốt giao được', async () => {
    const o = (await manager.post('/api/sales-orders', {
      customerId, tagIds: [], orderDate: today, discountAmount: 0, salesRep: 'quan.ly@ninhtrang.local',
      lines: [{ productId: item, unit: 'Cái', quantity: 1, unitPrice: 100000, warehouseId: WH }],
    }).expect(201)).body;
    orders.push(o.id);
    const t = (await manager.post('/api/delivery-trips', { date: today, driverName: 'Người Khác' }).expect(201)).body;
    trips.push(t.id);
    await manager.post(`/api/delivery-trips/${t.id}/orders`, { orderIds: [o.id] }).expect(200);
    await manager.post(`/api/delivery-trips/${t.id}/ship`).expect(200);
    const res = await driver.post(`/api/delivery-trips/${t.id}/orders/${o.id}/confirm`, { lines: [{ lineIndex: 0, received: 1 }] }).expect(403);
    expect(res.body.message).toContain('Người Khác');
    await manager.put(`/api/delivery-trips/${t.id}`, { date: today, driverName: 'Đặng Văn Tài' }).expect(200);
    await driver.post(`/api/delivery-trips/${t.id}/orders/${o.id}/confirm`, { lines: [{ lineIndex: 0, received: 1 }] }).expect(200);
  });

  it('lỗ 13: danh sách và chi tiết đơn bán cần quyền xem đơn', async () => {
    await prisma.role.create({ data: { id: roleId, name: 'E2E Xưởng', permissions: { create: [{ permissionCode: 'production.view' }] } } });
    await prisma.user.create({ data: { name: 'E2E Xưởng', email: workerEmail, passwordHash: await bcrypt.hash('E2e-xuong-123', 10), roleId } });
    const worker = await as(workerEmail, 'E2e-xuong-123');
    await worker.get('/api/sales-orders?recentDays=90').expect(403);
    await worker.get('/api/sales-orders/page').expect(403);
    await worker.get(`/api/sales-orders/${orders[0]}`).expect(403);
    // The xưởng still sees the đơn gốc of each lệnh, read-only: mã, khách, ngày cần giao, quy cách — no giá.
    const lsx = (await worker.get('/api/production-orders').expect(200)).body as any[];
    expect(lsx.length).toBeGreaterThan(0);
    expect(lsx[0].sourceOrder).toMatchObject({ code: expect.stringMatching(/^DH\d{7}$/), customerName: expect.any(String), lines: expect.any(Array) });
    expect(Object.keys(lsx[0].sourceOrder).sort()).toEqual(['code', 'customerName', 'lines', 'neededByDate']);
    expect(JSON.stringify(lsx[0].sourceOrder)).not.toMatch(/price|Price|amount/);
    await driver.get('/api/sales-orders?recentDays=90').expect(200);
  });
});
