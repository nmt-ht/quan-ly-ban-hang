import {
  BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Injectable, NotFoundException, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, Matches, Max, Min, ValidateNested } from 'class-validator';
import { PayrollCenter, Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SequenceService } from '../../prisma/sequence.service.js';
import { OptionalText, Text } from '../../common/dto.js';
import { fromDay, toDay, vnDay } from '../../common/text.js';
import { AuditService } from '../../audit/audit.service.js';
import { vnd } from '../../audit/audit.diff.js';
import { LedgerService } from './ledger.service.js';
import { CENTER_ACCOUNT, DEFAULT_BRACKETS, PayrollParams, TaxBracket, computePayroll } from './payroll.rules.js';

type Db = Prisma.TransactionClient | PrismaService;
const num = (d: Prisma.Decimal | null | undefined) => (d ? d.toNumber() : 0);
const CENTERS = ['QUAN_LY', 'BAN_HANG', 'SAN_XUAT'] as const;

function monthEnd(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return `${period}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
}

// ---------- DTOs ----------
export class EmployeeDto {
  @Text(120) name!: string;
  @IsIn(CENTERS as unknown as string[]) center!: PayrollCenter;
  @IsNumber() @Min(0) baseSalary!: number;
  @IsOptional() @IsNumber() @Min(0) allowance?: number;
  @IsOptional() @IsNumber() @Min(0) insuranceSalary?: number | null;
  @IsOptional() @IsInt() @Min(0) dependents?: number;
  @IsOptional() @OptionalText(300) note?: string;
}

export class EmployeeUpdateDto {
  @IsOptional() @Text(120) name?: string;
  @IsOptional() @IsIn(CENTERS as unknown as string[]) center?: PayrollCenter;
  @IsOptional() @IsNumber() @Min(0) baseSalary?: number;
  @IsOptional() @IsNumber() @Min(0) allowance?: number;
  @IsOptional() @IsNumber() @Min(0) insuranceSalary?: number | null;
  @IsOptional() @IsInt() @Min(0) dependents?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @OptionalText(300) note?: string;
}

export class BracketDto {
  @IsOptional() @IsNumber() @Min(0) upTo?: number | null;
  @IsNumber() @Min(0) @Max(100) rate!: number;
}

export class PayrollSettingsDto {
  @IsNumber() @Min(0) @Max(100) bhxhEmployee!: number;
  @IsNumber() @Min(0) @Max(100) bhytEmployee!: number;
  @IsNumber() @Min(0) @Max(100) bhtnEmployee!: number;
  @IsNumber() @Min(0) @Max(100) bhxhEmployer!: number;
  @IsNumber() @Min(0) @Max(100) bhytEmployer!: number;
  @IsNumber() @Min(0) @Max(100) bhtnEmployer!: number;
  @IsNumber() @Min(0) @Max(100) kpcd!: number;
  @IsNumber() @Min(0) socialCap!: number;
  @IsNumber() @Min(0) unemploymentCap!: number;
  @IsNumber() @Min(0) personalDeduction!: number;
  @IsNumber() @Min(0) dependentDeduction!: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => BracketDto) brackets!: BracketDto[];
}

export class AdjustmentDto {
  @Text(60) employeeId!: string;
  @IsNumber() amount!: number;
}

export class PayrollPeriodDto {
  @Matches(/^\d{4}-\d{2}$/, { message: 'Kỳ lương phải có dạng YYYY-MM' }) period!: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AdjustmentDto) adjustments?: AdjustmentDto[];
}

/** Kiểm tra biểu thuế: tăng dần, chỉ bậc cuối được để trống cận trên. */
function checkBrackets(b: BracketDto[]): TaxBracket[] {
  if (!b.length) throw new BadRequestException('Biểu thuế cần ít nhất một bậc.');
  let prev = 0;
  return b.map((x, i) => {
    const last = i === b.length - 1;
    if (last) {
      if (x.upTo != null) throw new BadRequestException('Bậc cuối của biểu thuế phải để trống cận trên (không giới hạn).');
    } else {
      if (x.upTo == null) throw new BadRequestException('Chỉ bậc cuối được để trống cận trên.');
      if (x.upTo <= prev) throw new BadRequestException('Cận trên các bậc thuế phải tăng dần.');
      prev = x.upTo;
    }
    return { upTo: x.upTo ?? null, rate: x.rate };
  });
}

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  // ---------- Thiết lập ----------
  private async loadParams(db: Db): Promise<PayrollParams> {
    const s = await db.payrollSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1, brackets: DEFAULT_BRACKETS as unknown as Prisma.InputJsonValue } });
    return {
      bhxhEmployee: num(s.bhxhEmployee), bhytEmployee: num(s.bhytEmployee), bhtnEmployee: num(s.bhtnEmployee),
      bhxhEmployer: num(s.bhxhEmployer), bhytEmployer: num(s.bhytEmployer), bhtnEmployer: num(s.bhtnEmployer),
      kpcd: num(s.kpcd), socialCap: num(s.socialCap), unemploymentCap: num(s.unemploymentCap),
      personalDeduction: num(s.personalDeduction), dependentDeduction: num(s.dependentDeduction),
      brackets: s.brackets as unknown as TaxBracket[],
    };
  }

  settings() {
    return this.loadParams(this.prisma);
  }

  async setSettings(dto: PayrollSettingsDto) {
    const brackets = checkBrackets(dto.brackets);
    const { brackets: _b, ...rest } = dto;
    await this.prisma.$transaction(async (tx) => {
      await tx.payrollSettings.upsert({
        where: { id: 1},
        update: { ...rest, brackets: brackets as unknown as Prisma.InputJsonValue },
        create: { id: 1, ...rest, brackets: brackets as unknown as Prisma.InputJsonValue },
      });
      await this.audit.log(tx, { action: 'payroll.settings', entityType: 'PayrollSettings', entityId: '1', summary: 'Cập nhật thiết lập lương (tỷ lệ bảo hiểm, giảm trừ, biểu thuế TNCN)' });
    });
    return this.settings();
  }

  // ---------- Nhân viên ----------
  private employeeView(e: Prisma.EmployeeGetPayload<object>) {
    return {
      id: e.id, code: e.code, name: e.name, center: e.center, baseSalary: num(e.baseSalary), allowance: num(e.allowance),
      insuranceSalary: e.insuranceSalary ? num(e.insuranceSalary) : null, dependents: e.dependents, isActive: e.isActive, note: e.note,
    };
  }

  async employees() {
    return (await this.prisma.employee.findMany({ orderBy: { code: 'asc' } })).map((e) => this.employeeView(e));
  }

  async createEmployee(dto: EmployeeDto) {
    return this.prisma.$transaction(async (tx) => {
      const code = await this.sequences.nextCode('NV', tx);
      const e = await tx.employee.create({
        data: {
          code, name: dto.name, center: dto.center, baseSalary: dto.baseSalary, allowance: dto.allowance ?? 0,
          insuranceSalary: dto.insuranceSalary ?? null, dependents: dto.dependents ?? 0, note: dto.note ?? null,
        },
      });
      await this.audit.log(tx, { action: 'employee.create', entityType: 'Employee', entityId: e.id, entityCode: code, summary: `Thêm nhân viên ${code} ${dto.name}` });
      return this.employeeView(e);
    });
  }

  async updateEmployee(id: string, dto: EmployeeUpdateDto) {
    return this.prisma.$transaction(async (tx) => {
      const cur = await tx.employee.findUnique({ where: { id } });
      if (!cur) throw new NotFoundException('Không tìm thấy nhân viên.');
      const e = await tx.employee.update({ where: { id }, data: { ...dto } });
      await this.audit.log(tx, { action: 'employee.update', entityType: 'Employee', entityId: id, entityCode: cur.code, summary: `Sửa nhân viên ${cur.code} ${cur.name}` });
      return this.employeeView(e);
    });
  }

  // ---------- Tính lương ----------
  /** Tính bảng lương cho mọi nhân viên đang làm việc, chưa lưu gì. */
  private async compute(db: Db, adjustments: AdjustmentDto[] = []) {
    const params = await this.loadParams(db);
    const adj = new Map(adjustments.map((a) => [a.employeeId, a.amount]));
    const employees = await db.employee.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
    const rows = employees.map((e) => {
      const adjustment = adj.get(e.id) ?? 0;
      const r = computePayroll({
        baseSalary: num(e.baseSalary), allowance: num(e.allowance), insuranceSalary: e.insuranceSalary ? num(e.insuranceSalary) : null,
        dependents: e.dependents, adjustment,
      }, params);
      return { employeeId: e.id, code: e.code, name: e.name, center: e.center, adjustment, ...r };
    });
    return rows;
  }

  private totals(rows: { gross: number; net: number; pit: number; bhxhEe: number; bhytEe: number; bhtnEe: number; bhxhEr: number; bhytEr: number; bhtnEr: number; kpcd: number }[]) {
    const s = (f: (r: (typeof rows)[number]) => number) => rows.reduce((t, r) => t + f(r), 0);
    return {
      gross: s((r) => r.gross), net: s((r) => r.net), pit: s((r) => r.pit),
      employeeInsurance: s((r) => r.bhxhEe + r.bhytEe + r.bhtnEe),
      employerCost: s((r) => r.bhxhEr + r.bhytEr + r.bhtnEr + r.kpcd),
    };
  }

  async preview(dto: PayrollPeriodDto) {
    const rows = await this.compute(this.prisma, dto.adjustments);
    const existing = !!(await this.prisma.payrollRun.findUnique({ where: { period: dto.period }, select: { id: true } }));
    return { period: dto.period, existing, rows, totals: this.totals(rows) };
  }

  async run(dto: PayrollPeriodDto, user: AuthUser) {
    if (dto.period > vnDay().slice(0, 7)) throw new BadRequestException('Chưa tới kỳ lương này.');
    return this.prisma.$transaction(async (tx) => {
      if (await tx.payrollRun.findUnique({ where: { period: dto.period }, select: { id: true } })) {
        throw new BadRequestException(`Kỳ ${dto.period} đã có bảng lương. Huỷ bảng lương cũ nếu cần tính lại.`);
      }
      const rows = await this.compute(tx, dto.adjustments);
      if (!rows.length) throw new BadRequestException('Chưa có nhân viên nào đang làm việc để tính lương.');
      const date = monthEnd(dto.period);
      const run = await tx.payrollRun.create({
        data: {
          period: dto.period, date: fromDay(date)!, createdById: user.id,
          lines: {
            create: rows.map((r) => ({
              employeeId: r.employeeId, center: r.center, gross: r.gross, adjustment: r.adjustment,
              bhxhEe: r.bhxhEe, bhytEe: r.bhytEe, bhtnEe: r.bhtnEe, taxable: r.taxable, pit: r.pit, net: r.net,
              bhxhEr: r.bhxhEr, bhytEr: r.bhytEr, bhtnEr: r.bhtnEr, kpcd: r.kpcd,
            })),
          },
        },
      });

      // Kế toán: (1) tính lương và chi phí bên doanh nghiệp, (2) khấu trừ từ lương nhân viên.
      if (await this.ledger.isLedgerActive(tx, date)) {
        const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((t, r) => t + f(r), 0);
        const expense = new Map<string, number>();
        for (const r of rows) {
          const acc = CENTER_ACCOUNT[r.center];
          expense.set(acc, (expense.get(acc) ?? 0) + r.gross + r.bhxhEr + r.bhytEr + r.bhtnEr + r.kpcd);
        }
        const base = { date, source: 'PAYROLL' as const, refType: 'PayrollRun', refId: run.id, createdById: user.id };
        await this.ledger.postEntry(tx, {
          ...base, description: `Tính lương kỳ ${dto.period}`,
          lines: [
            ...[...expense].map(([accountCode, debit]) => ({ accountCode, debit })),
            { accountCode: '334', credit: sum((r) => r.gross) },
            { accountCode: '3383', credit: sum((r) => r.bhxhEr) },
            { accountCode: '3384', credit: sum((r) => r.bhytEr) },
            { accountCode: '3385', credit: sum((r) => r.bhtnEr) },
            { accountCode: '3382', credit: sum((r) => r.kpcd) },
          ],
        });
        const deductions = sum((r) => r.bhxhEe + r.bhytEe + r.bhtnEe + r.pit);
        if (deductions > 0) {
          await this.ledger.postEntry(tx, {
            ...base, description: `Khấu trừ bảo hiểm và thuế TNCN từ lương kỳ ${dto.period}`,
            lines: [
              { accountCode: '334', debit: deductions },
              { accountCode: '3383', credit: sum((r) => r.bhxhEe) },
              { accountCode: '3384', credit: sum((r) => r.bhytEe) },
              { accountCode: '3385', credit: sum((r) => r.bhtnEe) },
              { accountCode: '3335', credit: sum((r) => r.pit) },
            ],
          });
        }
      }
      const t = this.totals(rows);
      await this.audit.log(tx, {
        action: 'payroll.run', entityType: 'PayrollRun', entityId: run.id, entityCode: dto.period,
        summary: `Chốt bảng lương ${dto.period}: ${rows.length} nhân viên, tổng thu nhập ${vnd(t.gross)}, thực lĩnh ${vnd(t.net)}, thuế TNCN ${vnd(t.pit)}`,
      });
      return { id: run.id, period: dto.period, employees: rows.length, ...t };
    });
  }

  async runs() {
    const runs = await this.prisma.payrollRun.findMany({ orderBy: { period: 'desc' }, include: { lines: true } });
    return runs.map((r) => {
      const rows = r.lines.map((l) => ({
        gross: num(l.gross), net: num(l.net), pit: num(l.pit), bhxhEe: num(l.bhxhEe), bhytEe: num(l.bhytEe), bhtnEe: num(l.bhtnEe),
        bhxhEr: num(l.bhxhEr), bhytEr: num(l.bhytEr), bhtnEr: num(l.bhtnEr), kpcd: num(l.kpcd),
      }));
      return { id: r.id, period: r.period, date: toDay(r.date), employees: rows.length, ...this.totals(rows) };
    });
  }

  async runDetail(period: string) {
    const run = await this.prisma.payrollRun.findUnique({ where: { period }, include: { lines: { include: { employee: { select: { code: true, name: true } } } } } });
    if (!run) throw new NotFoundException('Không có bảng lương của kỳ này.');
    const rows = run.lines
      .map((l) => ({
        employeeId: l.employeeId, code: l.employee.code, name: l.employee.name, center: l.center, adjustment: num(l.adjustment),
        gross: num(l.gross), bhxhEe: num(l.bhxhEe), bhytEe: num(l.bhytEe), bhtnEe: num(l.bhtnEe), taxable: num(l.taxable), pit: num(l.pit), net: num(l.net),
        bhxhEr: num(l.bhxhEr), bhytEr: num(l.bhytEr), bhtnEr: num(l.bhtnEr), kpcd: num(l.kpcd),
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
    return { period, existing: true, rows, totals: this.totals(rows) };
  }

  /** Huỷ bảng lương để tính lại: đảo bút toán đã ghi, xoá bảng lương (nhật ký hoạt động vẫn giữ dấu vết). */
  async cancel(period: string, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.findUnique({ where: { period } });
      if (!run) throw new NotFoundException('Không có bảng lương của kỳ này.');
      const reversed = await this.ledger.reverseEntriesFor(tx, 'PayrollRun', run.id, {
        date: toDay(run.date)!, createdById: user.id, description: `Huỷ bảng lương kỳ ${period}`,
      });
      await tx.payrollRun.delete({ where: { id: run.id } });
      await this.audit.log(tx, {
        action: 'payroll.cancel', entityType: 'PayrollRun', entityId: run.id, entityCode: period,
        summary: `Huỷ bảng lương ${period}${reversed ? ` (đảo ${reversed} bút toán)` : ''}`,
      });
      return { ok: true, period, reversed };
    });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('accounting/employees')
export class EmployeesController {
  constructor(private readonly svc: PayrollService) {}

  @RequirePermissions('accounting.payroll')
  @Get()
  list() {
    return this.svc.employees();
  }

  @RequirePermissions('accounting.payroll')
  @Post()
  create(@Body() dto: EmployeeDto) {
    return this.svc.createEmployee(dto);
  }

  @RequirePermissions('accounting.payroll')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: EmployeeUpdateDto) {
    return this.svc.updateEmployee(id, dto);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('accounting/payroll')
export class PayrollController {
  constructor(private readonly svc: PayrollService) {}

  @RequirePermissions('accounting.payroll')
  @Get('settings')
  settings() {
    return this.svc.settings();
  }

  @RequirePermissions('accounting.payroll')
  @Post('settings')
  @HttpCode(HttpStatus.OK)
  setSettings(@Body() dto: PayrollSettingsDto) {
    return this.svc.setSettings(dto);
  }

  @RequirePermissions('accounting.payroll')
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  preview(@Body() dto: PayrollPeriodDto) {
    return this.svc.preview(dto);
  }

  @RequirePermissions('accounting.payroll')
  @Post('run')
  run(@Body() dto: PayrollPeriodDto, @CurrentUser() user: AuthUser) {
    return this.svc.run(dto, user);
  }

  @RequirePermissions('accounting.payroll')
  @Get('runs')
  runs() {
    return this.svc.runs();
  }

  @RequirePermissions('accounting.payroll')
  @Get('runs/:period')
  runDetail(@Param('period') period: string) {
    return this.svc.runDetail(period);
  }

  @RequirePermissions('accounting.payroll')
  @Post('runs/:period/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('period') period: string, @CurrentUser() user: AuthUser) {
    return this.svc.cancel(period, user);
  }
}
