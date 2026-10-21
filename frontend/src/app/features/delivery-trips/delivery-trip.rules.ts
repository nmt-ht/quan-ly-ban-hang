import { DeliveryTrip, DeliveryTripStatus, SalesOrder, TripCosts } from '../../core/models/domain.models';
import { lineRemaining, orderTotals } from '../sales-orders/sales-order.rules';

// Chuyến giao hàng: Đang gom đơn → (Xuất kho một lượt) Đã xuất kho → (chốt giao từng đơn)
// → (Xe về kho: nhập lại hàng khách không nhận) Xe đã về kho → Hoàn tất. Huỷ chỉ khi chưa xuất kho.

export const ACTIVE_TRIP: DeliveryTripStatus[] = ['GOM_DON', 'DA_XUAT_KHO'];
export const isActiveTrip = (t: DeliveryTrip | undefined) => !!t && ACTIVE_TRIP.includes(t.status);

export const canEditHeader = (t: DeliveryTrip) => t.status === 'GOM_DON' || t.status === 'DA_XUAT_KHO';
export const canArrange = (t: DeliveryTrip) => t.status === 'GOM_DON';
export const canShip = (t: DeliveryTrip) => t.status === 'GOM_DON' && t.orderIds.length > 0;
export const canConfirm = (t: DeliveryTrip) => t.status === 'DA_XUAT_KHO';
export const canReturn = (t: DeliveryTrip) => t.status === 'DA_XUAT_KHO' && t.orderIds.every((id) => isConfirmed(t, id));
export const canComplete = (t: DeliveryTrip) => t.status === 'XE_VE_KHO';
export const canCancel = (t: DeliveryTrip) => t.status === 'GOM_DON';
export const canEditCosts = (t: DeliveryTrip) => t.status !== 'HUY';

export const isConfirmed = (t: DeliveryTrip, orderId: string) => !!t.confirmations?.some((c) => c.orderId === orderId);
export const costTotal = (c: TripCosts | undefined) => (c ? (c.fuel || 0) + (c.toll || 0) + (c.other || 0) : 0);

/** Đơn xếp được lên chuyến: còn hàng phải giao, chưa kết thúc, không nằm trên chuyến đang chạy khác. */
export function canLoadOrder(o: SalesOrder, tripOf: (id: string | undefined) => DeliveryTrip | undefined): boolean {
  if (o.status !== 'CHO_GIAO_HANG' && o.status !== 'GIAO_MOT_PHAN') return false;
  if (o.closedDate || !o.lines.some((l) => lineRemaining(l) > 0)) return false;
  return !isActiveTrip(tripOf(o.tripId));
}

/** Phải thu cho 1 ĐVT của từng dòng (sau chiết khấu, gồm thuế). */
export function unitValues(o: SalesOrder): number[] {
  const t = orderTotals(o.lines, o.discountAmount);
  return o.lines.map((l, i) => (l.quantity > 0 ? t.lines[i].total / l.quantity : 0));
}

/** Giá trị phần còn phải giao của đơn (để ước giá trị chuyến khi còn đang gom đơn). */
export function remainingValue(o: SalesOrder): number {
  const v = unitValues(o);
  return Math.round(o.lines.reduce((s, l, i) => s + lineRemaining(l) * v[i], 0));
}
