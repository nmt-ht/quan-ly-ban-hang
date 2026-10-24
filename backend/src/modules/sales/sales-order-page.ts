// Danh sách đơn hàng bán theo trang (Pha 1.1). The cheap filters (kỳ, thẻ, khách, người bán, người lập) run in the
// database; the ones that need the order's money (giá trị, đã nhận, trễ hẹn) and the accent-free search run here on the
// orders the database returned, with the same rules as the order screen (orderToApi), so totals never drift from it.
// Only the requested page goes to the browser.
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { Prisma, SalesOrderStatus } from '@prisma/client';
import { foldVi, fromDay } from '../../common/text.js';
import { STATUS_LABEL, round4 } from './sales-order.rules.js';
import type { orderToApi } from './sales.service.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const toArray = (value: unknown): string[] | undefined =>
  value === undefined || value === '' ? undefined : Array.isArray(value) ? value.map(String) : typeof value === 'string' ? value.split(',') : undefined;

export const ORDER_SORTS = ['code', 'orderDate', 'customer', 'lines', 'totalOrder', 'receivedValue', 'neededByDate', 'status', 'salesRep'] as const;

export class SalesOrderPageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5000) pageSize?: number;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) status?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) reps?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) createdBy?: string[];
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @Matches(DAY) from?: string;
  @IsOptional() @Matches(DAY) to?: string;
  @IsOptional() @Type(() => Number) @IsNumber() min?: number;
  @IsOptional() @Type(() => Number) @IsNumber() max?: number;
  @IsOptional() @IsIn(['1', 'true']) late?: string;
  @IsOptional() @IsIn(ORDER_SORTS as unknown as string[]) sort?: (typeof ORDER_SORTS)[number];
  @IsOptional() @IsIn(['asc', 'desc']) dir?: 'asc' | 'desc';
}

// Query strings carry lists as "a,b" or repeated keys; normalise before validation.
export function normaliseListQuery(raw: Record<string, unknown>): Record<string, unknown> {
  const out = { ...raw };
  for (const k of ['status', 'tags', 'reps', 'createdBy']) out[k] = toArray(raw[k]);
  return out;
}

type ApiOrder = ReturnType<typeof orderToApi>;

export interface PageLookups {
  customers: Map<string, { code: string; name: string; companyName: string | null; phone: string | null }>;
  products: Map<string, { code: string; name: string; crossRefCode: string | null }>;
  users: Map<string, string>; // email → name
}

/** What the database can filter on its own. */
export function orderWhere(q: SalesOrderPageQuery): Prisma.SalesOrderWhereInput {
  const and: Prisma.SalesOrderWhereInput[] = [];
  if (q.customerId) and.push({ customerId: q.customerId });
  if (q.from || q.to) and.push({ orderDate: { ...(q.from ? { gte: fromDay(q.from)! } : {}), ...(q.to ? { lte: fromDay(q.to)! } : {}) } });
  if (q.tags?.length) and.push({ tags: { some: { tagId: { in: q.tags } } } });
  if (q.reps?.length) and.push({ salesRep: { email: { in: q.reps } } });
  if (q.createdBy?.length) and.push({ createdBy: { email: { in: q.createdBy } } });
  return and.length ? { AND: and } : {};
}

/** Chưa giao xong mà đã quá ngày cần giao — same rule as the list screen. */
export function isLate(o: ApiOrder, today: string): boolean {
  return !!o.neededByDate && o.neededByDate < today && !o.closedDate && o.status !== 'HUY' && o.status !== 'HOAN_THANH'
    && o.status !== 'TRA_TOAN_BO'
    && o.lines.some((l) => round4(l.quantity.toNumber() - l.receivedQuantity.toNumber()) > 0);
}

function searchText(o: ApiOrder, lk: PageLookups): string {
  const c = lk.customers.get(o.customerId);
  const items = o.lines.map((l) => {
    const p = lk.products.get(l.productId);
    return `${p?.code ?? ''} ${p?.name ?? ''} ${p?.crossRefCode ?? ''}`;
  });
  return foldVi([o.code, c?.code ?? '', c?.name ?? '', c?.companyName ?? '', c?.phone ?? '', o.recipientName ?? '', o.recipientPhone ?? '',
    o.description ?? '', o.source ?? '', ...items].join(' '));
}

/**
 * One page of orders plus what the list shows around it: tổng giá trị / đã nhận / chờ giao / số đơn trễ of everything
 * that matched, and the count per trạng thái of what matched apart from the trạng thái filter.
 */
export function pageOf(all: ApiOrder[], q: SalesOrderPageQuery, lk: PageLookups, today: string) {
  const text = foldVi((q.q ?? '').trim());
  const matched = all.filter((o) => {
    if (text && !searchText(o, lk).includes(text)) return false;
    if (q.min !== undefined && o.totalOrder < q.min) return false;
    if (q.max !== undefined && o.totalOrder > q.max) return false;
    if (q.late && !isLate(o, today)) return false;
    return true;
  });
  const statusCounts: Partial<Record<SalesOrderStatus, number>> = {};
  for (const o of matched) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
  const rows = q.status?.length ? matched.filter((o) => q.status!.includes(o.status)) : matched;

  const name = (o: ApiOrder) => {
    const c = lk.customers.get(o.customerId);
    return c ? c.companyName || c.name : o.customerId;
  };
  const key: Record<(typeof ORDER_SORTS)[number], (o: ApiOrder) => string | number> = {
    code: (o) => o.code, orderDate: (o) => o.orderDate, customer: name, lines: (o) => o.lines.length, totalOrder: (o) => o.totalOrder,
    receivedValue: (o) => o.receivedValue, neededByDate: (o) => o.neededByDate ?? '', status: (o) => STATUS_LABEL[o.status],
    salesRep: (o) => lk.users.get(o.salesRep) ?? o.salesRep,
  };
  const sort = q.sort ?? 'code';
  const dir = (q.dir ?? (q.sort ? 'asc' : 'desc')) === 'asc' ? 1 : -1;
  const get = key[sort];
  const sorted = [...rows].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'vi', { numeric: true });
    return c * dir || b.code.localeCompare(a.code);
  });

  const live = rows.filter((o) => o.status !== 'HUY');
  const pageSize = q.pageSize ?? 20;
  const page = Math.max(1, Math.min(q.page ?? 1, Math.max(1, Math.ceil(sorted.length / pageSize))));
  return {
    rows: sorted.slice((page - 1) * pageSize, page * pageSize),
    total: sorted.length,
    page,
    pageSize,
    statusCounts,
    totals: {
      value: live.reduce((s, o) => s + o.totalOrder, 0),
      received: live.reduce((s, o) => s + o.receivedValue, 0),
      // Phần đã kết thúc (khách không lấy) không còn là "chờ giao".
      pending: live.filter((o) => !o.closedDate).reduce((s, o) => s + Math.max(0, o.totalOrder - o.receivedValue), 0),
      late: rows.filter((o) => isLate(o, today)).length,
    },
  };
}
