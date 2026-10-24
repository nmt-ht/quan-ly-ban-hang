import { BadRequestException, Body, Controller, Get, Injectable, Post, Query, UseGuards } from '@nestjs/common';
import { IsEnum, IsNumber, IsOptional, IsPositive } from 'class-validator';
import { Prisma, ReminderChannel } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { OptionalDay, OptionalText, Text } from '../../common/dto.js';
import { fromDay, toDay } from '../../common/text.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { vnd } from '../../audit/audit.diff.js';
import { ReceivablesService } from './receivables.service.js';

export class DebtReminderDto {
  @Text(60) customerId!: string;
  @IsEnum(ReminderChannel) channel!: ReminderChannel;
  @OptionalText(1000) note?: string;
  /** Khách hẹn trả ngày… */
  @OptionalDay() promisedDate?: string;
  @IsOptional() @IsNumber() @IsPositive() promisedAmount?: number;
}

export const CHANNEL_LABEL: Record<ReminderChannel, string> = {
  ZALO: 'Zalo', SMS: 'SMS', GOI_DIEN: 'Gọi điện', EMAIL: 'Email', GAP_TRUC_TIEP: 'Gặp trực tiếp', KHAC: 'Khác',
};

const INCLUDE = { createdBy: { select: { email: true } } } as const satisfies Prisma.DebtReminderInclude;
type Row = Prisma.DebtReminderGetPayload<{ include: typeof INCLUDE }>;

const toApi = ({ createdBy, createdById: _c, balance, overdue, promisedDate, promisedAmount, ...r }: Row) => ({
  ...r,
  balance: balance.toNumber(), overdue: overdue.toNumber(),
  promisedDate: toDay(promisedDate), promisedAmount: promisedAmount?.toNumber() ?? null,
  createdBy: createdBy.email,
});

/**
 * Nhắc nợ (Pha 2): each time someone reminds a customer — kênh, ghi chú, hẹn trả — with what the customer owed at that
 * moment (từ ReceivablesService, not typed in). The screen composes the message and opens Zalo / gọi / email; sending
 * through an SMS or Zalo OA account is not wired.
 */
@Injectable()
export class DebtRemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly receivables: ReceivablesService,
    private readonly audit: AuditService,
  ) {}

  async list(customerId?: string) {
    const rows = await this.prisma.debtReminder.findMany({
      where: customerId ? { customerId } : {}, include: INCLUDE, orderBy: { createdAt: 'desc' }, take: customerId ? undefined : 2000,
    });
    return rows.map(toApi);
  }

  async create(dto: DebtReminderDto, user: AuthUser) {
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId }, select: { id: true, code: true, name: true } });
    if (!customer) throw new BadRequestException('Khách hàng không tồn tại');
    const today = new Date().toISOString().slice(0, 10);
    if (dto.promisedDate && dto.promisedDate < today) throw new BadRequestException('Ngày hẹn trả đã qua.');
    const debt = (await this.receivables.rows(today, customer.id))[0];
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.debtReminder.create({
        data: {
          customerId: customer.id, channel: dto.channel, note: dto.note ?? null, balance: debt?.balance ?? 0, overdue: debt?.overdue ?? 0,
          promisedDate: fromDay(dto.promisedDate), promisedAmount: dto.promisedAmount ?? null, createdById: user.id,
        },
        include: INCLUDE,
      });
      const promise = dto.promisedDate ? ` · hẹn trả ${dto.promisedDate.split('-').reverse().join('/')}${dto.promisedAmount ? ` ${vnd(dto.promisedAmount)}` : ''}` : '';
      await this.audit.log(tx, {
        action: 'debt.remind', entityType: 'Customer', entityId: customer.id, entityCode: customer.code,
        summary: `Nhắc nợ ${customer.code} · ${customer.name} qua ${CHANNEL_LABEL[dto.channel]}: còn nợ ${vnd(debt?.balance ?? 0)}`
          + (debt?.overdue ? `, quá hạn ${vnd(debt.overdue)}` : '') + promise,
      });
      return toApi(r);
    });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('debt-reminders')
export class DebtRemindersController {
  constructor(private readonly reminders: DebtRemindersService) {}

  @RequirePermissions('debt.view')
  @Get()
  list(@Query('customerId') customerId?: string) {
    return this.reminders.list(customerId || undefined);
  }

  @RequirePermissions('debt.remind')
  @Post()
  create(@Body() dto: DebtReminderDto, @CurrentUser() user: AuthUser) {
    return this.reminders.create(dto, user);
  }
}
