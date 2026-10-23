// Runs after `prisma migrate deploy` on every start (Render + Neon):
// - database without any user → seed the permission catalog, roles, base lookups and the admin account;
// - SEED_DEMO=true → load the demo data too (prisma/seed-demo.ts skips itself once KH0000001 exists),
//   so a restart never touches real data and a missed demo load is caught up on the next start.
//
//   SEED_ADMIN_PASSWORD   required on a fresh database (≥ 10 characters); the admin keeps it until changed
//   SEED_DEMO=true        demo data; needs DEMO_USER_PASSWORD (≥ 8 characters)
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
    console.log(`Database đã có ${users} người dùng — bỏ qua seed danh mục và admin.`);
  } else {
    const admin = process.env.SEED_ADMIN_PASSWORD ?? '';
    if (admin.length < 10 || admin === 'ChangeMe123!') {
      console.error('Database còn trống: đặt SEED_ADMIN_PASSWORD (từ 10 ký tự, không dùng giá trị mặc định) rồi khởi động lại.');
      process.exit(1);
    }
    run('prisma/seed.ts');
  }
  if (process.env.SEED_DEMO === 'true') run('prisma/seed-demo.ts');
}

await main();
