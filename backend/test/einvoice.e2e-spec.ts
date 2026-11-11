// Hoá đơn điện tử (docs/ke-hoach-hoa-don-dien-tu.md, tasks 1–6) with the "Thử nghiệm" provider: phát hành theo đợt
// giao, không trùng (bấm hai lần, hai người cùng lúc), người mua phải hợp lệ, quyền, and the đợt / phiếu trả hàng a
// hoá đơn was made from cannot change under it. Needs the demo seed. Works on its own customers, product and đơn;
// removed in afterAll, and the thiết lập hoá đơn điện tử is put back as it was.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { vnDay } from '../src/common/text.js';
import { releaseDeliveries, assertReturnNotInvoiced } from '../src/modules/einvoice/einvoice-guards.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
const day = (offset: number) => vnDay(new Date(Date.now() + offset * 86_400_000));
const today = day(0);
const WH = 'wh-ninhtrang';
const SERIES = `C${today.slice(2, 4)}TAA`;

describe('Hoá đơn điện tử — phát hành qua nhà cung cấp thử (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let item = '';
  const customers: string[] = [];
  const orders: string[] = [];
  let savedSettings: Record<string, unknown> | null = null;

  const api = () => request(app.getHttpServer());
  async function as(email: string) {
    const token = (await api().post('/api/auth/login').send({ email, password: DEMO_PASSWORD }).expect(200)).body.accessToken;
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    return {
      get: (url: string) => auth(api().get(url)),
      post: (url: string, body: object = {}) => auth(api().post(url)).send(body),
      put: (url: string, body: object) => auth(api().put(url)).send(body),
    };
  }
  type Client = Awaited<ReturnType<typeof as>>;
  let manager: Client, accountant: Client, sale: Client;

  /** An đơn of `customerId` for 3 + 1 cái at 100.000 ₫, VAT 10%, delivered in two đợt (today −2 and today). */
  async function deliveredOrder(customerId: string) {
    const o = (await manager.post('/api/sales-orders', {
      customerId, tagIds: [], orderDate: day(-5), discountAmount: 0, salesRep: 'quan.ly@ninhtrang.local',
      lines: [{ productId: item, unit: 'Cái', quantity: 4, unitPrice: 100_000, vatRate: 10, warehouseId: WH }],
    }).expect(201)).body;
    orders.push(o.id);
    await manager.post(`/api/sales-orders/${o.id}/deliver`, { date: day(-2), items: [{ lineIndex: 0, quantity: 3 }] }).expect(200);
    await manager.post(`/api/sales-orders/${o.id}/deliver`, { date: today, items: [{ lineIndex: 0, quantity: 1 }] }).expect(200);
    return (await manager.get(`/api/sales-orders/${o.id}`).expect(200)).body as { id: string; code: string; updatedAt: string; deliveries: { id: string; amount: number }[] };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    manager = await as('quan.ly@ninhtrang.local');
    accountant = await as('ke.toan@ninhtrang.local');
    sale = await as('sale1@ninhtrang.local');
    savedSettings = await prisma.eInvoiceSettings.findUnique({ where: { id: 1 } });
    item = (await manager.post('/api/products', { name: 'E2E Hoá đơn điện tử', type: 'VAT_TU', baseUnit: 'Cái', retailPrice: 100_000, defaultWarehouseId: WH }).expect(201)).body.id;
    await manager.post('/api/warehouse-vouchers', { type: 'NHAP', date: day(-5), warehouseId: WH, lines: [{ productId: item, quantity: 50, unitPrice: 50_000 }] }).expect(201);
    await manager.put('/api/einvoice/settings', { provider: 'FAKE', environment: 'SANDBOX', templateCode: '1', series: SERIES, autoEmail: false }).expect(200);
  });

  afterAll(async () => {
    await prisma.eInvoice.deleteMany({ where: { orderId: { in: orders } } });
    if (savedSettings) await prisma.eInvoiceSettings.update({ where: { id: 1 }, data: savedSettings });
    else await prisma.eInvoiceSettings.deleteMany({ where: { id: 1 } });
    await prisma.salesReturn.deleteMany({ where: { orderId: { in: orders } } });
    await prisma.cashVoucher.deleteMany({ where: { customerId: { in: customers } } });
    await prisma.warehouseVoucher.deleteMany({ where: { lines: { some: { productId: item } } } });
    await prisma.salesOrder.deleteMany({ where: { id: { in: orders } } });
    await prisma.stockLevel.deleteMany({ where: { productId: item } });
    await prisma.product.deleteMany({ where: { id: item } });
    await prisma.customer.deleteMany({ where: { id: { in: customers } } });
    await app.close();
  });

  it('phát hành từng đợt: chờ → đã phát hành có số; tổng đúng công nợ của đợt; không xuất hai lần', async () => {
    const c = (await manager.post('/api/customers', {
      name: 'Anh Nam', companyName: 'E2E Công ty Hoá Đơn', companyTaxCode: '0101234567', type: 'SI', creditDays: 0, tagIds: [],
      addresses: [{ address: '12 Phố Huế, Hà Nội', isDefault: true }],
    }).expect(201)).body;
    customers.push(c.id);
    const o = await deliveredOrder(c.id);
    const [d1, d2] = o.deliveries;

    const preview = (await accountant.get(`/api/einvoice/preview?orderId=${o.id}&deliveryId=${d1.id}`).expect(200)).body;
    expect(preview).toMatchObject({ series: SERIES, issueDate: day(-2), total: 330_000, buyer: { taxCode: '0101234567', address: '12 Phố Huế, Hà Nội' } });
    expect(preview.lines).toEqual([expect.objectContaining({ nature: 1, quantity: 3, unitPrice: 100_000, amount: 300_000, vat: '10' })]);

    const sent = (await accountant.post('/api/einvoice/issue', { orderId: o.id, deliveryId: d1.id, updatedAt: o.updatedAt }).expect(200)).body;
    expect(sent).toMatchObject({ status: 'PENDING', total: 330_000, issueDate: day(-2), number: null });
    await prisma.eInvoice.update({ where: { id: sent.id }, data: { nextPollAt: new Date(0) } });
    const list = (await accountant.get(`/api/einvoice/order/${o.id}`).expect(200)).body;
    expect(list).toEqual([expect.objectContaining({ id: sent.id, status: 'ISSUED', number: expect.stringMatching(/^\d+$/), taxAuthorityCode: expect.any(String) })]);

    // Again for the same đợt: refused, whether it is the same person or the đơn moved on.
    await accountant.post('/api/einvoice/issue', { orderId: o.id, deliveryId: d1.id }).expect(409);
    // Whole đơn while a đợt already has its hoá đơn: refused.
    await accountant.post('/api/einvoice/issue', { orderId: o.id }).expect(409);
    // An old updatedAt: refused.
    await accountant.post('/api/einvoice/issue', { orderId: o.id, deliveryId: d2.id, updatedAt: '2020-01-01T00:00:00.000Z' }).expect(409);

    // Two at once for đợt 2: exactly one hoá đơn.
    const both = await Promise.all([1, 2].map(() => accountant.post('/api/einvoice/issue', { orderId: o.id, deliveryId: d2.id })));
    expect(both.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.eInvoice.count({ where: { orderId: o.id, deliveryId: d2.id } })).toBe(1);

    // The đợt cannot be removed (bỏ chốt giao) under the hoá đơn.
    await expect(prisma.$transaction((tx) => releaseDeliveries(tx, o.id, [d1.id], o.code))).rejects.toThrow('không bỏ chốt giao');
    await expect(prisma.salesOrderDelivery.delete({ where: { id: d1.id } })).rejects.toThrow();
  });

  it('người mua là tổ chức phải có mã số thuế; khách cá nhân không cần', async () => {
    const org = (await manager.post('/api/customers', { name: 'Chị Hoa', companyName: 'E2E Cty thiếu MST', type: 'SI', creditDays: 0, tagIds: [], addresses: [{ address: 'Đà Nẵng', isDefault: true }] }).expect(201)).body;
    const person = (await manager.post('/api/customers', { name: 'E2E Khách lẻ hoá đơn', type: 'LE', creditDays: 0, tagIds: [] }).expect(201)).body;
    customers.push(org.id, person.id);
    const a = await deliveredOrder(org.id);
    const res = await accountant.post('/api/einvoice/issue', { orderId: a.id, deliveryId: a.deliveries[0].id }).expect(400);
    expect(res.body.message).toContain('cần mã số thuế');
    const b = await deliveredOrder(person.id);
    await accountant.post('/api/einvoice/issue', { orderId: b.id, deliveryId: b.deliveries[0].id }).expect(200);
  });

  it('nhà cung cấp từ chối: lỗi, gửi lại được; quyền: Sale chỉ xem', async () => {
    const c = (await manager.post('/api/customers', { name: '[lỗi] E2E', type: 'LE', creditDays: 0, tagIds: [] }).expect(201)).body;
    customers.push(c.id);
    const o = await deliveredOrder(c.id);
    const failed = (await accountant.post('/api/einvoice/issue', { orderId: o.id, deliveryId: o.deliveries[0].id }).expect(200)).body;
    expect(failed).toMatchObject({ status: 'FAILED', error: expect.stringContaining('từ chối') });
    // A failed attempt does not hold the đợt: another attempt goes out under a new key.
    await prisma.customer.update({ where: { id: c.id }, data: { name: 'E2E đã sửa tên' } });
    const retried = await accountant.post(`/api/einvoice/${failed.id}/retry`);
    expect([retried.status, retried.body.message]).toEqual([200, undefined]);
    const again = retried.body;
    expect(again.status).toBe('PENDING');
    expect(again.partnerKey).not.toBe(failed.partnerKey);

    // Sale has einvoice.view but sees only the đơn they sell: another seller's đơn is not found.
    await sale.get(`/api/einvoice/order/${o.id}`).expect(404);
    await sale.post('/api/einvoice/issue', { orderId: o.id, deliveryId: o.deliveries[1].id }).expect(403);
    await sale.get('/api/einvoice/settings').expect(403);
    await accountant.get('/api/einvoice/settings').expect(403);
  });

  it('phiếu trả hàng đã có hoá đơn điều chỉnh không huỷ được', async () => {
    const c = (await manager.post('/api/customers', { name: 'E2E Khách trả hàng HĐ', type: 'LE', creditDays: 0, tagIds: [] }).expect(201)).body;
    customers.push(c.id);
    const o = await deliveredOrder(c.id);
    const lineId = (await prisma.salesOrderLine.findFirstOrThrow({ where: { orderId: o.id } })).id;
    const r = (await manager.post(`/api/sales-orders/${o.id}/returns`, { date: today, warehouseId: WH, reason: 'Hàng lỗi', lines: [{ orderLineId: lineId, quantity: 1 }] }).expect(201)).body;
    await prisma.eInvoice.create({
      data: {
        kind: 'ADJUST', status: 'ISSUED', orderId: o.id, returnId: r.id, partnerKey: `e2e-${r.id}`, provider: 'FAKE', templateCode: '1', series: SERIES,
        number: '999', issueDate: new Date(`${today}T00:00:00Z`), buyer: {}, lines: [], taxable: -100_000, vat: -10_000, total: -110_000,
        createdById: (await prisma.user.findFirstOrThrow({ where: { email: 'ke.toan@ninhtrang.local' } })).id,
      },
    });
    await expect(prisma.$transaction((tx) => assertReturnNotInvoiced(tx, r.id, r.code))).rejects.toThrow('không huỷ phiếu trả hàng');
    const res = await manager.post(`/api/sales-orders/${o.id}/returns/${r.id}/cancel`, { reason: 'Nhầm' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('hoá đơn điều chỉnh');
  });
});
