import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { SequenceService } from '../prisma/sequence.service.js';

/**
 * One Prisma client per doanh nghiệp, opened on its first request and kept. The first use also raises the
 * document sequences to the codes already stored (SequenceService does that for DATABASE_URL at start-up).
 */
@Injectable()
export class TenantClientsService implements OnModuleDestroy {
  private readonly logger = new Logger('TenantClients');
  private readonly clients = new Map<string, { url: string; ready: Promise<PrismaClient> }>();

  constructor(private readonly sequences: SequenceService) {}

  get(code: string, url: string): Promise<PrismaClient> {
    const known = this.clients.get(code);
    if (known && known.url === url) return known.ready;
    if (known) void this.close(code);
    const ready = this.open(code, url);
    this.clients.set(code, { url, ready });
    // A failed open is not cached: the next request tries again.
    ready.catch(() => this.clients.get(code)?.ready === ready && this.clients.delete(code));
    return ready;
  }

  private async open(code: string, url: string): Promise<PrismaClient> {
    const max = Number(process.env.TENANT_POOL_MAX) || 3;
    const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max }) });
    await client.$connect();
    await this.sequences.syncWithExistingCodes(client);
    this.logger.log(`Mở kết nối doanh nghiệp ${code}`);
    return client;
  }

  /** After a change of database or a reset: the next request opens a fresh client. */
  async close(code: string): Promise<void> {
    const known = this.clients.get(code);
    this.clients.delete(code);
    await known?.ready.then((c) => c.$disconnect()).catch(() => undefined);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.clients.keys()].map((code) => this.close(code)));
  }
}
