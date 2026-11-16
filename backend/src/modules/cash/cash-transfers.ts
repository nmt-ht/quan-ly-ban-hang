import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Injectable, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { IsNumber, IsPositive, Matches } from 'class-validator';
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
import { CashVouchersService } from './cash-vouchers.module.js';
import { TRANSFER_IN_CATEGORY, TRANSFER_OUT_CATEGORY } from './transfer-categories.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class CashTransferDto {
  @Text(60) fromAccountId!: string;
  @Text(60) toAccountId!: string;
  @Matches(DAY, { message: 'Ngày phải có dạng YYYY-MM-DD' }) date!: string;
  @IsNumber() @IsPositive({ message: 'Số tiền phải lớn hơn 0' }) amount!: number;
  @OptionalText(500) description?: string;
}

export class CancelTransferDto {
  @OptionalText(300) reason?: string;
}

const INCLUDE = {
  fromAccount: { select: { name: true } },
  toAccount: { select: { name: true } },
  outVoucher: { select: { code: true } },
  inVoucher: { select: { code: true } },
} as const satisfies Prisma.CashTransferInclude;
type Row = Prisma.CashTransferGetPayload<{ include: typeof INCLUDE }>;

export const transferToApi = (t: Row) => ({
  id: t.id, code: t.code, date: toDay(t.date)!, fromAccountId: t.fromAccountId, fromAccountName: t.fromAccount.name,
  toAccountId: t.toAccountId, toAccountName: t.toAccount.name, amount: t.amount.toNumber(), description: t.description,
  outVoucherCode: t.outVoucher.code, inVoucherCode: t.inVoucher.code, isCancelled: t.isCancelled, cancelReason: t.cancelReason,
});

/**
 * Chuyển tiền nội bộ CT…: một phiếu chi ở quỹ đi và một phiếu thu ở quỹ đến, cùng loại thu chi hệ thống, hạch toán qua TK 113 tiền
 * đang chuyển (Nợ 113 / Có quỹ đi, rồi Nợ quỹ đến / Có 113) nên 113 về 0 và Nợ 112 / Có 111 (hoặc ngược lại) là kết quả. Cả hai phiếu
 * lập trong một transaction; chi vượt tồn quỹ đi bị chặn như phiếu chi thường.
 */
@Injectable()
export class CashTransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly audit: AuditService,
    private readonly vouchers: CashVouchersService,
  ) {}

  async list() {
    const rows = await this.prisma.cashTransfer.findMany({ include: INCLUDE, orderBy: [{ date: 'desc' }, { code: 'desc' }], take: 500 });
    return rows.map(transferToApi);
  }

  /** Bảo đảm TK 113 và hai loại thu chi hệ thống có mặt (cơ sở dữ liệu cũ chưa chạy seed mới). */
  private async ensureSystemData(tx: Prisma.TransactionClient) {
    await tx.account.upsert({
      where: { code: '113' }, update: {}, create: { code: '113', name: 'Tiền đang chuyển', kind: 'TAI_SAN', normalSide: 'NO', isDetail: true },
    });
    const cats = [
      { code: 'CHI_NOIBO', name: TRANSFER_OUT_CATEGORY, kind: 'CHI' as const, sortOrder: 6 },
      { code: 'THU_NOIBO', name: TRANSFER_IN_CATEGORY, kind: 'THU' as const, sortOrder: 7 },
    ];
    for (const c of cats) {
      await tx.cashCategory.upsert({
        where: { code: c.code }, update: {},
        create: { ...c, partnerType: 'KHAC', isDefault: false, isActive: true, isSystem: true, defaultAccountCode: '113' },
      });
    }
  }

  async create(dto: CashTransferDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.fromAccountId === dto.toAccountId) throw new BadRequestException('Chọn hai tài khoản tiền khác nhau.');
      const day = await documentDay(tx, dto.date, 'Chuyển tiền nội bộ');
      const [from, to] = await Promise.all([
        tx.cashAccount.findUnique({ where: { id: dto.fromAccountId } }), tx.cashAccount.findUnique({ where: { id: dto.toAccountId } }),
      ]);
      if (!from || !from.isActive) throw new BadRequestException('Tài khoản chuyển đi không có hoặc đã ngừng dùng.');
      if (!to || !to.isActive) throw new BadRequestException('Tài khoản nhận không có hoặc đã ngừng dùng.');
      await this.ensureSystemData(tx);

      const code = await this.sequences.nextCode('CT', tx);
      const note = `Chuyển tiền nội bộ ${code}: ${from.name} → ${to.name}${dto.description ? ` · ${dto.description}` : ''}`;
      // Chi trước: nếu quỹ đi không đủ tiền thì dừng ngay, chưa có gì ghi.
      const out = await this.vouchers.createIn(tx, { kind: 'CHI', date: day, category: TRANSFER_OUT_CATEGORY, partnerType: 'KHAC', accountId: from.id, amount: dto.amount, description: note }, user);
      const inn = await this.vouchers.createIn(tx, { kind: 'THU', date: day, category: TRANSFER_IN_CATEGORY, partnerType: 'KHAC', accountId: to.id, amount: dto.amount, description: note }, user);
      const t = await tx.cashTransfer.create({
        data: {
          code, date: fromDay(day)!, fromAccountId: from.id, toAccountId: to.id, amount: dto.amount, description: dto.description ?? null,
          outVoucherId: out.id, inVoucherId: inn.id, createdById: user.id,
        },
        include: INCLUDE,
      });
      await this.audit.log(tx, {
        action: 'cash_transfer.create', entityType: 'CashTransfer', entityId: t.id, entityCode: code,
        summary: `Chuyển tiền nội bộ ${code}: ${vnd(dto.amount)} từ ${from.name} sang ${to.name}`, related: [out.code, inn.code],
      });
      return transferToApi(t);
    });
  }

  async cancel(id: string, reason: string | undefined, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "CashTransfer" WHERE "id" = ${id} FOR UPDATE`;
      const t = await tx.cashTransfer.findUnique({ where: { id }, include: INCLUDE });
      if (!t) throw new NotFoundException('Không tìm thấy chuyển tiền nội bộ.');
      if (t.isCancelled) throw new BadRequestException(`${t.code} đã huỷ rồi.`);
      await assertOpenPeriod(tx, t.date, `Huỷ ${t.code}:`);
      // Huỷ phiếu thu (quỹ nhận) trước: nếu quỹ nhận đã tiêu mất tiền thì bị chặn, chưa đụng tới quỹ đi.
      await this.vouchers.cancelIn(tx, t.inVoucherId, `Huỷ chuyển tiền nội bộ ${t.code}`, user);
      await this.vouchers.cancelIn(tx, t.outVoucherId, `Huỷ chuyển tiền nội bộ ${t.code}`, user);
      const out = await tx.cashTransfer.update({ where: { id }, data: { isCancelled: true, cancelReason: reason ?? null, cancelledAt: new Date() }, include: INCLUDE });
      await this.audit.log(tx, {
        action: 'cash_transfer.cancel', entityType: 'CashTransfer', entityId: id, entityCode: t.code,
        summary: `Huỷ chuyển tiền nội bộ ${t.code} (${vnd(t.amount.toNumber())})${reason ? `: ${reason}` : ''}`, related: [t.outVoucher.code, t.inVoucher.code],
      });
      return transferToApi(out);
    });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('cash-transfers')
export class CashTransfersController {
  constructor(private readonly svc: CashTransfersService) {}

  @RequirePermissions('voucher.view')
  @Get()
  list() {
    return this.svc.list();
  }

  // Chuyển tiền vừa chi vừa thu: cần cả hai quyền lập phiếu.
  @RequirePermissions('voucher.create_receipt', 'voucher.create_payment')
  @Post()
  create(@Body() dto: CashTransferDto, @CurrentUser() user: AuthUser) {
    return this.svc.create(dto, user);
  }

  @RequirePermissions('voucher.cancel')
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Body() dto: CancelTransferDto, @CurrentUser() user: AuthUser) {
    return this.svc.cancel(id, dto.reason, user);
  }
}
