import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TenantService } from '../services/tenant.service';
import { API_BASE } from './api.config';

/**
 * Adds the bearer token and the mã doanh nghiệp (X-Tenant, multi-tenant mode) to every API call. A 401 on
 * anything but the login call means the session expired or the account was locked: sign out and send the
 * user to /login, back to this page after. A 403 that names the doanh nghiệp means it was suspended.
 * Quản trị nền tảng (/api/platform) carries its own token and no doanh nghiệp: left alone.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_BASE) || req.url.startsWith(`${API_BASE}/platform`)) return next(req);
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const tenant = inject(TenantService).code();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (tenant) headers['X-Tenant'] = tenant;
  return next(req.clone({ setHeaders: headers })).pipe(
    catchError((err: unknown) => {
      const tenantRefusal = err instanceof HttpErrorResponse && err.status === 403 && !!(err.error as { tenant?: string } | null)?.tenant;
      if (tenantRefusal && auth.isAuthenticated()) {
        auth.logout();
        router.navigate(['/login'], { queryParams: { suspended: 1 } });
        return throwError(() => err);
      }
      if (err instanceof HttpErrorResponse && err.status === 401 && !req.url.endsWith('/auth/login') && auth.isAuthenticated()) {
        const returnUrl = router.url.startsWith('/login') ? undefined : router.url;
        auth.logout();
        router.navigate(['/login'], { queryParams: { expired: 1, returnUrl } });
      }
      return throwError(() => err);
    }),
  );
};
