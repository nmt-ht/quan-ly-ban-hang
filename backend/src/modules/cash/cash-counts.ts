import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Injectable, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsNumber, IsPositive, Matches, Min, ValidateNested } from 'class-validator';
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
import { bookBalance } from './cash-balance.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class DenominationDto {
  @IsNumber() @IsPositive() value!: number; // mệnh giá
  @IsInt() @Min(0) count!: number; // số tờ
}

export class CashCountDto {
  @Text(60) accountId!: string;
  @Matches(DAY, { message: 'Ngày phải có dạng YYYY-MM-DD' }) date!: string;
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => DenominationDto) denominations!: DenominationDto[];
  @OptionalText(100) countedBy?: string;
  @OptionalText(500) note?: string;
}

export class CancelCountDto {
  @OptionalText(300) reason?: string;
}

/** Tổng tiền đếm được theo mệnh giá. */
export const countedTotal = (d: { value: number; count: number }[]) => d.reduce((s, x) => s + Math.round(x.value) * x.count, 0);

const INCLUDE = { account: { select: { name: true } }, createdBy: { select: { email: true } } } as const satisfies Prisma.CashCountInclude;
type Row = Prisma.CashCountGetPayload<{ include: typeof INCLUDE }>;

export const countToApi = (c: Row) => ({
  id: c.id, code: c.code, date: toDay(c.date)!, accountId: c.accountId, accountName: c.account.name,
  bookAmount: c.bookAmount.toNumber(), countedAmount: c.countedAmount.toNumber(), difference: c.difference.toNumber(),
  denominations: (c.denominations as { value: number; count: number }[] | null) ?? [], countedBy: c.countedBy, note: c.note,
  isCancelled: c.isCancelled, cancelReason: c.cancelReason, createdBy: c.createdBy.email,
});

/**
 * Kiểm kê quỹ tiền mặt KQ…: đếm tiền theo mệnh giá, so với số dư sổ sách tại cuối ngày kiểm kê (chốt lúc lưu). Chênh lệch (thừa hoặc
 * thiếu quỹ) chỉ ghi nhận trên biên bản; xử lý chênh lệch bằng phiếu thu / phiếu chi như thường.
 */
@Injectable()
export class CashCountsService {
  constructor(private readonly prisma: PrismaService, private readonly sequences: SequenceService, private readonly audit: AuditService) {}

  async list(accountId?: string) {
    const rows = await this.prisma.cashCount.findMany({ where: accountId ? { accountId } : {}, include: INCLUDE, orderBy: [{ date: 'desc' }, { code: 'desc' }], take: 500 });
    return rows.map(countToApi);
  }

  /** Số dư sổ sách của một tài khoản tiền mặt vào cuối ngày — để màn hình kiểm kê hiện sẵn khi đang đếm. */
  async book(accountId: string, date: string) {
    if (!DAY.test(date)) throw new BadRequestException('Ngày phải có dạng YYYY-MM-DD');
    const account = await this.prisma.cashAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException('Không tìm thấy tài khoản tiền.');
    return { accountId, date, bookAmount: await bookBalance(this.prisma, account, date) };
  }

  async create(dto: CashCountDto, user: AuthUser) {
    if (dto.date > vnDay()) throw new BadRequestException('Ngày kiểm kê không được sau hôm nay.');
    for (const d of dto.denominations) if (d.value !== Math.round(d.value)) throw new BadRequestException('Mệnh giá phải là số nguyên đồng.');
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.cashAccount.findUnique({ where: { id: dto.accountId } });
      if (!account || !account.isActive) throw new BadRequestException('Tài khoản tiền không có hoặc đã ngừng dùng.');
      if (account.type !== 'TIEN_MAT') throw new BadRequestException('Kiểm kê quỹ chỉ dùng cho tài khoản tiền mặt.');
      // Mỗi mệnh giá một dòng: hai dòng cùng mệnh giá là nhập trùng.
      if (new Set(dto.denominations.map((d) => d.value)).size !== dto.denominations.length) throw new BadRequestException('Mỗi mệnh giá chỉ nhập một dòng.');
      const counted = countedTotal(dto.denominations);
      const book = await bookBalance(tx, account, dto.date);
      const code = await this.sequences.nextCode('KQ', tx);
      const c = await tx.cashCount.create({
        data: {
          code, date: fromDay(dto.date)!, accountId: account.id, bookAmount: book, countedAmount: counted, difference: counted - book,
          denominations: dto.denominations.filter((d) => d.count > 0).map((d) => ({ value: d.value, count: d.count })),
          countedBy: dto.countedBy ?? null, note: dto.note ?? null, createdById: user.id,
        },
        include: INCLUDE,
      });
      const diff = counted - book;
      await this.audit.log(tx, {
        action: 'cash_count.create', entityType: 'CashCount', entityId: c.id, entityCode: code,
        summary: `Kiểm kê quỹ ${code} · ${account.name} ngày ${dto.date}: đếm ${vnd(counted)}, sổ ${vnd(book)}, ${diff === 0 ? 'khớp' : diff > 0 ? `thừa ${vnd(diff)}` : `thiếu ${vnd(-diff)}`}`,
      });
      return countToApi(c);
    });
  }

  async cancel(id: string, reason: string | undefined) {
    return this.prisma.$transaction(async (tx) => {
      const c = await tx.cashCount.findUnique({ where: { id }, include: INCLUDE });
      if (!c) throw new NotFoundException('Không tìm thấy biên bản kiểm kê.');
      if (c.isCancelled) throw new BadRequestException(`${c.code} đã huỷ rồi.`);
      const out = await tx.cashCount.update({ where: { id }, data: { isCancelled: true, cancelReason: reason ?? null, cancelledAt: new Date() }, include: INCLUDE });
      await this.audit.log(tx, { action: 'cash_count.cancel', entityType: 'CashCount', entityId: id, entityCode: c.code, summary: `Huỷ biên bản kiểm kê quỹ ${c.code}${reason ? `: ${reason}` : ''}` });
      return countToApi(out);
    });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('cash-counts')
export class CashCountsController {
  constructor(private readonly svc: CashCountsService) {}

  @RequirePermissions('voucher.view')
  @Get()
  list() {
    return this.svc.list();
  }

  @RequirePermissions('voucher.view')
  @Get('book/:accountId/:date')
  book(@Param('accountId') accountId: string, @Param('date') date: string) {
    return this.svc.book(accountId, date);
  }

  @RequirePermissions('voucher.manage_account')
  @Post()
  create(@Body() dto: CashCountDto, @CurrentUser() user: AuthUser) {
    return this.svc.create(dto, user);
  }

  @RequirePermissions('voucher.manage_account')
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Body() dto: CancelCountDto) {
    return this.svc.cancel(id, dto.reason);
  }
}
