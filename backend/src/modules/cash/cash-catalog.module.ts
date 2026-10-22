import {
  BadRequestException, Body, ConflictException, Controller, Get, Injectable, Module, NotFoundException, Param, Patch, Post, Put, UseGuards,
} from '@nestjs/common';
import { CashAccountType, PartnerType, VoucherKind } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, Matches, Min } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { RequirePermissions } from '../../auth/permissions.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OptionalText, Text } from '../../common/dto.js';
import { foldVi } from '../../common/text.js';

export class ActiveDto {
  @IsBoolean() isActive!: boolean;
}

// ---------- Tài khoản tiền ----------

export class CashAccountDto {
  @Text(100) name!: string;
  @IsEnum(CashAccountType) type!: CashAccountType;
  @OptionalText(30) code?: string;
  @OptionalText(100) bankName?: string;
  @OptionalText(40) accountNumber?: string;
  @OptionalText(100) accountHolder?: string;
  @OptionalText(100) branch?: string;
  @IsNumber() openingBalance!: number;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @OptionalText(500) note?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@Injectable()
export class CashAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.cashAccount.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async save(dto: CashAccountDto, id?: string) {
    const all = await this.findAll();
    const old = id ? all.find((a) => a.id === id) : undefined;
    if (id && !old) throw new NotFoundException('Không tìm thấy tài khoản tiền');
    if (dto.type === 'NGAN_HANG' && !dto.accountNumber) throw new BadRequestException('Nhập số tài khoản ngân hàng');
    const dup = dto.code && all.find((a) => a.id !== id && (a.code ?? '').toUpperCase() === dto.code!.toUpperCase());
    if (dup) throw new ConflictException(`Mã ${dto.code} đã dùng cho ${dup.name}`);

    const bank = dto.type === 'NGAN_HANG';
    const isActive = dto.isActive ?? true;
    const isDefault = !!dto.isDefault && isActive;
    const data = {
      name: dto.name, type: dto.type, code: dto.code ?? null,
      bankName: bank ? (dto.bankName ?? null) : null, accountNumber: bank ? (dto.accountNumber ?? null) : null,
      accountHolder: bank ? (dto.accountHolder ?? null) : null, branch: bank ? (dto.branch ?? null) : null,
      openingBalance: dto.openingBalance, sortOrder: dto.sortOrder ?? 0, note: dto.note ?? null, isDefault, isActive,
    };
    return this.prisma.$transaction(async (tx) => {
      // "Chọn sẵn khi lập phiếu": one default account at most.
      // (No NOT: { id: undefined } on create — Prisma reads that as NOT {} and matches nothing.)
      if (isDefault) await tx.cashAccount.updateMany({ where: id ? { isDefault: true, NOT: { id } } : { isDefault: true }, data: { isDefault: false } });
      if (!old) return tx.cashAccount.create({ data: { ...data, balance: dto.openingBalance } });
      // Số dư = đầu kỳ + thu − chi: moving the opening balance moves the balance by the same amount.
      const shift = dto.openingBalance - old.openingBalance.toNumber();
      return tx.cashAccount.update({ where: { id }, data: { ...data, balance: { increment: shift } } });
    });
  }

  /** Ngừng dùng, never deleted: old vouchers keep it, new ones cannot pick it. */
  setActive(id: string, isActive: boolean) {
    return this.prisma.cashAccount.update({ where: { id }, data: isActive ? { isActive } : { isActive, isDefault: false } });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('cash-accounts')
export class CashAccountsController {
  constructor(private readonly accounts: CashAccountsService) {}

  @Get()
  findAll() {
    return this.accounts.findAll();
  }

  @RequirePermissions('voucher.manage_account')
  @Post()
  create(@Body() dto: CashAccountDto) {
    return this.accounts.save(dto);
  }

  @RequirePermissions('voucher.manage_account')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: CashAccountDto) {
    return this.accounts.save(dto, id);
  }

  @RequirePermissions('voucher.manage_account')
  @Patch(':id/active')
  setActive(@Param('id') id: string, @Body() dto: ActiveDto) {
    return this.accounts.setActive(id, dto.isActive);
  }
}

// ---------- Loại thu chi ----------

export class CashCategoryDto {
  @Text(100) name!: string;
  @IsEnum(VoucherKind) kind!: VoucherKind;
  @IsEnum(PartnerType) partnerType!: PartnerType;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

const CODE = /^[A-Z0-9_]{2,40}$/;

@Injectable()
export class CashCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.cashCategory.findMany({ orderBy: [{ kind: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }] });
  }

  /** Create or update by code (the frontend picks the code of a new category). */
  async save(code: string, dto: CashCategoryDto) {
    if (!CODE.test(code)) throw new BadRequestException('Mã loại chỉ gồm chữ in hoa, số và dấu _');
    const all = await this.findAll();
    const old = all.find((c) => c.code === code);
    if (old && old.kind !== dto.kind) throw new BadRequestException('Không đổi được loại thu thành chi (hoặc ngược lại).');
    if (old?.isSystem && old.partnerType !== dto.partnerType) throw new BadRequestException('Loại mặc định của hệ thống không đổi được cách gắn đối tác.');
    const dup = all.find((c) => c.code !== code && c.kind === dto.kind && foldVi(c.name) === foldVi(dto.name));
    if (dup) throw new ConflictException(`Đã có loại "${dup.name}"`);

    const isActive = dto.isActive ?? true;
    const isDefault = !!dto.isDefault && isActive;
    return this.prisma.$transaction(async (tx) => {
      if (isDefault) await tx.cashCategory.updateMany({ where: { kind: dto.kind, isDefault: true, NOT: { code } }, data: { isDefault: false } });
      // Vouchers store the category name: a rename carries over so reports do not split in two.
      if (old && old.name !== dto.name) {
        await tx.cashVoucher.updateMany({ where: { kind: old.kind, category: old.name }, data: { category: dto.name } });
      }
      const data = { name: dto.name, kind: dto.kind, partnerType: dto.partnerType, isDefault, isActive };
      return old
        ? tx.cashCategory.update({ where: { code }, data })
        : tx.cashCategory.create({ data: { code, ...data, sortOrder: all.length } });
    });
  }

  setActive(code: string, isActive: boolean) {
    return this.prisma.cashCategory.update({ where: { code }, data: isActive ? { isActive } : { isActive, isDefault: false } });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('cash-categories')
export class CashCategoriesController {
  constructor(private readonly categories: CashCategoriesService) {}

  @Get()
  findAll() {
    return this.categories.findAll();
  }

  @RequirePermissions('voucher.manage_category')
  @Put(':code')
  save(@Param('code') code: string, @Body() dto: CashCategoryDto) {
    return this.categories.save(code, dto);
  }

  @RequirePermissions('voucher.manage_category')
  @Patch(':code/active')
  setActive(@Param('code') code: string, @Body() dto: ActiveDto) {
    return this.categories.setActive(code, dto.isActive);
  }
}

@Module({
  controllers: [CashAccountsController, CashCategoriesController],
  providers: [CashAccountsService, CashCategoriesService],
})
export class CashCatalogModule {}
