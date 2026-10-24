import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Public, read-only. /api/health is what Render (healthCheckPath) and an uptime monitor call: 200 when the
 * app answers and the database does, 503 otherwise. /api/client-config tells the browser which Sentry
 * project to report to (a DSN is public by design); empty when error reporting is not set up.
 */
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  async health() {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'error', db: 'down' });
    }
    return {
      status: 'ok',
      db: 'ok',
      dbMs: Date.now() - started,
      version: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'dev',
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  @Get('client-config')
  clientConfig() {
    return {
      sentryDsn: process.env.SENTRY_FRONTEND_DSN ?? null,
      release: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? null,
      environment: process.env.NODE_ENV ?? 'development',
    };
  }
}
