import * as Sentry from '@sentry/node';

/** Error reporting is optional: it starts only when SENTRY_DSN is set. */
export function initSentry(): boolean {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.RENDER_GIT_COMMIT?.slice(0, 7),
    tracesSampleRate: 0,
  });
  return true;
}

export function reportError(error: unknown, context: { requestId?: string; method?: string; route?: string; userId?: string }): void {
  if (!process.env.SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    scope.setTag('request_id', context.requestId ?? 'none');
    scope.setContext('request', { method: context.method, route: context.route });
    if (context.userId) scope.setUser({ id: context.userId });
    Sentry.captureException(error);
  });
}
