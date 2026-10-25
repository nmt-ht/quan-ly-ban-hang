import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Nhiều doanh nghiệp (multi-tenant) is on when PLATFORM_DATABASE_URL is set: that database holds the list of
 * doanh nghiệp and the owner's sign-in, each doanh nghiệp has a database of its own. Without it the app is the
 * single-company app it always was. Plain functions (no Nest): prisma/migrate-tenants.ts uses them too.
 */
export const multiTenant = (): boolean => !!process.env.PLATFORM_DATABASE_URL;

/** Mã of the doanh nghiệp whose database is DATABASE_URL (registered on the first multi-tenant start). */
export const defaultTenantCode = (): string => (process.env.DEFAULT_TENANT_CODE ?? 'ninhtrang').trim().toLowerCase();

/** PLATFORM_SECRET signs the owner's tokens and encrypts the stored connection strings; one value, two keys. */
export function platformKey(purpose: 'jwt' | 'box'): Buffer {
  const secret = process.env.PLATFORM_SECRET ?? '';
  if (secret.length < 32) throw new Error('PLATFORM_SECRET chưa đặt (cần từ 32 ký tự) — bắt buộc khi bật nhiều doanh nghiệp.');
  return createHash('sha256').update(`ninhtrang-platform:${purpose}:${secret}`).digest();
}

/** AES-256-GCM, written as base64(iv | tag | data). Connection strings carry passwords: never stored in clear. */
export function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', platformKey('box'), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

export function unseal(sealed: string): string {
  const raw = Buffer.from(sealed, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', platformKey('box'), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

/** Mã doanh nghiệp: chữ thường không dấu, số và gạch ngang, 3–30 ký tự, bắt đầu bằng chữ. */
export const TENANT_CODE = /^[a-z][a-z0-9-]{2,29}$/;

/** Database name for a doanh nghiệp created on the platform's server: nt_<mã>, dashes as underscores. */
export const tenantDbName = (code: string): string => `nt_${code.replace(/-/g, '_')}`;

/** The same server and credentials as `base`, another database. Query options (sslmode…) are kept. */
export function withDatabase(base: string, database: string): string {
  const url = new URL(base);
  url.pathname = `/${database}`;
  return url.toString();
}

export const databaseOf = (url: string): string => decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));

/** Host and database only, for screens and logs: never the user or password. */
export function describeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}/${databaseOf(url)}`;
  } catch {
    return '(chuỗi kết nối không hợp lệ)';
  }
}
