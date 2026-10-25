import {
  BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Injectable, Module, NotFoundException, Param, Post, Query,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { PartnerType, Prisma, VoucherKind } from '@prisma/client';
import { IsArray, IsEnum, IsNumber, IsOptional, IsPositive, Matches, Min, ValidateNested } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequireAnyPermission, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SequenceService } from '../../prisma/sequence.service.js';
import { OptionalText, Text } from '../../common/dto.js';
import { fromDay } from '../../common/text.js';
import { assertOpenPeriod } from '../../common/period-lock.js';
import { CASH_INCLUDE, cashToApi } from './cash-voucher.mapper.js';
import { AuditService } from '../../audit/audit.service.js';
import { vnd } from '../../audit/audit.diff.js';
import { listParam, parsePageQuery, windowStart } from '../../common/paging.js';
import { CashVoucherPageQuery, cashPageOf, cashWhere, refWhere } from './cash-voucher-page.js';

export class AllocationDto {
  @Text(30) ref!: string; // mã chứng từ công nợ (DN…/DH…, or a phiếu hoàn tiền)
  @IsNumber() @IsPositive() amount!: number;
}

export class CashVoucherDto {
  @IsEnum(VoucherKind) kind!: VoucherKind;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày phải có dạng YYYY-MM-DD' }) date!: string;
  @Text(100) category!: string; // name of the loại thu chi
  @IsEnum(PartnerType) partnerType!: PartnerType;
  @OptionalText(60) partnerId?: string;
  @Text(60) accountId!: string;
  @IsNumber() @IsPositive({ message: 'Số tiền phải lớn hơn 0' }) amount!: number;
  @OptionalText(500) description?: string;
  /** Đối trừ "Chọn tay"; absent = tự động (khoản đến hạn sớm nhất trước). */
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AllocationDto) allocations?: AllocationDto[];
  @IsOptional() @IsNumber() @Min(0) settledAmount?: number;
}

export class CancelDto {
  @OptionalText(300) reason?: string;
}

type Tx = Prisma.TransactionClient;

const PREFIX: Record<VoucherKind, string> = { THU: 'PT', CHI: 'PC' };

/**
 * Phiếu thu chi. A phiếu tied to a khách hàng / nhà cung cấp settles their công nợ: allocations
 * ("Chọn tay") go to the named documents first, the rest settles the earliest due khoản (FIFO) —
 * computed when công nợ is read (common/settle.ts), never stored per khoản. Số dư quỹ follows from
 * the phiếu chưa huỷ (cashBalances).
 */
@Injectable()
export class CashVouchersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Phiếu thu chi. `since`: only those dated from then (what the app loads at sign-in, Pha 1.1). `pick`: just these, by id
   * or mã. `ref`: those naming one chứng từ (đối trừ or diễn giải) — for screens showing older ones.
   */
  async findAll(since?: Date, pick?: { ids?: string[]; codes?: string[] }, ref?: string) {
    const where: Prisma.CashVoucherWhereInput = pick?.ids?.length || pick?.codes?.length
      ? { OR: [...(pick.ids?.length ? [{ id: { in: pick.ids } }] : []), ...(pick.codes?.length ? [{ code: { in: pick.codes } }] : [])] }
      : ref ? refWhere(ref) : since ? { date: { gte: since } } : {};
    const rows = await this.prisma.cashVoucher.findMany({ where, include: CASH_INCLUDE, orderBy: [{ date: 'desc' }, { code: 'desc' }] });
    return rows.map(cashToApi);
  }

  /** Danh sách phiếu thu chi theo trang (Pha 1.1), see cash-voucher-page.ts. */
  async page(q: CashVoucherPageQuery) {
    const [rows, customers, suppliers, accounts, users] = await Promise.all([
      this.prisma.cashVoucher.findMany({ where: cashWhere(q), include: CASH_INCLUDE }),
      this.prisma.customer.findMany({ select: { id: true, code: true, name: true, companyName: true } }),
      this.prisma.supplier.findMany({ select: { id: true, code: true, name: true } }),
      this.prisma.cashAccount.findMany({ select: { id: true, name: true, type: true } }),
      this.prisma.user.findMany({ select: { email: true, name: true } }),
    ]);
    return cashPageOf(rows.map(cashToApi), q, {
      partners: new Map([
        ...customers.map((c) => [c.id, `${c.code} · ${c.companyName || c.name}`] as const),
        ...suppliers.map((x) => [x.id, `${x.code} · ${x.name}`] as const),
      ]),
      accounts: new Map(accounts.map((a) => [a.id, a])),
      users: new Map(users.map((u) => [u.email, u.name])),
    });
  }

  /** Số phiếu chưa huỷ của từng tài khoản tiền và từng loại thu chi ("THU|Tên loại") trên toàn bộ lịch sử. */
  async usage() {
    const [accounts, categories] = await Promise.all([
      this.prisma.cashVoucher.groupBy({ by: ['accountId'], where: { isCancelled: false }, _count: { _all: true } }),
      this.prisma.cashVoucher.groupBy({ by: ['kind', 'category'], where: { isCancelled: false }, _count: { _all: true } }),
    ]);
    return {
      accounts: Object.fromEntries(accounts.map((r) => [r.accountId, r._count._all])),
      categories: Object.fromEntries(categories.map((r) => [`${r.kind}|${r.category}`, r._count._all])),
    };
  }

  async create(dto: CashVoucherDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, dto.date, dto.kind === 'THU' ? 'Phiếu thu' : 'Phiếu chi');
      const category = await tx.cashCategory.findFirst({ where: { kind: dto.kind, name: dto.category, isActive: true } });
      if (!category) throw new BadRequestException(`Loại "${dto.category}" không có hoặc đã ngừng dùng.`);
      if (category.partnerType !== dto.partnerType) throw new BadRequestException(`Loại "${category.name}" không gắn với đối tác này.`);
      const account = await tx.cashAccount.findUnique({ where: { id: dto.accountId } });
      if (!account || !account.isActive) throw new BadRequestException('Tài khoản tiền không có hoặc đã ngừng dùng.');
      const overdrawn = dto.kind === 'CHI' ? await this.overdraw(tx, account, dto.date, dto.amount, user) : '';

      let customerId: string | null = null;
      let supplierId: string | null = null;
      let refs = new Set<string>();
      if (dto.partnerType === 'KHACH_HANG') {
        if (!dto.partnerId || !(await tx.customer.findUnique({ where: { id: dto.partnerId } }))) throw new BadRequestException('Chọn khách hàng.');
        customerId = dto.partnerId;
        // What a phiếu thu may settle: the customer's orders, and money we paid back to them (phiếu chi hoàn tiền).
        refs = new Set([
          ...(await tx.salesOrder.findMany({ where: { customerId, status: { not: 'HUY' } }, select: { code: true } })).map((o) => o.code),
          ...(await tx.cashVoucher.findMany({ where: { customerId, kind: dto.kind === 'THU' ? 'CHI' : 'THU', isCancelled: false }, select: { code: true } })).map((v) => v.code),
        ]);
      } else if (dto.partnerType === 'NHA_CUNG_CAP') {
        if (!dto.partnerId || !(await tx.supplier.findUnique({ where: { id: dto.partnerId } }))) throw new BadRequestException('Chọn nhà cung cấp.');
        supplierId = dto.partnerId;
        refs = new Set([
          ...(await tx.purchaseOrder.findMany({ where: { supplierId, status: { not: 'HUY' } }, select: { code: true } })).map((o) => o.code),
          ...(await tx.cashVoucher.findMany({ where: { supplierId, kind: dto.kind === 'CHI' ? 'THU' : 'CHI', isCancelled: false }, select: { code: true } })).map((v) => v.code),
        ]);
      }

      // Chọn tay: same document twice adds up; unknown documents and more than the phiếu are refused.
      const merged = new Map<string, number>();
      for (const a of dto.partnerType === 'KHAC' ? [] : (dto.allocations ?? [])) merged.set(a.ref, (merged.get(a.ref) ?? 0) + a.amount);
      for (const ref of merged.keys()) {
        if (!refs.has(ref.split('·')[0])) throw new BadRequestException(`${ref} không phải chứng từ công nợ của đối tác này.`);
      }
      const allocated = [...merged.values()].reduce((s, x) => s + x, 0);
      if (allocated > dto.amount) throw new BadRequestException('Tổng đối trừ chọn tay vượt số tiền của phiếu.');

      const v = await tx.cashVoucher.create({
        data: {
          code: await this.sequences.nextCode(PREFIX[dto.kind], tx), date: fromDay(dto.date)!, kind: dto.kind, category: category.name,
          partnerType: dto.partnerType, customerId, supplierId, accountId: account.id, amount: dto.amount,
          settledAmount: dto.partnerType === 'KHAC' ? 0 : Math.min(dto.amount, Math.max(0, dto.settledAmount ?? 0)),
          description: dto.description ?? null, createdById: user.id,
          allocations: { create: [...merged].map(([ref, amount]) => ({ ref, amount })) },
        },
        include: CASH_INCLUDE,
      });
      const partner = customerId
        ? (await tx.customer.findUnique({ where: { id: customerId }, select: { code: true, name: true } }))
        : supplierId ? (await tx.supplier.findUnique({ where: { id: supplierId }, select: { code: true, name: true } })) : null;
      await this.audit.log(tx, {
        action: 'cash_voucher.create', entityType: 'CashVoucher', entityId: v.id, entityCode: v.code,
        summary: `Lập ${dto.kind === 'THU' ? 'phiếu thu' : 'phiếu chi'} ${v.code}: ${vnd(dto.amount)} · ${category.name}`
          + (partner ? ` · ${partner.code} ${partner.name}` : '') + ` · ${account.name}`
          + (merged.size ? ` · đối trừ chọn tay ${[...merged].map(([r, a]) => `${r} ${vnd(a)}`).join(', ')}` : '') + overdrawn,
        related: [...merged.keys(), ...(partner ? [partner.code] : [])],
      });
      return cashToApi(v);
    });
  }

  /**
   * Không chi vượt tồn quỹ (as MISA): the account's số dư on the phiếu's date and today must both cover the phiếu.
   * The account row is locked so two phiếu chi at once queue up. voucher.overdraw saves anyway — the Nhật ký says so.
   */
  private async overdraw(tx: Tx, account: { id: string; name: string; openingBalance: Prisma.Decimal }, day: string, amount: number, user: AuthUser) {
    await tx.$queryRaw`SELECT "id" FROM "CashAccount" WHERE "id" = ${account.id} FOR UPDATE`;
    const balance = async (until?: Date) => {
      const sums = await tx.cashVoucher.groupBy({
        by: ['kind'], where: { accountId: account.id, isCancelled: false, ...(until ? { date: { lte: until } } : {}) }, _sum: { amount: true },
      });
      return sums.reduce((s, x) => s + (x.kind === 'THU' ? 1 : -1) * (x._sum.amount?.toNumber() ?? 0), account.openingBalance.toNumber());
    };
    const left = Math.min(await balance(fromDay(day)!), await balance());
    if (left >= amount) return '';
    if (!user.permissions.includes('voucher.overdraw')) {
      throw new BadRequestException(`Tồn quỹ ${account.name} chỉ còn ${vnd(left)} — không chi được ${vnd(amount)}.`);
    }
    return ` · chi vượt tồn quỹ (còn ${vnd(left)})`;
  }

  /** Huỷ phiếu: the phiếu stays (shown as huỷ); it no longer counts in số dư quỹ or đối trừ, so công nợ reopens. */
  async cancel(id: string, reason: string | undefined) {
    const v = await this.prisma.cashVoucher.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Không tìm thấy phiếu thu chi');
    if (v.isCancelled) throw new BadRequestException(`${v.code} đã huỷ rồi.`);
    const saved = await this.prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, v.date, `Huỷ ${v.code}:`);
      const s = await tx.cashVoucher.update({
        where: { id }, data: { isCancelled: true, cancelReason: reason ?? null, cancelledAt: new Date() }, include: CASH_INCLUDE,
      });
      await this.audit.log(tx, {
        action: 'cash_voucher.cancel', entityType: 'CashVoucher', entityId: id, entityCode: v.code,
        summary: `Huỷ ${v.kind === 'THU' ? 'phiếu thu' : 'phiếu chi'} ${v.code} (${vnd(v.amount)})${reason ? `: ${reason}` : ''}`,
      });
      return s;
    });
    return cashToApi(saved);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('cash-vouchers')
export class CashVouchersController {
  constructor(private readonly vouchers: CashVouchersService) {}

  // Công nợ, the dashboard and the cash-flow report read them too.
  // `?recentDays=90` (what the app loads at sign-in, Pha 1.1): the last 90 days. `?ids=` / `?codes=`: just those (at most
  // 500). `?ref=DH0001`: those naming that chứng từ.
  @RequireAnyPermission('voucher.view', 'debt.view', 'report.cashflow', 'report.dashboard')
  @Get()
  findAll(@Query('recentDays') recentDays?: string, @Query('ids') ids?: string, @Query('codes') codes?: string, @Query('ref') ref?: string) {
    return this.vouchers.findAll(windowStart(recentDays), { ids: listParam(ids), codes: listParam(codes) }, ref?.trim() || undefined);
  }

  /** Danh sách theo trang: lọc, tìm không dấu, sắp xếp, thẻ tổng của kỳ (Pha 1.1). Declared before :id routes. */
  @RequireAnyPermission('voucher.view', 'debt.view', 'report.cashflow', 'report.dashboard')
  @Get('page')
  async page(@Query() raw: Record<string, unknown>) {
    return this.vouchers.page(await parsePageQuery(CashVoucherPageQuery, raw, ['categories', 'createdBy']));
  }

  /** Số phiếu theo tài khoản tiền và loại thu chi — Thiết lập of those. */
  @RequireAnyPermission('voucher.view', 'debt.view', 'report.cashflow', 'report.dashboard')
  @Get('usage')
  usage() {
    return this.vouchers.usage();
  }

  @Post()
  create(@Body() dto: CashVoucherDto, @CurrentUser() user: AuthUser) {
    const need = dto.kind === 'THU' ? 'voucher.create_receipt' : 'voucher.create_payment';
    if (!user.permissions.includes(need)) throw new ForbiddenException(`Chức vụ của bạn chưa có quyền: ${need}`);
    return this.vouchers.create(dto, user);
  }

  @RequirePermissions('voucher.cancel')
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Body() dto: CancelDto) {
    return this.vouchers.cancel(id, dto.reason);
  }
}

@Module({ controllers: [CashVouchersController], providers: [CashVouchersService], exports: [CashVouchersService] })
export class CashVouchersModule {}
