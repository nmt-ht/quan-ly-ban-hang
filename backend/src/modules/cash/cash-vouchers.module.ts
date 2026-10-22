import {
  BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Injectable, Module, NotFoundException, Param, Post, UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { PartnerType, VoucherKind } from '@prisma/client';
import { IsArray, IsEnum, IsNumber, IsOptional, IsPositive, Matches, Min, ValidateNested } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequireAnyPermission, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SequenceService } from '../../prisma/sequence.service.js';
import { OptionalText, Text } from '../../common/dto.js';
import { fromDay } from '../../common/text.js';
import { CASH_INCLUDE, cashToApi } from './cash-voucher.mapper.js';

export class AllocationDto {
  @Text(30) ref!: string; // mã chứng từ công nợ (DN…/DH…, or a phiếu hoàn tiền)
  @IsNumber() @IsPositive() amount!: number;
}

export class CashVoucherDto {
  @IsEnum(VoucherKind) kind!: VoucherKind;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày phải có dạng YYYY-MM-DD' }) date!: string;
  @Text(100) category!: string; // name of the loại thu chi
  @IsEnum(PartnerType) partnerType!: PartnerType;
  @OptionalText(60) partnerId?: string;
  @Text(60) accountId!: string;
  @IsNumber() @IsPositive({ message: 'Số tiền phải lớn hơn 0' }) amount!: number;
  @OptionalText(500) description?: string;
  /** Đối trừ "Chọn tay"; absent = tự động (khoản đến hạn sớm nhất trước). */
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AllocationDto) allocations?: AllocationDto[];
  @IsOptional() @IsNumber() @Min(0) settledAmount?: number;
}

export class CancelDto {
  @OptionalText(300) reason?: string;
}

const PREFIX: Record<VoucherKind, string> = { THU: 'PT', CHI: 'PC' };

/**
 * Phiếu thu chi. A phiếu tied to a khách hàng / nhà cung cấp settles their công nợ: allocations
 * ("Chọn tay") go to the named documents first, the rest settles the earliest due khoản (FIFO) —
 * computed when công nợ is read (common/settle.ts), never stored per khoản. Số dư quỹ follows from
 * the phiếu chưa huỷ (cashBalances).
 */
@Injectable()
export class CashVouchersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
  ) {}

  async findAll() {
    const rows = await this.prisma.cashVoucher.findMany({ include: CASH_INCLUDE, orderBy: [{ date: 'desc' }, { code: 'desc' }] });
    return rows.map(cashToApi);
  }

  async create(dto: CashVoucherDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const category = await tx.cashCategory.findFirst({ where: { kind: dto.kind, name: dto.category, isActive: true } });
      if (!category) throw new BadRequestException(`Loại "${dto.category}" không có hoặc đã ngừng dùng.`);
      if (category.partnerType !== dto.partnerType) throw new BadRequestException(`Loại "${category.name}" không gắn với đối tác này.`);
      const account = await tx.cashAccount.findUnique({ where: { id: dto.accountId } });
      if (!account || !account.isActive) throw new BadRequestException('Tài khoản tiền không có hoặc đã ngừng dùng.');

      let customerId: string | null = null;
      let supplierId: string | null = null;
      let refs = new Set<string>();
      if (dto.partnerType === 'KHACH_HANG') {
        if (!dto.partnerId || !(await tx.customer.findUnique({ where: { id: dto.partnerId } }))) throw new BadRequestException('Chọn khách hàng.');
        customerId = dto.partnerId;
        // What a phiếu thu may settle: the customer's orders, and money we paid back to them (phiếu chi hoàn tiền).
        refs = new Set([
          ...(await tx.salesOrder.findMany({ where: { customerId, status: { not: 'HUY' } }, select: { code: true } })).map((o) => o.code),
          ...(await tx.cashVoucher.findMany({ where: { customerId, kind: dto.kind === 'THU' ? 'CHI' : 'THU', isCancelled: false }, select: { code: true } })).map((v) => v.code),
        ]);
      } else if (dto.partnerType === 'NHA_CUNG_CAP') {
        if (!dto.partnerId || !(await tx.supplier.findUnique({ where: { id: dto.partnerId } }))) throw new BadRequestException('Chọn nhà cung cấp.');
        supplierId = dto.partnerId;
        refs = new Set([
          ...(await tx.purchaseOrder.findMany({ where: { supplierId, status: { not: 'HUY' } }, select: { code: true } })).map((o) => o.code),
          ...(await tx.cashVoucher.findMany({ where: { supplierId, kind: dto.kind === 'CHI' ? 'THU' : 'CHI', isCancelled: false }, select: { code: true } })).map((v) => v.code),
        ]);
      }

      // Chọn tay: same document twice adds up; unknown documents and more than the phiếu are refused.
      const merged = new Map<string, number>();
      for (const a of dto.partnerType === 'KHAC' ? [] : (dto.allocations ?? [])) merged.set(a.ref, (merged.get(a.ref) ?? 0) + a.amount);
      for (const ref of merged.keys()) if (!refs.has(ref)) throw new BadRequestException(`${ref} không phải chứng từ công nợ của đối tác này.`);
      const allocated = [...merged.values()].reduce((s, x) => s + x, 0);
      if (allocated > dto.amount) throw new BadRequestException('Tổng đối trừ chọn tay vượt số tiền của phiếu.');

      const v = await tx.cashVoucher.create({
        data: {
          code: await this.sequences.nextCode(PREFIX[dto.kind], tx), date: fromDay(dto.date)!, kind: dto.kind, category: category.name,
          partnerType: dto.partnerType, customerId, supplierId, accountId: account.id, amount: dto.amount,
          settledAmount: dto.partnerType === 'KHAC' ? 0 : Math.min(dto.amount, Math.max(0, dto.settledAmount ?? 0)),
          description: dto.description ?? null, createdById: user.id,
          allocations: { create: [...merged].map(([ref, amount]) => ({ ref, amount })) },
        },
        include: CASH_INCLUDE,
      });
      return cashToApi(v);
    });
  }

  /** Huỷ phiếu: the phiếu stays (shown as huỷ); it no longer counts in số dư quỹ or đối trừ, so công nợ reopens. */
  async cancel(id: string, reason: string | undefined) {
    const v = await this.prisma.cashVoucher.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Không tìm thấy phiếu thu chi');
    if (v.isCancelled) throw new BadRequestException(`${v.code} đã huỷ rồi.`);
    const saved = await this.prisma.cashVoucher.update({
      where: { id }, data: { isCancelled: true, cancelReason: reason ?? null, cancelledAt: new Date() }, include: CASH_INCLUDE,
    });
    return cashToApi(saved);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('cash-vouchers')
export class CashVouchersController {
  constructor(private readonly vouchers: CashVouchersService) {}

  // Công nợ, the dashboard and the cash-flow report read them too.
  @RequireAnyPermission('voucher.view', 'debt.view', 'report.cashflow', 'report.dashboard')
  @Get()
  findAll() {
    return this.vouchers.findAll();
  }

  @Post()
  create(@Body() dto: CashVoucherDto, @CurrentUser() user: AuthUser) {
    const need = dto.kind === 'THU' ? 'voucher.create_receipt' : 'voucher.create_payment';
    if (!user.permissions.includes(need)) throw new ForbiddenException(`Chức vụ của bạn chưa có quyền: ${need}`);
    return this.vouchers.create(dto, user);
  }

  @RequirePermissions('voucher.cancel')
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Body() dto: CancelDto) {
    return this.vouchers.cancel(id, dto.reason);
  }
}

@Module({ controllers: [CashVouchersController], providers: [CashVouchersService] })
export class CashVouchersModule {}
