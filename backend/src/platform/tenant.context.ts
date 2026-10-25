import { AsyncLocalStorage } from 'node:async_hooks';
import type { PrismaClient } from '@prisma/client';

/**
 * Which doanh nghiệp the current request works for, and that doanh nghiệp's database client. Set by
 * TenantMiddleware for the whole request; PrismaService forwards every call to `client`.
 *  - no store (start-up, scripts, /api/health, single-company mode): the DATABASE_URL database;
 *  - `client: null` (the platform's own routes): any use of PrismaService is a bug, and throws.
 */
export interface TenantStore {
  code: string | null;
  client: PrismaClient | null;
}

const storage = new AsyncLocalStorage<TenantStore>();

export const runInTenant = <T>(store: TenantStore, fn: () => T): T => storage.run(store, fn);

export const tenantStore = (): TenantStore | undefined => storage.getStore();

/** Mã of the request's doanh nghiệp; undefined outside a request or in single-company mode. */
export const currentTenantCode = (): string | undefined => storage.getStore()?.code ?? undefined;
