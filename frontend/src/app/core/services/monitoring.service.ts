import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ClientConfigService } from './client-config.service';
import { ErrorNoticeService } from './error-notice.service';

type SentryBrowser = typeof import('@sentry/browser');

/**
 * Optional browser error reporting. The backend says which Sentry project to use (GET /api/client-config);
 * with none configured nothing is downloaded or sent. The SDK is a separate lazy chunk.
 */
@Injectable({ providedIn: 'root' })
export class MonitoringService {
  private readonly config = inject(ClientConfigService);
  private sentry: SentryBrowser | null = null;

  /** Not awaited at start-up: errors before it finishes still reach the console. */
  async start(): Promise<void> {
    try {
      const cfg = await this.config.load();
      if (!cfg.sentryDsn) return;
      const sentry = await import('@sentry/browser');
      sentry.init({ dsn: cfg.sentryDsn, release: cfg.release ?? undefined, environment: cfg.environment, tracesSampleRate: 0 });
      this.sentry = sentry;
    } catch {
      /* offline or blocked: monitoring is a convenience, never a reason to break the app */
    }
  }

  /** `clientErrorId`: the code shown to the person, so IT can find this report in Sentry. */
  capture(error: unknown, clientErrorId?: string): void {
    this.sentry?.captureException(error, clientErrorId ? { tags: { clientErrorId } } : undefined);
  }
}

/**
 * Angular's default behaviour (log to the console), a report to Sentry when it is on, and — so the person is not left with a screen that
 * silently stopped working — a banner saying what to do (ErrorNoticeService: report to IT, with a code).
 */
@Injectable()
export class MonitoringErrorHandler implements ErrorHandler {
  constructor(
    private readonly monitoring: MonitoringService,
    private readonly notice: ErrorNoticeService,
  ) {}

  handleError(error: unknown): void {
    console.error(error);
    const shown = this.notice.report(error);
    this.monitoring.capture(error, shown?.clientErrorId);
  }
}
