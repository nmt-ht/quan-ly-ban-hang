import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Injectable, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, Matches, Min, ValidateNested } from 'class-validator';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { OptionalText, Text } from '../../common/dto.js';
import { fromDay, toDay, vnDay } from '../../common/text.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SequenceService } from '../../prisma/sequence.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { vnd } from '../../audit/audit.diff.js';
import { InventoryService, VoucherLineInput } from '../inventory/inventory.service.js';
import { SaleLine, orderTotals, round4 } from './sales-order.rules.js';
import { lockOrderFor } from './order-access.js';
import { assertOpenPeriod } from '../../common/period-lock.js';

type Tx = Prisma.TransactionClient;

export class ReturnLineDto {
  @Text(60) orderLineId!: string;
  @IsNumber() @Min(0) quantity!: number; // in the order line's unit; 0 = not returned
}

export class SalesReturnDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày phải có dạng YYYY-MM-DD' }) date!: string;
  /** Kho nhập lại hàng trả. */
  @Text(60) warehouseId!: string;
  @Text(300) reason!: string;
  @OptionalText(1000) note?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ReturnLineDto) lines!: ReturnLineDto[];
}

export class CancelReturnDto {
  @OptionalText(300) reason?: string;
}

/** What orderToApi needs of each phiếu trả hàng (ORDER_INCLUDE.returns). */
export const RETURN_INCLUDE = {
  lines: { orderBy: { sortOrder: 'asc' } },
  voucher: { select: { code: true } },
  createdBy: { select: { email: true } },
} as const satisfies Prisma.SalesReturnInclude;

type ReturnRow = Prisma.SalesReturnGetPayload<{ include: typeof RETURN_INCLUDE }>;

/** The frontend's SalesReturn: day-only date, amounts as numbers, the phiếu nhập trả về by code. */
export function returnToApi({ lines, voucher, createdBy, createdById: _c, date, amount, ...r }: ReturnRow) {
  return {
    ...r,
    date: toDay(date)!,
    amount: amount.toNumber(),
    voucherCode: voucher?.code ?? null,
    createdBy: createdBy.email,
    lines: lines.map((l) => ({ id: l.id, orderLineId: l.orderLineId, quantity: l.quantity.toNumber(), amount: l.amount.toNumber() })),
  };
}

/**
 * Trả hàng bán (Pha 1.5): the customer gives back goods they had RECEIVED. One phiếu TH… per return: the goods go back
 * into a kho through a phiếu "Nhập trả về" (InventoryService.post), the value — the returned share of each line's total,
 * VAT included, after chiết khấu — lowers the order's công nợ and doanh thu on the return's own date (ReceivablesService,
 * report revenueLines). Huỷ phiếu trả undoes the phiếu kho. A refund of money already paid is a phiếu chi as before.
 */
@Injectable()
export class SalesReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
  ) {}

  async create(orderId: string, dto: SalesReturnDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      // Locked: two phiếu trả at once cannot both take the same received quantity. A seller only the orders they see.
      await lockOrderFor(tx, orderId, user);
      const o = await tx.salesOrder.findUnique({
        where: { id: orderId },
        include: { lines: { orderBy: { sortOrder: 'asc' }, include: { product: { select: { code: true, type: true } } } }, returns: { where: { isCancelled: false }, include: { lines: true } } },
      });
      if (!o) throw new NotFoundException('Không tìm thấy đơn hàng');
      if (o.status === 'HUY') throw new BadRequestException('Đơn đã huỷ — không nhận trả hàng.');
      const today = vnDay();
      if (dto.date > today) throw new BadRequestException('Ngày trả hàng không được sau hôm nay.');
      if (dto.date < toDay(o.orderDate)!) throw new BadRequestException('Ngày trả hàng không được trước ngày đặt đơn.');
      await assertOpenPeriod(tx, dto.date, 'Trả hàng');
      const wh = await tx.warehouse.findUnique({ where: { id: dto.warehouseId }, select: { name: true, isActive: true } });
      if (!wh) throw new BadRequestException('Kho nhập lại không tồn tại.');
      if (!wh.isActive) throw new BadRequestException(`Kho "${wh.name}" đã ngừng dùng — chọn kho khác.`);

      const nums: SaleLine[] = o.lines.map((l) => ({
        productId: l.productId, quantity: l.quantity.toNumber(), unitPrice: l.unitPrice.toNumber(), discountRate: l.discountRate?.toNumber() ?? null,
        discountAmount: l.discountAmount.toNumber(), vatRate: l.vatRate.toNumber(), receivedQuantity: l.receivedQuantity.toNumber(), ratioToBase: l.ratioToBase.toNumber(),
      }));
      const totals = orderTotals(nums, o.discountAmount.toNumber());
      const returned = new Map<string, number>();
      for (const r of o.returns) for (const l of r.lines) returned.set(l.orderLineId, round4((returned.get(l.orderLineId) ?? 0) + l.quantity.toNumber()));

      const rows: { orderLineId: string; quantity: number; amount: number; sortOrder: number }[] = [];
      const stock = new Map<string, number>(); // productId → base quantity going back into the kho
      for (const item of dto.lines.filter((x) => x.quantity > 0)) {
        const i = o.lines.findIndex((l) => l.id === item.orderLineId);
        if (i < 0) throw new BadRequestException('Dòng hàng không thuộc đơn này.');
        const l = o.lines[i];
        const can = round4(l.receivedQuantity.toNumber() - (returned.get(l.id) ?? 0));
        const qty = round4(item.quantity);
        if (qty > can) throw new BadRequestException(`${l.product.code}: khách mới nhận ${can} ${l.unitName ?? l.unit} chưa trả — không trả được ${qty}.`);
        const amount = Math.round((totals.lines[i].total * qty) / l.quantity.toNumber());
        rows.push({ orderLineId: l.id, quantity: qty, amount, sortOrder: rows.length });
        if (l.product.type !== 'DICH_VU') stock.set(l.productId, round4((stock.get(l.productId) ?? 0) + qty * l.ratioToBase.toNumber()));
      }
      if (!rows.length) throw new BadRequestException('Nhập số lượng trả cho ít nhất một dòng.');
      const amount = rows.reduce((s, r) => s + r.amount, 0);

      const code = await this.sequences.nextCode('TH', tx);
      let voucherId: string | null = null;
      if (stock.size) {
        // Back in at the giá vốn it left at — the order's own phiếu xuất, or those of the chuyến that carried it.
        const trips = (await tx.deliveryTripOrder.findMany({ where: { orderId: o.id }, select: { tripId: true } })).map((t) => t.tripId);
        const issued = await this.inventory.issuedCost(tx, { OR: [{ salesOrderId: o.id }, ...(trips.length ? [{ deliveryTripId: { in: trips } }] : [])] });
        const lines: VoucherLineInput[] = [...stock].map(([productId, quantity]) => ({ productId, quantity, unitCost: issued.get(productId) }));
        voucherId = await this.inventory.post(tx, {
          type: 'NHAP', date: dto.date, warehouseId: dto.warehouseId, salesOrderId: o.id, lines,
          reason: `Nhập trả về — đơn ${o.code} (${code})`, note: dto.note,
        }, user.id);
      }
      const r = await tx.salesReturn.create({
        data: {
          code, orderId: o.id, date: fromDay(dto.date)!, reason: dto.reason, note: dto.note ?? null, amount, voucherId,
          createdById: user.id, lines: { create: rows },
        },
        include: RETURN_INCLUDE,
      });
      await this.audit.log(tx, {
        action: 'sales_order.return', entityType: 'SalesOrder', entityId: o.id, entityCode: o.code,
        summary: `Nhận trả hàng ${code} · ${rows.length} dòng · ${vnd(amount)} (giảm công nợ) · ${dto.reason}`,
        related: [code, ...(r.voucher ? [r.voucher.code] : [])],
      });
      return returnToApi(r);
    });
  }

  /** Huỷ phiếu trả: the phiếu nhập trả về is undone, the value counts against công nợ again. The phiếu stays, marked huỷ. */
  async cancel(orderId: string, returnId: string, reason: string | undefined, user: AuthUser) {
    return this.prisma.$transaction(async (tx: Tx) => {
      await lockOrderFor(tx, orderId, user);
      const r = await tx.salesReturn.findUnique({ where: { id: returnId }, include: { order: { select: { id: true, code: true } } } });
      if (!r || r.orderId !== orderId) throw new NotFoundException('Không tìm thấy phiếu trả hàng');
      if (r.isCancelled) throw new BadRequestException(`${r.code} đã huỷ rồi.`);
      await assertOpenPeriod(tx, r.date, `Huỷ ${r.code}:`);
      if (r.voucherId) await this.inventory.reverse(tx, r.voucherId, `Huỷ phiếu trả hàng ${r.code}`, user.id);
      const out = await tx.salesReturn.update({
        where: { id: returnId }, data: { isCancelled: true, cancelReason: reason ?? null, cancelledAt: new Date() }, include: RETURN_INCLUDE,
      });
      await this.audit.log(tx, {
        action: 'sales_order.return_cancel', entityType: 'SalesOrder', entityId: r.order.id, entityCode: r.order.code,
        summary: `Huỷ phiếu trả hàng ${r.code} (${vnd(r.amount.toNumber())} tính lại vào công nợ)${reason ? `: ${reason}` : ''}`,
        related: [r.code, ...(out.voucher ? [out.voucher.code] : [])],
      });
      return returnToApi(out);
    });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sales-orders/:id/returns')
export class SalesReturnsController {
  constructor(private readonly returns: SalesReturnsService) {}

  @RequirePermissions('order.return')
  @Post()
  create(@Param('id') id: string, @Body() dto: SalesReturnDto, @CurrentUser() user: AuthUser) {
    return this.returns.create(id, dto, user);
  }

  @RequirePermissions('order.return')
  @Post(':returnId/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Param('returnId') returnId: string, @Body() dto: CancelReturnDto, @CurrentUser() user: AuthUser) {
    return this.returns.cancel(id, returnId, dto.reason, user);
  }
}
