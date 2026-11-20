// Lệnh sản xuất theo trang (Pha 1.1). Tìm kiếm, lọc theo kỳ / thành phẩm / trễ hạn, sắp xếp và cắt trang chạy ở đây trên
// các hàng đã map (lsxToApi), nên số đếm tab, bộ lọc Thành phẩm và tổng khớp với màn hình Lệnh sản xuất.
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { ProductionOrderStatus } from '@prisma/client';
import { foldVi } from '../../common/text.js';
import { DAY, slicePage, sortRows } from '../../common/paging.js';
import type { lsxToApi } from './sales.service.js';

export const PRODUCTION_SORTS = ['code', 'createdDate', 'product', 'quantity', 'sourceOrder', 'customer', 'needed', 'startDate', 'completeDate', 'status'] as const;

const STATUS_LABEL: Record<ProductionOrderStatus, string> = {
  NHAP: 'Nháp', DANG_SAN_XUAT: 'Đang sản xuất', HOAN_TAT: 'Hoàn tất', HUY: 'Đã huỷ',
};

export class ProductionOrderPageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5000) pageSize?: number;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) status?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) productIds?: string[];
  @IsOptional() @Matches(DAY) from?: string;
  @IsOptional() @Matches(DAY) to?: string;
  /** "1" = chỉ lệnh còn mở đã quá ngày cần giao. */
  @IsOptional() @IsIn(['1']) late?: string;
  @IsOptional() @IsIn(PRODUCTION_SORTS as unknown as string[]) sort?: (typeof PRODUCTION_SORTS)[number];
  @IsOptional() @IsIn(['asc', 'desc']) dir?: 'asc' | 'desc';
}

export type ApiLsx = ReturnType<typeof lsxToApi>;
export interface ProductionLookups {
  products: Map<string, { code: string; name: string; baseUnit: string }>;
}

/** Lệnh còn mở (Nháp / Đang sản xuất) mà đơn bán đã quá ngày cần giao (giống isLate phía frontend). */
export const lsxLate = (x: ApiLsx, today: string): boolean =>
  (x.status === 'NHAP' || x.status === 'DANG_SAN_XUAT') && !!x.sourceOrder.neededByDate && x.sourceOrder.neededByDate < today;

/**
 * Một trang, kèm số đếm theo trạng thái (của phần khớp các lọc khác, trừ trạng thái) và theo thành phẩm (trừ thành phẩm),
 * `late` = tổng lệnh trễ trên toàn bộ lịch sử (không theo lọc), để KPI đúng kể cả khi chưa nạp hết.
 */
export function productionPageOf(all: ApiLsx[], q: ProductionOrderPageQuery, lk: ProductionLookups, today: string) {
  const text = foldVi((q.q ?? '').trim());
  const productText = (x: ApiLsx) => {
    const p = lk.products.get(x.productId);
    return p ? `${p.code} · ${p.name}` : x.productId;
  };
  // Mọi lọc trừ Trạng thái và Thành phẩm — số đếm tab và bộ lọc thành phẩm lấy từ đây.
  const base = all.filter((x) => {
    if (q.from && x.createdDate < q.from) return false;
    if (q.to && x.createdDate > q.to) return false;
    if (q.late === '1' && !lsxLate(x, today)) return false;
    if (text && !foldVi([x.code, productText(x), x.sourceOrder.code, x.sourceOrder.customerName].join(' ')).includes(text)) return false;
    return true;
  });
  const ofProduct = (x: ApiLsx) => !q.productIds?.length || q.productIds.includes(x.productId);
  const ofStatus = (x: ApiLsx) => !q.status?.length || q.status.includes(x.status);

  const statusCounts: Partial<Record<ProductionOrderStatus, number>> = {};
  for (const x of base.filter(ofProduct)) statusCounts[x.status] = (statusCounts[x.status] ?? 0) + 1;
  const productCounts: Record<string, number> = {};
  for (const x of base.filter(ofStatus)) productCounts[x.productId] = (productCounts[x.productId] ?? 0) + 1;

  const rows = base.filter((x) => ofProduct(x) && ofStatus(x));
  const key: Record<(typeof PRODUCTION_SORTS)[number], (x: ApiLsx) => string | number> = {
    code: (x) => x.code, createdDate: (x) => x.createdDate, product: (x) => productText(x), quantity: (x) => Number(x.quantity),
    sourceOrder: (x) => x.sourceOrder.code, customer: (x) => x.sourceOrder.customerName, needed: (x) => x.sourceOrder.neededByDate ?? '',
    startDate: (x) => x.startDate ?? '', completeDate: (x) => x.completeDate ?? '', status: (x) => STATUS_LABEL[x.status],
  };
  const sorted = sortRows(rows, key[q.sort ?? 'code'], q.dir ?? (q.sort ? 'asc' : 'desc'));
  return {
    ...slicePage(sorted, q.page, q.pageSize),
    statusCounts,
    productCounts,
    late: all.filter((x) => lsxLate(x, today)).length,
  };
}
