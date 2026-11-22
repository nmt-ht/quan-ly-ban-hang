import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from '../../core/api/api.config';
import { describeHttpError } from '../../core/api/api.service';

// Shapes of /api/platform (backend src/platform/platform.controller.ts).
export type TenantStatus = 'PROVISIONING' | 'FAILED' | 'ACTIVE' | 'SUSPENDED';

export interface PlatformTenant {
  code: string;
  name: string;
  dbName: string;
  database: string;
  status: TenantStatus;
  adminEmail: string | null;
  lastError: string | null;
  managed: boolean;
  createdAt: string;
  updatedAt: string;
  migratedAt: string | null;
  schemaVersion: string | null;
  needsMigration: boolean;
}

/** GET /platform/tenants/:code/stats: read from the doanh nghiệp's own database, so it is a call per row. */
export interface TenantStats {
  databaseBytes: number;
  activeUsers: number;
  totalUsers: number;
  lastLoginAt: string | null;
}

export interface PlatformAuditRow {
  id: string;
  at: string;
  action: string;
  tenantCode: string | null;
  summary: string;
  ip: string | null;
}

export type OwnerLoginResult =
  | { step: 'totp' }
  | { step: 'enroll'; secret: string; otpauthUrl: string }
  | { step: 'done'; accessToken: string; expiresInSeconds: number };

export interface NewTenant {
  code: string;
  name: string;
  adminEmail: string;
  adminPassword?: string;
  databaseUrl?: string;
  demo?: boolean;
}

const TOKEN_KEY = 'nt_platform_token';

/** The server's message for a failed call, in the words the page shows. */
export function platformError(e: unknown): string {
  // Same wording as the rest of the app: a rule the owner can fix is shown as written; a fault on our side says to tell IT, with the code.
  if (e instanceof HttpErrorResponse) return describeHttpError(e).message;
  return 'Có lỗi không mong muốn. Tải lại trang (F5) rồi thử lại; nếu vẫn lỗi, báo bộ phận IT kiểm tra.';
}

/**
 * Quản trị nền tảng: its own session, apart from any doanh nghiệp's (authInterceptor leaves /api/platform
 * alone). Kept for this tab only (sessionStorage): closing the tab signs the owner out.
 */
@Injectable({ providedIn: 'root' })
export class PlatformApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/platform`;
  readonly token = signal<string | null>(readToken());

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.token() ?? ''}` });
  }

  /** Every signed-in call: a 401 means the session ran out, so the page goes back to the sign-in. */
  private async call<T>(request: () => Promise<T>): Promise<T> {
    try {
      return await request();
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 401) this.signOut();
      throw e;
    }
  }

  status() {
    return firstValueFrom(this.http.get<{ multiTenant: boolean; ownerConfigured: boolean }>(`${this.base}/status`));
  }

  async login(email: string, password: string, code?: string): Promise<OwnerLoginResult> {
    const res = await firstValueFrom(this.http.post<OwnerLoginResult>(`${this.base}/login`, { email, password, code: code || undefined }));
    if (res.step === 'done') {
      this.token.set(res.accessToken);
      try {
        sessionStorage.setItem(TOKEN_KEY, res.accessToken);
      } catch {
        /* storage blocked: the session lasts while the page stays open */
      }
    }
    return res;
  }

  signOut(): void {
    this.token.set(null);
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* see login() */
    }
  }

  tenants() {
    return this.call(() => firstValueFrom(this.http.get<{ latestMigration: string | null; tenants: PlatformTenant[] }>(`${this.base}/tenants`, { headers: this.headers() })));
  }

  create(body: NewTenant) {
    return this.call(() => firstValueFrom(this.http.post<{ tenant: PlatformTenant; adminPassword: string }>(`${this.base}/tenants`, body, { headers: this.headers() })));
  }

  rename(code: string, name: string) {
    return this.call(() => firstValueFrom(this.http.patch<PlatformTenant>(`${this.base}/tenants/${encodeURIComponent(code)}`, { name }, { headers: this.headers() })));
  }

  action(code: string, what: 'suspend' | 'reopen' | 'migrate') {
    return this.call(() => firstValueFrom(this.http.post<PlatformTenant>(`${this.base}/tenants/${encodeURIComponent(code)}/${what}`, {}, { headers: this.headers() })));
  }

  retry(code: string) {
    return this.call(() => firstValueFrom(this.http.post<{ tenant: PlatformTenant; adminPassword: string }>(`${this.base}/tenants/${encodeURIComponent(code)}/retry`, {}, { headers: this.headers() })));
  }

  resetPassword(code: string, email?: string) {
    return this.call(() =>
      firstValueFrom(this.http.post<{ email: string; password: string }>(`${this.base}/tenants/${encodeURIComponent(code)}/reset-password`, { email: email || undefined }, { headers: this.headers() })),
    );
  }

  stats(code: string) {
    return this.call(() => firstValueFrom(this.http.get<TenantStats>(`${this.base}/tenants/${encodeURIComponent(code)}/stats`, { headers: this.headers() })));
  }

  /** The pg_dump file of one doanh nghiệp, as a Blob (an error comes back as JSON inside a Blob; it is unpacked here). */
  exportDump(code: string) {
    return this.call(async () => {
      try {
        const res = await firstValueFrom(
          this.http.get(`${this.base}/tenants/${encodeURIComponent(code)}/export`, { headers: this.headers(), responseType: 'blob', observe: 'response' }),
        );
        const named = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1];
        return { blob: res.body as Blob, filename: named ?? `${code}.dump` };
      } catch (e) {
        if (e instanceof HttpErrorResponse && e.error instanceof Blob) {
          let error: unknown = null;
          try {
            error = JSON.parse(await e.error.text());
          } catch {
            /* not JSON: the generic message shows */
          }
          throw new HttpErrorResponse({ status: e.status, error });
        }
        throw e;
      }
    });
  }

  migrateAll() {
    return this.call(() => firstValueFrom(this.http.post<{ code: string; ok: boolean; error?: string }[]>(`${this.base}/tenants/migrate-all`, {}, { headers: this.headers() })));
  }

  audit() {
    return this.call(() => firstValueFrom(this.http.get<PlatformAuditRow[]>(`${this.base}/audit`, { headers: this.headers() })));
  }
}

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
