// Nhập Excel (Pha 1.9): the screens read the sheet and send its cells as they are; the server parses, validates and
// saves each row with the same rules as the form, and answers row by row. A dry run (xem trước) does everything inside a
// transaction that is rolled back, so the preview shows exactly what saving would do — including codes, permissions and
// duplicates — without changing anything.
import { HttpException } from '@nestjs/common';
import { Type, plainToInstance } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsObject, IsOptional, Min, ValidateNested, ValidationError, validate } from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { auditContext } from '../audit/audit.context.js';

type Tx = Prisma.TransactionClient;

export type Cell = string | number | boolean | null | undefined;

export class ImportRowDto {
  /** Số dòng trong file Excel, để báo lỗi. */
  @IsInt() @Min(1) row!: number;
  /** Ô theo khoá cột; cột không có trong file thì không có khoá (khi cập nhật: giữ nguyên). */
  @IsObject() cells!: Record<string, Cell>;
}

export class ImportDto {
  @IsOptional() @IsBoolean() dryRun?: boolean;
  @IsArray() @ArrayMaxSize(5000, { message: 'Tối đa 5.000 dòng mỗi lần nhập' }) @ValidateNested({ each: true }) @Type(() => ImportRowDto)
  rows!: ImportRowDto[];
}

export type ImportAction = 'create' | 'update' | 'unchanged' | 'error';

export interface ImportRowResult {
  row: number;
  action: ImportAction;
  code?: string;
  name?: string;
  /** Cập nhật: nhãn các trường đổi. */
  changes?: string[];
  errors: string[];
}

export interface ImportResult {
  dryRun: boolean;
  rows: ImportRowResult[];
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
}

/** A row the handler refuses, with its reasons. */
export class RowError extends Error {
  constructor(readonly errors: string[]) {
    super(errors.join('; '));
  }
}

/** The row matches what is stored: its savepoint is rolled back (no write, no Nhật ký line) and it counts as unchanged. */
export class UnchangedRow extends Error {
  constructor(readonly code: string, readonly name: string) {
    super('unchanged');
  }
}

class DryRunRollback extends Error {}

/**
 * Each row runs in its own savepoint: a row that fails is rolled back alone and reported, the others go on. A dry run
 * then rolls the whole transaction back. `summarize` writes the one Nhật ký line of a real import.
 */
export async function runImport<R extends { row: number }>(
  prisma: PrismaService,
  dto: { dryRun?: boolean; rows: R[] },
  handle: (tx: Tx, row: R) => Promise<Omit<ImportRowResult, 'row' | 'errors'>>,
  summarize: (tx: Tx, result: ImportResult) => Promise<void>,
): Promise<ImportResult> {
  const dryRun = !!dto.dryRun;
  const rows: ImportRowResult[] = [];
  const result = () => ({
    dryRun, rows,
    created: rows.filter((r) => r.action === 'create').length,
    updated: rows.filter((r) => r.action === 'update').length,
    unchanged: rows.filter((r) => r.action === 'unchanged').length,
    failed: rows.filter((r) => r.action === 'error').length,
  });
  try {
    await prisma.$transaction(async (tx) => {
      for (const r of dto.rows) {
        await tx.$executeRawUnsafe('SAVEPOINT import_row');
        try {
          rows.push({ row: r.row, errors: [], ...(await handle(tx, r)) });
          await tx.$executeRawUnsafe('RELEASE SAVEPOINT import_row');
        } catch (e) {
          await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT import_row');
          if (e instanceof UnchangedRow) rows.push({ row: r.row, action: 'unchanged', code: e.code, name: e.name, errors: [] });
          else rows.push({ row: r.row, action: 'error', errors: errorsOf(e) });
        }
      }
      if (dryRun) throw new DryRunRollback();
      await summarize(tx, result());
    }, { timeout: 120_000, maxWait: 10_000 });
  } catch (e) {
    if (!(e instanceof DryRunRollback)) throw e;
    const ctx = auditContext();
    if (ctx) ctx.readOnly = true;
  }
  return result();
}

function errorsOf(e: unknown): string[] {
  if (e instanceof RowError) return e.errors;
  if (e instanceof HttpException) {
    const body = e.getResponse() as string | { message?: string | string[] };
    const msg = typeof body === 'string' ? body : body.message;
    return Array.isArray(msg) ? msg : [msg ?? e.message];
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return ['Trùng dữ liệu đã có'];
  return ['Không lưu được dòng này'];
}

// ---------- đọc ô ----------

/** Lower-case, no dấu: "Đang theo dõi" → "dang theo doi". */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

export const cellText = (v: Cell): string => (v === null || v === undefined ? '' : String(v).trim());

/** Số thường hoặc kiểu Việt Nam ("1.250.000", "0,45"); null = ô trống, NaN = không phải số. */
export function cellNumber(v: Cell): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  let s = String(v).trim().replace(/\s|₫|đ/gi, '');
  if (!s) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Có / Không (x, 1, true…); ô trống = `fallback`; null = không hiểu. */
export function cellBool(v: Cell, fallback: boolean): boolean | null {
  if (v === null || v === undefined || cellText(v) === '') return fallback;
  if (typeof v === 'boolean') return v;
  const s = fold(cellText(v));
  if (['co', 'x', '1', 'true', 'yes', 'dung', 'dang theo doi', 'con hop tac'].includes(s)) return true;
  if (['khong', '0', 'false', 'no', 'sai', 'ngung theo doi', 'ngung hop tac'].includes(s)) return false;
  return null;
}

/** Check a DTO built from a row with the form's own validators; messages say which column. */
export async function validateRow<T extends object>(cls: new () => T, plain: object, labels: Record<string, string>): Promise<T> {
  const dto = plainToInstance(cls, plain);
  const errs = await validate(dto, { whitelist: true, forbidUnknownValues: false });
  if (errs.length) throw new RowError(errs.flatMap((e) => messagesOf(e, labels)));
  return dto;
}

function messagesOf(e: ValidationError, labels: Record<string, string>): string[] {
  const label = labels[e.property] ?? e.property;
  // An empty required cell fails several checks at once (chuỗi, độ dài…): say it once.
  if ((e.value === undefined || e.value === null || e.value === '') && e.constraints) return [`thiếu ${label}`];
  const out: string[] = [];
  for (const [key, msg] of Object.entries(e.constraints ?? {})) {
    if (key === 'maxLength') out.push(`${label}: quá dài`);
    else if (/^[A-ZÀ-Ỹ]/.test(msg)) out.push(`${label}: ${msg.charAt(0).toLowerCase()}${msg.slice(1)}`);
    else out.push(`${label} không hợp lệ`);
  }
  for (const c of e.children ?? []) out.push(...messagesOf(c, labels));
  return out;
}
