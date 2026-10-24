import { CallHandler, ExecutionContext, HttpException, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, throwError } from 'rxjs';
import { reportError } from './sentry.js';

/** Prisma errors a user can cause; PrismaExceptionFilter turns them into 404/409, so they are not server faults. */
const USER_CAUSED = new Set(['P2002', 'P2003', 'P2025']);

/** Is this a fault on our side: an unexpected error, or an HttpException with a 5xx status. */
export function isServerFault(err: unknown): boolean {
  if (err instanceof HttpException) return err.getStatus() >= 500;
  const code = (err as { code?: unknown } | null)?.code;
  return !(typeof code === 'string' && USER_CAUSED.has(code));
}

/**
 * Logs every server-side fault with its request id and hands it to Sentry (when configured), then lets
 * the normal exception filters answer. 4xx answers (validation, permission, not found) are not logged here.
 */
@Injectable()
export class ErrorReportInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Error');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    return next.handle().pipe(
      catchError((err: unknown) => {
        if (isServerFault(err)) {
          const req = context.switchToHttp().getRequest<{ id?: string; method?: string; originalUrl?: string; user?: { id?: string } }>();
          const e = err instanceof Error ? err : new Error(String(err));
          this.logger.error(`[${req.id ?? '-'}] ${req.method} ${req.originalUrl}: ${e.message}`, e.stack);
          reportError(e, { requestId: req.id, method: req.method, route: req.originalUrl, userId: req.user?.id });
        }
        return throwError(() => err);
      }),
    );
  }
}
