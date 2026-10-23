import { Controller, ForbiddenException, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { CurrentUser, RequirePermissions } from '../auth/permissions.decorator.js';
import type { AuthUser } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class AuditQueryDto {
  @IsOptional() @Matches(DAY, { message: 'Ngày phải có dạng YYYY-MM-DD' }) from?: string;
  @IsOptional() @Matches(DAY, { message: 'Ngày phải có dạng YYYY-MM-DD' }) to?: string;
  @IsOptional() @IsString() @MaxLength(64) userId?: string;
  @IsOptional() @IsString() @MaxLength(64) entityType?: string;
  /** Prefix of the action: "sales_order." or "auth.login_failed". */
  @IsOptional() @IsString() @MaxLength(64) action?: string;
  /** Mã chứng từ or words of the summary. */
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  /** Keyset paging: the `nextCursor` of the previous page. */
  @IsOptional() @Matches(/^\d+$/) before?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number;
}

/** Who may read the Lịch sử of one record without audit.view: whoever may open that record. */
const VIEW_PERMISSION: Record<string, string> = {
  SalesOrder: 'order.view', ProductionOrder: 'production.view', PurchaseOrder: 'purchase.view',
  DeliveryTrip: 'trip.view', WarehouseVoucher: 'stock.view', CashVoucher: 'voucher.view',
  CashAccount: 'voucher.view', CashCategory: 'voucher.view', Customer: 'customer.view',
  Supplier: 'supplier.view', Product: 'product.view', Vehicle: 'vehicle.view', User: 'user.view',
  Role: 'position.view', Tag: 'tag.view', Warehouse: 'warehouse.view', ProductCategory: 'category.view',
  CompanyInfo: 'company.view',
};

type Row = Awaited<ReturnType<PrismaService['auditLog']['findMany']>>[number];
const toApi = ({ id, ...r }: Row) => ({ id: id.toString(), ...r });

// Days are Vietnamese calendar days (UTC+7, no daylight saving), as the screens show them.
const startOfDay = (d: string) => new Date(`${d}T00:00:00.000+07:00`);
const endOfDay = (d: string) => new Date(startOfDay(d).getTime() + 86_400_000);

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  /** Thiết lập › Nhật ký hoạt động: newest first, keyset paged. */
  @RequirePermissions('audit.view')
  @Get()
  async list(@Query() q: AuditQueryDto) {
    const limit = q.limit ?? 100;
    const where: Prisma.AuditLogWhereInput = {
      ...(q.userId ? { userId: q.userId } : {}),
      ...(q.entityType ? { entityType: q.entityType } : {}),
      ...(q.action ? { action: { startsWith: q.action } } : {}),
      ...(q.before ? { id: { lt: BigInt(q.before) } } : {}),
      ...(q.from || q.to ? { at: { ...(q.from ? { gte: startOfDay(q.from) } : {}), ...(q.to ? { lt: endOfDay(q.to) } : {}) } } : {}),
      ...(q.q?.trim()
        ? { OR: [
          { entityCode: { contains: q.q.trim(), mode: 'insensitive' } },
          { summary: { contains: q.q.trim(), mode: 'insensitive' } },
          { userName: { contains: q.q.trim(), mode: 'insensitive' } },
        ] }
        : {}),
    };
    const rows = await this.prisma.auditLog.findMany({ where, orderBy: { id: 'desc' }, take: limit + 1 });
    const page = rows.slice(0, limit);
    return { items: page.map(toApi), nextCursor: rows.length > limit ? page[page.length - 1].id.toString() : null };
  }

  /**
   * Tab Lịch sử of one record, oldest first: its own lines plus lines of other records that name its
   * code (a chuyến chốt giao naming the đơn, a phiếu thu tự lập for it…). Without audit.view, a line
   * about another kind of record shows only to whoever may open that kind.
   */
  @Get('entity/:type/:id')
  async entity(@Param('type') type: string, @Param('id') id: string, @Query('code') code: string | undefined, @CurrentUser() user: AuthUser) {
    const perms = new Set(user.permissions);
    const all = perms.has('audit.view');
    const need = VIEW_PERMISSION[type];
    if (!all && !(need && perms.has(need))) throw new ForbiddenException('Chức vụ của bạn chưa có quyền xem lịch sử này.');
    if (type === 'SalesOrder' && !all) await this.checkOwnOrder(id, user);

    const rows = await this.prisma.auditLog.findMany({
      where: { OR: [{ entityType: type, entityId: id }, ...(code?.trim() ? [{ related: { has: code.trim() } }] : [])] },
      orderBy: { id: 'asc' }, take: 500,
    });
    return rows
      .filter((r) => all || (r.entityType === type && r.entityId === id) || perms.has(VIEW_PERMISSION[r.entityType] ?? 'audit.view'))
      .map(toApi);
  }

  /** Same rule as SalesService.visibleTo: a seller without order.view_all sees only orders they sell or made. */
  private async checkOwnOrder(id: string, user: AuthUser) {
    if (user.permissions.includes('order.view_all') || !user.permissions.includes('order.create')) return;
    const own = await this.prisma.salesOrder.count({ where: { id, OR: [{ salesRepId: user.id }, { createdById: user.id }] } });
    if (!own) throw new ForbiddenException('Chức vụ của bạn chưa có quyền xem lịch sử đơn này.');
  }
}
