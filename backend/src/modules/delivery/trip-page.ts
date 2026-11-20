// Chuyến giao hàng theo trang (Pha 1.1). Tìm kiếm (mã chuyến, tài xế, biển số, mã đơn / khách trên chuyến), lọc theo kỳ /
// tài xế / xe / trạng thái, sắp xếp, cắt trang và tổng chạy ở đây trên các hàng đã map (tripToApi), nên khớp màn hình Chuyến.
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { DeliveryTripStatus } from '@prisma/client';
import { foldVi } from '../../common/text.js';
import { DAY, slicePage, sortRows } from '../../common/paging.js';

export const TRIP_SORTS = ['code', 'date', 'driverName', 'plateNumber', 'status', 'orderIds', 'totalValue', 'receivedValue', 'cost'] as const;

const STATUS_LABEL: Record<DeliveryTripStatus, string> = {
  GOM_DON: 'Đang gom đơn', DA_XUAT_KHO: 'Đã xuất kho', XE_VE_KHO: 'Xe đã về kho', HOAN_TAT: 'Hoàn tất', HUY: 'Đã huỷ',
};
/** Tài xế trống gom thành một nhóm (giống frontend). */
export const NO_DRIVER = '(Chưa có tài xế)';
/** Giá trị lọc "xe thuê ngoài" (chuyến không gắn xe công ty). */
const HIRED = 'hired';

export class DeliveryTripPageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5000) pageSize?: number;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) status?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) drivers?: string[];
  /** id xe công ty, "hired" (xe thuê ngoài) hoặc bỏ trống / "all" (mọi xe). */
  @IsOptional() @IsString() vehicle?: string;
  @IsOptional() @Matches(DAY) from?: string;
  @IsOptional() @Matches(DAY) to?: string;
  @IsOptional() @IsIn(TRIP_SORTS as unknown as string[]) sort?: (typeof TRIP_SORTS)[number];
  @IsOptional() @IsIn(['asc', 'desc']) dir?: 'asc' | 'desc';
}

interface PageTrip {
  code: string;
  date: string;
  status: DeliveryTripStatus;
  vehicleId?: string | null;
  plateNumber?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  note?: string | null;
  orderIds: string[];
  confirmedCount: number;
  totalValue: number;
  receivedValue: number;
  costs: { fuel: number; toll: number; other: number };
}

export interface TripLookups {
  /** mã đơn + tên khách của mỗi đơn trên chuyến, để tìm kiếm. */
  orders: Map<string, { code: string; customer: string }>;
}

const costOf = (c: { fuel: number; toll: number; other: number }) => c.fuel + c.toll + c.other;
const driverOf = (t: PageTrip) => t.driverName || NO_DRIVER;

export function tripPageOf<T extends PageTrip>(all: T[], q: DeliveryTripPageQuery, lk: TripLookups) {
  const text = foldVi((q.q ?? '').trim());
  // Mọi lọc trừ Trạng thái — số đếm trạng thái lấy từ đây; số đếm tài xế lấy trên toàn bộ (giống màn hình).
  const matched = all.filter((t) => {
    if (text) {
      const orders = t.orderIds.map((id) => {
        const o = lk.orders.get(id);
        return `${o?.code ?? ''} ${o?.customer ?? ''}`;
      });
      if (!foldVi([t.code, t.driverName ?? '', t.driverPhone ?? '', t.plateNumber ?? '', t.note ?? '', ...orders].join(' ')).includes(text)) return false;
    }
    if (q.from && t.date < q.from) return false;
    if (q.to && t.date > q.to) return false;
    if (q.drivers?.length && !q.drivers.includes(driverOf(t))) return false;
    if (q.vehicle === HIRED && t.vehicleId) return false;
    if (q.vehicle && q.vehicle !== 'all' && q.vehicle !== HIRED && t.vehicleId !== q.vehicle) return false;
    return true;
  });

  const statusCounts: Partial<Record<DeliveryTripStatus, number>> = {};
  for (const t of matched) statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;
  const driverCounts: Record<string, number> = {};
  for (const t of all) driverCounts[driverOf(t)] = (driverCounts[driverOf(t)] ?? 0) + 1;

  const rows = q.status?.length ? matched.filter((t) => q.status!.includes(t.status)) : matched;
  const key: Record<(typeof TRIP_SORTS)[number], (t: T) => string | number> = {
    code: (t) => t.code, date: (t) => t.date, driverName: (t) => driverOf(t), plateNumber: (t) => t.plateNumber ?? '',
    status: (t) => STATUS_LABEL[t.status], orderIds: (t) => t.orderIds.length, totalValue: (t) => t.totalValue,
    receivedValue: (t) => t.receivedValue, cost: (t) => costOf(t.costs),
  };
  const sorted = sortRows(rows, key[q.sort ?? 'code'], q.dir ?? 'asc');
  const live = rows.filter((t) => t.status !== 'HUY');
  return {
    ...slicePage(sorted, q.page, q.pageSize),
    statusCounts,
    driverCounts,
    totals: {
      value: live.reduce((s, t) => s + t.totalValue, 0),
      received: live.reduce((s, t) => s + t.receivedValue, 0),
      cost: live.reduce((s, t) => s + costOf(t.costs), 0),
      pending: live.filter((t) => t.status === 'DA_XUAT_KHO').reduce((s, t) => s + (t.orderIds.length - t.confirmedCount), 0),
    },
  };
}
