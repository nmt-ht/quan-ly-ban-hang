// First start on a fresh database (Render + Neon): seed the permission catalog, roles, base lookups and
// the admin account, and — with SEED_DEMO=true — the demo data. Runs after `prisma migrate deploy` on
// every start, but seeds only when the database has no user yet, so a restart never touches real data.
//
//   SEED_ADMIN_PASSWORD   required on a fresh database (≥ 10 characters); the admin keeps it until changed
//   SEED_DEMO=true        also load prisma/demo-data.json; needs DEMO_USER_PASSWORD (≥ 8 characters)
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

function run(script: string) {
  const r = spawnSync('npx', ['tsx', script], { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) });
  const users = await prisma.user.count();
  await prisma.$disconnect();
  if (users > 0) {
    console.log(`Database đã có ${users} người dùng — bỏ qua seed.`);
    return;
  }

  const admin = process.env.SEED_ADMIN_PASSWORD ?? '';
  if (admin.length < 10 || admin === 'ChangeMe123!') {
    console.error('Database còn trống: đặt SEED_ADMIN_PASSWORD (từ 10 ký tự, không dùng giá trị mặc định) rồi khởi động lại.');
    process.exit(1);
  }
  run('prisma/seed.ts');
  if (process.env.SEED_DEMO === 'true') run('prisma/seed-demo.ts');
}

await main();
