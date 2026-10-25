import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service.js';

type Db = PrismaService | Prisma.TransactionClient;

// Which table holds the codes of each prefix. On boot every sequence is raised to at least the
// highest code already stored, so seeded or imported data never collides with new codes.
const SOURCES: [prefix: string, table: string][] = [
  ['KH', 'Customer'], ['NCC', 'Supplier'], ['VT', 'Product'], ['SP', 'Product'], ['DV', 'Product'],
  ['DN', 'PurchaseOrder'], ['DH', 'SalesOrder'], ['LSX', 'ProductionOrder'], ['XE', 'Vehicle'], ['CH', 'DeliveryTrip'],
  ['PNK', 'WarehouseVoucher'], ['PXK', 'WarehouseVoucher'], ['PCK', 'WarehouseVoucher'], ['PKK', 'WarehouseVoucher'],
  ['PT', 'CashVoucher'], ['PC', 'CashVoucher'], ['KHO', 'Warehouse'], ['TH', 'SalesReturn'], ['BG', 'Quotation'], ['KM', 'Promotion'],
  ['TLM', 'PurchaseReturn'],
];

/** Mã chứng từ: prefix + 7 digits (DH0000027), handed out atomically in Postgres. */
@Injectable()
export class SequenceService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SequenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.syncWithExistingCodes();
  }

  /** Next code for `prefix`. Pass the transaction client so a rolled-back save also gives the number back. */
  async nextCode(prefix: string, db: Db = this.prisma, width = 7): Promise<string> {
    return prefix + String(await this.next(prefix, db)).padStart(width, '0');
  }

  // INSERT … ON CONFLICT is one atomic statement: two saves at the same moment get different numbers.
  async next(key: string, db: Db = this.prisma): Promise<number> {
    const rows = await db.$queryRaw<{ value: number }[]>`
      INSERT INTO "DocumentSequence" ("key", "value", "updatedAt") VALUES (${key}, 1, now())
      ON CONFLICT ("key") DO UPDATE SET "value" = "DocumentSequence"."value" + 1, "updatedAt" = now()
      RETURNING "value"`;
    return Number(rows[0].value);
  }

  async syncWithExistingCodes(db: Db = this.prisma): Promise<void> {
    for (const [prefix, table] of SOURCES) {
      // `table` comes from the constant list above, never from a request. The ::int matters: a text
      // parameter would pick the regex form of SUBSTRING and return garbage.
      await db.$executeRaw`
        INSERT INTO "DocumentSequence" ("key", "value", "updatedAt")
        SELECT ${prefix}, COALESCE(MAX(CAST(SUBSTRING("code" FROM ${prefix.length + 1}::int) AS INTEGER)), 0), now()
        FROM ${Prisma.raw(`"${table}"`)} WHERE "code" ~ ${`^${prefix}[0-9]+$`}
        ON CONFLICT ("key") DO UPDATE SET "value" = GREATEST("DocumentSequence"."value", EXCLUDED."value")`;
    }
    this.logger.log(`Synced ${SOURCES.length} document sequences`);
  }
}
