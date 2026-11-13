import {
  BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Injectable, Post, UseGuards,
} from '@nestjs/common';
import { IsIn, IsInt, IsNumber, IsOptional, IsPositive, Matches, Min } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SequenceService } from '../../prisma/sequence.service.js';
import { OptionalText, Text } from '../../common/dto.js';
import { fromDay, toDay } from '../../common/text.js';
import { AuditService } from '../../audit/audit.service.js';
import { vnd } from '../../audit/audit.diff.js';
import { LedgerService } from './ledger.service.js';

const r0 = (n: number) => Math.round(n);
const FUNDING = ['153', '111', '112', '331'] as const;

function monthEnd(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return `${period}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
}

export class PrepaidItemDto {
  @Text(200) name!: string;
  @IsNumber() @IsPositive({ message: 'Giá trị phải lớn hơn 0' }) cost!: number;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày phải có dạng YYYY-MM-DD' }) startDate!: string;
  @IsInt() @Min(1, { message: 'Số tháng phân bổ phải ≥ 1' }) allocationMonths!: number;
  @OptionalText(10) expenseAccount?: string;
  @IsOptional() @IsIn(FUNDING as unknown as string[], { message: 'TK đối ứng phải là 153, 111, 112 hoặc 331' }) fundingAccount?: string;
  @OptionalText(300) note?: string;
}

export class AllocateDto {
  @Matches(/^\d{4}-\d{2}$/, { message: 'Kỳ phải có dạng YYYY-MM' }) period!: string;
}

/**
 * Công cụ dụng cụ / chi phí trả trước. Ghi nhận: Nợ 242 / Có TK đối ứng (mặc định 153 — xuất CCDC từ kho).
 * Phân bổ hằng tháng: Nợ 642/627/641 / Có 242. Chỉ ghi sổ khi sổ cái đã bật tại ngày liên quan.
 */
@Injectable()
export class PrepaidItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const items = await this.prisma.prepaidItem.findMany({ orderBy: { code: 'asc' } });
    return items.map((i) => {
      const cost = i.cost.toNumber(), allocated = i.allocated.toNumber();
      return {
        id: i.id, code: i.code, name: i.name, cost, allocated, remaining: cost - allocated,
        startDate: toDay(i.startDate), allocationMonths: i.allocationMonths, monthly: r0(cost / i.allocationMonths),
        expenseAccount: i.expenseAccount, fundingAccount: i.fundingAccount, status: i.status, note: i.note,
      };
    });
  }

  async create(dto: PrepaidItemDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const code = await this.sequences.nextCode('CC', tx);
      const funding = dto.fundingAccount || '153';
      const item = await tx.prepaidItem.create({
        data: {
          code, name: dto.name, cost: dto.cost, startDate: fromDay(dto.startDate)!, allocationMonths: dto.allocationMonths,
          expenseAccount: dto.expenseAccount || '642', fundingAccount: funding, note: dto.note ?? null, createdById: user.id,
        },
      });
      // Ghi nhận vào chi phí trả trước: Nợ 242 / Có TK đối ứng.
      if (await this.ledger.isLedgerActive(tx, dto.startDate)) {
        await this.ledger.postEntry(tx, {
          date: dto.startDate, source: 'MANUAL', refType: 'PrepaidItem', refId: item.id, createdById: user.id,
          description: `Ghi nhận công cụ dụng cụ ${code} ${dto.name}`,
          lines: [{ accountCode: '242', debit: dto.cost }, { accountCode: funding, credit: dto.cost }],
        });
      }
      await this.audit.log(tx, {
        action: 'prepaid_item.create', entityType: 'PrepaidItem', entityId: item.id, entityCode: code,
        summary: `Thêm CCDC ${code} ${dto.name}: ${vnd(dto.cost)}, phân bổ ${dto.allocationMonths} tháng`,
      });
      return item;
    });
  }

  /** Phân bổ cho một tháng (YYYY-MM): một bút toán gộp, chống phân bổ trùng, không phân bổ trước ngày bắt đầu. */
  async allocate(period: string, user: AuthUser) {
    const date = monthEnd(period);
    return this.prisma.$transaction(async (tx) => {
      const items = await tx.prepaidItem.findMany({ where: { status: 'DANG_PHAN_BO' } });
      const byAccount = new Map<string, number>();
      let total = 0, count = 0;
      for (const i of items) {
        if (toDay(i.startDate)!.slice(0, 7) > period) continue; // chưa tới tháng bắt đầu phân bổ
        const cost = i.cost.toNumber(), allocated = i.allocated.toNumber();
        const remaining = cost - allocated;
        if (remaining <= 0) continue;
        if (await tx.prepaidAllocation.findUnique({ where: { itemId_period: { itemId: i.id, period } } })) continue;
        const amount = Math.min(r0(cost / i.allocationMonths), remaining);
        if (amount <= 0) continue;
        await tx.prepaidAllocation.create({ data: { itemId: i.id, period, amount } });
        const done = allocated + amount >= cost;
        await tx.prepaidItem.update({ where: { id: i.id }, data: { allocated: allocated + amount, status: done ? 'HET_PHAN_BO' : 'DANG_PHAN_BO' } });
        byAccount.set(i.expenseAccount, (byAccount.get(i.expenseAccount) ?? 0) + amount);
        total += amount;
        count++;
      }
      if (total > 0 && (await this.ledger.isLedgerActive(tx, date))) {
        const lines: { accountCode: string; debit?: number; credit?: number }[] = [...byAccount].map(([accountCode, debit]) => ({ accountCode, debit }));
        lines.push({ accountCode: '242', credit: total });
        await this.ledger.postEntry(tx, {
          date, source: 'MANUAL', refType: 'PrepaidAllocation', refId: period, createdById: user.id,
          description: `Phân bổ công cụ dụng cụ kỳ ${period}`, lines,
        });
      }
      if (total > 0) {
        await this.audit.log(tx, { action: 'prepaid_item.allocate', entityType: 'PrepaidItem', entityId: period, summary: `Phân bổ CCDC kỳ ${period}: ${count} khoản, ${vnd(total)}` });
      }
      return { period, total, count };
    });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('accounting/prepaid')
export class PrepaidItemsController {
  constructor(private readonly svc: PrepaidItemsService) {}

  @RequirePermissions('accounting.view')
  @Get()
  list() {
    return this.svc.list();
  }

  @RequirePermissions('accounting.manage_account')
  @Post()
  create(@Body() dto: PrepaidItemDto, @CurrentUser() user: AuthUser) {
    return this.svc.create(dto, user);
  }

  @RequirePermissions('accounting.manual')
  @Post('allocate')
  @HttpCode(HttpStatus.OK)
  allocate(@Body() dto: AllocateDto, @CurrentUser() user: AuthUser) {
    if (!dto?.period) throw new BadRequestException('Thiếu kỳ phân bổ.');
    return this.svc.allocate(dto.period, user);
  }
}
