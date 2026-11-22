import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Injectable, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { vnd } from '../../audit/audit.diff.js';
import { OptionalText } from '../../common/dto.js';
import { documentDay } from '../../common/period-lock.js';
import { fromDay, toDay, vnDay } from '../../common/text.js';
import { LedgerService } from './ledger.service.js';
import { CIT_PERIODS, PERIOD_LABEL, computeCit, lossAvailable, periodEnd, periodOrder, suggestedRate } from './corporate-tax.rules.js';
import type { CitPeriod, PastYear } from './corporate-tax.rules.js';

const num = (d: Prisma.Decimal | null | undefined) => (d ? d.toNumber() : 0);
const r0 = (n: number) => Math.round(n);
const dmy = (d: string) => d.split('-').reverse().join('/');
const dayAfter = (d: string) => new Date(fromDay(d)!.getTime() + 86_400_000);
type Db = Prisma.TransactionClient | PrismaService;

class CreateCitDto {
  @IsInt() @Min(2000) @Max(2100) year!: number;
  @IsIn([...CIT_PERIODS], { message: 'Kỳ phải là Q1, Q2, Q3, Q4 hoặc Y' }) period!: CitPeriod;
  @IsOptional() @IsNumber() @Min(0) @Max(100) rate?: number;
  @IsOptional() @IsNumber() @Min(0) addbacks?: number;
  @IsOptional() @IsNumber() @Min(0) deductions?: number;
  @IsOptional() @IsNumber() @Min(0) lossUsed?: number;
  @OptionalText(300) note?: string;
}

interface CitQuery { year: number; period: CitPeriod; rate?: number; addbacks: number; deductions: number; lossUsed?: number }

/**
 * Thuế TNDN (TT133, as MISA): tạm tính theo quý và quyết toán năm.
 *
 * Mỗi lần tính là LUỸ KẾ từ đầu năm: lợi nhuận kế toán trước thuế (doanh thu trừ chi phí, chưa kể 821, bỏ bút toán kết chuyển)
 * ± điều chỉnh (chi phí không được trừ, thu nhập miễn thuế) − lỗ chuyển (chỉ quyết toán năm) = thu nhập tính thuế; nhân thuế suất
 * rồi trừ thuế đã ghi các kỳ trước ra số ghi kỳ này. Ghi: Nợ 821 / Có 3334 (số âm thì ngược lại). Nộp thuế là phiếu chi loại
 * "Nộp thuế TNDN" (Nợ 3334 / Có 111, 112). Các kỳ theo thứ tự Q1 → Q4 → năm; chỉ huỷ được kỳ gần nhất.
 *
 * Số liệu là hỗ trợ: điều chỉnh tăng giảm, thuế suất và lỗ chuyển do kế toán nhập và chịu trách nhiệm.
 */
@Injectable()
export class CorporateTaxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  /** Doanh thu và lợi nhuận kế toán trước thuế luỹ kế từ 01/01 đến hết `end`. */
  private async figures(db: Db, end: string) {
    const accounts = await db.account.findMany({ where: { isDetail: true, kind: { in: ['DOANH_THU', 'CHI_PHI'] } }, select: { code: true, kind: true } });
    const sums = await db.journalLine.groupBy({
      by: ['accountCode'],
      where: { accountCode: { in: accounts.map((a) => a.code) }, entry: { source: { not: 'CLOSING' }, date: { gte: fromDay(`${end.slice(0, 4)}-01-01`)!, lt: dayAfter(end) } } },
      _sum: { debit: true, credit: true },
    });
    const by = new Map(sums.map((s) => [s.accountCode, num(s._sum.debit) - num(s._sum.credit)]));
    let revenue = 0;
    let expense = 0;
    for (const a of accounts) {
      const net = by.get(a.code) ?? 0; // Nợ − Có
      if (a.kind === 'DOANH_THU') revenue -= net;
      else if (a.code !== '821') expense += net;
    }
    return { revenue: r0(revenue), profit: r0(revenue - expense) };
  }

  private async pastYears(db: Db, year: number): Promise<PastYear[]> {
    const rows = await db.citAssessment.findMany({ where: { period: 'Y', reversedAt: null, year: { lt: year } } });
    return rows.map((r) => ({ year: r.year, beforeLoss: r0(num(r.accountingProfit) + num(r.addbacks) - num(r.deductions)), lossUsed: num(r.lossUsed) }));
  }

  /** Lý do chưa tính được kỳ này (null = được). */
  private async blocker(db: Db, year: number, period: CitPeriod): Promise<string | null> {
    const info = await db.companyInfo.findUnique({ where: { id: 1 }, select: { ledgerStartDate: true } });
    const start = toDay(info?.ledgerStartDate ?? null);
    if (!start) return 'Sổ kế toán chưa bật (Kế toán › Thiết lập).';
    const end = periodEnd(year, period);
    if (end < start) return `Sổ kế toán bắt đầu từ ${dmy(start)}, sau kỳ này.`;
    if (end > vnDay()) return `${PERIOD_LABEL[period]} ${year} chưa kết thúc (đến ${dmy(end)}).`;
    if (await db.fiscalYearClose.findUnique({ where: { year } })) return `Năm ${year} đã đóng sổ: mở lại năm trước khi tính thuế.`;
    const latest = await this.latest(db, year);
    if (latest && periodOrder(latest.period) >= periodOrder(period)) {
      return `Đã tính đến ${PERIOD_LABEL[latest.period as CitPeriod]}: tính kỳ sau đó, hoặc huỷ kỳ ${PERIOD_LABEL[latest.period as CitPeriod]} để tính lại.`;
    }
    return null;
  }

  /** Kỳ gần nhất còn hiệu lực của năm (Q4 và Y cùng ngày cuối kỳ nên xếp theo thứ tự kỳ). */
  private async latest(db: Db, year: number) {
    const all = await db.citAssessment.findMany({ where: { year, reversedAt: null } });
    return all.sort((a, b) => periodOrder(b.period) - periodOrder(a.period))[0] ?? null;
  }

  private async calc(db: Db, q: CitQuery) {
    const end = periodEnd(q.year, q.period);
    const [fig, active, past] = await Promise.all([
      this.figures(db, end),
      db.citAssessment.findMany({ where: { year: q.year, reversedAt: null } }),
      this.pastYears(db, q.year),
    ]);
    const available = lossAvailable(q.year, past);
    const suggested = suggestedRate(q.year, fig.revenue);
    const rate = q.rate ?? suggested;
    const annual = q.period === 'Y';
    const taxPrior = active.reduce((s, a) => s + num(a.taxBooked), 0);
    const res = computeCit({ accountingProfit: fig.profit, addbacks: q.addbacks, deductions: q.deductions, lossRequested: q.lossUsed ?? available, rate, taxPrior, annual });
    return { year: q.year, period: q.period, periodEnd: end, rate, suggestedRate: suggested, revenue: fig.revenue, accountingProfit: fig.profit, addbacks: q.addbacks, deductions: q.deductions, lossAvailable: available, taxPrior, ...res };
  }

  async preview(q: CitQuery) {
    if (!CIT_PERIODS.includes(q.period)) throw new BadRequestException('Chọn kỳ tính thuế.');
    return { ...(await this.calc(this.prisma, q)), blocker: await this.blocker(this.prisma, q.year, q.period) };
  }

  async overview(year: number) {
    const [rows, info, closed, latest, balance, past] = await Promise.all([
      this.prisma.citAssessment.findMany({ where: { year }, orderBy: [{ createdAt: 'asc' }] }),
      this.prisma.companyInfo.findUnique({ where: { id: 1 }, select: { ledgerStartDate: true } }),
      this.prisma.fiscalYearClose.findUnique({ where: { year } }),
      this.latest(this.prisma, year),
      this.prisma.journalLine.aggregate({ where: { accountCode: '3334', entry: { date: { lt: dayAfter(vnDay()) } } }, _sum: { debit: true, credit: true } }),
      this.pastYears(this.prisma, year),
    ]);
    const active = rows.filter((r) => !r.reversedAt);
    const nextIndex = latest ? periodOrder(latest.period) + 1 : 0;
    return {
      year,
      ledgerStartDate: toDay(info?.ledgerStartDate ?? null),
      yearClosed: !!closed,
      assessments: rows.map((r) => ({
        id: r.id, period: r.period, label: PERIOD_LABEL[r.period as CitPeriod], periodEnd: toDay(r.periodEnd)!, rate: num(r.rate), revenue: num(r.revenue),
        accountingProfit: num(r.accountingProfit), addbacks: num(r.addbacks), deductions: num(r.deductions), lossUsed: num(r.lossUsed),
        taxableIncome: num(r.taxableIncome), taxCumulative: num(r.taxCumulative), taxPrior: num(r.taxPrior), taxBooked: num(r.taxBooked),
        note: r.note, createdByName: r.createdByName, createdAt: r.createdAt, reversedAt: r.reversedAt,
        canReverse: !r.reversedAt && r.id === latest?.id && !closed,
      })),
      nextPeriod: nextIndex < CIT_PERIODS.length ? CIT_PERIODS[nextIndex] : null,
      booked: active.reduce((s, a) => s + num(a.taxBooked), 0),
      payable: r0(num(balance._sum.credit) - num(balance._sum.debit)), // số dư 3334 (Có − Nợ)
      lossAvailable: lossAvailable(year, past),
    };
  }

  async create(dto: CreateCitDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const end = periodEnd(dto.year, dto.period);
      await documentDay(tx, end, 'Thuế TNDN');
      const blocker = await this.blocker(tx, dto.year, dto.period);
      if (blocker) throw new BadRequestException(blocker);
      const c = await this.calc(tx, { year: dto.year, period: dto.period, rate: dto.rate, addbacks: dto.addbacks ?? 0, deductions: dto.deductions ?? 0, lossUsed: dto.lossUsed });
      const row = await tx.citAssessment.create({
        data: {
          year: dto.year, period: dto.period, periodEnd: fromDay(end)!, rate: c.rate, revenue: c.revenue, accountingProfit: c.accountingProfit,
          addbacks: c.addbacks, deductions: c.deductions, lossUsed: c.lossUsed, taxableIncome: c.taxableIncome, taxCumulative: c.taxCumulative,
          taxPrior: c.taxPrior, taxBooked: c.taxBooked, note: dto.note ?? null, createdById: user.id, createdByName: user.name,
        },
      });
      if (c.taxBooked !== 0) {
        const amount = Math.abs(c.taxBooked);
        await this.ledger.postEntry(tx, {
          date: end, source: 'CIT', refType: 'CitAssessment', refId: row.id, createdById: user.id,
          description: `Thuế TNDN ${PERIOD_LABEL[dto.period]} ${dto.year}${c.taxBooked < 0 ? ' (điều chỉnh giảm)' : ''}`,
          lines: c.taxBooked > 0 ? [{ accountCode: '821', debit: amount }, { accountCode: '3334', credit: amount }] : [{ accountCode: '3334', debit: amount }, { accountCode: '821', credit: amount }],
        });
      }
      await this.audit.log(tx, {
        action: 'accounting.cit', entityType: 'CitAssessment', entityId: row.id,
        summary: `Thuế TNDN ${PERIOD_LABEL[dto.period]} ${dto.year}: thu nhập tính thuế ${vnd(c.taxableIncome)}, thuế suất ${c.rate}%, thuế luỹ kế ${vnd(c.taxCumulative)}, ghi kỳ này ${vnd(c.taxBooked)}`,
      });
      return { id: row.id, taxBooked: c.taxBooked, taxCumulative: c.taxCumulative };
    });
  }

  /** Huỷ kỳ gần nhất của năm: đảo bút toán 821 / 3334. */
  async reverse(id: string, user: AuthUser) {
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.citAssessment.findUnique({ where: { id } });
      if (!row) throw new NotFoundException('Không tìm thấy lần tính thuế.');
      if (row.reversedAt) throw new BadRequestException('Lần tính thuế này đã huỷ.');
      if (await tx.fiscalYearClose.findUnique({ where: { year: row.year } })) throw new BadRequestException(`Năm ${row.year} đã đóng sổ: mở lại năm trước khi huỷ.`);
      const latest = await this.latest(tx, row.year);
      if (latest?.id !== row.id) throw new BadRequestException(`Chỉ huỷ được kỳ gần nhất (${PERIOD_LABEL[latest!.period as CitPeriod]}).`);
      const day = toDay(row.periodEnd)!;
      await this.ledger.reverseEntriesFor(tx, 'CitAssessment', row.id, { date: day, createdById: user.id, description: `Huỷ tính thuế TNDN ${PERIOD_LABEL[row.period as CitPeriod]} ${row.year}` });
      await tx.citAssessment.update({ where: { id }, data: { reversedAt: new Date(), reversedById: user.id } });
      await this.audit.log(tx, {
        action: 'accounting.reverse_cit', entityType: 'CitAssessment', entityId: row.id,
        summary: `Huỷ tính thuế TNDN ${PERIOD_LABEL[row.period as CitPeriod]} ${row.year} (đã ghi ${vnd(num(row.taxBooked))})`,
      });
    });
    return { ok: true };
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('accounting/cit')
export class CorporateTaxController {
  constructor(private readonly svc: CorporateTaxService) {}

  @RequirePermissions('accounting.view')
  @Get()
  overview(@Query('year') year?: string) {
    return this.svc.overview(Number(year) || Number(vnDay().slice(0, 4)));
  }

  @RequirePermissions('accounting.view')
  @Get('preview')
  preview(
    @Query('year') year?: string, @Query('period') period?: string, @Query('rate') rate?: string,
    @Query('addbacks') addbacks?: string, @Query('deductions') deductions?: string, @Query('lossUsed') lossUsed?: string,
  ) {
    const opt = (v?: string) => (v === undefined || v.trim() === '' || Number.isNaN(Number(v)) ? undefined : Number(v));
    return this.svc.preview({
      year: Number(year) || Number(vnDay().slice(0, 4)), period: (period ?? '') as CitPeriod,
      rate: opt(rate), addbacks: Math.max(0, opt(addbacks) ?? 0), deductions: Math.max(0, opt(deductions) ?? 0), lossUsed: opt(lossUsed),
    });
  }

  @RequirePermissions('accounting.manual')
  @Post()
  @HttpCode(HttpStatus.OK)
  create(@Body() dto: CreateCitDto, @CurrentUser() user: AuthUser) {
    return this.svc.create(dto, user);
  }

  @RequirePermissions('accounting.reverse')
  @Post(':id/reverse')
  @HttpCode(HttpStatus.OK)
  reverse(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.svc.reverse(id, user);
  }
}
