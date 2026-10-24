import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable, mergeMap } from 'rxjs';
import type { AuthUser } from '../auth/auth.service.js';
import { AuditContext, runInAuditContext } from './audit.context.js';
import { AuditService } from './audit.service.js';

const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Opens the audit context around every handler (guards have run, so `req.user` is known) and,
 * after a successful write, checks that the handler logged something — if not, AuditService
 * records an `api.unaudited` line so no change goes untraced.
 */
@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<{
      id?: string; method: string; ip?: string; originalUrl?: string; route?: { path?: string }; user?: AuthUser;
    }>();
    const ctx: AuditContext = {
      requestId: req.id ?? randomUUID(),
      ip: req.ip ?? null,
      method: req.method,
      route: req.route?.path ?? req.originalUrl ?? '',
      user: req.user ? { id: req.user.id, name: req.user.name } : null,
      logged: 0,
    };
    const isWrite = WRITES.has(req.method);
    return new Observable((subscriber) =>
      runInAuditContext(ctx, () =>
        next
          .handle()
          .pipe(
            mergeMap(async (data) => {
              if (isWrite && ctx.logged === 0 && !ctx.readOnly) await this.audit.unaudited(ctx);
              return data;
            }),
          )
          .subscribe(subscriber),
      ),
    );
  }
}
