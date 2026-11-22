import { afterEach, describe, expect, it } from 'vitest';
import { NotImplementedException } from '@nestjs/common';
import { runInAuditContext, type AuditContext } from '../audit/audit.context.js';
import { UploadsController } from './storage.module.js';
import { StorageService } from './storage.service.js';
import { parseImageDataUrl } from './image-data.js';

const ENV = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_URL'] as const;
const PNG = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]).toString('base64')}`;
const saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const configure = () => {
  Object.assign(process.env, { R2_ACCOUNT_ID: 'acc', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's', R2_BUCKET: 'b', R2_PUBLIC_URL: 'https://img.example.vn/' });
};

describe('StorageService', () => {
  it('is off until every R2 variable is set, and then refuses to store', async () => {
    for (const k of ENV) delete process.env[k];
    const s = new StorageService();
    expect(s.enabled).toBe(false);
    await expect(s.putImage(parseImageDataUrl(PNG))).rejects.toBeInstanceOf(NotImplementedException);
    configure();
    expect(s.enabled).toBe(true);
    delete process.env.R2_BUCKET;
    expect(s.enabled).toBe(false);
  });

  it('puts each doanh nghiệp in its own folder with a random name, and builds the public address without a double slash', () => {
    configure();
    const s = new StorageService();
    expect(s.publicBase).toBe('https://img.example.vn');
    const a = s.keyFor('webp', 'abc');
    const b = s.keyFor('webp', 'abc');
    expect(a).toMatch(/^abc\/products\/[0-9a-f-]{36}\.webp$/);
    expect(a).not.toBe(b);
    expect(s.keyFor('png', undefined)).toMatch(/^main\/products\//);
  });
});

describe('UploadsController', () => {
  const ctx = (): AuditContext => ({ requestId: 'r', ip: null, method: 'POST', route: '/uploads/images', user: null, logged: 0 });

  it('reports whether storage is on', () => {
    for (const k of ENV) delete process.env[k];
    expect(new UploadsController(new StorageService()).status()).toEqual({ enabled: false });
    configure();
    expect(new UploadsController(new StorageService()).status()).toEqual({ enabled: true });
  });

  it('returns the stored address, and marks the request as one that changes no record (no Nhật ký line expected)', async () => {
    const fake = { putImage: async () => 'https://img.example.vn/main/products/x.png' } as unknown as StorageService;
    const c = ctx();
    const r = await runInAuditContext(c, () => new UploadsController(fake).image({ dataUrl: PNG }));
    expect(r).toEqual({ url: 'https://img.example.vn/main/products/x.png' });
    expect(c.readOnly).toBe(true);
  });

  it('refuses a body that is not a real image before anything is stored', async () => {
    const fake = { putImage: async () => 'never' } as unknown as StorageService;
    await expect(new UploadsController(fake).image({ dataUrl: 'data:image/png;base64,aGVsbG8=' })).rejects.toThrow(/PNG, JPEG/);
  });
});
