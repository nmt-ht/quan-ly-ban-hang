import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditContext, auditContext } from './audit.context.js';
import { AuditChange } from './audit.diff.js';

type Db = PrismaService | Prisma.TransactionClient;

/** One line of Nhật ký hoạt động. `action` is `<entity>.<verb>`, e.g. sales_order.deliver. */
export interface AuditEntry {
  action: string;
  entityType: string; // Prisma model name: SalesOrder, Customer…
  entityId: string;
  entityCode?: string | null; // DH0000014, KH0000004… — searchable
  summary: string; // one Vietnamese sentence, shown as is
  changes?: AuditChange[];
  related?: string[]; // codes of documents written alongside (PXK…, PT…)
  /** Only where no signed-in user exists yet (sign-in itself). */
  actor?: { id: string | null; name: string };
}

const SYSTEM = { id: null, name: 'Hệ thống' };

/**
 * Append-only activity log. Call `log(tx, …)` inside the same transaction as the change it records,
 * so a rolled-back write leaves no line behind and a committed one always has its line.
 * The table refuses UPDATE / DELETE / TRUNCATE (migration dot9_audit_log).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  async log(db: Db, e: AuditEntry): Promise<void> {
    const ctx = auditContext();
    const actor = e.actor ?? ctx?.user ?? SYSTEM;
    await db.auditLog.create({
      data: {
        userId: actor.id,
        userName: actor.name,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        entityCode: e.entityCode ?? null,
        summary: e.summary,
        changes: e.changes?.length ? (e.changes as unknown as Prisma.InputJsonValue) : undefined,
        related: e.related?.length ? e.related : undefined,
        ip: ctx?.ip ?? null,
        requestId: ctx?.requestId ?? null,
      },
    });
    if (ctx) ctx.logged++;
  }

  /** Safety net: a successful write that logged nothing still leaves a trace, and a warning to fix it. */
  async unaudited(ctx: AuditContext): Promise<void> {
    this.logger.warn(`${ctx.method} ${ctx.route} ghi dữ liệu nhưng không ghi nhật ký`);
    await this.prisma.auditLog.create({
      data: {
        userId: ctx.user?.id ?? null,
        userName: ctx.user?.name ?? SYSTEM.name,
        action: 'api.unaudited',
        entityType: 'Api',
        entityId: `${ctx.method} ${ctx.route}`,
        summary: `${ctx.method} ${ctx.route} (chưa có mô tả nhật ký)`,
        ip: ctx.ip,
        requestId: ctx.requestId,
      },
    });
  }
}
