import {
  Body, ConflictException, Controller, Delete, Get, HttpCode, HttpStatus, Injectable, NotFoundException, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { AccountKind, NormalSide } from '@prisma/client';
import { IsBoolean, IsIn, IsOptional, Matches } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { RequirePermissions } from '../../auth/permissions.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Text } from '../../common/dto.js';
import { AuditService } from '../../audit/audit.service.js';
import { diff } from '../../audit/audit.diff.js';

const KINDS: AccountKind[] = ['TAI_SAN', 'NO_PHAI_TRA', 'VON_CSH', 'DOANH_THU', 'CHI_PHI', 'KQKD'];
const SIDES: NormalSide[] = ['NO', 'CO'];
const ACCOUNT_FIELDS = { name: 'Tên', kind: 'Loại', normalSide: 'Dư thường', parentCode: 'TK cha', isDetail: 'Chi tiết' };

export class CreateAccountDto {
  @Matches(/^\d{3,6}$/, { message: 'Số hiệu tài khoản là 3–6 chữ số.' }) code!: string;
  @Text(200) name!: string;
  @IsIn(KINDS) kind!: AccountKind;
  @IsIn(SIDES) normalSide!: NormalSide;
  @IsOptional() @Matches(/^\d{3,6}$/, { message: 'TK cha là 3–6 chữ số.' }) parentCode?: string;
  @IsBoolean() isDetail!: boolean;
}

export class UpdateAccountDto {
  @Text(200) name!: string;
  @IsOptional() @IsIn(KINDS) kind?: AccountKind;
  @IsOptional() @IsIn(SIDES) normalSide?: NormalSide;
  @IsOptional() @Matches(/^\d{3,6}$/) parentCode?: string;
  @IsOptional() @IsBoolean() isDetail?: boolean;
}

export class AccountActiveDto {
  @IsBoolean() isActive!: boolean;
}

/** Hệ thống tài khoản: thêm / sửa / ngừng dùng / xoá. TK chuẩn (isSystem) chỉ đổi được tên; cấu trúc và việc xoá chỉ áp dụng cho TK người dùng tự thêm. */
@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async requireParent(parentCode: string, selfCode?: string): Promise<void> {
    if (parentCode === selfCode) throw new ConflictException('Tài khoản không thể là tài khoản cha của chính nó.');
    const parent = await this.prisma.account.findUnique({ where: { code: parentCode }, select: { isDetail: true } });
    if (!parent) throw new ConflictException(`Không có tài khoản cha ${parentCode}.`);
    if (parent.isDetail) throw new ConflictException(`TK ${parentCode} là tài khoản chi tiết — không thể làm tài khoản cha. Chọn một tài khoản tổng hợp.`);
  }

  async create(dto: CreateAccountDto) {
    const exists = await this.prisma.account.findUnique({ where: { code: dto.code }, select: { code: true } });
    if (exists) throw new ConflictException(`Đã có tài khoản ${dto.code}.`);
    if (dto.parentCode) await this.requireParent(dto.parentCode);
    const data = {
      code: dto.code, name: dto.name, kind: dto.kind, normalSide: dto.normalSide,
      parentCode: dto.parentCode ?? null, isDetail: dto.isDetail, isSystem: false,
    };
    return this.prisma.$transaction(async (tx) => {
      const a = await tx.account.create({ data });
      await this.audit.log(tx, { action: 'account.create', entityType: 'Account', entityId: a.code, entityCode: a.code, summary: `Tạo tài khoản ${a.code} — ${a.name}` });
      return a;
    });
  }

  async update(code: string, dto: UpdateAccountDto) {
    const before = await this.prisma.account.findUnique({ where: { code } });
    if (!before) throw new NotFoundException('Không tìm thấy tài khoản.');
    // TK chuẩn: chỉ đổi tên. TK tự thêm: đổi được cả cấu trúc.
    const data = before.isSystem
      ? { name: dto.name }
      : {
          name: dto.name,
          kind: dto.kind ?? before.kind,
          normalSide: dto.normalSide ?? before.normalSide,
          parentCode: dto.parentCode ?? null,
          isDetail: dto.isDetail ?? before.isDetail,
        };
    if (!before.isSystem && data.parentCode) await this.requireParent(data.parentCode, code);
    return this.prisma.$transaction(async (tx) => {
      const a = await tx.account.update({ where: { code }, data });
      await this.audit.log(tx, {
        action: 'account.update', entityType: 'Account', entityId: code, entityCode: code,
        summary: `Sửa tài khoản ${code} — ${a.name}`, changes: diff(before, data, ACCOUNT_FIELDS),
      });
      return a;
    });
  }

  async setActive(code: string, isActive: boolean) {
    const before = await this.prisma.account.findUnique({ where: { code }, select: { code: true, name: true } });
    if (!before) throw new NotFoundException('Không tìm thấy tài khoản.');
    return this.prisma.$transaction(async (tx) => {
      const a = await tx.account.update({ where: { code }, data: { isActive } });
      await this.audit.log(tx, {
        action: isActive ? 'account.activate' : 'account.deactivate', entityType: 'Account', entityId: code, entityCode: code,
        summary: `${isActive ? 'Dùng lại' : 'Ngừng dùng'} tài khoản ${code} — ${a.name}`,
      });
      return a;
    });
  }

  /** Chỉ xoá được TK tự thêm, chưa phát sinh: không bút toán, không số dư đầu kỳ, không TK con. TK đang dùng thì Ngừng dùng. */
  async remove(code: string): Promise<void> {
    const acc = await this.prisma.account.findUnique({ where: { code }, select: { code: true, name: true, isSystem: true } });
    if (!acc) throw new NotFoundException('Không tìm thấy tài khoản.');
    if (acc.isSystem) throw new ConflictException('Tài khoản chuẩn (theo TT133) không xoá được — chọn Ngừng dùng nếu không dùng.');
    const [lines, opening, children] = await Promise.all([
      this.prisma.journalLine.count({ where: { accountCode: code } }),
      this.prisma.openingBalance.count({ where: { accountCode: code } }),
      this.prisma.account.count({ where: { parentCode: code } }),
    ]);
    if (lines) throw new ConflictException('Tài khoản đã có phát sinh bút toán — chọn Ngừng dùng thay vì xoá.');
    if (opening) throw new ConflictException('Tài khoản đã có số dư đầu kỳ — xoá số dư trước, hoặc chọn Ngừng dùng.');
    if (children) throw new ConflictException('Tài khoản còn tài khoản con — xoá tài khoản con trước.');
    await this.prisma.$transaction(async (tx) => {
      await tx.account.delete({ where: { code } });
      await this.audit.log(tx, { action: 'account.delete', entityType: 'Account', entityId: code, entityCode: code, summary: `Xoá tài khoản ${code} — ${acc.name} (chưa phát sinh)` });
    });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('accounting/accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @RequirePermissions('accounting.manage_account')
  @Post()
  create(@Body() dto: CreateAccountDto) {
    return this.accounts.create(dto);
  }

  @RequirePermissions('accounting.manage_account')
  @Patch(':code')
  update(@Param('code') code: string, @Body() dto: UpdateAccountDto) {
    return this.accounts.update(code, dto);
  }

  @RequirePermissions('accounting.manage_account')
  @Patch(':code/active')
  setActive(@Param('code') code: string, @Body() dto: AccountActiveDto) {
    return this.accounts.setActive(code, dto.isActive);
  }

  @RequirePermissions('accounting.manage_account')
  @Delete(':code')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('code') code: string) {
    return this.accounts.remove(code);
  }
}
