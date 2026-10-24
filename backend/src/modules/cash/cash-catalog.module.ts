import {
  BadRequestException, Body, ConflictException, Controller, Get, Injectable, Module, NotFoundException, Param, Patch, Post, Put, UseGuards,
} from '@nestjs/common';
import { CashAccountType, PartnerType, VoucherKind } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, Matches, Min } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { RequirePermissions } from '../../auth/permissions.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { diff } from '../../audit/audit.diff.js';

const ACCOUNT_FIELDS = {
  name: 'Tên', type: 'Tính chất', code: 'Mã', bankName: 'Ngân hàng', bankBin: 'Mã ngân hàng (VietQR)', accountNumber: 'Số tài khoản', accountHolder: 'Chủ tài khoản',
  branch: 'Chi nhánh', openingBalance: 'Số dư đầu kỳ', sortOrder: 'Thứ tự', note: 'Ghi chú', isDefault: 'Mặc định', isActive: 'Đang dùng',
};
const CATEGORY_FIELDS = { name: 'Tên', partnerType: 'Đối tác', isDefault: 'Mặc định', isActive: 'Đang dùng' };
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
  /** Mã BIN NAPAS (6 số) — có thì in được mã VietQR chuyển khoản vào tài khoản này. */
  @IsOptional() @Matches(/^\d{6}$/, { message: 'Mã ngân hàng (BIN) gồm 6 chữ số' }) bankBin?: string;
  @OptionalText(40) accountNumber?: string;
  @OptionalText(100) accountHolder?: string;
  @OptionalText(100) branch?: string;
  @IsNumber() openingBalance!: number;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @OptionalText(500) note?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

/** Số dư of each account = số dư đầu kỳ + thu − chi of the phiếu chưa huỷ. Never stored. */
export async function cashBalances(db: Pick<PrismaService, 'cashVoucher'>): Promise<Map<string, number>> {
  const sums = await db.cashVoucher.groupBy({ by: ['accountId', 'kind'], where: { isCancelled: false }, _sum: { amount: true } });
  const out = new Map<string, number>();
  for (const s of sums) {
    const amount = s._sum.amount?.toNumber() ?? 0;
    out.set(s.accountId, (out.get(s.accountId) ?? 0) + (s.kind === 'THU' ? amount : -amount));
  }
  return out;
}

@Injectable()
export class CashAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll() {
    const [accounts, moved] = await Promise.all([
      this.prisma.cashAccount.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      cashBalances(this.prisma),
    ]);
    return accounts.map((a) => ({ ...a, balance: a.openingBalance.toNumber() + (moved.get(a.id) ?? 0) }));
  }

  private async one(id: string) {
    return (await this.findAll()).find((a) => a.id === id)!;
  }

  async save(dto: CashAccountDto, id?: string) {
    const all = await this.prisma.cashAccount.findMany();
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
      bankName: bank ? (dto.bankName ?? null) : null, bankBin: bank ? (dto.bankBin ?? null) : null, accountNumber: bank ? (dto.accountNumber ?? null) : null,
      accountHolder: bank ? (dto.accountHolder ?? null) : null, branch: bank ? (dto.branch ?? null) : null,
      openingBalance: dto.openingBalance, sortOrder: dto.sortOrder ?? 0, note: dto.note ?? null, isDefault, isActive,
    };
    const saved = await this.prisma.$transaction(async (tx) => {
      // "Chọn sẵn khi lập phiếu": one default account at most.
      // (No NOT: { id: undefined } on create — Prisma reads that as NOT {} and matches nothing.)
      if (isDefault) await tx.cashAccount.updateMany({ where: id ? { isDefault: true, NOT: { id } } : { isDefault: true }, data: { isDefault: false } });
      const a = old ? await tx.cashAccount.update({ where: { id }, data }) : await tx.cashAccount.create({ data });
      await this.audit.log(tx, {
        action: old ? 'cash_account.update' : 'cash_account.create', entityType: 'CashAccount', entityId: a.id, entityCode: a.code ?? a.name,
        summary: `${old ? 'Sửa' : 'Thêm'} tài khoản tiền ${a.name}`, changes: old ? diff(old, data, ACCOUNT_FIELDS) : undefined,
      });
      return a;
    });
    return this.one(saved.id);
  }

  /** Ngừng dùng, never deleted: old vouchers keep it, new ones cannot pick it. */
  async setActive(id: string, isActive: boolean) {
    await this.prisma.$transaction(async (tx) => {
      const a = await tx.cashAccount.update({ where: { id }, data: isActive ? { isActive } : { isActive, isDefault: false } });
      await this.audit.log(tx, {
        action: isActive ? 'cash_account.activate' : 'cash_account.deactivate', entityType: 'CashAccount', entityId: id, entityCode: a.code ?? a.name,
        summary: `${isActive ? 'Dùng lại' : 'Ngừng dùng'} tài khoản tiền ${a.name}`,
      });
    });
    return this.one(id);
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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
      const c = old
        ? await tx.cashCategory.update({ where: { code }, data })
        : await tx.cashCategory.create({ data: { code, ...data, sortOrder: all.length } });
      await this.audit.log(tx, {
        action: old ? 'cash_category.update' : 'cash_category.create', entityType: 'CashCategory', entityId: code, entityCode: code,
        summary: `${old ? 'Sửa' : 'Thêm'} loại ${c.kind === 'THU' ? 'thu' : 'chi'} ${c.name}` + (old && old.name !== c.name ? ' (phiếu cũ đổi tên theo)' : ''),
        changes: old ? diff(old, data, CATEGORY_FIELDS) : undefined,
      });
      return c;
    });
  }

  setActive(code: string, isActive: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const c = await tx.cashCategory.update({ where: { code }, data: isActive ? { isActive } : { isActive, isDefault: false } });
      await this.audit.log(tx, {
        action: isActive ? 'cash_category.activate' : 'cash_category.deactivate', entityType: 'CashCategory', entityId: code, entityCode: code,
        summary: `${isActive ? 'Dùng lại' : 'Ngừng dùng'} loại thu chi ${c.name}`,
      });
      return c;
    });
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
  exports: [CashAccountsService],
})
export class CashCatalogModule {}
