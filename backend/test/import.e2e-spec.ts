// Pha 1.9 — nhập Excel có xem trước: máy chủ kiểm tra từng dòng như form, xem trước không lưu gì, dòng lỗi bị bỏ qua
// còn dòng hợp lệ vẫn vào. Needs the demo seed. Removes what it creates in afterAll.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
const TAG = `E2E-IMP-${Date.now()}`;

describe('Nhập Excel có xem trước (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const api = () => request(app.getHttpServer());
  async function as(email: string) {
    const token = (await api().post('/api/auth/login').send({ email, password: DEMO_PASSWORD }).expect(200)).body.accessToken;
    return { post: (url: string, body: object = {}) => api().post(url).set('Authorization', `Bearer ${token}`).send(body) };
  }
  type Client = Awaited<ReturnType<typeof as>>;
  let manager: Client, sale: Client;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    manager = await as('quan.ly@ninhtrang.local');
    sale = await as('sale1@ninhtrang.local');
  });

  afterAll(async () => {
    await prisma.customer.deleteMany({ where: { name: { startsWith: TAG } } });
    await prisma.supplier.deleteMany({ where: { name: { startsWith: TAG } } });
    await prisma.product.deleteMany({ where: { name: { startsWith: TAG } } });
    await app.close();
  });

  const customerRows = [
    { row: 2, cells: { name: `${TAG} Khách A`, type: 'Sỉ', phone: '0999000111', creditDays: '15', creditLimit: '5.000.000', address: 'Số 1 Phố Huế' } },
    { row: 3, cells: { name: `${TAG} Khách B`, type: 'Khách quen' } }, // loại khách sai
    { row: 4, cells: { name: '', type: 'Lẻ' } }, // thiếu tên
    { row: 5, cells: { name: `${TAG} Khách C`, phone: '0999000111' } }, // trùng điện thoại dòng 2
    { row: 6, cells: { code: 'KH9999999', name: 'x' } }, // mã không có
  ];

  it('xem trước khách hàng: lỗi từng dòng, không lưu gì, không ghi nhật ký', async () => {
    const before = await prisma.auditLog.count();
    const res = (await manager.post('/api/customers/import', { dryRun: true, rows: customerRows }).expect(200)).body;
    expect(res).toMatchObject({ dryRun: true, created: 1, failed: 4 });
    const byRow = new Map(res.rows.map((r: { row: number }) => [r.row, r]));
    expect(byRow.get(2)).toMatchObject({ action: 'create', code: expect.stringMatching(/^KH\d{7}$/) });
    expect((byRow.get(3) as { errors: string[] }).errors.join()).toContain('Loại khách');
    expect((byRow.get(4) as { errors: string[] }).errors.join()).toContain('Tên khách hàng');
    expect((byRow.get(5) as { errors: string[] }).errors.join()).toContain('trùng');
    expect((byRow.get(6) as { errors: string[] }).errors.join()).toContain('KH9999999');
    expect(await prisma.customer.count({ where: { name: { startsWith: TAG } } })).toBe(0);
    expect(await prisma.auditLog.count()).toBe(before);
  });

  it('nhập thật: dòng hợp lệ vào, dòng lỗi bỏ qua; nhập lại theo mã = cập nhật / không đổi', async () => {
    const res = (await manager.post('/api/customers/import', { rows: customerRows }).expect(200)).body;
    expect(res).toMatchObject({ dryRun: false, created: 1, failed: 4 });
    const c = await prisma.customer.findFirstOrThrow({ where: { name: `${TAG} Khách A` }, include: { addresses: true } });
    expect(c).toMatchObject({ type: 'SI', creditDays: 15, phone: '0999000111' });
    expect(c.creditLimit.toNumber()).toBe(5_000_000);
    expect(c.addresses).toMatchObject([{ address: 'Số 1 Phố Huế', isDefault: true }]);
    const log = await prisma.auditLog.findFirst({ where: { action: 'customer.import' }, orderBy: { at: 'desc' } });
    expect(log?.summary).toContain('1 thêm mới');

    const again = (await manager.post('/api/customers/import', {
      rows: [
        { row: 2, cells: { code: c.code, name: c.name, creditDays: '30' } }, // chỉ có vài cột: các cột khác giữ nguyên
        { row: 3, cells: { code: c.code, name: c.name } },
      ],
    }).expect(200)).body;
    expect(again.rows[0]).toMatchObject({ action: 'update', changes: ['Số ngày được nợ'] });
    expect(again.rows[1].action).toBe('error'); // cùng mã hai lần
    const after = await prisma.customer.findUniqueOrThrow({ where: { id: c.id } });
    expect(after).toMatchObject({ creditDays: 30, type: 'SI', phone: '0999000111' });
    const same = (await manager.post('/api/customers/import', { rows: [{ row: 2, cells: { code: c.code, creditDays: 30 } }] }).expect(200)).body;
    expect(same.rows[0].action).toBe('unchanged');
  });

  it('nhà cung cấp: thêm mới, trùng mã số thuế bị chặn', async () => {
    const res = (await manager.post('/api/suppliers/import', {
      rows: [
        { row: 2, cells: { name: `${TAG} NCC 1`, taxCode: '0109999999', creditDays: 7, isActive: 'Có' } },
        { row: 3, cells: { name: `${TAG} NCC 2`, taxCode: '0109999999' } },
        { row: 4, cells: { name: `${TAG} NCC 3`, isActive: 'Có lẽ' } },
      ],
    }).expect(200)).body;
    expect(res.rows.map((r: { action: string }) => r.action)).toEqual(['create', 'error', 'error']);
    expect(res.rows[2].errors.join()).toContain('Còn hợp tác');
  });

  it('hàng hoá: lỗi của một dòng không làm hỏng cả file; người không có quyền nhập bị chặn', async () => {
    await sale.post('/api/products/import', { dryRun: true, rows: [] }).expect(403);
    const ok = { name: `${TAG} Hàng 1`, type: 'VAT_TU', baseUnit: 'Cái', retailPrice: 1000 };
    const res = (await manager.post('/api/products/import', {
      dryRun: true,
      rows: [
        { row: 2, data: ok },
        { row: 3, data: { ...ok, name: 'x'.repeat(500) } },
        { row: 4, data: { ...ok, name: `${TAG} Hàng 3`, retailPrice: -5 } },
      ],
    }).expect(200)).body;
    expect(res.rows.map((r: { action: string }) => r.action)).toEqual(['create', 'error', 'error']);
    expect(res.rows[1].errors.join()).toContain('Tên');
    expect(await prisma.product.count({ where: { name: { startsWith: TAG } } })).toBe(0);
  });
});
