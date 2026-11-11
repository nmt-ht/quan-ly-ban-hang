// Secrets stored per doanh nghiệp (SMTP password, e-invoice provider credentials): AES-256-GCM with a key derived from
// MAIL_SECRET (else PLATFORM_SECRET, else JWT_SECRET). Changing that secret makes stored values unreadable: the screen
// that owns them asks for them again — nothing else breaks. The derivation must stay exactly as is, or values already
// stored stop opening.
import { BadRequestException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function key(): Buffer {
  const secret = process.env.MAIL_SECRET || process.env.PLATFORM_SECRET || process.env.JWT_SECRET || '';
  if (secret.length < 16) throw new BadRequestException('Máy chủ chưa đặt MAIL_SECRET (hoặc JWT_SECRET) đủ dài để mã hoá mật khẩu.');
  return createHash('sha256').update(`ninhtrang-mail:${secret}`).digest();
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString('base64');
}

/** The stored value, or null when it cannot be opened (the key changed, or it was tampered with). */
export function unseal(sealed: string): string | null {
  try {
    const raw = Buffer.from(sealed, 'base64');
    const d = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}
