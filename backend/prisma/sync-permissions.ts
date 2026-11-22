// Runs on every start for a database that already has users (bootstrap.ts, migrate-tenants.ts): seed.ts only runs on an empty
// database, so a permission added later (Hợp đồng: contract.*) never reached the CEO and its screens stayed shut, even for the CEO.
// - every code of the catalog exists, with its current label and module;
// - the CEO (chức vụ hệ thống, "toàn quyền") holds every code.
// Other roles are left as the company set them in Chức vụ & phân quyền: a new right is theirs to hand out. Safe to repeat.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { ALL_PERMISSION_CODES, PERMISSION_MODULES } from './permission-catalog.js';

const CEO_ROLE_ID = 'role-ceo';

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) });
  try {
    for (const module of PERMISSION_MODULES) {
      for (const perm of module.permissions) {
        await prisma.permission.upsert({
          where: { code: perm.code },
          update: { label: perm.label, module: module.key },
          create: { code: perm.code, label: perm.label, module: module.key },
        });
      }
    }
    if (await prisma.role.findUnique({ where: { id: CEO_ROLE_ID } })) {
      const added = await prisma.rolePermission.createMany({
        data: ALL_PERMISSION_CODES.map((permissionCode) => ({ roleId: CEO_ROLE_ID, permissionCode })),
        skipDuplicates: true,
      });
      console.log(added.count ? `Quyền: đã cấp thêm ${added.count} quyền mới cho CEO.` : 'Quyền: danh mục và quyền CEO đã đủ.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

await main();
