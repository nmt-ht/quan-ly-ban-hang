// Kết chuyển lãi lỗ và đóng sổ năm. Chạy trên database riêng nt_qa_closing (tạo lại mỗi lần) với các năm 2019–2021,
// xa dữ liệu demo. Số liệu mong đợi tính tay từ các bút toán nhập trong bài.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { createDatabase } from '../src/platform/platform-db.service.js';
import { withDatabase } from '../src/platform/secret-box.js';
import { errorTail, migrateDeploy, runScript } from '../src/platform/tenant-commands.js';

const MAIN_URL = process.env.DATABASE_URL!;
const QA_DB = 'nt_qa_closing';
const QA_URL = withDatabase(MAIN_URL, QA_DB);
const PASSWORD = 'QaMatKhau2026';

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

interface Row { label: string; amount: number }
interface Closing { id: string; date: string; profit: number; reversedAt: string | null; canReverse: boolean }

describe('Kết chuyển lãi lỗ và đóng sổ năm (e2e)', () => {
  let app: INestApplication;
  let savedUrl: string | undefined;
  const api = () => request(app.getHttpServer());
  async function as(email: string) {
    const token = (await api().post('/api/auth/login').send({ email, password: PASSWORD }).expect(200)).body.accessToken;
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    return { get: (url: string) => auth(api().get(url)), post: (url: string, body: object = {}) => auth(api().post(url)).send(body) };
  }
  let manager: Awaited<ReturnType<typeof as>>;
  let sale: Awaited<ReturnType<typeof as>>;

  const entry = (date: string, debit: string, credit: string, amount: number) =>
    manager.post('/api/accounting/journal', { date, description: `${debit}/${credit}`, lines: [{ accountCode: debit, debit: amount, credit: 0 }, { accountCode: credit, debit: 0, credit: amount }] });
  const overview = async (year: number) => (await manager.get(`/api/accounting/closing?year=${year}`).expect(200)).body as {
    closings: Closing[]; lockDate: string | null; yearClose: { profit: number } | null; yearBlocker: string | null; lastClosedDate: string | null;
  };
  const income = async (year: number) => ((await manager.get(`/api/accounting/income-statement?period=${year}`).expect(200)).body.items as Row[]);
  const amountOf = (rows: Row[], start: string) => rows.find((r) => r.label.startsWith(start))!.amount;
  const balanceSheet = async (year: number) => (await manager.get(`/api/accounting/balance-sheet?period=${year}`).expect(200)).body;
  const opening = async (year: number) => {
    const rows = (await manager.get(`/api/accounting/opening-balances?period=${year}`).expect(200)).body.rows as { code: string; debit: number; credit: number }[];
    return Object.fromEntries(rows.filter((r) => r.debit || r.credit).map((r) => [r.code, r.debit ? { debit: r.debit } : { credit: r.credit }]));
  };

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
    manager = await as('quan.ly@ninhtrang.local');
    sale = await as('sale1@ninhtrang.local');

    await manager.post('/api/accounting/settings', { ledgerStartDate: '2019-01-01' }).expect(201);
    await manager.post('/api/accounting/opening-balances', {
      period: '2019', rows: [{ accountCode: '111', debit: 5_000_000, credit: 0 }, { accountCode: '411', debit: 0, credit: 5_000_000 }],
    }).expect(201);
    await entry('2019-03-10', '111', '511', 1_000_000).expect(201); // doanh thu
    await entry('2019-03-15', '642', '331', 300_000).expect(201); // chi phí quản lý
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    process.env.DATABASE_URL = savedUrl;
  });

  it('xem trước số kết chuyển rồi kết chuyển đến một ngày; báo cáo kết quả kinh doanh vẫn đủ số', async () => {
    const preview = (await manager.get('/api/accounting/closing/preview?date=2019-06-30').expect(200)).body;
    expect(preview).toMatchObject({ revenue: 1_000_000, expense: 300_000, profit: 700_000 });

    await sale.post('/api/accounting/closing', { date: '2019-06-30' }).expect(403);
    await manager.post('/api/accounting/closing', { date: '2999-01-01' }).expect(400); // sau hôm nay
    const made = (await manager.post('/api/accounting/closing', { date: '2019-06-30' }).expect(200)).body;
    expect(made).toMatchObject({ date: '2019-06-30', profit: 700_000 });

    const is = await income(2019);
    expect(amountOf(is, '1.')).toBe(1_000_000);
    expect(amountOf(is, '14.')).toBe(700_000);

    // 911: Nợ 1.000.000 (chi phí + lãi) = Có 1.000.000 (doanh thu); lãi nằm ở 421, chưa phân phối không bị tính hai lần.
    const tb = (await manager.get('/api/accounting/trial-balance?period=2019').expect(200)).body.rows as { code: string; debit: number; credit: number; closingCo: number }[];
    expect(tb.find((r) => r.code === '911')).toMatchObject({ debit: 1_000_000, credit: 1_000_000 });
    expect(tb.find((r) => r.code === '421')!.closingCo).toBe(700_000);
    const bs = await balanceSheet(2019);
    expect(bs.balanced).toBe(true);
    expect(bs.resources.find((r: Row) => r.label.includes('(421)')).amount).toBe(700_000);
    expect(bs.totalAssets).toBe(5_000_000 + 1_000_000);
  });

  it('chỉ kết chuyển tiếp sau lần trước, mỗi lần chỉ phần mới; chỉ huỷ được lần gần nhất', async () => {
    await manager.post('/api/accounting/closing', { date: '2019-06-30' }).expect(400); // trùng ngày
    await manager.post('/api/accounting/closing', { date: '2019-05-31' }).expect(400); // trước lần trước
    await manager.post('/api/accounting/closing', { date: '2019-08-31' }).expect(400); // không còn số dư để kết chuyển

    await entry('2019-09-01', '111', '511', 200_000).expect(201);
    const second = (await manager.post('/api/accounting/closing', { date: '2019-09-30' }).expect(200)).body;
    expect(second.profit).toBe(200_000);
    expect(amountOf(await income(2019), '1.')).toBe(1_200_000);

    const { closings } = await overview(2019);
    expect(closings.map((c) => [c.date, c.profit, c.canReverse])).toEqual([['2019-06-30', 700_000, false], ['2019-09-30', 200_000, true]]);

    // Bút toán kết chuyển không đảo riêng lẻ ở Sổ nhật ký.
    const journal = (await manager.get('/api/accounting/journal?from=2019-09-30&to=2019-09-30').expect(200)).body as { id: string; description: string }[];
    const one = journal.find((e) => e.description.startsWith('Kết chuyển'))!;
    expect((await manager.post(`/api/accounting/journal/${one.id}/reverse`).expect(400)).body.message).toContain('Huỷ kết chuyển');

    await manager.post(`/api/accounting/closing/${closings[0].id}/reverse`).expect(400); // không phải lần gần nhất
    await manager.post(`/api/accounting/closing/${closings[1].id}/reverse`).expect(200);
    await manager.post(`/api/accounting/closing/${closings[1].id}/reverse`).expect(400); // đã huỷ

    // Huỷ xong: báo cáo không đổi, lãi 200.000 trở lại thành chưa kết chuyển nhưng bảng cân đối vẫn cân.
    expect(amountOf(await income(2019), '1.')).toBe(1_200_000);
    const bs = await balanceSheet(2019);
    expect(bs.balanced).toBe(true);
    expect(bs.resources.find((r: Row) => r.label.includes('(421)')).amount).toBe(900_000);
    expect((await overview(2019)).lastClosedDate).toBe('2019-06-30');
  });

  it('đóng sổ năm: kết chuyển nốt, chuyển số dư sang đầu năm sau, khoá sổ; không sửa được năm đã đóng', async () => {
    await manager.post('/api/accounting/closing/year/2021/close').expect(400); // phải đóng 2020 trước
    await sale.post('/api/accounting/closing/year/2019/close').expect(403);

    const closed = (await manager.post('/api/accounting/closing/year/2019/close').expect(200)).body;
    expect(closed).toMatchObject({ year: 2019, profit: 900_000 });

    // 111 = 5.000.000 + 1.000.000 + 200.000 · 331 Có 300.000 · 411 Có 5.000.000 · 421 Có 900.000; chi phí, doanh thu, 911 về 0.
    expect(await opening(2020)).toEqual({ '111': { debit: 6_200_000 }, '331': { credit: 300_000 }, '411': { credit: 5_000_000 }, '421': { credit: 900_000 } });

    const o = await overview(2019);
    expect(o.lockDate).toBe('2019-12-31');
    expect(o.yearClose).toMatchObject({ profit: 900_000 });
    expect(o.yearBlocker).toContain('đã đóng sổ');
    expect(o.closings.at(-1)).toMatchObject({ date: '2019-12-31', profit: 200_000, canReverse: false });

    await entry('2019-12-01', '111', '511', 10_000).expect(400); // kỳ đã khoá sổ
    await manager.post('/api/accounting/closing', { date: '2019-12-31' }).expect(400);
    await manager.post(`/api/accounting/closing/${o.closings.at(-1)!.id}/reverse`).expect(400);
    await manager.post('/api/accounting/closing/year/2019/close').expect(400);
    await manager.post('/api/accounting/opening-balances', { period: '2020', rows: [{ accountCode: '111', debit: 1, credit: 0 }] }).expect(400);

    expect(amountOf(await income(2019), '14.')).toBe(900_000);
  });

  it('năm sau bắt đầu từ số dư đã chuyển, đóng tiếp được, và chuỗi năm phải mở lại từ năm cuối', async () => {
    const bs0 = await balanceSheet(2020);
    expect(bs0).toMatchObject({ balanced: true, totalAssets: 6_200_000 });
    expect(amountOf(await income(2020), '1.')).toBe(0);

    await entry('2020-02-01', '111', '511', 100_000).expect(201);
    const closed = (await manager.post('/api/accounting/closing/year/2020/close').expect(200)).body;
    expect(closed.profit).toBe(100_000);
    expect(await opening(2021)).toEqual({ '111': { debit: 6_300_000 }, '331': { credit: 300_000 }, '411': { credit: 5_000_000 }, '421': { credit: 1_000_000 } });
    expect((await overview(2020)).lockDate).toBe('2020-12-31');

    await manager.post('/api/accounting/closing/year/2019/reopen').expect(400); // 2020 còn đóng
    await sale.post('/api/accounting/closing/year/2020/reopen').expect(403);
    await manager.post('/api/accounting/closing/year/2020/reopen').expect(200);
    expect((await overview(2020)).lockDate).toBe('2019-12-31'); // trả về ngày khoá sổ trước khi đóng
    await manager.post('/api/accounting/closing/year/2020/reopen').expect(400);

    await manager.post('/api/accounting/closing/year/2019/reopen').expect(200);
    const o = await overview(2019);
    expect(o.lockDate).toBeNull();
    expect(o.yearClose).toBeNull();
    expect(o.yearBlocker).toBeNull();

    // Năm mở lại sửa được: huỷ kết chuyển 31/12 rồi đóng sổ lại cho số liệu mới.
    await manager.post(`/api/accounting/closing/${o.closings.at(-1)!.id}/reverse`).expect(200);
    await entry('2019-12-01', '111', '511', 50_000).expect(201);
    const again = (await manager.post('/api/accounting/closing/year/2019/close').expect(200)).body;
    expect(again.profit).toBe(950_000);
    expect(await opening(2020)).toMatchObject({ '111': { debit: 6_250_000 }, '421': { credit: 950_000 } });
  });
});
