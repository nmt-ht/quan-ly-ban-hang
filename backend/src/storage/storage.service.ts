import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { currentTenantCode } from '../platform/tenant.context.js';
import type { ParsedImage } from './image-data.js';

/**
 * Cloudflare R2 (S3-compatible) for product photos, so they stay out of the database.
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET — the bucket and an API token with Object Read & Write
 *   R2_PUBLIC_URL — where the browser reads files (the bucket's custom domain, or its r2.dev address), no trailing slash
 * With any of them missing, `enabled` is false and the app keeps images as data: URLs, exactly as before.
 */
@Injectable()
export class StorageService {
  private readonly log = new Logger(StorageService.name);
  private client?: S3Client;

  get publicBase(): string {
    return (process.env.R2_PUBLIC_URL ?? '').trim().replace(/\/+$/, '');
  }

  get enabled(): boolean {
    const e = process.env;
    return !!(e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY && e.R2_BUCKET && this.publicBase);
  }

  private s3(): S3Client {
    this.client ??= new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
    });
    return this.client;
  }

  /** Object key: one folder per doanh nghiệp, a random name (the address is the only secret a photo has). */
  keyFor(ext: string, tenant = currentTenantCode()): string {
    return `${tenant ?? 'main'}/products/${randomUUID()}.${ext}`;
  }

  /** Stores one checked image and returns the URL the browser reads it from. */
  async putImage(img: ParsedImage, tenant?: string): Promise<string> {
    if (!this.enabled) throw new NotImplementedException('Chưa cấu hình kho lưu ảnh (Cloudflare R2)');
    const key = this.keyFor(img.ext, tenant ?? currentTenantCode());
    await this.s3().send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET, Key: key, Body: img.bytes, ContentType: img.mime, CacheControl: 'public, max-age=31536000, immutable',
    }));
    this.log.log(`Lưu ảnh ${key} (${img.bytes.length} byte)`);
    return `${this.publicBase}/${key}`;
  }
}
