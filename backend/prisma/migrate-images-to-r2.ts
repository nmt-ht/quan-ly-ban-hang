/**
 * Moves the product photos still stored as data: URLs in the database to Cloudflare R2, and points the rows at the new addresses.
 * The company logo stays in the database (print, PDF and the favicon draw it on a canvas). Safe to repeat: rows already holding an https URL are left alone.
 *
 *   npm run storage:migrate-images            # counts only, changes nothing
 *   npm run storage:migrate-images -- --apply # uploads, then updates the rows
 *
 * Needs DATABASE_URL and the R2_* variables (see .env.example). One doanh nghiệp at a time: for a platform tenant run it with that
 * tenant's DATABASE_URL and TENANT_CODE=<mã>, so its files go in their own folder.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { parseImageDataUrl } from '../src/storage/image-data.js';
import { StorageService } from '../src/storage/storage.service.js';

const apply = process.argv.includes('--apply');
const tenant = process.env.TENANT_CODE || undefined;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const storage = new StorageService();

async function main() {
  const images = await prisma.productImage.findMany({ where: { url: { startsWith: 'data:' } }, select: { id: true, url: true } });
  const bytes = images.reduce((s, i) => s + i.url.length, 0);
  console.log(`Ảnh sản phẩm còn lưu trong DB: ${images.length} (~${(bytes / 1_048_576).toFixed(1)} MB)`);
  if (!apply) {
    console.log('Chạy lại với --apply để chuyển sang R2.');
    return;
  }
  if (!storage.enabled) throw new Error('Thiếu cấu hình R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL.');

  let done = 0;
  let failed = 0;
  for (const img of images) {
    try {
      const url = await storage.putImage(parseImageDataUrl(img.url), tenant);
      await prisma.productImage.update({ where: { id: img.id }, data: { url } });
      done++;
    } catch (e) {
      failed++;
      console.error(`Ảnh ${img.id}: ${(e as Error).message}`);
    }
  }
  console.log(`Đã chuyển ${done}, lỗi ${failed}. Các dòng ảnh trong DB đã trỏ tới địa chỉ R2.`);
}

main().finally(() => prisma.$disconnect());
