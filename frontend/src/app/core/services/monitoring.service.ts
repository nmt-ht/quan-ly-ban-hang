import { ErrorHandler, Injectable } from '@angular/core';
import { API_BASE } from '../api/api.config';

type SentryBrowser = typeof import('@sentry/browser');

/**
 * Optional browser error reporting. The backend says which Sentry project to use (GET /api/client-config);
 * with none configured nothing is downloaded or sent. The SDK is a separate lazy chunk.
 */
@Injectable({ providedIn: 'root' })
export class MonitoringService {
  private sentry: SentryBrowser | null = null;

  /** Not awaited at start-up: errors before it finishes still reach the console. */
  async start(): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/client-config`);
      if (!res.ok) return;
      const cfg = (await res.json()) as { sentryDsn: string | null; release: string | null; environment: string };
      if (!cfg.sentryDsn) return;
      const sentry = await import('@sentry/browser');
      sentry.init({ dsn: cfg.sentryDsn, release: cfg.release ?? undefined, environment: cfg.environment, tracesSampleRate: 0 });
      this.sentry = sentry;
    } catch {
      /* offline or blocked: monitoring is a convenience, never a reason to break the app */
    }
  }

  capture(error: unknown): void {
    this.sentry?.captureException(error);
  }
}

/** Angular's default behaviour (log to the console), plus a report to Sentry when it is on. */
@Injectable()
export class MonitoringErrorHandler implements ErrorHandler {
  constructor(private readonly monitoring: MonitoringService) {}

  handleError(error: unknown): void {
    console.error(error);
    this.monitoring.capture(error);
  }
}
