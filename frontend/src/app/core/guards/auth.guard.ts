import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CatalogLoader } from '../api/catalog-loader.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  return router.parseUrl('/login');
};

/**
 * Waits for the danh mục before the shell opens, so no screen shows empty lists on first paint.
 * A failed load still opens the shell; it shows the error with a retry (shell.component.html).
 */
export const catalogGuard: CanActivateFn = async () => {
  await inject(CatalogLoader).ensureLoaded();
  return true;
};

/** Pages the role has no permission for send the user to their first allowed page (rules: core/auth/route-access.ts). */
export const permissionGuard: CanActivateChildFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.canVisit(state.url)) return true;
  return inject(Router).parseUrl(auth.homeUrl());
};
