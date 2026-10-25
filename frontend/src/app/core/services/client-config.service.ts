import { Injectable } from '@angular/core';
import { API_BASE } from '../api/api.config';

/** GET /api/client-config (backend src/monitoring/health.controller.ts). */
export interface ClientConfig {
  sentryDsn: string | null;
  release: string | null;
  environment: string;
  /** Nhiều doanh nghiệp: the login screen asks for the mã doanh nghiệp. */
  multiTenant: boolean;
}

const OFFLINE: ClientConfig = { sentryDsn: null, release: null, environment: 'unknown', multiTenant: false };

/** Read once per page load; a failed read (offline) is not cached, the next caller tries again. */
@Injectable({ providedIn: 'root' })
export class ClientConfigService {
  private pending: Promise<ClientConfig> | null = null;

  load(): Promise<ClientConfig> {
    this.pending ??= fetch(`${API_BASE}/client-config`)
      .then(async (res) => (res.ok ? { ...OFFLINE, ...((await res.json()) as Partial<ClientConfig>) } : Promise.reject(new Error(String(res.status)))))
      .catch(() => {
        this.pending = null;
        return OFFLINE;
      });
    return this.pending;
  }
}
