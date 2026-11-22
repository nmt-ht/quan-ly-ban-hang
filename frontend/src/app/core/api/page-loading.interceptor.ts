import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { PageLoadingService } from '../services/page-loading.service';
import { API_BASE } from './api.config';

/**
 * The GET calls a page makes while it opens keep the full-page spinner up until they answer (PageLoadingService decides
 * whether this one is part of the page loading). Anything that is not a read of our own API is left alone.
 */
export const pageLoadingInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET' || !req.url.startsWith(API_BASE)) return next(req);
  const loading = inject(PageLoadingService);
  const counted = loading.requestStart();
  return counted ? next(req).pipe(finalize(() => loading.requestEnd())) : next(req);
};
