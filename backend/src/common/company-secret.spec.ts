import { afterEach, describe, expect, it } from 'vitest';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { seal, unseal } from './company-secret.js';

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe('secret box', () => {
  it('round-trips, and a different key cannot open it', () => {
    process.env.MAIL_SECRET = 'a'.repeat(32);
    const s = seal('mật khẩu ứng dụng');
    expect(unseal(s)).toBe('mật khẩu ứng dụng');
    process.env.MAIL_SECRET = 'b'.repeat(32);
    expect(unseal(s)).toBeNull();
  });

  it('opens values sealed with the original mail-module derivation (stored SMTP passwords keep working)', () => {
    process.env.MAIL_SECRET = 'c'.repeat(32);
    const key = createHash('sha256').update(`ninhtrang-mail:${'c'.repeat(32)}`).digest();
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([c.update('old', 'utf8'), c.final()]);
    expect(unseal(Buffer.concat([iv, c.getAuthTag(), data]).toString('base64'))).toBe('old');
  });
});
