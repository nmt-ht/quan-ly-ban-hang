// Báo cáo tài chính in theo mẫu TT133: B01b-DNN (tình hình tài chính), B02-DNN (kết quả kinh doanh), sổ nhật ký chung S03a-DNN.
// Chạy trên database riêng nt_qa_stmt (tạo lại mỗi lần) với năm 2019, xa dữ liệu demo. Số liệu tính tay từ các bút toán nhập trong bài.
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
const QA_DB = 'nt_qa_stmt';
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

interface Line { code: string; label: string; amount: number | null; prior: number | null }

describe('Báo cáo tài chính theo mẫu TT133 (e2e)', () => {
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
  const position = async (date: string) => (await manager.get(`/api/accounting/statements/financial-position?date=${date}`).expect(200)).body as { lines: Line[]; balanced: boolean; unmapped: string[] };
  const at = (lines: Line[], code: string) => lines.find((l) => l.code === code)!;

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
    await entry('2019-03-15', '642', '331', 300_000).expect(201); // chi phí quản lý, còn nợ người bán
    await entry('2019-04-01', '156', '331', 700_000).expect(201); // mua hàng chưa trả tiền
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    process.env.DATABASE_URL = savedUrl;
  });

  it('B01b-DNN: số cuối năm theo sổ cái, số đầu năm theo số dư đầu năm, bảng cân', async () => {
    await sale.get('/api/accounting/statements/financial-position?date=2019-06-30').expect(403);
    await manager.get('/api/accounting/statements/financial-position').expect(400);

    const p = await position('2019-06-30');
    expect(p.balanced).toBe(true);
    expect(p.unmapped).toEqual([]);
    expect(at(p.lines, '110')).toMatchObject({ amount: 6_000_000, prior: 5_000_000 });
    expect(at(p.lines, '141')).toMatchObject({ amount: 700_000, prior: 0 });
    expect(at(p.lines, '100')).toMatchObject({ amount: 6_700_000, prior: 5_000_000 });
    expect(at(p.lines, '300')).toMatchObject({ amount: 6_700_000, prior: 5_000_000 });
    expect(at(p.lines, '411')).toMatchObject({ amount: 1_000_000, prior: 0 });
    expect(at(p.lines, '511')).toMatchObject({ amount: 5_000_000, prior: 5_000_000 });
    expect(at(p.lines, '517')).toMatchObject({ amount: 700_000, prior: 0 }); // lãi chưa kết chuyển
    expect(at(p.lines, '600')).toMatchObject({ amount: 6_700_000, prior: 5_000_000 });
    expect(p.lines[0].code).toBe('100');
    expect(p.lines.at(-1)!.code).toBe('600');
  });

  it('kết chuyển lãi lỗ không đổi báo cáo: lãi chuyển từ "chưa kết chuyển" sang 421, vẫn cân', async () => {
    await manager.post('/api/accounting/closing', { date: '2019-06-30' }).expect(200);
    const p = await position('2019-06-30');
    expect(p.balanced).toBe(true);
    expect(at(p.lines, '517').amount).toBe(700_000);
    expect(at(p.lines, '300').amount).toBe(6_700_000);
  });

  it('B02-DNN: chỉ tiêu và mã số, bỏ bút toán kết chuyển, kỳ trước ở cột riêng', async () => {
    const r = (await manager.get('/api/accounting/statements/income-statement?from=2019-01-01&to=2019-06-30').expect(200)).body as { priorFrom: string; priorTo: string; lines: Line[] };
    expect([r.priorFrom, r.priorTo]).toEqual(['2018-01-01', '2018-06-30']);
    expect(r.lines.map((l) => l.code)).toEqual(['01', '02', '10', '11', '20', '21', '22', '23', '24', '30', '31', '32', '40', '50', '51', '60']);
    expect(at(r.lines, '01')).toMatchObject({ amount: 1_000_000, prior: 0 });
    expect(at(r.lines, '10').amount).toBe(1_000_000);
    expect(at(r.lines, '24').amount).toBe(300_000);
    expect(at(r.lines, '30').amount).toBe(700_000);
    expect(at(r.lines, '50').amount).toBe(700_000);
    expect(at(r.lines, '60').amount).toBe(700_000); // sau khi đã kết chuyển vẫn đủ số
    expect(at(r.lines, '23').amount).toBeNull();
    await manager.get('/api/accounting/statements/income-statement?from=2019-06-30&to=2019-01-01').expect(400);
  });

  it('sổ nhật ký chung S03a-DNN: theo ngày tăng dần, mỗi bút toán đủ dòng Nợ / Có', async () => {
    const j = (await manager.get('/api/accounting/books/journal?from=2019-01-01&to=2019-06-30').expect(200)).body as {
      truncated: boolean; rows: { code: string; date: string; description: string | null; lines: { accountCode: string; debit: number; credit: number }[] }[];
    };
    expect(j.truncated).toBe(false);
    const dates = j.rows.map((r) => r.date);
    expect(dates).toEqual([...dates].sort());
    expect(j.rows[0].date).toBe('2019-03-10');
    expect(j.rows[0].lines).toEqual([{ accountCode: '111', debit: 1_000_000, credit: 0 }, { accountCode: '511', debit: 0, credit: 1_000_000 }]);
    for (const r of j.rows) {
      expect(r.lines.reduce((s, l) => s + l.debit, 0)).toBe(r.lines.reduce((s, l) => s + l.credit, 0));
    }
    expect(j.rows.some((r) => r.description?.startsWith('Kết chuyển'))).toBe(true);
    await manager.get('/api/accounting/books/journal?from=2019-01-01').expect(400);
  });
});
