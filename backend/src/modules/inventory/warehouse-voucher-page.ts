// Phiếu kho theo trang (Pha 1.1). Kỳ, kho, người lập, chứng từ gốc and mặt hàng filter in the database; loại (Nhập trả về
// is a phiếu nhập by its lý do), the accent-free search and the sort run here, with the list screen's rules.
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { Prisma } from '@prisma/client';
import { foldVi, fromDay } from '../../common/text.js';
import { DAY, slicePage, sortRows } from '../../common/paging.js';
import type { voucherToApi } from './inventory.service.js';

export const VOUCHER_KINDS = ['NHAP', 'TRA_VE', 'XUAT', 'CHUYEN', 'KIEM_KE'] as const;
type Kind = (typeof VOUCHER_KINDS)[number];
const KIND_LABEL: Record<Kind, string> = { NHAP: 'Nhập kho', TRA_VE: 'Nhập trả về', XUAT: 'Xuất kho', CHUYEN: 'Chuyển kho', KIEM_KE: 'Kiểm kê' };

export const VOUCHER_SORTS = ['code', 'date', 'type', 'warehouse', 'source', 'reason', 'lines', 'qty', 'value', 'createdBy'] as const;

export class WarehouseVoucherPageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5000) pageSize?: number;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsIn(VOUCHER_KINDS as unknown as string[]) kind?: Kind;
  /** A chuyển kho belongs to both its warehouses. */
  @IsOptional() @IsString() warehouseId?: string;
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) createdBy?: string[];
  @IsOptional() @Matches(DAY) from?: string;
  @IsOptional() @Matches(DAY) to?: string;
  @IsOptional() @IsIn(['1', 'true']) cancelled?: string;
  @IsOptional() @IsIn(VOUCHER_SORTS as unknown as string[]) sort?: (typeof VOUCHER_SORTS)[number];
  @IsOptional() @IsIn(['asc', 'desc']) dir?: 'asc' | 'desc';
}

type ApiVoucher = ReturnType<typeof voucherToApi>;

export const kindOf = (v: { type: string; reason: string | null }): Kind =>
  v.type === 'NHAP' && (v.reason ?? '').startsWith('Nhập trả về') ? 'TRA_VE' : (v.type as Kind);

/** Phiếu of a chứng từ gốc: by its id, or (older vouchers) by its mã in the lý do. */
export function relatedWhere(id?: string, code?: string): Prisma.WarehouseVoucherWhereInput {
  return {
    OR: [
      ...(id ? [{ salesOrderId: id }, { purchaseOrderId: id }, { productionOrderId: id }, { deliveryTripId: id }] : []),
      ...(code ? [{ reason: { contains: code } }] : []),
    ],
  };
}

/** What the database can filter on its own. */
export function voucherWhere(q: WarehouseVoucherPageQuery): Prisma.WarehouseVoucherWhereInput {
  const and: Prisma.WarehouseVoucherWhereInput[] = [];
  if (!q.cancelled) and.push({ isCancelled: false });
  if (q.from || q.to) and.push({ date: { ...(q.from ? { gte: fromDay(q.from)! } : {}), ...(q.to ? { lt: new Date(fromDay(q.to)!.getTime() + 86_400_000) } : {}) } });
  if (q.createdBy?.length) and.push({ createdBy: { email: { in: q.createdBy } } });
  if (q.productId) and.push({ lines: { some: { productId: q.productId } } });
  return and.length ? { AND: and } : {};
}

export interface VoucherLookups {
  products: Map<string, { code: string; name: string }>;
  warehouses: Map<string, string>;
  users: Map<string, string>;
  /** id → mã of đơn nhập / đơn bán / lệnh SX / chuyến, for the Chứng từ gốc column. */
  docs: Map<string, string>;
}

const value = (v: ApiVoucher) => v.lines.reduce((s, l) => s + (l.unitPrice ? l.unitPrice.toNumber() : 0) * l.quantity.toNumber(), 0);
const qty = (v: ApiVoucher) => Math.round(v.lines.reduce((s, l) => s + (v.type === 'KIEM_KE' ? l.delta : l.quantity).toNumber(), 0) * 100) / 100;

function sourceText(v: ApiVoucher, lk: VoucherLookups): string {
  const id = v.purchaseOrderId ?? v.salesOrderId ?? v.productionOrderId ?? v.deliveryTripId;
  return id ? (lk.docs.get(id) ?? '') : 'Lập tay';
}

/**
 * One page of phiếu kho plus what the list shows around it: the count per loại (within the chosen kho) for the tabs, the
 * count per kho (within the chosen loại) for the rail, and the giá trị nhập of everything that matched.
 */
export function voucherPageOf(all: ApiVoucher[], q: WarehouseVoucherPageQuery, lk: VoucherLookups) {
  const text = foldVi((q.q ?? '').trim());
  const base = text
    ? all.filter((v) => foldVi([v.code, v.reason ?? '', v.note ?? '', ...v.lines.map((l) => {
      const p = lk.products.get(l.productId);
      return `${p?.code ?? ''} ${p?.name ?? ''}`;
    })].join(' ')).includes(text))
    : all;
  const inWarehouse = (v: ApiVoucher, wh?: string) => !wh || v.warehouseId === wh || v.targetWarehouseId === wh;
  const ofKind = (v: ApiVoucher) => !q.kind || kindOf(v) === q.kind;

  const kindCounts: Partial<Record<Kind, number>> = {};
  for (const v of base) if (inWarehouse(v, q.warehouseId)) kindCounts[kindOf(v)] = (kindCounts[kindOf(v)] ?? 0) + 1;
  const warehouseCounts: Record<string, number> = {};
  for (const v of base.filter(ofKind)) {
    warehouseCounts[v.warehouseId] = (warehouseCounts[v.warehouseId] ?? 0) + 1;
    if (v.targetWarehouseId && v.targetWarehouseId !== v.warehouseId) warehouseCounts[v.targetWarehouseId] = (warehouseCounts[v.targetWarehouseId] ?? 0) + 1;
  }
  const rows = base.filter((v) => inWarehouse(v, q.warehouseId) && ofKind(v));

  const warehouseText = (v: ApiVoucher) => {
    const from = lk.warehouses.get(v.warehouseId) ?? v.warehouseId;
    return v.type === 'CHUYEN' ? `${from} → ${lk.warehouses.get(v.targetWarehouseId ?? '') ?? '—'}` : from;
  };
  const key: Record<(typeof VOUCHER_SORTS)[number], (v: ApiVoucher) => string | number> = {
    code: (v) => v.code, date: (v) => v.date, type: (v) => KIND_LABEL[kindOf(v)], warehouse: warehouseText, source: (v) => sourceText(v, lk),
    reason: (v) => v.reason ?? '', lines: (v) => v.lines.length, qty, value, createdBy: (v) => lk.users.get(v.createdBy) ?? v.createdBy,
  };
  const sorted = sortRows(rows, key[q.sort ?? 'code'], q.dir ?? (q.sort ? 'asc' : 'desc'));
  return {
    ...slicePage(sorted, q.page, q.pageSize),
    kindCounts,
    warehouseCounts,
    allCount: base.filter(ofKind).length,
    totals: { value: rows.filter((v) => !v.isCancelled).reduce((s, v) => s + value(v), 0) },
  };
}
