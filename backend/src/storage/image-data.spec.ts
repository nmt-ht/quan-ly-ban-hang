import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { MAX_IMAGE_BYTES, parseImageDataUrl, sniff } from './image-data.js';
import { storageOrigins } from '../common/security.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);
const url = (mime: string, b: Buffer) => `data:${mime};base64,${b.toString('base64')}`;

describe('parseImageDataUrl', () => {
  it('reads png, jpeg and webp, and names the file extension from what the bytes are', () => {
    expect(parseImageDataUrl(url('image/png', PNG))).toMatchObject({ mime: 'image/png', ext: 'png' });
    expect(parseImageDataUrl(url('image/jpeg', JPG))).toMatchObject({ mime: 'image/jpeg', ext: 'jpg' });
    expect(parseImageDataUrl(url('image/webp', WEBP))).toMatchObject({ mime: 'image/webp', ext: 'webp' });
  });

  it('refuses a declared type the bytes do not match, other types (svg, html) and junk', () => {
    expect(() => parseImageDataUrl(url('image/png', JPG))).toThrow(BadRequestException);
    expect(() => parseImageDataUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toThrow(BadRequestException);
    expect(() => parseImageDataUrl(url('image/png', Buffer.from('<script>alert(1)</script>')))).toThrow(BadRequestException);
    expect(() => parseImageDataUrl('https://example.com/a.png')).toThrow(BadRequestException);
    expect(() => parseImageDataUrl('data:image/png;base64,')).toThrow(BadRequestException);
  });

  it('refuses an image over the limit', () => {
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_IMAGE_BYTES)]);
    expect(() => parseImageDataUrl(url('image/png', big))).toThrow(/8MB/);
  });

  it('sniff tells the three formats apart', () => {
    expect([sniff(PNG), sniff(JPG), sniff(WEBP), sniff(Buffer.from('hello'))]).toEqual(['image/png', 'image/jpeg', 'image/webp', null]);
  });
});

describe('storageOrigins (CSP)', () => {
  it('allows only the origin of R2_PUBLIC_URL, and nothing when storage is off or the value is not a URL', () => {
    expect(storageOrigins('https://img.example.vn/')).toEqual(['https://img.example.vn']);
    expect(storageOrigins('https://pub-abc.r2.dev')).toEqual(['https://pub-abc.r2.dev']);
    expect(storageOrigins('')).toEqual([]);
    expect(storageOrigins('not a url')).toEqual([]);
  });
});
