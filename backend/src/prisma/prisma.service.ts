import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // Prisma 7 needs a driver adapter; the URL no longer comes from schema.prisma.
  // DATABASE_POOL_MAX caps the connections (`prisma dev`'s embedded Postgres takes one at a time).
  constructor(config: ConfigService) {
    const max = Number(config.get<string>('DATABASE_POOL_MAX')) || undefined;
    super({ adapter: new PrismaPg({ connectionString: config.getOrThrow<string>('DATABASE_URL'), max }) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
