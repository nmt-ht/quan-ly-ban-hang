import { Injectable, signal } from '@angular/core';

const KEY = 'nt_tenant';

/** Mã doanh nghiệp: chữ thường không dấu, số, gạch ngang (the backend's TENANT_CODE). */
export const normalizeTenant = (code: string): string => code.trim().toLowerCase();

/**
 * Nhiều doanh nghiệp: which doanh nghiệp this browser works for. Typed once on the login screen and
 * remembered; authInterceptor sends it as X-Tenant with every API call. Unused in single-company mode.
 */
@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly _code = signal(read());
  readonly code = this._code.asReadonly();

  set(code: string): void {
    const next = normalizeTenant(code);
    this._code.set(next);
    try {
      if (next) localStorage.setItem(KEY, next);
      else localStorage.removeItem(KEY);
    } catch {
      /* storage blocked: remembered until the tab closes */
    }
  }
}

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}
