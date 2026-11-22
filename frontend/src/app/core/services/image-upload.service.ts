import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api/api.service';

/**
 * Where a product photo is kept. With Cloudflare R2 set up on the server (GET /uploads/status) the shrunk photo is uploaded and the
 * product keeps its https address; without it the photo stays a data: URL in the database, as before.
 */
@Injectable({ providedIn: 'root' })
export class ImageUploadService {
  private readonly api = inject(ApiService);
  private enabled?: Promise<boolean>;

  private isEnabled(): Promise<boolean> {
    this.enabled ??= this.api.get<{ enabled: boolean }>('/uploads/status').then((r) => r.enabled, () => false);
    return this.enabled;
  }

  /** The address to keep for a shrunk photo (data: URL). Throws when storage is on but the upload fails, so the user can retry. */
  async store(dataUrl: string): Promise<string> {
    if (!(await this.isEnabled())) return dataUrl;
    return (await this.api.post<{ url: string }>('/uploads/images', { dataUrl })).url;
  }
}
