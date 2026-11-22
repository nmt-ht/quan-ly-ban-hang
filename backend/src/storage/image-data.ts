import { BadRequestException } from '@nestjs/common';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export interface ParsedImage {
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  ext: 'png' | 'jpg' | 'webp';
  bytes: Buffer;
}

const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/;

/** What the file's first bytes say it is (the declared type alone is not trusted). */
export function sniff(b: Buffer): ParsedImage['mime'] | null {
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as const;

/** A `data:image/…;base64,…` URL (what the browser makes after shrinking a photo) → the image's bytes, checked. */
export function parseImageDataUrl(dataUrl: string): ParsedImage {
  const m = DATA_URL.exec(dataUrl);
  if (!m) throw new BadRequestException('Ảnh phải là PNG, JPEG hoặc WebP');
  const bytes = Buffer.from(m[2].replace(/\s/g, ''), 'base64');
  if (!bytes.length) throw new BadRequestException('Ảnh rỗng');
  if (bytes.length > MAX_IMAGE_BYTES) throw new BadRequestException('Ảnh lớn hơn 8MB');
  const mime = sniff(bytes);
  if (!mime || mime !== m[1]) throw new BadRequestException('Nội dung file không đúng là ảnh PNG, JPEG hoặc WebP');
  return { mime, ext: EXT[mime], bytes };
}
