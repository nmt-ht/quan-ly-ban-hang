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
import { assertOpenPeriod } from '../../common/period-lock.js';
import { LedgerService } from '../accounting/ledger.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SequenceService } from '../../prisma/sequence.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { vnd } from '../../audit/audit.diff.js';
import { SaleLine, orderTotals } from './sales-order.rules.js';
import { lockOrderFor } from './order-access.js';

export class AllowanceLineDto {
  @Text(60) orderLineId!: string;
  /** Giảm giá chưa thuế của dòng, đồng; 0 = không giảm dòng này. */
  @IsNumber() @Min(0) taxable!: number;
}

export class SalesAllowanceDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày phải có dạng YYYY-MM-DD' }) date!: string;
  @Text(300) reason!: string;
  @OptionalText(1000) note?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => AllowanceLineDto) lines!: AllowanceLineDto[];
}

export class CancelAllowanceDto {
  @OptionalText(300) reason?: string;
}

/** What orderToApi needs of each phiếu giảm giá (ORDER_INCLUDE.allowances). */
export const ALLOWANCE_INCLUDE = { lines: { orderBy: { sortOrder: 'asc' } } } as const satisfies Prisma.SalesAllowanceInclude;
type AllowanceRow = Prisma.SalesAllowanceGetPayload<{ include: typeof ALLOWANCE_INCLUDE }>;

/** The frontend's SalesAllowance: day-only date, amounts as numbers. */
export function allowanceToApi({ lines, createdById: _c, createdByName, date, taxable, amount, ...a }: AllowanceRow) {
  return {
    ...a,
    createdBy: createdByName,
    date: toDay(date)!,
    taxable: taxable.toNumber(),
    amount: amount.toNumber(),
    lines: lines.map((l) => ({ id: l.id, orderLineId: l.orderLineId, taxable: l.taxable.toNumber(), vat: l.vat.toNumber() })),
  };
}

const round = (n: number) => Math.round(n);

/**
 * Giảm giá hàng bán (TK 5213): giảm giá cho hàng khách ĐÃ NHẬN, không có hàng đi hay về. One phiếu GG… per lần giảm, by dòng
 * hàng: the giảm giá chưa thuế leaves doanh thu, plus its VAT it lowers the order's công nợ (an đối trừ in the receivables,
 * negative revenue in the reports) on the phiếu's own date. Per dòng it is capped at what the customer received less what was
 * already returned or allowed. Bút toán: Nợ 5213 + Nợ 3331 / Có 131.
 */
@Injectable()
export class SalesAllowancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
  ) {}

  /** Chưa thuế of each dòng the customer has received, less what trả hàng and earlier giảm giá already took off. */
  private async room(tx: Prisma.TransactionClient, orderId: string) {
    const o = await tx.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        lines: { orderBy: { sortOrder: 'asc' }, include: { product: { select: { code: true } } } },
        returns: { where: { isCancelled: false }, include: { lines: true } },
        allowances: { where: { isCancelled: false }, include: { lines: true } },
      },
    });
    if (!o) throw new NotFoundException('Không tìm thấy đơn hàng');
    const nums: SaleLine[] = o.lines.map((l) => ({
      productId: l.productId, quantity: l.quantity.toNumber(), unitPrice: l.unitPrice.toNumber(), discountRate: l.discountRate?.toNumber() ?? null,
      discountAmount: l.discountAmount.toNumber(), vatRate: l.vatRate.toNumber(), receivedQuantity: l.receivedQuantity.toNumber(), ratioToBase: l.ratioToBase.toNumber(),
    }));
    const totals = orderTotals(nums, o.discountAmount.toNumber());
    const left = o.lines.map((l, i) => {
      const qty = l.quantity.toNumber();
      const received = qty ? l.receivedQuantity.toNumber() / qty : 0;
      const gave = round(totals.lines[i].taxable * received);
      const vatRate = l.vatRate.toNumber();
      // A return's amount is VAT included: take the VAT back out to compare chưa thuế with chưa thuế.
      const returned = o.returns.flatMap((r) => r.lines).filter((x) => x.orderLineId === l.id).reduce((s, x) => s + round(x.amount.toNumber() / (1 + vatRate / 100)), 0);
      const allowed = o.allowances.flatMap((a) => a.lines).filter((x) => x.orderLineId === l.id).reduce((s, x) => s + x.taxable.toNumber(), 0);
      return Math.max(0, gave - returned - allowed);
    });
    return { o, left, vatRates: o.lines.map((l) => l.vatRate.toNumber()) };
  }

  /** What each dòng can still be lowered by — the dialog shows it. */
  async limits(orderId: string, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      await lockOrderFor(tx, orderId, user);
      const { o, left } = await this.room(tx, orderId);
      return o.lines.map((l, i) => ({ orderLineId: l.id, max: left[i] }));
    });
  }

  async create(orderId: string, dto: SalesAllowanceDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      await lockOrderFor(tx, orderId, user);
      const { o, left, vatRates } = await this.room(tx, orderId);
      if (o.status === 'HUY') throw new BadRequestException('Đơn đã huỷ — không giảm giá được.');
      if (dto.date > vnDay()) throw new BadRequestException('Ngày giảm giá không được sau hôm nay.');
      if (dto.date < toDay(o.orderDate)!) throw new BadRequestException('Ngày giảm giá không được trước ngày đặt đơn.');
      await assertOpenPeriod(tx, dto.date, 'Giảm giá hàng bán');

      const rows: { orderLineId: string; taxable: number; vat: number; sortOrder: number }[] = [];
      for (const item of dto.lines.filter((x) => x.taxable > 0)) {
        const i = o.lines.findIndex((l) => l.id === item.orderLineId);
        if (i < 0) throw new BadRequestException('Dòng hàng không thuộc đơn này.');
        if (rows.some((r) => r.orderLineId === item.orderLineId)) throw new BadRequestException('Mỗi dòng hàng chỉ ghi một lần trong phiếu.');
        const taxable = round(item.taxable);
        if (taxable > left[i]) {
          throw new BadRequestException(`${o.lines[i].product.code}: chỉ giảm được tối đa ${vnd(left[i])} (chưa thuế) cho phần khách đã nhận — nhập ${vnd(taxable)}.`);
        }
        rows.push({ orderLineId: item.orderLineId, taxable, vat: round((taxable * vatRates[i]) / 100), sortOrder: rows.length });
      }
      if (!rows.length) throw new BadRequestException('Nhập số tiền giảm cho ít nhất một dòng.');
      const taxable = rows.reduce((s, r) => s + r.taxable, 0);
      const vat = rows.reduce((s, r) => s + r.vat, 0);
      const amount = taxable + vat;

      const code = await this.sequences.nextCode('GG', tx);
      const a = await tx.salesAllowance.create({
        data: {
          code, orderId: o.id, date: fromDay(dto.date)!, reason: dto.reason, note: dto.note ?? null, taxable, amount,
          createdById: user.id, createdByName: user.name, lines: { create: rows },
        },
        include: ALLOWANCE_INCLUDE,
      });
      await this.audit.log(tx, {
        action: 'sales_order.allowance', entityType: 'SalesOrder', entityId: o.id, entityCode: o.code,
        summary: `Giảm giá hàng bán ${code} · ${rows.length} dòng · ${vnd(amount)} (giảm công nợ) · ${dto.reason}`,
        related: [code],
      });

      if (await this.ledger.isLedgerActive(tx, dto.date)) {
        await this.ledger.postEntry(tx, {
          date: dto.date, source: 'SALES_RETURN', refType: 'SalesAllowance', refId: a.id, createdById: user.id,
          description: `Giảm giá hàng bán - đơn ${o.code} (${code})`,
          lines: [
            { accountCode: '5213', debit: taxable },
            { accountCode: '3331', debit: vat },
            { accountCode: '131', credit: amount, partnerType: 'KHACH_HANG', customerId: o.customerId },
          ],
        });
      }
      return allowanceToApi(a);
    });
  }

  /** Huỷ phiếu giảm giá: the value counts against công nợ and doanh thu again. The phiếu stays, marked huỷ. */
  async cancel(orderId: string, allowanceId: string, reason: string | undefined, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      await lockOrderFor(tx, orderId, user);
      const a = await tx.salesAllowance.findUnique({ where: { id: allowanceId }, include: { order: { select: { id: true, code: true } } } });
      if (!a || a.orderId !== orderId) throw new NotFoundException('Không tìm thấy phiếu giảm giá');
      if (a.isCancelled) throw new BadRequestException(`${a.code} đã huỷ rồi.`);
      await assertOpenPeriod(tx, a.date, `Huỷ ${a.code}:`);
      await this.ledger.reverseEntriesFor(tx, 'SalesAllowance', a.id, { date: toDay(a.date)!, createdById: user.id, description: `Huỷ giảm giá hàng bán ${a.code}` });
      const out = await tx.salesAllowance.update({
        where: { id: allowanceId }, data: { isCancelled: true, cancelReason: reason ?? null, cancelledAt: new Date() }, include: ALLOWANCE_INCLUDE,
      });
      await this.audit.log(tx, {
        action: 'sales_order.allowance_cancel', entityType: 'SalesOrder', entityId: a.order.id, entityCode: a.order.code,
        summary: `Huỷ phiếu giảm giá ${a.code} (${vnd(a.amount.toNumber())} tính lại vào công nợ)${reason ? `: ${reason}` : ''}`,
        related: [a.code],
      });
      return allowanceToApi(out);
    });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sales-orders/:id/allowances')
export class SalesAllowancesController {
  constructor(private readonly allowances: SalesAllowancesService) {}

  @RequirePermissions('order.return')
  @Post('limits')
  @HttpCode(HttpStatus.OK)
  limits(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.allowances.limits(id, user);
  }

  @RequirePermissions('order.return')
  @Post()
  create(@Param('id') id: string, @Body() dto: SalesAllowanceDto, @CurrentUser() user: AuthUser) {
    return this.allowances.create(id, dto, user);
  }

  @RequirePermissions('order.return')
  @Post(':allowanceId/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Param('allowanceId') allowanceId: string, @Body() dto: CancelAllowanceDto, @CurrentUser() user: AuthUser) {
    return this.allowances.cancel(id, allowanceId, dto.reason, user);
  }
}
