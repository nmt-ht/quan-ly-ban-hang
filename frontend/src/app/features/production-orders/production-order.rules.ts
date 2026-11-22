import { ProductionOrder, ProductionOrderStatus, SalesOrder } from '../../core/models/domain.models';
import { StatusStep, stepsAt } from '../../shared/status-steps/status-steps';

/** Lệnh còn mở (Nháp / Đang sản xuất) mà đơn bán đã quá ngày cần giao. */
export function isLate(x: ProductionOrder, order: Pick<SalesOrder, 'neededByDate'> | { neededByDate?: string | null } | undefined, today: string): boolean {
  return (x.status === 'NHAP' || x.status === 'DANG_SAN_XUAT') && !!order?.neededByDate && order.neededByDate < today;
}

export const canStart = (x: ProductionOrder) => x.status === 'NHAP';
export const canComplete = (x: ProductionOrder) => x.status === 'DANG_SAN_XUAT';
export const canCancelLsx = (x: ProductionOrder) => x.status === 'NHAP' || x.status === 'DANG_SAN_XUAT';

/** Lệnh sản xuất on the stepper: Nháp → Đang sản xuất → Hoàn tất. */
export function productionSteps(status: ProductionOrderStatus): StatusStep[] {
  const labels = ['Nháp', 'Đang sản xuất', 'Hoàn tất'];
  return status === 'HUY' ? stepsAt(labels, -1) : stepsAt(labels, ['NHAP', 'DANG_SAN_XUAT', 'HOAN_TAT'].indexOf(status), { finished: status === 'HOAN_TAT' });
}
