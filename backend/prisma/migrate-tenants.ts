// Runs on every start after the DATABASE_URL migration (package.json › start:render): in multi-tenant mode
// (PLATFORM_DATABASE_URL set) every other doanh nghiệp's database gets the same `prisma migrate deploy`,
// so a deploy never leaves one doanh nghiệp on the old structure. One failure is reported (and shown on
// Quản trị nền tảng) without stopping the others or the start-up.
import 'dotenv/config';
import pg from 'pg';
import { describeUrl, unseal } from '../src/platform/secret-box.js';
import { errorTail, latestMigration, migrateDeploy } from '../src/platform/tenant-commands.js';

async function main() {
  if (!process.env.PLATFORM_DATABASE_URL) return;
  const pool = new pg.Pool({ connectionString: process.env.PLATFORM_DATABASE_URL, max: 1 });
  try {
    const exists = await pool.query("SELECT to_regclass('platform_tenant') AS t").catch(() => null);
    if (!exists?.rows[0]?.t) return console.log('Nhiều doanh nghiệp: chưa có danh sách doanh nghiệp, bỏ qua.');
    const { rows } = await pool.query<{ code: string; database_url_enc: string }>(
      "SELECT code, database_url_enc FROM platform_tenant WHERE status IN ('ACTIVE', 'SUSPENDED') ORDER BY created_at",
    );
    const version = latestMigration();
    for (const row of rows) {
      const url = unseal(row.database_url_enc);
      if (url === process.env.DATABASE_URL) continue; // already migrated by the step before
      const r = await migrateDeploy(url);
      if (r.ok) {
        await pool.query('UPDATE platform_tenant SET migrated_at = now(), schema_version = $2, last_error = NULL, updated_at = now() WHERE code = $1', [row.code, version]);
        console.log(`Doanh nghiệp ${row.code} (${describeUrl(url)}): cấu trúc dữ liệu đã cập nhật.`);
      } else {
        await pool.query('UPDATE platform_tenant SET last_error = $2, updated_at = now() WHERE code = $1', [row.code, `Cập nhật cấu trúc khi khởi động: ${errorTail(r.output)}`]);
        console.error(`Doanh nghiệp ${row.code}: cập nhật cấu trúc lỗi\n${errorTail(r.output)}`);
      }
    }
  } finally {
    await pool.end();
  }
}

await main();
