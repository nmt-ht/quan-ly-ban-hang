import {
  BadRequestException, Body, ConflictException, Controller, Get, HttpCode, HttpStatus, Injectable, Module, NotFoundException, Param, Post, Put, UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsPositive, IsString, Matches, Min, ValidateNested,
} from 'class-validator';
import { CustomerType, DiscountType, Prisma, PromotionKind, PromotionScope } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { OptionalDay, OptionalText, Text } from '../../common/dto.js';
import { fromDay, toDay } from '../../common/text.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SequenceService } from '../../prisma/sequence.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { diff, vnd } from '../../audit/audit.diff.js';

type Tx = Prisma.TransactionClient;

// ---------- Bảng giá ----------

export class PriceListItemDto {
  @Text(60) productId!: string;
  /** "" = ĐVT chính. */
  @IsOptional() @IsString() unitName?: string;
  @IsNumber() @Min(0) price!: number;
}

export class PriceListDto {
  @Text(100) name!: string;
  @OptionalText(500) note?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsArray() @ValidateNested({ each: true }) @Type(() => PriceListItemDto) items!: PriceListItemDto[];
}

const LIST_INCLUDE = {
  items: { include: { product: { select: { code: true } } }, orderBy: [{ product: { code: 'asc' } }, { unitName: 'asc' }] },
  _count: { select: { customers: true } },
} as const satisfies Prisma.PriceListInclude;

type ListRow = Prisma.PriceListGetPayload<{ include: typeof LIST_INCLUDE }>;

const listToApi = ({ items, _count, ...l }: ListRow) => ({
  ...l,
  customerCount: _count.customers,
  items: items.map((x) => ({ productId: x.productId, unitName: x.unitName, price: x.price.toNumber() })),
});

/** "SP0000003 · Bó: 120.000 ₫" — one line of a bảng giá, for the Sửa diff. */
const itemText = (code: string, unitName: string, price: unknown) => `${code}${unitName ? ` · ${unitName}` : ''}: ${vnd(price)}`;

/**
 * Bảng giá riêng (Pha 1.6): giá theo mặt hàng và ĐVT, gán cho khách (Customer.priceListId). Ai lập đơn / báo giá cũng
 * đọc được để áp giá; lập và sửa cần pricelist.manage. Không xoá — ngừng dùng thì khách về giá theo loại khách.
 */
@Injectable()
export class PriceListsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list() {
    return (await this.prisma.priceList.findMany({ include: LIST_INCLUDE, orderBy: { name: 'asc' } })).map(listToApi);
  }

  private async get(tx: Tx, id: string) {
    const l = await tx.priceList.findUnique({ where: { id }, include: LIST_INCLUDE });
    if (!l) throw new NotFoundException('Không tìm thấy bảng giá');
    return l;
  }

  /** Products must exist; one price per mặt hàng + ĐVT; the ĐVT must be the product's own. */
  private async items(tx: Tx, dto: PriceListDto) {
    const ids = [...new Set(dto.items.map((x) => x.productId))];
    const products = await tx.product.findMany({ where: { id: { in: ids } }, include: { unitConversions: { select: { unitName: true } } } });
    const byId = new Map(products.map((p) => [p.id, p]));
    const seen = new Set<string>();
    return dto.items.map((x, i) => {
      const p = byId.get(x.productId);
      if (!p) throw new BadRequestException(`Dòng ${i + 1}: mặt hàng không tồn tại.`);
      const unitName = (x.unitName ?? '').trim();
      if (unitName && !p.unitConversions.some((u) => u.unitName === unitName)) {
        throw new BadRequestException(`Dòng ${i + 1}: ${p.code} không có ĐVT "${unitName}".`);
      }
      const key = `${x.productId}|${unitName}`;
      if (seen.has(key)) throw new BadRequestException(`Dòng ${i + 1}: ${p.code}${unitName ? ` (${unitName})` : ''} đã có giá ở dòng khác.`);
      seen.add(key);
      return { productId: x.productId, unitName, price: x.price, code: p.code };
    });
  }

  private async nameTaken(tx: Tx, name: string, id?: string) {
    const other = await tx.priceList.findFirst({ where: { name: { equals: name, mode: 'insensitive' }, NOT: id ? { id } : undefined } });
    if (other) throw new ConflictException(`Đã có bảng giá tên "${other.name}".`);
  }

  create(dto: PriceListDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.nameTaken(tx, dto.name);
      const items = await this.items(tx, dto);
      const l = await tx.priceList.create({
        data: {
          name: dto.name, note: dto.note ?? null, isActive: dto.isActive ?? true,
          items: { create: items.map(({ code: _c, ...x }) => x) },
        },
      });
      await this.audit.log(tx, {
        action: 'price_list.create', entityType: 'PriceList', entityId: l.id, entityCode: l.name,
        summary: `Lập bảng giá "${l.name}" · ${items.length} giá`,
      });
      return listToApi(await this.get(tx, l.id));
    });
  }

  update(id: string, dto: PriceListDto) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.get(tx, id);
      await this.nameTaken(tx, dto.name, id);
      const items = await this.items(tx, dto);
      await tx.priceListItem.deleteMany({ where: { priceListId: id } });
      await tx.priceList.update({
        where: { id },
        data: { name: dto.name, note: dto.note ?? null, isActive: dto.isActive ?? true, items: { create: items.map(({ code: _c, ...x }) => x) } },
      });
      await this.audit.log(tx, {
        action: 'price_list.update', entityType: 'PriceList', entityId: id, entityCode: dto.name, summary: `Sửa bảng giá "${dto.name}"`,
        changes: diff(
          { name: before.name, note: before.note, isActive: before.isActive, items: before.items.map((x) => itemText(x.product.code, x.unitName, x.price)) },
          { name: dto.name, note: dto.note ?? null, isActive: dto.isActive ?? true, items: items.map((x) => itemText(x.code, x.unitName, x.price)) },
          { name: 'Tên', note: 'Ghi chú', isActive: 'Đang dùng', items: 'Giá' },
        ),
      });
      return listToApi(await this.get(tx, id));
    });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('price-lists')
export class PriceListsController {
  constructor(private readonly lists: PriceListsService) {}

  // Every role that lập đơn / báo giá needs them to price the lines.
  @Get()
  list() {
    return this.lists.list();
  }

  @RequirePermissions('pricelist.manage')
  @Post()
  create(@Body() dto: PriceListDto) {
    return this.lists.create(dto);
  }

  @RequirePermissions('pricelist.manage')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: PriceListDto) {
    return this.lists.update(id, dto);
  }
}

// ---------- Khuyến mãi ----------

export class TierDto {
  @IsNumber() @IsPositive({ message: 'Số lượng bậc phải lớn hơn 0' }) minQuantity!: number;
  @IsNumber() @IsPositive({ message: 'Mức giảm phải lớn hơn 0' }) value!: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class PromotionDto {
  @Text(200) name!: string;
  @IsEnum(PromotionKind) kind!: PromotionKind;
  @Matches(DAY, { message: 'Ngày phải có dạng YYYY-MM-DD' }) startDate!: string;
  @OptionalDay() endDate?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @OptionalText(1000) note?: string;
  @IsEnum(PromotionScope) scope!: PromotionScope;
  @IsArray() @IsEnum(CustomerType, { each: true }) customerTypes!: CustomerType[];
  @IsArray() @IsString({ each: true }) priceListIds!: string[];
  @IsArray() @IsString({ each: true }) productIds!: string[];
  @IsArray() @IsString({ each: true }) categoryIds!: string[];
  @IsEnum(DiscountType) discountType!: DiscountType;
  @IsOptional() @IsNumber() @Min(0) discountValue?: number;
  @IsOptional() @IsNumber() @Min(0) minOrderValue?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => TierDto) tiers?: TierDto[];
  @IsOptional() @IsNumber() @Min(0) buyQuantity?: number;
  @OptionalText(60) giftProductId?: string;
  @IsOptional() @IsNumber() @Min(0) giftQuantity?: number;
}

export class PromotionActiveDto {
  @IsBoolean() isActive!: boolean;
}

const PROMO_INCLUDE = { createdBy: { select: { email: true } } } as const satisfies Prisma.PromotionInclude;
type PromoRow = Prisma.PromotionGetPayload<{ include: typeof PROMO_INCLUDE }>;

export const KIND_LABEL: Record<PromotionKind, string> = {
  GIAM_HANG: 'Giảm giá mặt hàng', GIAM_DON: 'Giảm theo tổng đơn', BAC_THANG: 'Giảm theo số lượng', TANG_HANG: 'Mua hàng tặng hàng',
};

function promoToApi({ createdBy, createdById: _c, startDate, endDate, discountValue, minOrderValue, buyQuantity, giftQuantity, tiers, ...p }: PromoRow) {
  return {
    ...p,
    startDate: toDay(startDate)!, endDate: toDay(endDate),
    discountValue: discountValue.toNumber(), minOrderValue: minOrderValue.toNumber(),
    buyQuantity: buyQuantity.toNumber(), giftQuantity: giftQuantity.toNumber(),
    tiers: Array.isArray(tiers) ? (tiers as { minQuantity: number; value: number }[]) : [],
    createdBy: createdBy.email,
  };
}

const PROMO_FIELDS = {
  name: 'Tên', kind: 'Kiểu', startDate: 'Từ ngày', endDate: 'Đến ngày', isActive: 'Đang chạy', note: 'Ghi chú', scope: 'Áp cho',
  customerTypes: 'Loại khách', priceListIds: 'Bảng giá', productIds: 'Mặt hàng', categoryIds: 'Nhóm hàng', discountType: 'Cách giảm',
  discountValue: 'Mức giảm', minOrderValue: 'Đơn từ', tiers: 'Bậc', buyQuantity: 'Mua mỗi', giftProductId: 'Hàng tặng', giftQuantity: 'Tặng',
};

/**
 * Khuyến mãi KM… (Pha 1.6). The rules live here; applying them is the order / báo giá form's job (it fills chiết khấu
 * dòng, chiết khấu cả đơn and hàng tặng, and records promotionId). The server does not re-price: chiết khấu was never
 * checked against a rule and a gift line is a 100% chiết khấu at the listed price.
 */
@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService, private readonly sequences: SequenceService, private readonly audit: AuditService) {}

  async list() {
    return (await this.prisma.promotion.findMany({ include: PROMO_INCLUDE, orderBy: [{ startDate: 'desc' }, { code: 'desc' }] })).map(promoToApi);
  }

  private async get(tx: Tx, id: string) {
    const p = await tx.promotion.findUnique({ where: { id }, include: PROMO_INCLUDE });
    if (!p) throw new NotFoundException('Không tìm thấy khuyến mãi');
    return p;
  }

  /** What each kiểu needs, checked here so a half-filled chương trình never reaches the forms. */
  private async fields(tx: Tx, dto: PromotionDto) {
    const value = dto.discountValue ?? 0;
    const percent = dto.discountType === 'PHAN_TRAM';
    if (dto.endDate && dto.endDate < dto.startDate) throw new BadRequestException('Ngày kết thúc trước ngày bắt đầu.');
    if (dto.scope === 'LOAI_KHACH' && !dto.customerTypes.length) throw new BadRequestException('Chọn ít nhất một loại khách.');
    if (dto.scope === 'BANG_GIA' && !dto.priceListIds.length) throw new BadRequestException('Chọn ít nhất một bảng giá.');
    let tiers: { minQuantity: number; value: number }[] = [];
    switch (dto.kind) {
      case 'GIAM_HANG':
      case 'GIAM_DON':
        if (!(value > 0)) throw new BadRequestException('Nhập mức giảm lớn hơn 0.');
        if (percent && value > 100) throw new BadRequestException('Giảm theo % tối đa 100%.');
        break;
      case 'BAC_THANG':
        tiers = [...(dto.tiers ?? [])].sort((a, b) => a.minQuantity - b.minQuantity).map((t) => ({ minQuantity: t.minQuantity, value: t.value }));
        if (!tiers.length) throw new BadRequestException('Thêm ít nhất một bậc số lượng.');
        if (new Set(tiers.map((t) => t.minQuantity)).size !== tiers.length) throw new BadRequestException('Hai bậc trùng số lượng.');
        if (percent && tiers.some((t) => t.value > 100)) throw new BadRequestException('Giảm theo % tối đa 100%.');
        break;
      case 'TANG_HANG':
        if (!dto.productIds.length && !dto.categoryIds.length) throw new BadRequestException('Chọn mặt hàng hoặc nhóm hàng phải mua.');
        if (!((dto.buyQuantity ?? 0) > 0) || !((dto.giftQuantity ?? 0) > 0)) throw new BadRequestException('Nhập số lượng mua và số lượng tặng lớn hơn 0.');
        if (!dto.giftProductId || !(await tx.product.findUnique({ where: { id: dto.giftProductId } }))) throw new BadRequestException('Chọn hàng tặng.');
        break;
    }
    const gift = dto.kind === 'TANG_HANG';
    return {
      name: dto.name, kind: dto.kind, startDate: fromDay(dto.startDate)!, endDate: fromDay(dto.endDate), isActive: dto.isActive ?? true,
      note: dto.note ?? null, scope: dto.scope,
      customerTypes: dto.scope === 'LOAI_KHACH' ? [...new Set(dto.customerTypes)] : [],
      priceListIds: dto.scope === 'BANG_GIA' ? [...new Set(dto.priceListIds)] : [],
      productIds: dto.kind === 'GIAM_DON' ? [] : [...new Set(dto.productIds)],
      categoryIds: dto.kind === 'GIAM_DON' ? [] : [...new Set(dto.categoryIds)],
      discountType: dto.discountType,
      discountValue: dto.kind === 'GIAM_HANG' || dto.kind === 'GIAM_DON' ? value : 0,
      minOrderValue: dto.kind === 'GIAM_DON' ? dto.minOrderValue ?? 0 : 0,
      tiers: dto.kind === 'BAC_THANG' ? tiers : Prisma.DbNull,
      buyQuantity: gift ? dto.buyQuantity ?? 0 : 0,
      giftProductId: gift ? dto.giftProductId! : null,
      giftQuantity: gift ? dto.giftQuantity ?? 0 : 0,
    };
  }

  create(dto: PromotionDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const data = await this.fields(tx, dto);
      const p = await tx.promotion.create({ data: { ...data, code: await this.sequences.nextCode('KM', tx), createdById: user.id } });
      await this.audit.log(tx, {
        action: 'promotion.create', entityType: 'Promotion', entityId: p.id, entityCode: p.code,
        summary: `Lập khuyến mãi ${p.code} · ${p.name} (${KIND_LABEL[p.kind]})`,
      });
      return promoToApi(await this.get(tx, p.id));
    });
  }

  update(id: string, dto: PromotionDto) {
    return this.prisma.$transaction(async (tx) => {
      const before = promoToApi(await this.get(tx, id));
      const data = await this.fields(tx, dto);
      const p = await tx.promotion.update({ where: { id }, data, include: PROMO_INCLUDE });
      const after = promoToApi(p);
      await this.audit.log(tx, {
        action: 'promotion.update', entityType: 'Promotion', entityId: id, entityCode: p.code, summary: `Sửa khuyến mãi ${p.code} · ${p.name}`,
        changes: diff({ ...before, tiers: JSON.stringify(before.tiers) }, { ...after, tiers: JSON.stringify(after.tiers) }, PROMO_FIELDS),
      });
      return after;
    });
  }

  setActive(id: string, isActive: boolean) {
    return this.prisma.$transaction(async (tx) => {
      await this.get(tx, id);
      const p = await tx.promotion.update({ where: { id }, data: { isActive }, include: PROMO_INCLUDE });
      await this.audit.log(tx, {
        action: isActive ? 'promotion.activate' : 'promotion.deactivate', entityType: 'Promotion', entityId: id, entityCode: p.code,
        summary: `${isActive ? 'Chạy lại' : 'Dừng'} khuyến mãi ${p.code} · ${p.name}`,
      });
      return promoToApi(p);
    });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get()
  list() {
    return this.promotions.list();
  }

  @RequirePermissions('promotion.manage')
  @Post()
  create(@Body() dto: PromotionDto, @CurrentUser() user: AuthUser) {
    return this.promotions.create(dto, user);
  }

  @RequirePermissions('promotion.manage')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: PromotionDto) {
    return this.promotions.update(id, dto);
  }

  @RequirePermissions('promotion.manage')
  @Post(':id/active')
  @HttpCode(HttpStatus.OK)
  setActive(@Param('id') id: string, @Body() dto: PromotionActiveDto) {
    return this.promotions.setActive(id, dto.isActive);
  }
}

@Module({
  controllers: [PriceListsController, PromotionsController],
  providers: [PriceListsService, PromotionsService],
})
export class PricingModule {}
