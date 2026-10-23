// Runs around every e2e file: any write the file made through the API that did not log a Nhật ký line
// left an `api.unaudited` row (AuditContextInterceptor). Fail the file so the missing log gets written.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

let since: Date;

beforeAll(() => {
  since = new Date();
});

// Registered before the suite's own afterAll, so it runs after the app has closed its connections
// (`prisma dev` serves one connection at a time).
afterAll(async () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) });
  try {
    const rows = await prisma.auditLog.findMany({ where: { action: 'api.unaudited', at: { gte: since } }, select: { entityId: true } });
    expect(rows.map((r) => r.entityId), 'API ghi dữ liệu nhưng không ghi nhật ký').toEqual([]);
  } finally {
    await prisma.$disconnect();
  }
});
