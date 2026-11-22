import {
  BadRequestException, Body, ConflictException, Controller, Get, HttpCode, HttpStatus, Injectable, NotFoundException, Param, Post, Query, UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional, IsPositive, Matches, ValidateNested } from 'class-validator';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { OptionalText, Text } from '../../common/dto.js';
import { fromDay, toDay } from '../../common/text.js';
import { assertOpenPeriod, documentDay } from '../../common/period-lock.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SequenceService } from '../../prisma/sequence.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { vnd } from '../../audit/audit.diff.js';
import { LedgerLineInput, LedgerService } from '../accounting/ledger.service.js';
import { SupplierInvoiceDto, cleanSupplierInvoice } from './supplier-invoice.dto.js';
import { allocateCost, avgAfterCost, avgBeforeCost, splitStockCogs } from './landed-cost.rules.js';
import type { AllocationBasis } from './landed-cost.rules.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** TK được hạch toán trên hoá đơn không qua kho: chi phí bán hàng, quản lý, tài chính, khác và chi phí trả trước. Hàng tồn kho đi qua phiếu nhập kho, không qua đây. */
export const BILL_ACCOUNTS = ['641', '642', '635', '811', '242'];
/** "Tài khoản" của một dòng chi phí mua hàng: không phải TK, mà là lệnh phân bổ vào giá nhập hàng đã nhận của một đơn nhập. */
export const GIA_NHAP = 'GIA_NHAP';
export const VAT_RATES = [0, 5, 8, 10];

export class PurchaseBillLineDto {
  @Text(10) accountCode!: string;
  @Text(200) description!: string;
  @IsNumber() @IsPositive({ message: 'Số tiền phải lớn hơn 0' }) amount!: number; // chưa thuế
  @IsNumber() @IsIn(VAT_RATES, { message: 'Thuế suất phải là 0, 5, 8 hoặc 10' }) vatRate!: number;
}

export class PurchaseBillDto extends SupplierInvoiceDto {
  @Text(60) supplierId!: string;
  @Matches(DAY, { message: 'Ngày phải có dạng YYYY-MM-DD' }) date!: string;
  @OptionalText(300) description?: string;
  /** Đơn nhập nhận chi phí mua hàng (bắt buộc khi có dòng GIA_NHAP). */
  @OptionalText(60) purchaseOrderId?: string;
  @IsOptional() @IsIn(['GIA_TRI', 'SO_LUONG'], { message: 'Phân bổ theo giá trị hoặc số lượng' }) allocationBasis?: AllocationBasis;
  @IsArray() @ArrayMinSize(1, { message: 'Thêm ít nhất một dòng chi phí' }) @ValidateNested({ each: true }) @Type(() => PurchaseBillLineDto)
  lines!: PurchaseBillLineDto[];
}

export class CancelBillDto {
  @OptionalText(300) reason?: string;
}

const INCLUDE = {
  lines: { orderBy: { sortOrder: 'asc' } },
  supplier: { select: { code: true, name: true } },
  purchaseOrder: { select: { code: true } },
  allocations: true,
} as const satisfies Prisma.PurchaseBillInclude;
type Row = Prisma.PurchaseBillGetPayload<{ include: typeof INCLUDE }>;

export function billToApi(b: Row) {
  return {
    id: b.id, code: b.code, supplierId: b.supplierId, supplierCode: b.supplier.code, supplierName: b.supplier.name,
    date: toDay(b.date)!, description: b.description, invoiceSeries: b.invoiceSeries, invoiceNo: b.invoiceNo, invoiceDate: toDay(b.invoiceDate),
    taxable: b.taxable.toNumber(), vat: b.vat.toNumber(), total: b.total.toNumber(),
    isCancelled: b.isCancelled, cancelReason: b.cancelReason,
    purchaseOrderId: b.purchaseOrderId, purchaseOrderCode: b.purchaseOrder?.code ?? null, allocationBasis: b.allocationBasis,
    allocations: b.allocations.map((a) => ({ productId: a.productId, amount: a.amount.toNumber(), toStock: a.toStock.toNumber(), toCogs: a.toCogs.toNumber() })),
    lines: b.lines.map((l) => ({ id: l.id, accountCode: l.accountCode, description: l.description, amount: l.amount.toNumber(), vatRate: l.vatRate.toNumber() })),
  };
}

/** Chi phí mua hàng đã chia cho một mặt hàng của đơn nhập. */
interface Allocation {
  productId: string;
  type: string;
  amount: number;
  toStock: number;
  toCogs: number;
  avgAfter: number;
}

/** Tổng chưa thuế, thuế và tổng thanh toán của các dòng (thuế làm tròn từng dòng, như hoá đơn). */
export function billTotals(lines: { amount: number; vatRate: number }[]) {
  let taxable = 0, vat = 0;
  for (const l of lines) {
    const amount = Math.round(l.amount);
    taxable += amount;
    vat += Math.round((amount * l.vatRate) / 100);
  }
  return { taxable, vat, total: taxable + vat };
}

/**
 * Hoá đơn mua hàng / dịch vụ không qua kho (HM…): điện, nước, vận chuyển, thuê ngoài… Là một khoản công nợ phải trả của
 * NCC (PayablesService), trả bằng phiếu chi như lần nhận hàng. Sổ cái: Nợ chi phí (+ Nợ 133) / Có 331.
 */
@Injectable()
export class PurchaseBillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
  ) {}

  async list(q: { from?: string; to?: string; supplierId?: string }) {
    const where: Prisma.PurchaseBillWhereInput = {};
    if (q.from || q.to) where.date = { ...(q.from ? { gte: fromDay(q.from)! } : {}), ...(q.to ? { lte: fromDay(q.to)! } : {}) };
    if (q.supplierId) where.supplierId = q.supplierId;
    const rows = await this.prisma.purchaseBill.findMany({ where, include: INCLUDE, orderBy: [{ date: 'desc' }, { code: 'desc' }], take: 1000 });
    return rows.map(billToApi);
  }

  async findOne(id: string) {
    const b = await this.prisma.purchaseBill.findUnique({ where: { id }, include: INCLUDE });
    if (!b) throw new NotFoundException('Không tìm thấy hoá đơn mua hàng.');
    return billToApi(b);
  }

  async create(dto: PurchaseBillDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const day = await documentDay(tx, dto.date, 'Hoá đơn mua hàng');
      const supplier = await tx.supplier.findUnique({ where: { id: dto.supplierId }, select: { code: true, name: true, isActive: true } });
      if (!supplier) throw new BadRequestException('Nhà cung cấp không tồn tại.');
      if (!supplier.isActive) throw new BadRequestException(`Nhà cung cấp ${supplier.name} đã ngừng hợp tác.`);

      const { series, no, date: invoiceDate } = cleanSupplierInvoice(dto);
      if (no) {
        // Cùng một hoá đơn của cùng NCC không ghi hai lần (kê khai trùng làm khấu trừ thuế hai lần).
        const dup = await tx.purchaseBill.findFirst({ where: { supplierId: dto.supplierId, invoiceSeries: series, invoiceNo: no, isCancelled: false }, select: { code: true } });
        if (dup) throw new ConflictException(`Hoá đơn ${series ?? ''} ${no} của ${supplier.name} đã ghi ở ${dup.code}.`.replace('  ', ' '));
      }

      const landed = dto.lines.filter((l) => l.accountCode === GIA_NHAP);
      const codes = [...new Set(dto.lines.filter((l) => l.accountCode !== GIA_NHAP).map((l) => l.accountCode))];
      const bad = codes.find((c) => !BILL_ACCOUNTS.includes(c));
      if (bad) throw new BadRequestException(`Tài khoản ${bad} không dùng cho hoá đơn mua hàng không qua kho (chỉ ${BILL_ACCOUNTS.join(', ')}).`);
      const accts = await tx.account.findMany({ where: { code: { in: codes } }, select: { code: true, isDetail: true } });
      for (const c of codes) if (!accts.find((a) => a.code === c)?.isDetail) throw new BadRequestException(`Tài khoản ${c} không tồn tại hoặc không phải TK chi tiết.`);

      const { taxable, vat, total } = billTotals(dto.lines);
      if (total <= 0) throw new BadRequestException('Tổng hoá đơn phải lớn hơn 0.');

      // Chi phí mua hàng: phần chưa thuế của các dòng GIA_NHAP chia cho hàng đã nhận của đơn nhập, cộng vào giá bình quân.
      let allocations: Allocation[] = [];
      if (landed.length) {
        if (!dto.purchaseOrderId) throw new BadRequestException('Chọn đơn nhập hàng nhận chi phí mua hàng.');
        allocations = await this.allocate(tx, dto.purchaseOrderId, landed.reduce((s, l) => s + Math.round(l.amount), 0), dto.allocationBasis ?? 'GIA_TRI');
      } else if (dto.purchaseOrderId) {
        throw new BadRequestException('Chỉ gắn đơn nhập hàng khi có dòng chi phí mua hàng phân bổ vào giá nhập.');
      }

      const code = await this.sequences.nextCode('HM', tx);
      const bill = await tx.purchaseBill.create({
        data: {
          code, supplierId: dto.supplierId, date: fromDay(day)!, description: dto.description ?? null,
          invoiceSeries: series, invoiceNo: no, invoiceDate: fromDay(invoiceDate),
          taxable, vat, total, createdById: user.id,
          purchaseOrderId: landed.length ? dto.purchaseOrderId : null, allocationBasis: landed.length ? (dto.allocationBasis ?? 'GIA_TRI') : null,
          lines: { create: dto.lines.map((l, i) => ({ accountCode: l.accountCode, description: l.description, amount: Math.round(l.amount), vatRate: l.vatRate, sortOrder: i })) },
          allocations: { create: allocations.map((a) => ({ productId: a.productId, amount: a.amount, toStock: a.toStock, toCogs: a.toCogs })) },
        },
        include: INCLUDE,
      });
      for (const a of allocations) await tx.product.update({ where: { id: a.productId }, data: { avgCost: a.avgAfter } });

      // Sổ cái: Nợ TK chi phí (từng TK) + Nợ 133 (VAT đầu vào) / Có 331 (phải trả NCC). Chi phí mua hàng: Nợ 156 / 155 phần hàng
      // còn trong kho, Nợ 632 phần của hàng đã bán.
      if (await this.ledger.isLedgerActive(tx, day)) {
        const byAccount = new Map<string, number>();
        for (const l of dto.lines.filter((x) => x.accountCode !== GIA_NHAP)) byAccount.set(l.accountCode, (byAccount.get(l.accountCode) ?? 0) + Math.round(l.amount));
        for (const a of allocations) {
          const stock = a.type === 'THANH_PHAM' ? '155' : '156';
          if (a.toStock) byAccount.set(stock, (byAccount.get(stock) ?? 0) + a.toStock);
          if (a.toCogs) byAccount.set('632', (byAccount.get('632') ?? 0) + a.toCogs);
        }
        const lines: LedgerLineInput[] = [...byAccount].map(([accountCode, debit]) => ({ accountCode, debit }));
        if (vat) lines.push({ accountCode: '133', debit: vat });
        lines.push({ accountCode: '331', credit: total, partnerType: 'NHA_CUNG_CAP', supplierId: dto.supplierId });
        await this.ledger.postEntry(tx, {
          date: day, source: 'PURCHASE_BILL', refType: 'PurchaseBill', refId: bill.id, createdById: user.id,
          description: `Mua hàng/dịch vụ ${code} - ${supplier.name}${dto.description ? ` (${dto.description})` : ''}`, lines,
        });
      }
      await this.audit.log(tx, {
        action: 'purchase_bill.create', entityType: 'PurchaseBill', entityId: bill.id, entityCode: code,
        summary: `Hoá đơn mua hàng ${code} · ${supplier.code} ${supplier.name} · ${vnd(total)} (thuế ${vnd(vat)})${no ? ` · HĐ ${series ?? ''} ${no}`.replace('  ', ' ') : ''}`,
        related: [supplier.code],
      });
      return billToApi(bill);
    });
  }

  /**
   * Chia `total` (chưa thuế) cho hàng đã nhận của đơn nhập (trừ phần đã trả NCC, bỏ dịch vụ). Mỗi mặt hàng: phần đi vào tồn kho
   * theo tỷ lệ hàng còn lại (mọi kho), phần còn lại là giá vốn của hàng đã bán; giá bình quân tăng theo phần vào tồn kho.
   */
  private async allocate(tx: Prisma.TransactionClient, orderId: string, total: number, basis: AllocationBasis): Promise<Allocation[]> {
    const o = await tx.purchaseOrder.findUnique({
      where: { id: orderId },
      include: {
        lines: { include: { product: { select: { type: true, avgCost: true } } } },
        returns: { where: { isCancelled: false }, include: { lines: true } },
      },
    });
    if (!o) throw new BadRequestException('Đơn nhập hàng không tồn tại.');
    if (o.status === 'HUY') throw new BadRequestException(`Đơn ${o.code} đã huỷ — không phân bổ chi phí được.`);

    const byProduct = new Map<string, { quantity: number; value: number; type: string; avg: number }>();
    for (const l of o.lines) {
      if (l.product.type === 'DICH_VU') continue;
      const back = o.returns.flatMap((r) => r.lines).filter((x) => x.orderLineId === l.id).reduce((s, x) => s + x.quantity.toNumber(), 0);
      const got = l.receivedQuantity.toNumber() - back;
      if (got <= 0) continue;
      const prev = byProduct.get(l.productId) ?? { quantity: 0, value: 0, type: l.product.type, avg: l.product.avgCost.toNumber() };
      byProduct.set(l.productId, { ...prev, quantity: prev.quantity + got * l.ratioToBase.toNumber(), value: prev.value + got * l.unitPrice.toNumber() });
    }
    if (!byProduct.size) throw new BadRequestException(`Đơn ${o.code} chưa nhận hàng nhập kho nào (hoặc đã trả hết) — chưa có hàng để phân bổ chi phí.`);

    const shares = allocateCost(total, [...byProduct].map(([key, v]) => ({ key, quantity: v.quantity, value: v.value })), basis);
    const stock = await tx.stockLevel.groupBy({ by: ['productId'], where: { productId: { in: [...byProduct.keys()] } }, _sum: { quantity: true } });
    const onHand = new Map(stock.map((s) => [s.productId, Math.max(0, s._sum.quantity?.toNumber() ?? 0)]));
    return [...byProduct].map(([productId, v]) => {
      const amount = shares.get(productId) ?? 0;
      const { toStock, toCogs } = splitStockCogs(amount, v.quantity, onHand.get(productId) ?? 0);
      return { productId, type: v.type, amount, toStock, toCogs, avgAfter: avgAfterCost(v.avg, onHand.get(productId) ?? 0, toStock) };
    });
  }

  async cancel(id: string, reason: string | undefined, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PurchaseBill" WHERE "id" = ${id} FOR UPDATE`;
      const b = await tx.purchaseBill.findUnique({ where: { id }, include: INCLUDE });
      if (!b) throw new NotFoundException('Không tìm thấy hoá đơn mua hàng.');
      if (b.isCancelled) throw new BadRequestException(`${b.code} đã huỷ rồi.`);
      await assertOpenPeriod(tx, b.date, `Huỷ ${b.code}:`);
      // Phiếu chi đã chọn tay đối trừ hoá đơn này thì phải huỷ phiếu chi trước, nếu không công nợ lệch.
      const used = await tx.cashAllocation.findFirst({ where: { ref: b.code, voucher: { isCancelled: false } }, select: { voucher: { select: { code: true } } } });
      if (used) throw new BadRequestException(`${b.code} đã được đối trừ bằng phiếu ${used.voucher.code} — huỷ phiếu đó trước.`);
      await this.ledger.reverseEntriesFor(tx, 'PurchaseBill', b.id, { date: toDay(b.date)!, createdById: user.id, description: `Huỷ hoá đơn mua hàng ${b.code}` });
      // Chi phí mua hàng đã cộng vào giá bình quân thì trả lại phần đó (theo tồn hiện tại).
      for (const a of b.allocations) {
        const toStock = a.toStock.toNumber();
        if (!toStock) continue;
        const [p, stock] = await Promise.all([
          tx.product.findUnique({ where: { id: a.productId }, select: { avgCost: true } }),
          tx.stockLevel.aggregate({ where: { productId: a.productId }, _sum: { quantity: true } }),
        ]);
        if (p) await tx.product.update({ where: { id: a.productId }, data: { avgCost: avgBeforeCost(p.avgCost.toNumber(), Math.max(0, stock._sum.quantity?.toNumber() ?? 0), toStock) } });
      }
      const out = await tx.purchaseBill.update({ where: { id }, data: { isCancelled: true, cancelReason: reason ?? null, cancelledAt: new Date() }, include: INCLUDE });
      await this.audit.log(tx, {
        action: 'purchase_bill.cancel', entityType: 'PurchaseBill', entityId: b.id, entityCode: b.code,
        summary: `Huỷ hoá đơn mua hàng ${b.code} (${vnd(b.total.toNumber())} bỏ khỏi công nợ phải trả)${reason ? `: ${reason}` : ''}`,
        related: [b.supplier.code],
      });
      return billToApi(out);
    });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('purchase-bills')
export class PurchaseBillsController {
  constructor(private readonly bills: PurchaseBillsService) {}

  @RequirePermissions('purchase.view')
  @Get()
  list(@Query('from') from?: string, @Query('to') to?: string, @Query('supplierId') supplierId?: string) {
    return this.bills.list({
      from: from && DAY.test(from) ? from : undefined, to: to && DAY.test(to) ? to : undefined, supplierId: supplierId?.trim() || undefined,
    });
  }

  @RequirePermissions('purchase.view')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bills.findOne(id);
  }

  @RequirePermissions('purchase.create')
  @Post()
  create(@Body() dto: PurchaseBillDto, @CurrentUser() user: AuthUser) {
    return this.bills.create(dto, user);
  }

  @RequirePermissions('purchase.cancel')
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Body() dto: CancelBillDto, @CurrentUser() user: AuthUser) {
    return this.bills.cancel(id, dto.reason, user);
  }
}
