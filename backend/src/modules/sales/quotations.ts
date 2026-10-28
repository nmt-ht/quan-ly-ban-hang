import {
  BadRequestException, Body, ConflictException, Controller, Get, HttpCode, HttpStatus, Injectable, NotFoundException, Param, Post, Put, UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsISO8601, IsNumber, IsOptional, IsPositive, Matches, Max, Min, ValidateNested } from 'class-validator';
import { Prisma } from '@prisma/client';
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
import { orderTotals } from './sales-order.rules.js';
import { SaleLineInput, checkPartyAndPrices, lineRows } from './sales.service.js';

type Tx = Prisma.TransactionClient;

export class QuoteLineDto {
  @Text(60) productId!: string;
  @Text(30) unit!: string;
  @OptionalText(30) unitName?: string;
  @IsOptional() @IsNumber() @IsPositive() ratioToBase?: number;
  @IsNumber() @IsPositive({ message: 'Số lượng phải lớn hơn 0' }) quantity!: number;
  @IsNumber() @Min(0) unitPrice!: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) discountRate?: number;
  @IsOptional() @IsNumber() @Min(0) discountAmount?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) vatRate?: number;
  @IsOptional() @IsNumber() @Min(0) length?: number;
  @IsOptional() @IsNumber() @Min(0) width?: number;
  @OptionalText(300) note?: string;
  @OptionalText(60) promotionId?: string;
  @IsOptional() @IsBoolean() isGift?: boolean;
}

export class QuotationDto {
  @Text(60) customerId!: string;
  @OptionalText(100) recipientName?: string;
  @OptionalText(30) recipientPhone?: string;
  @OptionalText(300) deliveryAddress?: string;
  @OptionalText(1000) description?: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày phải có dạng YYYY-MM-DD' }) quoteDate!: string;
  @OptionalDay() validUntil?: string;
  @OptionalText(200) salesRep?: string;
  @IsNumber() @Min(0) discountAmount!: number;
  @OptionalText(60) promotionId?: string;
  @IsArray() @ArrayMinSize(1, { message: 'Thêm ít nhất một dòng hàng' }) @ValidateNested({ each: true }) @Type(() => QuoteLineDto)
  lines!: QuoteLineDto[];
  @IsOptional() @IsISO8601() updatedAt?: string;
}

export class CancelQuotationDto {
  @OptionalText(300) reason?: string;
}

const QUOTE_INCLUDE = {
  lines: { orderBy: { sortOrder: 'asc' } },
  createdBy: { select: { email: true } },
  salesRep: { select: { email: true } },
  order: { select: { code: true } },
} as const satisfies Prisma.QuotationInclude;

type QuoteRow = Prisma.QuotationGetPayload<{ include: typeof QUOTE_INCLUDE }>;

const QUOTE_FIELDS = {
  customer: 'Khách hàng', recipientName: 'Người nhận', recipientPhone: 'Điện thoại nhận', deliveryAddress: 'Địa chỉ giao',
  description: 'Diễn giải', quoteDate: 'Ngày báo giá', validUntil: 'Hiệu lực đến', salesRep: 'Người báo giá',
  discountAmount: 'Chiết khấu cả báo giá', lines: 'Dòng hàng',
};

/** The frontend's Quotation: day-only dates, e-mails for people, totals derived from the lines like an order's. */
export function quotationToApi(q: QuoteRow) {
  const { lines, createdBy, createdById: _c, salesRep, salesRepId: _r, order, quoteDate, validUntil, ...rest } = q;
  const t = orderTotals(lines.map((l) => ({
    productId: l.productId, quantity: l.quantity.toNumber(), unitPrice: l.unitPrice.toNumber(), discountRate: l.discountRate?.toNumber() ?? null,
    discountAmount: l.discountAmount.toNumber(), vatRate: l.vatRate.toNumber(), receivedQuantity: 0, ratioToBase: l.ratioToBase.toNumber(),
  })), q.discountAmount.toNumber());
  return {
    ...rest,
    quoteDate: toDay(quoteDate)!, validUntil: toDay(validUntil),
    discountAmount: q.discountAmount.toNumber(),
    salesRep: salesRep?.email ?? '',
    createdBy: createdBy.email,
    orderCode: order?.code ?? null,
    totalGoods: t.goods, totalOrder: t.total, vatAmount: t.vat,
    lines: lines.map(({ quotationId: _q, sortOrder: _s, ...l }, i) => ({
      ...l, ratioToBase: l.ratioToBase.toNumber(), quantity: l.quantity.toNumber(), unitPrice: l.unitPrice.toNumber(),
      discountRate: l.discountRate?.toNumber() ?? null, discountAmount: l.discountAmount.toNumber(), vatRate: l.vatRate.toNumber(),
      length: l.length?.toNumber() ?? null, width: l.width?.toNumber() ?? null, lineTotal: t.lines[i].gross,
    })),
  };
}

/**
 * Báo giá (Pha 1.4): the same lines, prices and chiết khấu as an order, but no stock, no công nợ, no hạn mức.
 * Mới → sửa, huỷ, or Lập đơn (POST /sales-orders with quotationId, SalesService.create) which marks it Đã chốt.
 * "Hết hạn" is not stored: the screens derive it from validUntil. A seller without order.view_all sees only
 * the báo giá they made or quote under their name — the same rule as orders.
 */
@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly audit: AuditService,
  ) {}

  private visibleTo(user: AuthUser): Prisma.QuotationWhereInput {
    const perms = user.permissions;
    if (perms.includes('order.view_all') || !perms.includes('quote.create')) return {};
    return { OR: [{ salesRepId: user.id }, { createdById: user.id }] };
  }

  async list(user: AuthUser) {
    const rows = await this.prisma.quotation.findMany({ where: this.visibleTo(user), include: QUOTE_INCLUDE, orderBy: [{ quoteDate: 'desc' }, { code: 'desc' }] });
    return rows.map(quotationToApi);
  }

  async one(id: string, user: AuthUser) {
    const q = await this.prisma.quotation.findFirst({ where: { id, ...this.visibleTo(user) }, include: QUOTE_INCLUDE });
    if (!q) throw new NotFoundException('Không tìm thấy báo giá');
    return quotationToApi(q);
  }

  private async get(tx: Tx, id: string) {
    return quotationToApi(await tx.quotation.findUniqueOrThrow({ where: { id }, include: QUOTE_INCLUDE }));
  }

  create(dto: QuotationDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const { customer, salesRepId } = await this.check(tx, dto, user, [], 0);
      const lines = quoteLines(dto.lines);
      const q = await tx.quotation.create({
        data: { ...header(dto), code: await this.sequences.nextCode('BG', tx), salesRepId, createdById: user.id, lines: { create: lines } },
      });
      const saved = await this.get(tx, q.id);
      await this.audit.log(tx, {
        action: 'quotation.create', entityType: 'Quotation', entityId: q.id, entityCode: q.code,
        summary: `Lập báo giá ${q.code} · ${customer.code} ${customer.name} · ${lines.length} dòng · ${vnd(saved.totalOrder)}`,
        related: [customer.code],
      });
      return saved;
    });
  }

  update(id: string, dto: QuotationDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const q = await this.locked(tx, id, user);
      if (dto.updatedAt && new Date(dto.updatedAt).getTime() !== q.updatedAt.getTime()) {
        throw new ConflictException(`${q.code} vừa được người khác lưu — tải lại để xem bản mới rồi sửa tiếp.`);
      }
      if (q.status !== 'MOI') throw new BadRequestException(`Báo giá ${q.code} ${q.status === 'HUY' ? 'đã huỷ' : 'đã lập đơn'} — không sửa được.`);
      const { salesRepId } = await this.check(tx, dto, user, q.lines, q.discountAmount.toNumber());
      const lines = quoteLines(dto.lines);
      const before = await this.described(tx, { ...q, discountAmount: q.discountAmount.toNumber() });
      await tx.quotationLine.deleteMany({ where: { quotationId: id } });
      await tx.quotation.update({ where: { id }, data: { ...header(dto), salesRepId, lines: { create: lines } } });
      const after = await this.described(tx, { ...header(dto), salesRepId, lines });
      await this.audit.log(tx, {
        action: 'quotation.update', entityType: 'Quotation', entityId: id, entityCode: q.code, summary: `Sửa báo giá ${q.code}`,
        changes: diff(before, after, QUOTE_FIELDS),
      });
      return this.get(tx, id);
    });
  }

  cancel(id: string, reason: string | undefined, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const q = await this.locked(tx, id, user);
      if (q.status !== 'MOI') throw new BadRequestException(`Báo giá ${q.code} ${q.status === 'HUY' ? 'đã huỷ rồi' : 'đã lập đơn — huỷ đơn hàng nếu khách không lấy'}.`);
      await tx.quotation.update({ where: { id }, data: { status: 'HUY', cancelReason: reason ?? null } });
      await this.audit.log(tx, {
        action: 'quotation.cancel', entityType: 'Quotation', entityId: id, entityCode: q.code,
        summary: `Huỷ báo giá ${q.code}${reason ? `: ${reason}` : ''}`,
      });
      return this.get(tx, id);
    });
  }

  private async locked(tx: Tx, id: string, user: AuthUser) {
    await tx.$queryRaw`SELECT "id" FROM "Quotation" WHERE "id" = ${id} FOR UPDATE`;
    const q = await tx.quotation.findFirst({ where: { id, ...this.visibleTo(user) }, include: { lines: { orderBy: { sortOrder: 'asc' } } } });
    if (!q) throw new NotFoundException('Không tìm thấy báo giá');
    return q;
  }

  /** Customer, products and the list-price rule as on an order; the người báo giá must exist. */
  private async check(tx: Tx, dto: QuotationDto, user: AuthUser, existing: Parameters<typeof checkPartyAndPrices>[3], existingDiscount: number) {
    if (dto.validUntil && dto.validUntil < dto.quoteDate) throw new BadRequestException('Ngày hiệu lực trước ngày báo giá.');
    const { customer } = await checkPartyAndPrices(tx, { ...dto, date: dto.quoteDate }, user, existing, existingDiscount);
    let salesRepId: string | null = null;
    if (dto.salesRep) {
      const rep = await tx.user.findUnique({ where: { email: dto.salesRep.toLowerCase() } });
      if (!rep) throw new BadRequestException('Người báo giá không tồn tại');
      salesRepId = rep.id;
    }
    return { customer, salesRepId };
  }

  /** A báo giá with names instead of ids, for the Sửa diff. */
  private async described(tx: Tx, q: ReturnType<typeof header> & {
    salesRepId: string | null; lines: { productId: string; quantity: unknown; unitName: string | null; unit: string; unitPrice: unknown; discountAmount: unknown; vatRate: unknown }[];
  }) {
    const [customer, rep, products] = await Promise.all([
      tx.customer.findUnique({ where: { id: q.customerId }, select: { code: true, name: true } }),
      q.salesRepId ? tx.user.findUnique({ where: { id: q.salesRepId }, select: { name: true } }) : null,
      tx.product.findMany({ where: { id: { in: q.lines.map((l) => l.productId) } }, select: { id: true, code: true } }),
    ]);
    const code = new Map(products.map((p) => [p.id, p.code]));
    return {
      ...q,
      customer: customer ? `${customer.code} · ${customer.name}` : q.customerId,
      salesRep: rep?.name ?? null,
      lines: q.lines.map((l) => {
        const ck = Number(l.discountAmount) ? ` · CK ${vnd(l.discountAmount)}` : '';
        return `${code.get(l.productId) ?? l.productId} × ${Number(l.quantity)} ${l.unitName ?? l.unit} @ ${vnd(l.unitPrice)}${ck} · VAT ${Number(l.vatRate)}%`;
      }),
    };
  }
}

function header(dto: QuotationDto) {
  return {
    customerId: dto.customerId, recipientName: dto.recipientName ?? null, recipientPhone: dto.recipientPhone ?? null,
    deliveryAddress: dto.deliveryAddress ?? null, description: dto.description ?? null,
    quoteDate: fromDay(dto.quoteDate)!, validUntil: fromDay(dto.validUntil), discountAmount: dto.discountAmount || 0,
    promotionId: dto.promotionId ?? null,
  };
}

/** The order's line rows without what only an order has (kho xuất, đã nhận). */
function quoteLines(lines: SaleLineInput[]) {
  return lineRows(lines).map(({ id: _i, warehouseId: _w, receivedQuantity: _r, unitPriceFx: _f, ...l }) => l);
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('quotations')
export class QuotationsController {
  constructor(private readonly quotations: QuotationsService) {}

  @RequirePermissions('quote.view')
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.quotations.list(user);
  }

  @RequirePermissions('quote.view')
  @Get(':id')
  one(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.quotations.one(id, user);
  }

  @RequirePermissions('quote.create')
  @Post()
  create(@Body() dto: QuotationDto, @CurrentUser() user: AuthUser) {
    return this.quotations.create(dto, user);
  }

  @RequirePermissions('quote.update')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: QuotationDto, @CurrentUser() user: AuthUser) {
    return this.quotations.update(id, dto, user);
  }

  @RequirePermissions('quote.cancel')
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Body() dto: CancelQuotationDto, @CurrentUser() user: AuthUser) {
    return this.quotations.cancel(id, dto.reason, user);
  }
}
