// Phiếu thu chi theo trang (Pha 1.1). Kỳ, loại thu chi, tài khoản, đối tượng, người lập and số tiền filter in the database;
// the accent-free search (đối tượng by name too) and the sort run here.
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { CashAccountType, PartnerType, Prisma, VoucherKind } from '@prisma/client';
import { foldVi, fromDay } from '../../common/text.js';
import { DAY, slicePage, sortRows } from '../../common/paging.js';
import type { cashToApi } from './cash-voucher.mapper.js';

export const CASH_SORTS = ['code', 'date', 'category', 'partner', 'account', 'amount', 'description', 'createdBy'] as const;

export class CashVoucherPageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5000) pageSize?: number;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsEnum(VoucherKind) kind?: VoucherKind;
  @IsOptional() @IsArray() @IsString({ each: true }) categories?: string[];
  @IsOptional() @IsEnum(CashAccountType) method?: CashAccountType;
  @IsOptional() @IsString() accountId?: string;
  @IsOptional() @IsEnum(PartnerType) partnerType?: PartnerType;
  @IsOptional() @IsString() partnerId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) createdBy?: string[];
  @IsOptional() @Matches(DAY) from?: string;
  @IsOptional() @Matches(DAY) to?: string;
  @IsOptional() @Type(() => Number) @IsNumber() min?: number;
  @IsOptional() @Type(() => Number) @IsNumber() max?: number;
  @IsOptional() @IsIn(['1', 'true']) cancelled?: string;
  @IsOptional() @IsIn(CASH_SORTS as unknown as string[]) sort?: (typeof CASH_SORTS)[number];
  @IsOptional() @IsIn(['asc', 'desc']) dir?: 'asc' | 'desc';
}

/** Every filter except loại thu chi, thu/chi and đã huỷ — the period cards and the loại counts are taken from it. */
export function cashWhere(q: CashVoucherPageQuery): Prisma.CashVoucherWhereInput {
  const and: Prisma.CashVoucherWhereInput[] = [];
  if (q.method) and.push({ account: { type: q.method } });
  if (q.accountId) and.push({ accountId: q.accountId });
  if (q.partnerType) and.push({ partnerType: q.partnerType });
  if (q.partnerId) and.push({ OR: [{ customerId: q.partnerId }, { supplierId: q.partnerId }] });
  if (q.from || q.to) and.push({ date: { ...(q.from ? { gte: fromDay(q.from)! } : {}), ...(q.to ? { lt: new Date(fromDay(q.to)!.getTime() + 86_400_000) } : {}) } });
  if (q.createdBy?.length) and.push({ createdBy: { email: { in: q.createdBy } } });
  if (q.min !== undefined) and.push({ amount: { gte: q.min } });
  if (q.max !== undefined) and.push({ amount: { lte: q.max } });
  return and.length ? { AND: and } : {};
}

/** Phiếu thu chi naming a chứng từ: đối trừ chọn tay to it, or its mã in the diễn giải. */
export function refWhere(ref: string): Prisma.CashVoucherWhereInput {
  return { OR: [{ allocations: { some: { ref } } }, { description: { contains: ref } }] };
}

type ApiCash = ReturnType<typeof cashToApi>;

export interface CashLookups {
  /** Khách hàng and nhà cung cấp: id → "KH0001 · Tên". */
  partners: Map<string, string>;
  accounts: Map<string, { name: string; type: CashAccountType }>;
  users: Map<string, string>;
}

/**
 * One page plus the thẻ tổng of the kỳ (thu / chi by tiền mặt and chuyển khoản, phiếu đã huỷ không tính) and the count
 * per loại thu chi — both over what matched apart from loại, thu/chi and đã huỷ.
 */
export function cashPageOf(all: ApiCash[], q: CashVoucherPageQuery, lk: CashLookups) {
  const text = foldVi((q.q ?? '').trim());
  const partner = (v: ApiCash) => (v.partnerId ? (lk.partners.get(v.partnerId) ?? '—') : '—');
  const matched = text
    ? all.filter((v) => foldVi(`${v.code} ${partner(v)} ${v.description ?? ''} ${v.category}`).includes(text))
    : all;

  const categoryCounts: Record<string, number> = {};
  for (const v of matched) categoryCounts[v.category] = (categoryCounts[v.category] ?? 0) + 1;
  const ofCategory = matched.filter((v) => !q.categories?.length || q.categories.includes(v.category));

  const live = ofCategory.filter((v) => !v.isCancelled);
  const sum = (kind: VoucherKind, type?: CashAccountType) =>
    live.filter((v) => v.kind === kind && (!type || lk.accounts.get(v.accountId)?.type === type)).reduce((s, v) => s + v.amount.toNumber(), 0);
  const thu = sum('THU');
  const chi = sum('CHI');
  const cards = {
    thu, thuCash: sum('THU', 'TIEN_MAT'), thuBank: sum('THU', 'NGAN_HANG'),
    chi, chiCash: sum('CHI', 'TIEN_MAT'), chiBank: sum('CHI', 'NGAN_HANG'), net: thu - chi, count: live.length,
  };

  const rows = ofCategory.filter((v) => (!q.kind || v.kind === q.kind) && (q.cancelled || !v.isCancelled));
  const key: Record<(typeof CASH_SORTS)[number], (v: ApiCash) => string | number> = {
    code: (v) => v.code, date: (v) => v.date, category: (v) => `${v.kind === 'THU' ? 'Phiếu thu' : 'Phiếu chi'} · ${v.category}`, partner,
    account: (v) => lk.accounts.get(v.accountId)?.name ?? v.accountId, amount: (v) => v.amount.toNumber(),
    description: (v) => v.description ?? '', createdBy: (v) => lk.users.get(v.createdBy) ?? v.createdBy,
  };
  const sorted = sortRows(rows, key[q.sort ?? 'code'], q.dir ?? (q.sort ? 'asc' : 'desc'));
  return { ...slicePage(sorted, q.page, q.pageSize), categoryCounts, cards };
}
