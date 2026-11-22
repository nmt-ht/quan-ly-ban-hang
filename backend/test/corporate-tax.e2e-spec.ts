// Thuế TNDN: tạm tính quý, quyết toán năm, lỗ chuyển, hạch toán 821 / 3334. Chạy trên database riêng nt_qa_cit (tạo lại mỗi lần)
// với các năm 2019–2020 xa dữ liệu demo. Số liệu mong đợi tính tay từ các bút toán nhập trong bài.
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
const QA_DB = 'nt_qa_cit';
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
interface Assessment { id: string; period: string; taxBooked: number; reversedAt: string | null; canReverse: boolean }

describe('Thuế TNDN (e2e)', () => {
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
  const preview = async (year: number, period: string, extra = '') => (await manager.get(`/api/accounting/cit/preview?year=${year}&period=${period}${extra}`).expect(200)).body;
  const overview = async (year: number) => (await manager.get(`/api/accounting/cit?year=${year}`).expect(200)).body as {
    assessments: Assessment[]; nextPeriod: string | null; booked: number; payable: number; lossAvailable: number; yearClosed: boolean;
  };
  const create = (year: number, period: string, body: object = {}) => manager.post('/api/accounting/cit', { year, period, ...body });
  const trial = async (code: string) => {
    const rows = (await manager.get('/api/accounting/trial-balance?period=2019').expect(200)).body.rows as { code: string; debit: number; credit: number; closingNo: number; closingCo: number }[];
    return rows.find((r) => r.code === code);
  };
  const income = async (year: number, start: string) => ((await manager.get(`/api/accounting/income-statement?period=${year}`).expect(200)).body.items as Row[]).find((r) => r.label.startsWith(start))!.amount;

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
    await entry('2019-02-10', '111', '511', 1_000_000).expect(201); // doanh thu
    await entry('2019-03-05', '642', '331', 400_000).expect(201); // chi phí quản lý
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    process.env.DATABASE_URL = savedUrl;
  });

  it('quý I: lợi nhuận kế toán cộng chi phí không được trừ, nhân thuế suất, ghi Nợ 821 / Có 3334', async () => {
    const p = await preview(2019, 'Q1', '&addbacks=100000');
    expect(p).toMatchObject({ revenue: 1_000_000, accountingProfit: 600_000, beforeLoss: 700_000, rate: 20, taxableIncome: 700_000, taxCumulative: 140_000, taxBooked: 140_000, blocker: null });

    await sale.post('/api/accounting/cit', { year: 2019, period: 'Q1' }).expect(403);
    await create(2019, 'Q9').expect(400);
    await create(2999, 'Q1').expect(400); // kỳ chưa kết thúc
    const made = (await create(2019, 'Q1', { addbacks: 100_000 }).expect(200)).body;
    expect(made).toMatchObject({ taxBooked: 140_000, taxCumulative: 140_000 });
    await create(2019, 'Q1').expect(400); // đã tính

    expect(await trial('821')).toMatchObject({ debit: 140_000, closingNo: 140_000 });
    expect(await trial('3334')).toMatchObject({ credit: 140_000, closingCo: 140_000 });
    expect(await income(2019, '13.')).toBe(140_000);
    const bs = (await manager.get('/api/accounting/balance-sheet?period=2019').expect(200)).body;
    expect(bs.balanced).toBe(true);

    const o = await overview(2019);
    expect(o).toMatchObject({ nextPeriod: 'Q2', booked: 140_000, payable: 140_000 });

    // Phiếu chi "Nộp thuế TNDN" mặc định hạch toán vào 3334.
    const cats = (await manager.get('/api/cash-categories').expect(200)).body as { name: string; kind: string; defaultAccountCode: string | null }[];
    expect(cats.find((c) => c.name === 'Nộp thuế TNDN')).toMatchObject({ kind: 'CHI', defaultAccountCode: '3334' });
  });

  it('quý II tính luỹ kế rồi trừ phần đã ghi; chỉ huỷ được kỳ gần nhất; bút toán không đảo riêng', async () => {
    await entry('2019-05-10', '111', '511', 500_000).expect(201);
    const p = await preview(2019, 'Q2', '&addbacks=100000');
    expect(p).toMatchObject({ accountingProfit: 1_100_000, taxCumulative: 240_000, taxPrior: 140_000, taxBooked: 100_000 });
    await create(2019, 'Q2', { addbacks: 100_000 }).expect(200);

    const o = await overview(2019);
    expect(o.assessments.map((a) => [a.period, a.taxBooked, a.canReverse])).toEqual([['Q1', 140_000, false], ['Q2', 100_000, true]]);
    expect((await preview(2019, 'Q1')).blocker).toContain('Quý II'); // đã tính tới quý II
    await manager.post(`/api/accounting/cit/${o.assessments[0].id}/reverse`).expect(400);

    const journal = (await manager.get('/api/accounting/journal?from=2019-06-30&to=2019-06-30').expect(200)).body as { id: string; description: string }[];
    const one = journal.find((e) => e.description.startsWith('Thuế TNDN'))!;
    expect((await manager.post(`/api/accounting/journal/${one.id}/reverse`).expect(400)).body.message).toContain('Huỷ ở Kế toán');

    await manager.post(`/api/accounting/cit/${o.assessments[1].id}/reverse`).expect(200);
    expect((await trial('3334'))).toMatchObject({ closingCo: 140_000 });
    await create(2019, 'Q2', { addbacks: 100_000 }).expect(200); // làm lại được
    expect((await overview(2019)).booked).toBe(240_000);
  });

  it('quyết toán năm lỗ: thuế về 0 và hoàn lại thuế đã ghi (Nợ 3334 / Có 821)', async () => {
    await entry('2019-11-15', '642', '331', 1_500_000).expect(201);
    const p = await preview(2019, 'Y', '&addbacks=100000');
    expect(p).toMatchObject({ accountingProfit: -400_000, beforeLoss: -300_000, taxableIncome: 0, taxCumulative: 0, taxPrior: 240_000, taxBooked: -240_000 });
    await create(2019, 'Y', { addbacks: 100_000 }).expect(200);
    await create(2019, 'Y').expect(400);

    // Có: 140 + 100 + 100 (Q2 làm lại); Nợ: 100 (huỷ Q2) + 240 (hoàn khi quyết toán lỗ) — còn lại 0.
    expect(await trial('3334')).toMatchObject({ debit: 340_000, credit: 340_000, closingNo: 0, closingCo: 0 });
    expect((await overview(2019)).payable).toBe(0);
    expect(await income(2019, '13.')).toBe(0);
    expect(((await manager.get('/api/accounting/balance-sheet?period=2019').expect(200)).body).balanced).toBe(true);
    expect((await overview(2019)).nextPeriod).toBeNull();
  });

  it('lỗ chuyển: trừ vào năm sau, còn lại dùng tiếp, hết hạn sau 5 năm', async () => {
    await entry('2020-04-01', '111', '511', 1_200_000).expect(201);
    await entry('2020-05-01', '642', '331', 200_000).expect(201);

    expect(await preview(2020, 'Y')).toMatchObject({ accountingProfit: 1_000_000, lossAvailable: 300_000, lossUsed: 300_000, taxableIncome: 700_000, taxCumulative: 140_000 });
    expect(await preview(2020, 'Y', '&lossUsed=200000')).toMatchObject({ lossUsed: 200_000, taxableIncome: 800_000, taxCumulative: 160_000 });
    expect(await preview(2020, 'Q4', '&lossUsed=200000')).toMatchObject({ lossUsed: 0, taxableIncome: 1_000_000 }); // quý không trừ lỗ
    await create(2020, 'Y', { lossUsed: 200_000 }).expect(200);

    expect((await overview(2021)).lossAvailable).toBe(100_000);
    expect((await overview(2024)).lossAvailable).toBe(100_000);
    expect((await overview(2025)).lossAvailable).toBe(0);
  });

  it('thuế suất gợi ý theo doanh thu từ 2025; đóng sổ năm chặn sửa thuế, mở lại thì sửa được', async () => {
    expect(await preview(2025, 'Q1')).toMatchObject({ suggestedRate: 15, rate: 15, blocker: null });
    expect(await preview(2019, 'Q1', '&rate=17')).toMatchObject({ suggestedRate: 20, rate: 17 });

    expect((await manager.get('/api/accounting/closing?year=2019').expect(200)).body.citAssessed).toBe(true);
    await manager.post('/api/accounting/closing/year/2019/close').expect(200);
    const o = await overview(2019);
    expect(o.yearClosed).toBe(true);
    const last = o.assessments.filter((a) => !a.reversedAt).at(-1)!;
    expect(last.canReverse).toBe(false);
    await manager.post(`/api/accounting/cit/${last.id}/reverse`).expect(400);
    expect((await preview(2019, 'Y')).blocker).toContain('đã đóng sổ');

    await manager.post('/api/accounting/closing/year/2019/reopen').expect(200);
    await manager.post(`/api/accounting/cit/${last.id}/reverse`).expect(200);
    expect((await overview(2019)).nextPeriod).toBe('Q3'); // kỳ gần nhất còn lại là Q2
  });
});
