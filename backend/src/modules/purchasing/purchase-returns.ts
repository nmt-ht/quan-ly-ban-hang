import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Injectable, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, Matches, Min, ValidateNested } from 'class-validator';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { OptionalText, Text } from '../../common/dto.js';
import { fromDay, toDay } from '../../common/text.js';
import { assertOpenPeriod } from '../../common/period-lock.js';
import { seesPurchasePrices } from '../../common/purchase-prices.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SequenceService } from '../../prisma/sequence.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { vnd } from '../../audit/audit.diff.js';
import { InventoryService, VoucherLineInput } from '../inventory/inventory.service.js';
import { round4 } from './purchase-order.rules.js';

type Tx = Prisma.TransactionClient;

export class PurchaseReturnLineDto {
  @Text(60) orderLineId!: string;
  @IsNumber() @Min(0) quantity!: number; // in the order line's unit; 0 = not returned
}

export class PurchaseReturnDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày phải có dạng YYYY-MM-DD' }) date!: string;
  /** Kho xuất trả hàng. */
  @Text(60) warehouseId!: string;
  @Text(300) reason!: string;
  @OptionalText(1000) note?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PurchaseReturnLineDto) lines!: PurchaseReturnLineDto[];
}

export class CancelPurchaseReturnDto {
  @OptionalText(300) reason?: string;
}

/** What orderToApi needs of each phiếu trả lại hàng mua. */
export const PURCHASE_RETURN_INCLUDE = {
  lines: { orderBy: { sortOrder: 'asc' } },
  voucher: { select: { code: true } },
  createdBy: { select: { email: true } },
} as const satisfies Prisma.PurchaseReturnInclude;

type ReturnRow = Prisma.PurchaseReturnGetPayload<{ include: typeof PURCHASE_RETURN_INCLUDE }>;

/** The frontend's PurchaseReturn: day-only date, amounts as numbers, the phiếu xuất by code. */
export function purchaseReturnToApi({ lines, voucher, createdBy, createdById: _c, date, amount, ...r }: ReturnRow) {
  return {
    ...r,
    date: toDay(date)!,
    amount: amount.toNumber() as number | null,
    voucherCode: voucher?.code ?? null,
    createdBy: createdBy.email,
    lines: lines.map((l) => ({ id: l.id, orderLineId: l.orderLineId, quantity: l.quantity.toNumber(), amount: l.amount.toNumber() as number | null })),
  };
}

/**
 * Trả lại hàng mua TLM… (as MISA): goods RECEIVED on a đơn nhập go back to the nhà cung cấp. A phiếu xuất kho takes them
 * out at their giá mua (the moving average is taken back as if they had never come in); the value — số lượng × đơn giá ×
 * (1 + VAT) — lowers công nợ phải trả on the return's own date (PayablesService). Money the supplier pays back is a phiếu
 * thu as before. Huỷ phiếu trả undoes the phiếu xuất. The đơn's số đã nhận stays as it was.
 */
@Injectable()
export class PurchaseReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
  ) {}

  async create(orderId: string, dto: PurchaseReturnDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PurchaseOrder" WHERE "id" = ${orderId} FOR UPDATE`;
      const o = await tx.purchaseOrder.findUnique({
        where: { id: orderId },
        include: {
          lines: { orderBy: { sortOrder: 'asc' }, include: { product: { select: { code: true, type: true } } } },
          returns: { where: { isCancelled: false }, include: { lines: true } },
          supplier: { select: { code: true, name: true } },
        },
      });
      if (!o) throw new NotFoundException('Không tìm thấy đơn nhập');
      if (o.status === 'HUY') throw new BadRequestException('Đơn đã huỷ — không có hàng để trả.');
      const today = new Date().toISOString().slice(0, 10);
      if (dto.date > today) throw new BadRequestException('Ngày trả hàng không được sau hôm nay.');
      if (dto.date < toDay(o.date)!) throw new BadRequestException('Ngày trả hàng không được trước ngày đặt đơn.');
      await assertOpenPeriod(tx, dto.date, 'Trả lại hàng mua');
      const wh = await tx.warehouse.findUnique({ where: { id: dto.warehouseId }, select: { name: true, isActive: true } });
      if (!wh) throw new BadRequestException('Kho xuất trả không tồn tại.');
      if (!wh.isActive) throw new BadRequestException(`Kho "${wh.name}" đã ngừng dùng — chọn kho khác.`);

      const returned = new Map<string, number>();
      for (const r of o.returns) for (const l of r.lines) returned.set(l.orderLineId, round4((returned.get(l.orderLineId) ?? 0) + l.quantity.toNumber()));

      const rows: { orderLineId: string; quantity: number; amount: number; sortOrder: number }[] = [];
      const stock = new Map<string, { quantity: number; value: number }>(); // productId → base quantity and giá mua going out
      for (const item of dto.lines.filter((x) => x.quantity > 0)) {
        const l = o.lines.find((x) => x.id === item.orderLineId);
        if (!l) throw new BadRequestException('Dòng hàng không thuộc đơn này.');
        const can = round4(l.receivedQuantity.toNumber() - (returned.get(l.id) ?? 0));
        const qty = round4(item.quantity);
        if (qty > can) throw new BadRequestException(`${l.product.code}: mới nhận ${can} ${l.unitName ?? ''} chưa trả — không trả được ${qty}.`.replace('  ', ' '));
        const value = qty * l.unitPrice.toNumber();
        rows.push({ orderLineId: l.id, quantity: qty, amount: Math.round(value * (1 + l.vatRate.toNumber() / 100)), sortOrder: rows.length });
        if (l.product.type !== 'DICH_VU') {
          const s = stock.get(l.productId) ?? { quantity: 0, value: 0 };
          stock.set(l.productId, { quantity: round4(s.quantity + qty * l.ratioToBase.toNumber()), value: s.value + value });
        }
      }
      if (!rows.length) throw new BadRequestException('Nhập số lượng trả cho ít nhất một dòng.');
      const amount = rows.reduce((s, r) => s + r.amount, 0);

      const code = await this.sequences.nextCode('TLM', tx);
      let voucherId: string | null = null;
      if (stock.size) {
        const lines: VoucherLineInput[] = [...stock].map(([productId, x]) => ({ productId, quantity: x.quantity, unitCost: x.value / x.quantity }));
        voucherId = await this.inventory.post(tx, {
          type: 'XUAT', date: dto.date, warehouseId: dto.warehouseId, purchaseOrderId: o.id, lines,
          reason: `Trả lại hàng mua — đơn ${o.code} (${code})`, note: dto.note,
        }, user.id);
      }
      const r = await tx.purchaseReturn.create({
        data: {
          code, orderId: o.id, date: fromDay(dto.date)!, reason: dto.reason, note: dto.note ?? null, amount, voucherId,
          createdById: user.id, lines: { create: rows },
        },
        include: PURCHASE_RETURN_INCLUDE,
      });
      await this.audit.log(tx, {
        action: 'purchase_order.return', entityType: 'PurchaseOrder', entityId: o.id, entityCode: o.code,
        summary: `Trả lại hàng mua ${code} · ${o.supplier.code} ${o.supplier.name} · ${rows.length} dòng · ${vnd(amount)} (giảm công nợ phải trả) · ${dto.reason}`,
        related: [code, o.supplier.code, ...(r.voucher ? [r.voucher.code] : [])],
      });
      return r;
    });
  }

  /** Huỷ phiếu trả: the phiếu xuất is undone, the value counts against công nợ phải trả again. The phiếu stays, marked huỷ. */
  async cancel(orderId: string, returnId: string, reason: string | undefined) {
    return this.prisma.$transaction(async (tx: Tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PurchaseOrder" WHERE "id" = ${orderId} FOR UPDATE`;
      const r = await tx.purchaseReturn.findUnique({ where: { id: returnId }, include: { order: { select: { id: true, code: true } } } });
      if (!r || r.orderId !== orderId) throw new NotFoundException('Không tìm thấy phiếu trả lại hàng mua');
      if (r.isCancelled) throw new BadRequestException(`${r.code} đã huỷ rồi.`);
      await assertOpenPeriod(tx, r.date, `Huỷ ${r.code}:`);
      if (r.voucherId) await this.inventory.reverse(tx, r.voucherId, `Huỷ phiếu trả lại hàng mua ${r.code}`);
      const out = await tx.purchaseReturn.update({
        where: { id: returnId }, data: { isCancelled: true, cancelReason: reason ?? null, cancelledAt: new Date() }, include: PURCHASE_RETURN_INCLUDE,
      });
      await this.audit.log(tx, {
        action: 'purchase_order.return_cancel', entityType: 'PurchaseOrder', entityId: r.order.id, entityCode: r.order.code,
        summary: `Huỷ phiếu trả lại hàng mua ${r.code} (${vnd(r.amount.toNumber())} tính lại vào công nợ phải trả)${reason ? `: ${reason}` : ''}`,
        related: [r.code, ...(out.voucher ? [out.voucher.code] : [])],
      });
      return out;
    });
  }
}

/** Giá trả hàng hidden from roles that do not see giá nhập, as on the đơn. */
const shown = (r: ReturnType<typeof purchaseReturnToApi>, user: AuthUser) =>
  seesPurchasePrices(user) ? r : { ...r, amount: null, lines: r.lines.map((l) => ({ ...l, amount: null })) };

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('purchase-orders/:id/returns')
export class PurchaseReturnsController {
  constructor(private readonly returns: PurchaseReturnsService) {}

  @RequirePermissions('purchase.return')
  @Post()
  async create(@Param('id') id: string, @Body() dto: PurchaseReturnDto, @CurrentUser() user: AuthUser) {
    return shown(purchaseReturnToApi(await this.returns.create(id, dto, user)), user);
  }

  @RequirePermissions('purchase.return')
  @Post(':returnId/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string, @Param('returnId') returnId: string, @Body() dto: CancelPurchaseReturnDto, @CurrentUser() user: AuthUser) {
    return shown(purchaseReturnToApi(await this.returns.cancel(id, returnId, dto.reason)), user);
  }
}
