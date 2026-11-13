import {
  BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Injectable, Param, Post, UseGuards,
} from '@nestjs/common';
import { IsInt, IsNumber, IsPositive, Matches, Min } from 'class-validator';
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
/** Ngày cuối tháng của 'YYYY-MM'. */
function monthEnd(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return `${period}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
}

export class FixedAssetDto {
  @Text(200) name!: string;
  @IsNumber() @IsPositive({ message: 'Nguyên giá phải lớn hơn 0' }) cost!: number;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày phải có dạng YYYY-MM-DD' }) usageStartDate!: string;
  @IsInt() @Min(1, { message: 'Số tháng khấu hao phải ≥ 1' }) usefulLifeMonths!: number;
  @OptionalText(10) expenseAccount?: string;
  @OptionalText(300) note?: string;
}

export class DepreciateDto {
  @Matches(/^\d{4}-\d{2}$/, { message: 'Kỳ phải có dạng YYYY-MM' }) period!: string;
}

/** Tài sản cố định + khấu hao đường thẳng. Khấu hao: Nợ 642/627/641 / Có 214 (hao mòn). */
@Injectable()
export class FixedAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const assets = await this.prisma.fixedAsset.findMany({ orderBy: { code: 'asc' } });
    return assets.map((a) => {
      const cost = a.cost.toNumber(), accumulated = a.accumulated.toNumber();
      return {
        id: a.id, code: a.code, name: a.name, cost, accumulated,
        usageStartDate: toDay(a.usageStartDate), usefulLifeMonths: a.usefulLifeMonths,
        expenseAccount: a.expenseAccount, status: a.status,
        monthly: r0(cost / a.usefulLifeMonths), remaining: cost - accumulated, note: a.note,
      };
    });
  }

  async create(dto: FixedAssetDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const code = await this.sequences.nextCode('TS', tx);
      const a = await tx.fixedAsset.create({
        data: {
          code, name: dto.name, cost: dto.cost, usageStartDate: fromDay(dto.usageStartDate)!,
          usefulLifeMonths: dto.usefulLifeMonths, expenseAccount: dto.expenseAccount || '642',
          note: dto.note ?? null, createdById: user.id,
        },
      });
      await this.audit.log(tx, { action: 'fixed_asset.create', entityType: 'FixedAsset', entityId: a.id, entityCode: a.code, summary: `Thêm TSCĐ ${a.code} ${dto.name}: nguyên giá ${vnd(dto.cost)}, khấu hao ${dto.usefulLifeMonths} tháng` });
      return a;
    });
  }

  /** Trích khấu hao cho một tháng (YYYY-MM): một bút toán gộp, chống trích trùng. */
  async depreciate(period: string, user: AuthUser) {
    const date = monthEnd(period);
    return this.prisma.$transaction(async (tx) => {
      const assets = await tx.fixedAsset.findMany({ where: { status: 'DANG_DUNG' } });
      const byAccount = new Map<string, number>();
      let total = 0;
      let count = 0;
      for (const a of assets) {
        const cost = a.cost.toNumber(), accumulated = a.accumulated.toNumber();
        const remaining = cost - accumulated;
        if (remaining <= 0) continue;
        const exists = await tx.depreciationEntry.findUnique({ where: { assetId_period: { assetId: a.id, period } } });
        if (exists) continue;
        const dep = Math.min(r0(cost / a.usefulLifeMonths), remaining);
        if (dep <= 0) continue;
        await tx.depreciationEntry.create({ data: { assetId: a.id, period, amount: dep } });
        await tx.fixedAsset.update({ where: { id: a.id }, data: { accumulated: accumulated + dep } });
        byAccount.set(a.expenseAccount, (byAccount.get(a.expenseAccount) ?? 0) + dep);
        total += dep;
        count++;
      }
      if (total > 0) {
        const lines: { accountCode: string; debit?: number; credit?: number }[] = [...byAccount].map(([accountCode, debit]) => ({ accountCode, debit }));
        lines.push({ accountCode: '214', credit: total });
        await this.ledger.postEntry(tx, {
          date, source: 'MANUAL', refType: 'Depreciation', refId: period, createdById: user.id,
          description: `Khấu hao TSCĐ kỳ ${period}`, lines,
        });
        await this.audit.log(tx, { action: 'fixed_asset.depreciate', entityType: 'FixedAsset', entityId: period, summary: `Trích khấu hao kỳ ${period}: ${count} tài sản, ${vnd(total)}` });
      }
      return { period, total, count };
    });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('accounting/assets')
export class FixedAssetsController {
  constructor(private readonly svc: FixedAssetsService) {}

  @RequirePermissions('accounting.view')
  @Get()
  list() {
    return this.svc.list();
  }

  @RequirePermissions('accounting.manage_account')
  @Post()
  create(@Body() dto: FixedAssetDto, @CurrentUser() user: AuthUser) {
    return this.svc.create(dto, user);
  }

  @RequirePermissions('accounting.manual')
  @Post('depreciate')
  @HttpCode(HttpStatus.OK)
  depreciate(@Body() dto: DepreciateDto, @CurrentUser() user: AuthUser) {
    if (!dto?.period) throw new BadRequestException('Thiếu kỳ khấu hao.');
    return this.svc.depreciate(dto.period, user);
  }
}
