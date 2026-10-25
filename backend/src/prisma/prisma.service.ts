import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { tenantStore } from '../platform/tenant.context.js';

/**
 * The DATABASE_URL client, seen through a proxy: inside a request for a doanh nghiệp (multi-tenant mode)
 * every property — models, $transaction, $queryRaw… — comes from that doanh nghiệp's client instead
 * (src/platform/tenant.context.ts), so the services keep injecting PrismaService as they always did.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    const max = Number(config.get<string>('DATABASE_POOL_MAX')) || undefined;
    super({ adapter: new PrismaPg({ connectionString: config.getOrThrow<string>('DATABASE_URL'), max }) });
    return new Proxy(this, {
      get(target, prop, receiver) {
        const store = tenantStore();
        if (!store) return Reflect.get(target, prop, receiver);
        if (!store.client) throw new Error(`PrismaService dùng ngoài phạm vi doanh nghiệp (${String(prop)})`);
        const value = Reflect.get(store.client, prop) as unknown;
        return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(store.client) : value;
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
