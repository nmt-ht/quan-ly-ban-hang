import {
  BadRequestException, Body, ConflictException, Controller, Get, HttpCode, HttpStatus, Injectable, NotFoundException, Param, Post, Query, UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsNumber, IsPositive, Matches, ValidateNested } from 'class-validator';
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

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** TK được hạch toán trên hoá đơn không qua kho: chi phí bán hàng, quản lý, tài chính, khác và chi phí trả trước. Hàng tồn kho đi qua phiếu nhập kho, không qua đây. */
export const BILL_ACCOUNTS = ['641', '642', '635', '811', '242'];
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
  @IsArray() @ArrayMinSize(1, { message: 'Thêm ít nhất một dòng chi phí' }) @ValidateNested({ each: true }) @Type(() => PurchaseBillLineDto)
  lines!: PurchaseBillLineDto[];
}

export class CancelBillDto {
  @OptionalText(300) reason?: string;
}

const INCLUDE = {
  lines: { orderBy: { sortOrder: 'asc' } },
  supplier: { select: { code: true, name: true } },
} as const satisfies Prisma.PurchaseBillInclude;
type Row = Prisma.PurchaseBillGetPayload<{ include: typeof INCLUDE }>;

export function billToApi(b: Row) {
  return {
    id: b.id, code: b.code, supplierId: b.supplierId, supplierCode: b.supplier.code, supplierName: b.supplier.name,
    date: toDay(b.date)!, description: b.description, invoiceSeries: b.invoiceSeries, invoiceNo: b.invoiceNo, invoiceDate: toDay(b.invoiceDate),
    taxable: b.taxable.toNumber(), vat: b.vat.toNumber(), total: b.total.toNumber(),
    isCancelled: b.isCancelled, cancelReason: b.cancelReason,
    lines: b.lines.map((l) => ({ id: l.id, accountCode: l.accountCode, description: l.description, amount: l.amount.toNumber(), vatRate: l.vatRate.toNumber() })),
  };
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

      const codes = [...new Set(dto.lines.map((l) => l.accountCode))];
      const bad = codes.find((c) => !BILL_ACCOUNTS.includes(c));
      if (bad) throw new BadRequestException(`Tài khoản ${bad} không dùng cho hoá đơn mua hàng không qua kho (chỉ ${BILL_ACCOUNTS.join(', ')}).`);
      const accts = await tx.account.findMany({ where: { code: { in: codes } }, select: { code: true, isDetail: true } });
      for (const c of codes) if (!accts.find((a) => a.code === c)?.isDetail) throw new BadRequestException(`Tài khoản ${c} không tồn tại hoặc không phải TK chi tiết.`);

      const { taxable, vat, total } = billTotals(dto.lines);
      if (total <= 0) throw new BadRequestException('Tổng hoá đơn phải lớn hơn 0.');
      const code = await this.sequences.nextCode('HM', tx);
      const bill = await tx.purchaseBill.create({
        data: {
          code, supplierId: dto.supplierId, date: fromDay(day)!, description: dto.description ?? null,
          invoiceSeries: series, invoiceNo: no, invoiceDate: fromDay(invoiceDate),
          taxable, vat, total, createdById: user.id,
          lines: { create: dto.lines.map((l, i) => ({ accountCode: l.accountCode, description: l.description, amount: Math.round(l.amount), vatRate: l.vatRate, sortOrder: i })) },
        },
        include: INCLUDE,
      });

      // Sổ cái: Nợ TK chi phí (từng TK) + Nợ 133 (VAT đầu vào) / Có 331 (phải trả NCC).
      if (await this.ledger.isLedgerActive(tx, day)) {
        const byAccount = new Map<string, number>();
        for (const l of dto.lines) byAccount.set(l.accountCode, (byAccount.get(l.accountCode) ?? 0) + Math.round(l.amount));
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
