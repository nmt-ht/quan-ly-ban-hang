import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Mã xác thực 6 số đổi mỗi 30 giây (RFC 6238, SHA-1): what Google Authenticator, Microsoft Authenticator,
// 1Password… produce from the secret the owner scans once.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP = 30;

export function newTotpSecret(): string {
  return base32(randomBytes(20));
}

export function otpauthUrl(secret: string, account: string, issuer = 'Ninh Trang ERP'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP}`;
}

export const totpStep = (at = Date.now()): number => Math.floor(at / 1000 / STEP);

export function totpCode(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac('sha1', fromBase32(secret)).update(counter).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(bin).padStart(6, '0');
}

/**
 * The step the code belongs to (now, or one step either side for a slow phone clock), or null.
 * The caller keeps the last accepted step and refuses it again, so an overheard code works once.
 */
export function verifyTotp(secret: string, code: string, at = Date.now()): number | null {
  const given = Buffer.from(code.replace(/\s/g, ''));
  if (given.length !== 6) return null;
  const now = totpStep(at);
  for (const step of [now, now - 1, now + 1]) {
    if (timingSafeEqual(Buffer.from(totpCode(secret, step)), given)) return step;
  }
  return null;
}

function base32(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function fromBase32(text: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of text.replace(/=+$/, '').toUpperCase()) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
