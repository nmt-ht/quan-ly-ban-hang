import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { API_BASE } from './api.config';

/**
 * Adds the bearer token to every API call. A 401 on anything but the login call means the session
 * expired or the account was locked: sign out and send the user to /login, back to this page after.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_BASE)) return next(req);
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authed).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && !req.url.endsWith('/auth/login') && auth.isAuthenticated()) {
        const returnUrl = router.url.startsWith('/login') ? undefined : router.url;
        auth.logout();
        router.navigate(['/login'], { queryParams: { expired: 1, returnUrl } });
      }
      return throwError(() => err);
    }),
  );
};
