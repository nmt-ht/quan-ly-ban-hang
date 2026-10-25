// Đơn nhập hàng theo trang (Pha 1.1). Nhà cung cấp, kỳ and người lập filter in the database; giá trị, the accent-free
// search and the sort run here on orderToApi's numbers, so totals match the order screen.
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { foldVi, fromDay } from '../../common/text.js';
import { DAY, slicePage, sortRows } from '../../common/paging.js';
import { STATUS_LABEL } from './purchase-order.rules.js';

export const PURCHASE_SORTS = ['code', 'date', 'supplier', 'lines', 'totalValue', 'receivedValue', 'status', 'createdBy'] as const;

export class PurchaseOrderPageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5000) pageSize?: number;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) status?: string[];
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) createdBy?: string[];
  @IsOptional() @Matches(DAY) from?: string;
  @IsOptional() @Matches(DAY) to?: string;
  @IsOptional() @Type(() => Number) @IsNumber() min?: number;
  @IsOptional() @Type(() => Number) @IsNumber() max?: number;
  @IsOptional() @IsIn(PURCHASE_SORTS as unknown as string[]) sort?: (typeof PURCHASE_SORTS)[number];
  @IsOptional() @IsIn(['asc', 'desc']) dir?: 'asc' | 'desc';
}

/** Still waiting on the supplier or on the Hoàn tất step: always loaded, whatever its date. */
export const OPEN_STATUSES: PurchaseOrderStatus[] = ['NHAP', 'DA_GUI_NCC', 'NHAN_MOT_PHAN', 'DA_NHAN_DU'];

export function purchaseWhere(q: PurchaseOrderPageQuery): Prisma.PurchaseOrderWhereInput {
  const and: Prisma.PurchaseOrderWhereInput[] = [];
  if (q.supplierId) and.push({ supplierId: q.supplierId });
  if (q.from || q.to) and.push({ date: { ...(q.from ? { gte: fromDay(q.from)! } : {}), ...(q.to ? { lte: fromDay(q.to)! } : {}) } });
  if (q.createdBy?.length) and.push({ createdBy: { email: { in: q.createdBy } } });
  return and.length ? { AND: and } : {};
}

interface PageOrder {
  code: string;
  date: string;
  status: PurchaseOrderStatus;
  supplierId: string;
  note: string | null;
  createdBy: string;
  totalValue: number | null;
  receivedValue: number | null;
  lines: { productId: string }[];
}

export interface PurchaseLookups {
  suppliers: Map<string, { code: string; name: string }>;
  products: Map<string, { code: string; name: string; crossRefCode: string | null }>;
  users: Map<string, string>;
}

/** One page plus the count per trạng thái (of what matched apart from it) and the money of everything that matched. */
export function purchasePageOf<O extends PageOrder>(all: O[], q: PurchaseOrderPageQuery, lk: PurchaseLookups) {
  const text = foldVi((q.q ?? '').trim());
  const matched = all.filter((o) => {
    if (text) {
      const s = lk.suppliers.get(o.supplierId);
      const items = o.lines.map((l) => {
        const p = lk.products.get(l.productId);
        return `${p?.code ?? ''} ${p?.name ?? ''} ${p?.crossRefCode ?? ''}`;
      });
      if (!foldVi([o.code, s?.code ?? '', s?.name ?? '', o.note ?? '', ...items].join(' ')).includes(text)) return false;
    }
    // Giá trị is null for roles without giá nhập: the range filter does not apply to them.
    if (q.min !== undefined && o.totalValue !== null && o.totalValue < q.min) return false;
    if (q.max !== undefined && o.totalValue !== null && o.totalValue > q.max) return false;
    return true;
  });
  const statusCounts: Partial<Record<PurchaseOrderStatus, number>> = {};
  for (const o of matched) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
  const rows = q.status?.length ? matched.filter((o) => q.status!.includes(o.status)) : matched;

  const key: Record<(typeof PURCHASE_SORTS)[number], (o: O) => string | number> = {
    code: (o) => o.code, date: (o) => o.date, supplier: (o) => lk.suppliers.get(o.supplierId)?.name ?? o.supplierId, lines: (o) => o.lines.length,
    totalValue: (o) => o.totalValue ?? 0, receivedValue: (o) => o.receivedValue ?? 0, status: (o) => STATUS_LABEL[o.status],
    createdBy: (o) => lk.users.get(o.createdBy) ?? o.createdBy,
  };
  const sorted = sortRows(rows, key[q.sort ?? 'code'], q.dir ?? (q.sort ? 'asc' : 'desc'));
  const live = rows.filter((o) => o.status !== 'HUY');
  return {
    ...slicePage(sorted, q.page, q.pageSize),
    statusCounts,
    totals: {
      value: live.reduce((s, o) => s + (o.totalValue ?? 0), 0),
      received: live.reduce((s, o) => s + (o.receivedValue ?? 0), 0),
    },
  };
}
