// Giá nhập chỉ cho người mua / duyệt / định giá / trả tiền: Thủ kho và Sale đọc đơn nhập, phiếu kho, danh mục hàng NCC
// nhưng không thấy đơn giá. Needs the demo seed; reads only.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';

describe('Ẩn giá nhập (e2e)', () => {
  let app: INestApplication;
  const api = () => request(app.getHttpServer());
  async function as(email: string) {
    const token = (await api().post('/api/auth/login').send({ email, password: DEMO_PASSWORD }).expect(200)).body.accessToken;
    return (url: string) => api().get(url).set('Authorization', `Bearer ${token}`);
  }
  let manager: Awaited<ReturnType<typeof as>>, storekeeper: Awaited<ReturnType<typeof as>>, sale: Awaited<ReturnType<typeof as>>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    manager = await as('quan.ly@ninhtrang.local');
    storekeeper = await as('thu.kho@ninhtrang.local');
    sale = await as('sale1@ninhtrang.local');
  });

  afterAll(async () => {
    await app.close();
  });

  it('đơn nhập: Quản lý thấy đơn giá; Thủ kho và Sale thấy số lượng nhưng không thấy giá', async () => {
    const all = (await manager('/api/purchase-orders').expect(200)).body;
    const priced = all.find((o: { totalValue: number }) => o.totalValue > 0);
    expect(priced).toBeDefined();
    expect(priced.lines[0].unitPrice).toBeGreaterThan(0);
    for (const client of [storekeeper, sale]) {
      const list = (await client('/api/purchase-orders').expect(200)).body;
      const o = list.find((x: { id: string }) => x.id === priced.id);
      expect(o).toMatchObject({ totalValue: null, receivedValue: null });
      expect(o.lines[0].unitPrice).toBeNull();
      expect(o.lines[0].quantity).toBe(priced.lines[0].quantity);
      expect((await client(`/api/purchase-orders/${priced.id}`).expect(200)).body.lines[0].unitPrice).toBeNull();
    }
  });

  it('phiếu nhập kho và giá mua theo NCC cũng ẩn với Thủ kho', async () => {
    const vouchers = (await manager('/api/warehouse-vouchers').expect(200)).body as { id: string; type: string; lines: { unitPrice?: number | null }[] }[];
    const nhap = vouchers.find((v) => v.type === 'NHAP' && v.lines.some((l) => (l.unitPrice ?? 0) > 0));
    expect(nhap).toBeDefined();
    const seen = ((await storekeeper('/api/warehouse-vouchers').expect(200)).body as typeof vouchers).find((v) => v.id === nhap!.id)!;
    expect(seen.lines.every((l) => l.unitPrice === null)).toBe(true);

    const catalog = (await manager('/api/supplier-products').expect(200)).body as { purchasePrice: number | null }[];
    expect(catalog.some((c) => (c.purchasePrice ?? 0) > 0)).toBe(true);
    const hidden = (await storekeeper('/api/supplier-products').expect(200)).body as { purchasePrice: number | null }[];
    expect(hidden.every((c) => c.purchasePrice === null)).toBe(true);
  });
});
