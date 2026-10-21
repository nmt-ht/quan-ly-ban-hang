import { DeliveryTrip, Vehicle, VehicleStatus, VehicleType } from '../../core/models/domain.models';

export const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: 'XE_TAI', label: 'Xe tải' },
  { value: 'XE_VAN', label: 'Xe van / bán tải' },
  { value: 'XE_BA_GAC', label: 'Xe ba gác' },
  { value: 'XE_MAY', label: 'Xe máy' },
  { value: 'KHAC', label: 'Khác' },
];
export const VEHICLE_TYPE_LABEL = Object.fromEntries(VEHICLE_TYPES.map((t) => [t.value, t.label])) as Record<VehicleType, string>;

export const VEHICLE_STATUSES: { value: VehicleStatus; label: string }[] = [
  { value: 'DANG_DUNG', label: 'Đang dùng' },
  { value: 'BAO_TRI', label: 'Bảo trì' },
  { value: 'NGUNG_DUNG', label: 'Ngừng dùng' },
];
export const VEHICLE_STATUS_LABEL = Object.fromEntries(VEHICLE_STATUSES.map((t) => [t.value, t.label])) as Record<VehicleStatus, string>;

/** Chuyến đang dùng xe (gom đơn / đã xuất kho) — suy ra từ chuyến, không lưu trên xe. */
export function currentTripOf(v: Vehicle, trips: DeliveryTrip[]): DeliveryTrip | undefined {
  return trips.find((t) => t.vehicleId === v.id && (t.status === 'GOM_DON' || t.status === 'DA_XUAT_KHO'));
}

export const EXPIRY_WARN_DAYS = 30;

export interface ExpiryState {
  level: 'ok' | 'soon' | 'expired' | 'none';
  days: number; // còn bao nhiêu ngày (âm = đã quá)
  label: string;
}

/** Hạn đăng kiểm / bảo hiểm: quá hạn → đỏ, còn ≤ 30 ngày → vàng. */
export function expiryState(date: string | undefined, today: string): ExpiryState {
  if (!date) return { level: 'none', days: 0, label: 'Chưa khai' };
  const days = Math.round((new Date(date.slice(0, 10)).getTime() - new Date(today).getTime()) / 86_400_000);
  if (days < 0) return { level: 'expired', days, label: `Quá hạn ${-days} ngày` };
  if (days <= EXPIRY_WARN_DAYS) return { level: 'soon', days, label: days === 0 ? 'Hết hạn hôm nay' : `Còn ${days} ngày` };
  return { level: 'ok', days, label: `Còn ${days} ngày` };
}

export const vehicleLabel = (v: Pick<Vehicle, 'plateNumber' | 'name' | 'type'>) =>
  `${v.plateNumber} · ${v.name || VEHICLE_TYPE_LABEL[v.type]}`;
