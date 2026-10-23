import { AsyncLocalStorage } from 'node:async_hooks';

/** Who is acting in the current request; AuditContextInterceptor opens it around every handler. */
export interface AuditContext {
  requestId: string;
  ip: string | null;
  method: string;
  route: string;
  user: { id: string; name: string } | null;
  /** Entries written by AuditService during this request (0 on a write = nothing was logged). */
  logged: number;
}

const storage = new AsyncLocalStorage<AuditContext>();

export const runInAuditContext = <T>(ctx: AuditContext, fn: () => T): T => storage.run(ctx, fn);

export const auditContext = (): AuditContext | undefined => storage.getStore();
