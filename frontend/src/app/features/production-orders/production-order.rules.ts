import { ProductionOrder, SalesOrder } from '../../core/models/domain.models';

/** Lệnh còn mở (Nháp / Đang sản xuất) mà đơn bán đã quá ngày cần giao. */
export function isLate(x: ProductionOrder, order: SalesOrder | undefined, today: string): boolean {
  return (x.status === 'NHAP' || x.status === 'DANG_SAN_XUAT') && !!order?.neededByDate && order.neededByDate < today;
}

export const canStart = (x: ProductionOrder) => x.status === 'NHAP';
export const canComplete = (x: ProductionOrder) => x.status === 'DANG_SAN_XUAT';
export const canCancelLsx = (x: ProductionOrder) => x.status === 'NHAP' || x.status === 'DANG_SAN_XUAT';
