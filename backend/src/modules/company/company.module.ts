import { BadRequestException, Body, Controller, Get, Injectable, Module, Put, UseGuards } from '@nestjs/common';
import { IsBoolean, IsObject, IsOptional, Matches, ValidateIf } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { RequirePermissions } from '../../auth/permissions.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OptionalEmail, OptionalText, Text } from '../../common/dto.js';
import { AuditService } from '../../audit/audit.service.js';
import { diff } from '../../audit/audit.diff.js';
import { fromDay, toDay } from '../../common/text.js';

const COMPANY_FIELDS = { name: 'Tên công ty', address: 'Địa chỉ', taxCode: 'Mã số thuế', phone: 'Điện thoại', email: 'Email', website: 'Website' };

export class CompanyDto {
  @Text(200) name!: string;
  @OptionalText(300) address?: string;
  @OptionalText(20) taxCode?: string;
  @OptionalText(30) phone?: string;
  @OptionalEmail() email?: string;
  @OptionalText(200) website?: string;
  // A small PNG/JPEG data: URL (the frontend shrinks it) until file uploads exist, or a URL.
  @OptionalText(1_500_000)
  @ValidateIf((o: CompanyDto) => !!o.logo)
  @Matches(/^(data:image\/(png|jpeg);base64,|https?:\/\/)/, { message: 'Logo phải là ảnh PNG/JPEG hoặc đường dẫn' })
  logo?: string;
}

export class StockPolicyDto {
  @IsBoolean() allowNegativeStock!: boolean;
}

export class LockDateDto {
  /** Null = bỏ khoá sổ. */
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày phải có dạng YYYY-MM-DD' }) lockDate?: string | null;
}

/** Màu hiển thị: `${group}:${key}` → hue 0–359 or "neutral" (frontend core/services/display-colors.service.ts). */
export type TagColors = Record<string, number | 'neutral'>;

export class TagColorsDto {
  @IsObject() colors!: TagColors;
}

const COLOR_KEY = /^[a-z][a-z-]*:[A-Z][A-Z_]*$/;
const MAX_COLORS = 500;

function checkColors(colors: Record<string, unknown>): TagColors {
  const entries = Object.entries(colors);
  if (entries.length > MAX_COLORS) throw new BadRequestException('Quá nhiều màu.');
  for (const [k, v] of entries) {
    const hue = typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 359;
    if (!COLOR_KEY.test(k) || !(hue || v === 'neutral')) throw new BadRequestException(`Màu không hợp lệ: ${k}`);
  }
  return colors as TagColors;
}

// Thông tin công ty: a single row (id = 1), printed on every phiếu. Màu hiển thị live on it too.
@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get() {
    const row = await this.prisma.companyInfo.findUnique({ where: { id: 1 }, omit: { tagColors: true } });
    const { id: _id, ...info } = row ?? { id: 1, name: '' };
    return info;
  }

  async getColors(): Promise<TagColors> {
    const row = await this.prisma.companyInfo.findUnique({ where: { id: 1 }, select: { tagColors: true } });
    return (row?.tagColors ?? {}) as TagColors;
  }

  /** Replaces the whole set: what is left out is back to its default colour. */
  async saveColors(colors: Record<string, unknown>): Promise<TagColors> {
    const tagColors = checkColors(colors);
    const before = await this.getColors();
    const keys = [...new Set([...Object.keys(before), ...Object.keys(tagColors)])].filter((k) => before[k] !== tagColors[k]);
    await this.prisma.$transaction(async (tx) => {
      await tx.companyInfo.upsert({ where: { id: 1 }, update: { tagColors }, create: { id: 1, name: '', tagColors } });
      await this.audit.log(tx, {
        action: 'company.display_colors', entityType: 'CompanyInfo', entityId: '1', summary: `Đổi màu hiển thị (${keys.length} nhãn)`,
        changes: keys.map((k) => ({ field: k, label: k, from: before[k] ?? 'mặc định', to: tagColors[k] ?? 'mặc định' })),
      });
    });
    return this.getColors();
  }

  /** Khoá sổ đến ngày (as MISA "Khoá sổ kỳ kế toán"); a later date closes more, an earlier one or none re-opens. */
  async setLockDate(lockDate: string | null) {
    const before = toDay((await this.prisma.companyInfo.findUnique({ where: { id: 1 }, select: { lockDate: true } }))?.lockDate ?? null);
    const show = (d: string | null) => (d ? d.split('-').reverse().join('/') : null);
    await this.prisma.$transaction(async (tx) => {
      await tx.companyInfo.upsert({ where: { id: 1 }, update: { lockDate: fromDay(lockDate) }, create: { id: 1, name: '', lockDate: fromDay(lockDate) } });
      await this.audit.log(tx, {
        action: 'company.lock_period', entityType: 'CompanyInfo', entityId: '1',
        summary: lockDate ? `Khoá sổ đến ngày ${show(lockDate)}` : 'Bỏ khoá sổ',
        changes: [{ field: 'lockDate', label: 'Ngày khoá sổ', from: show(before), to: show(lockDate) }],
      });
    });
    return this.get();
  }

  /** "Cho xuất quá số tồn" (as MISA's tuỳ chọn); off = InventoryService refuses phiếu leaving a kho below 0. */
  async setStockPolicy(allowNegativeStock: boolean) {
    const before = (await this.prisma.companyInfo.findUnique({ where: { id: 1 }, select: { allowNegativeStock: true } }))?.allowNegativeStock ?? true;
    const show = (v: boolean) => (v ? 'Cho phép' : 'Không cho phép');
    await this.prisma.$transaction(async (tx) => {
      await tx.companyInfo.upsert({ where: { id: 1 }, update: { allowNegativeStock }, create: { id: 1, name: '', allowNegativeStock } });
      await this.audit.log(tx, {
        action: 'company.stock_policy', entityType: 'CompanyInfo', entityId: '1',
        summary: allowNegativeStock ? 'Cho xuất quá số tồn kho' : 'Không cho xuất quá số tồn kho',
        changes: [{ field: 'allowNegativeStock', label: 'Xuất quá số tồn', from: show(before), to: show(allowNegativeStock) }],
      });
    });
    return this.get();
  }

  async save(dto: CompanyDto) {
    const data = {
      name: dto.name, address: dto.address ?? null, taxCode: dto.taxCode ?? null, phone: dto.phone ?? null,
      email: dto.email ?? null, website: dto.website ?? null, logo: dto.logo ?? null,
    };
    const before = await this.prisma.companyInfo.findUnique({ where: { id: 1 }, omit: { tagColors: true } });
    const changes = diff(before, data, COMPANY_FIELDS);
    if ((before?.logo ?? null) !== data.logo) changes.push({ field: 'logo', label: 'Logo', from: before?.logo ? 'có logo' : null, to: data.logo ? 'logo mới' : null });
    await this.prisma.$transaction(async (tx) => {
      await tx.companyInfo.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
      await this.audit.log(tx, { action: 'company.update', entityType: 'CompanyInfo', entityId: '1', summary: 'Sửa thông tin công ty', changes });
    });
    return this.get();
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('company')
export class CompanyController {
  constructor(private readonly company: CompanyService) {}

  // Every signed-in user reads it: the letterhead of printed vouchers needs it.
  @Get()
  get() {
    return this.company.get();
  }

  @RequirePermissions('company.update')
  @Put()
  save(@Body() dto: CompanyDto) {
    return this.company.save(dto);
  }

  @RequirePermissions('company.update')
  @Put('stock-policy')
  setStockPolicy(@Body() dto: StockPolicyDto) {
    return this.company.setStockPolicy(dto.allowNegativeStock);
  }

  @RequirePermissions('period.lock')
  @Put('lock-date')
  setLockDate(@Body() dto: LockDateDto) {
    return this.company.setLockDate(dto.lockDate ?? null);
  }

  // Every signed-in user reads them: the badges on every page use them.
  @Get('display-colors')
  getColors() {
    return this.company.getColors();
  }

  @RequirePermissions('company.update')
  @Put('display-colors')
  saveColors(@Body() dto: TagColorsDto) {
    return this.company.saveColors(dto.colors);
  }
}

@Module({ controllers: [CompanyController], providers: [CompanyService] })
export class CompanyModule {}
