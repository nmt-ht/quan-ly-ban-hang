// Số liệu của 11 báo cáo chưa có test riêng: kho (dưới tối thiểu, nhập xuất tồn, nằm im, thẻ kho, vòng quay),
// mua hàng (nhập hàng, giá mua), sản xuất, bán dưới giá vốn, khách ngừng mua, chi phí xe.
// Works on its own products, customers, orders and chuyến; everything created here is removed in afterAll.
//
// Dữ liệu dựng theo thứ tự ghi sổ (giá vốn bình quân tính theo thứ tự này, báo cáo theo ngày chứng từ):
//   20 ngày trước  đơn nhập 1: vật tư A 10 × 100 000          → tồn 10, bình quân 100 000
//   hôm nay        đơn nhập 2: vật tư A 10 × 120 000          → tồn 20, bình quân 110 000
//   20 ngày trước  khách C mua 2 A × 200 000 (rồi không mua nữa) → tồn 18
//   hôm nay        lệnh SX 3 thành phẩm (định mức 2 A)         → xuất 6 A = 660 000, nhập 3 TP giá 220 000
//   hôm nay        khách D mua 3 TP × 150 000 (dưới giá vốn)   → lỗ 3 × 70 000
//   200 ngày trước nhập 5 vật tư B × 50 000, không xuất lần nào → nằm im
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { isoDay } from '../src/modules/reports/report.rules.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDay(d);
};
const today = isoDay();
const d10 = daysAgo(10);
const d20 = daysAgo(20);
const d200 = daysAgo(200);

describe('Báo cáo: số liệu từng báo cáo (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const products: string[] = [];
  const customers: string[] = [];
  const salesOrders: string[] = [];
  const purchaseOrders: string[] = [];
  const trips: string[] = [];
  let a = '', b = '', tp = '', lostCustomer = '', tpOrder = '', lostOrder = '';
  let trip: { id: string; plateNumber: string };

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
  let manager: Client, sale: Client, storekeeper: Client;

  async function product(body: object): Promise<string> {
    const id = (await manager.post('/api/products', body).expect(201)).body.id;
    products.push(id);
    return id;
  }
  async function customer(name: string): Promise<string> {
    const id = (await manager.post('/api/customers', { name, type: 'LE', creditDays: 0, tagIds: [] }).expect(201)).body.id;
    customers.push(id);
    return id;
  }
  async function buy(date: string, unitPrice: number) {
    const o = (await manager.post('/api/purchase-orders', {
      supplierId: 'ncc-1', date, note: 'E2E báo cáo', lines: [{ productId: a, quantity: 10, unitPrice, warehouseId: 'wh-vattu' }],
    }).expect(201)).body;
    purchaseOrders.push(o.id);
    await manager.post(`/api/purchase-orders/${o.id}/send`).expect(200);
    await storekeeper.post(`/api/purchase-orders/${o.id}/receive`, { date, items: [{ lineIndex: 0, quantity: 10, warehouseId: 'wh-vattu' }] }).expect(200);
  }
  async function sell(customerId: string, date: string, productId: string, quantity: number, unitPrice: number, warehouseId: string) {
    const o = (await manager.post('/api/sales-orders', {
      customerId, tagIds: [], orderDate: date, discountAmount: 0, salesRep: 'quan.ly@ninhtrang.local',
      lines: [{ productId, unit: 'Cái', quantity, unitPrice, warehouseId }],
    }).expect(201)).body;
    salesOrders.push(o.id);
    return o.id as string;
  }
  const deliver = (orderId: string, date: string, quantity: number, warehouseId: string) =>
    storekeeper.post(`/api/sales-orders/${orderId}/deliver`, { date, items: [{ lineIndex: 0, quantity, warehouseId }] }).expect(200);
  const report = async (slug: string, query: string) => (await manager.get(`/api/reports/${slug}?${query}`).expect(200)).body;
  const rowOf = (r: { rows: any[] }, id: string) => r.rows.find((x) => x.id === id);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    manager = await as('quan.ly@ninhtrang.local');
    sale = await as('sale1@ninhtrang.local');
    storekeeper = await as('thu.kho@ninhtrang.local');

    a = await product({ name: 'E2E BC Vật tư A', type: 'VAT_TU', baseUnit: 'Cái', defaultWarehouseId: 'wh-vattu', minStock: 30, retailPrice: 200000 });
    b = await product({ name: 'E2E BC Vật tư nằm im', type: 'VAT_TU', baseUnit: 'Cái', defaultWarehouseId: 'wh-vattu' });
    tp = await product({ name: 'E2E BC Thành phẩm', type: 'THANH_PHAM', baseUnit: 'Cái', retailPrice: 150000 });
    await manager.put('/api/bom-lines', { replacements: [{ finishedProductId: tp, lines: [{ componentId: a, quantityPerUnit: 2 }] }] }).expect(200);
    lostCustomer = await customer('E2E BC Khách ngừng mua');
    const current = await customer('E2E BC Khách đang mua');

    await buy(d20, 100000);
    await buy(today, 120000);
    lostOrder = await sell(lostCustomer, d20, a, 2, 200000, 'wh-vattu');
    await deliver(lostOrder, d20, 2, 'wh-vattu');

    tpOrder = await sell(current, today, tp, 3, 150000, 'wh-thanhpham');
    const lsx = (await manager.post(`/api/sales-orders/${tpOrder}/production-orders`).expect(201)).body.created[0];
    await manager.post(`/api/production-orders/${lsx.id}/start`).expect(200);
    await manager.post(`/api/production-orders/${lsx.id}/complete`, { producedQuantity: 3 }).expect(200);
    await deliver(tpOrder, today, 3, 'wh-thanhpham');

    await manager.post('/api/warehouse-vouchers', { type: 'NHAP', date: d200, warehouseId: 'wh-vattu', lines: [{ productId: b, quantity: 5, unitPrice: 50000 }] }).expect(201);

    trip = (await manager.post('/api/delivery-trips', { date: today, plateNumber: 'E2E-99X', driverName: 'E2E Tài xế báo cáo' }).expect(201)).body;
    trips.push(trip.id);
    await manager.put(`/api/delivery-trips/${trip.id}/costs`, { fuel: 100000, toll: 20000, other: 5000, note: 'E2E' }).expect(200);
  });

  afterAll(async () => {
    await prisma.warehouseVoucher.deleteMany({ where: { lines: { some: { productId: { in: products } } } } });
    await prisma.productionOrder.deleteMany({ where: { sourceOrderId: { in: salesOrders } } });
    await prisma.deliveryTrip.deleteMany({ where: { id: { in: trips } } });
    await prisma.salesOrder.deleteMany({ where: { id: { in: salesOrders } } });
    await prisma.purchaseOrder.deleteMany({ where: { id: { in: purchaseOrders } } });
    await prisma.stockLevel.deleteMany({ where: { productId: { in: products } } });
    await prisma.bomLine.deleteMany({ where: { finishedProductId: { in: products } } });
    await prisma.product.deleteMany({ where: { id: { in: products } } });
    await prisma.customer.deleteMany({ where: { id: { in: customers } } });
    await app.close();
  });

  it('dưới tồn tối thiểu: tồn 12, tối thiểu 30 → thiếu 18, tiền cần bù 18 × 110 000', async () => {
    const r = await report('duoi-ton-toi-thieu', '');
    expect(rowOf(r, a)).toMatchObject({ qty: 12, min: 30, short: 18, need: 1_980_000 });
    expect(rowOf(r, b)).toBeUndefined(); // không đặt tồn tối thiểu
  });

  it('nhập xuất tồn: tồn đầu kỳ + nhập − xuất = tồn cuối kỳ, theo ngày chứng từ', async () => {
    const r = await report('nhap-xuat-ton', `from=${d10}&to=${today}`);
    expect(rowOf(r, a)).toMatchObject({ opening: 8, in: 10, out: 6, closing: 12 });
    expect(rowOf(r, tp)).toMatchObject({ opening: 0, in: 3, out: 3, closing: 0 });
    expect(rowOf(r, b)).toMatchObject({ opening: 5, in: 0, out: 0, closing: 5 });
    // Kỳ trước ngày nhập đầu tiên: chưa có gì, vật tư A không có dòng.
    expect(rowOf(await report('nhap-xuat-ton', `from=${daysAgo(30)}&to=${daysAgo(25)}`), a)).toBeUndefined();
  });

  it('hàng nằm im: chỉ hàng còn tồn không có chứng từ từ số ngày đã chọn', async () => {
    const r = await report('hang-nam-im', 'group=180');
    expect(rowOf(r, b)).toMatchObject({ qty: 5, value: 250_000, last: d200, lastOut: null, days: 200 });
    expect(rowOf(r, a)).toBeUndefined(); // có chứng từ hôm nay
    expect(rowOf(await report('hang-nam-im', 'group=365'), b)).toBeUndefined();
  });

  it('thẻ kho: dòng tồn đầu kỳ rồi từng chứng từ trong kỳ, số tồn chạy đúng', async () => {
    const r = await report('the-kho', `from=${d10}&to=${today}&item=${a}`);
    expect(r.rows.map((x: any) => [x.kind, x.in, x.out, x.balance])).toEqual([
      ['Tồn đầu kỳ', null, null, 8],
      ['Nhập kho', 10, null, 18],
      ['Xuất kho', null, 6, 12],
    ]);
    expect(r.totals).toMatchObject({ in: 10, out: 6, balance: 12 });
    expect(r.rows[1].link).toEqual(['/kho/phieu', expect.any(String)]);
    expect((await report('the-kho', `from=${d10}&to=${today}`)).rows).toEqual([]); // chưa chọn mặt hàng
  });

  it('vòng quay tồn kho: xuất 6 trong 11 ngày, tồn cuối 12 → đủ dùng 22 ngày, quay 0,6 vòng', async () => {
    const r = await report('vong-quay-ton-kho', `from=${d10}&to=${today}`);
    expect(rowOf(r, a)).toMatchObject({ stock: 12, used: 6, perDay: 0.5455, cover: 22, turns: 0.6, value: 1_320_000 });
    expect(rowOf(r, b)).toMatchObject({ stock: 5, used: 0, cover: null, turns: 0 }); // không xuất: không biết đủ dùng bao lâu
    expect(r.kpis.find((k: any) => k.label === 'Mặt hàng còn tồn không xuất').value).not.toBe('0');
  });

  it('nhập hàng: giá trị theo phiếu nhập của đơn nhập, đơn giá trung bình theo số lượng', async () => {
    const r = await report('mua-hang', `from=${d20}&to=${today}&group=product`);
    expect(rowOf(r, a)).toMatchObject({ qty: 20, value: 2_200_000, vouchers: 2, avg: 110_000 });
    expect(rowOf(await report('mua-hang', `from=${d10}&to=${today}&group=product`), a)).toMatchObject({ qty: 10, value: 1_200_000, vouchers: 1 });
  });

  it('giá mua biến động: lần đầu 100 000, gần nhất 120 000 → tăng 20%; theo dòng so với lần trước', async () => {
    const r = await report('gia-mua', `from=${d20}&to=${today}&group=product`);
    expect(rowOf(r, a)).toMatchObject({ times: 2, first: 100_000, last: 120_000, min: 100_000, max: 120_000, avg: 110_000, spread: 20, change: 20 });
    const lines = (await report('gia-mua', `from=${d20}&to=${today}&group=line`)).rows.filter((x: any) => x.link?.[1] === a);
    expect(lines.map((x: any) => [x.date, x.price, x.vsPrev])).toEqual([[today, 120_000, 20], [d20, 100_000, null]]); // mới nhất trước
  });

  it('sản xuất: chi phí vật tư theo giá đã chốt trên phiếu xuất vật tư', async () => {
    const r = await report('san-xuat', `from=${today}&to=${today}`);
    expect(rowOf(r, tp)).toMatchObject({ orders: 1, planned: 3, made: 3, waste: 0, cost: 660_000, unit_cost: 220_000 });
  });

  it('bán dưới giá vốn: giá bán thực 150 000 dưới giá vốn đã chốt 220 000 → lỗ 210 000', async () => {
    const r = await report('ban-duoi-gia-von', `from=${today}&to=${today}`);
    expect(r.rows.find((x: any) => x.id === `${tpOrder}:${tp}`)).toMatchObject({ qty: 3, price: 150_000, cost: 220_000, loss: 210_000 });
    expect(r.rows.some((x: any) => x.id === `${lostOrder}:${a}`)).toBe(false); // bán 200 000 trên giá vốn 110 000
  });

  it('khách ngừng mua: mua trước kỳ, không nhận hàng trong kỳ', async () => {
    const r = await report('khach-ngung-mua', `from=${d10}&to=${today}`);
    expect(rowOf(r, lostCustomer)).toMatchObject({ last: d20, since: 20, orders: 1, revenue: 400_000 });
    expect(rowOf(await report('khach-ngung-mua', `from=${d20}&to=${today}`), lostCustomer)).toBeUndefined(); // kỳ có lần mua
  });

  it('chi phí xe: theo xe (xe thuê ngoài) và theo tài xế', async () => {
    const byVehicle = await report('chi-phi-xe', `from=${today}&to=${today}&group=vehicle`);
    expect(rowOf(byVehicle, `ext:${trip.plateNumber}`)).toMatchObject({ name: `${trip.plateNumber} (thuê ngoài)`, trips: 1, fuel: 100_000, toll: 20_000, other: 5_000, total: 125_000, avg: 125_000 });
    const byDriver = await report('chi-phi-xe', `from=${today}&to=${today}&group=driver`);
    expect(rowOf(byDriver, 'E2E Tài xế báo cáo')).toMatchObject({ trips: 1, total: 125_000 });
  });

  it('mỗi báo cáo theo đúng quyền của nhóm: Sale chỉ báo cáo bán hàng, Thủ kho không có báo cáo nào', async () => {
    await sale.get('/api/reports/khach-ngung-mua').expect(200);
    for (const slug of ['ban-duoi-gia-von', 'duoi-ton-toi-thieu', 'nhap-xuat-ton', 'hang-nam-im', 'the-kho', 'vong-quay-ton-kho', 'mua-hang', 'gia-mua', 'san-xuat', 'chi-phi-xe']) {
      await sale.get(`/api/reports/${slug}`).expect(403);
      await storekeeper.get(`/api/reports/${slug}`).expect(403);
    }
  });
});
