// Used by .github/workflows/backup-db.yml in multi-tenant mode. Reads `code<TAB>database_url_enc` lines
// (psql -tA output of platform_tenant) on stdin, decrypts each connection string with PLATFORM_SECRET and
// writes `code<TAB>url` lines to the file given as argument (mode 600). Stdout only carries ::add-mask::
// commands, so no connection string or password reaches the log.
//
// No dependencies on purpose (the workflow does not install the backend): the key derivation and the
// base64(iv | tag | data) layout must stay the same as platformKey('box') / unseal in
// backend/src/platform/secret-box.ts.
//
// Usage: psql ... | PLATFORM_SECRET=... node tools/backup/tenant-urls.mjs targets.tsv [mã bỏ qua]
import { createDecipheriv, createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const TENANT_CODE = /^[a-z][a-z0-9-]{2,29}$/;

const [out, skip] = process.argv.slice(2);
if (!out) {
  console.error('Cách dùng: node tenant-urls.mjs <file kết quả> [mã doanh nghiệp bỏ qua]');
  process.exit(2);
}
const secret = process.env.PLATFORM_SECRET ?? '';
if (secret.length < 32) {
  console.error('::error::Thiếu secret PLATFORM_SECRET (cần từ 32 ký tự) để giải mã chuỗi kết nối các doanh nghiệp');
  process.exit(1);
}
const key = createHash('sha256').update(`ninhtrang-platform:box:${secret}`).digest();

function unseal(sealed) {
  const raw = Buffer.from(sealed, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const lines = Buffer.concat(chunks).toString('utf8').split('\n').filter((l) => l.trim());

const rows = [];
let failed = 0;
for (const line of lines) {
  const [code, sealed] = line.split('\t').map((s) => s.trim());
  if (!TENANT_CODE.test(code ?? '') || !sealed) {
    console.log(`::error::Dòng không hợp lệ trong platform_tenant (mã "${(code ?? '').slice(0, 30)}"), bỏ qua`);
    failed++;
    continue;
  }
  if (code === skip) continue;
  let url;
  try {
    url = unseal(sealed);
  } catch {
    console.log(`::error::Không giải mã được chuỗi kết nối của doanh nghiệp ${code} (PLATFORM_SECRET sai?)`);
    failed++;
    continue;
  }
  console.log(`::add-mask::${url}`);
  try {
    const { password } = new URL(url);
    for (const p of new Set([password, decodeURIComponent(password)])) if (p) console.log(`::add-mask::${p}`);
  } catch {
    // An unparsable URL still gets masked whole above; pg_dump will report it as unusable.
  }
  rows.push(`${code}\t${url}\n`);
}

writeFileSync(out, rows.join(''), { mode: 0o600 });
console.log(`Doanh nghiệp cần sao lưu: ${rows.length}${failed ? `, lỗi: ${failed}` : ''}`);
process.exit(failed ? 1 : 0);
