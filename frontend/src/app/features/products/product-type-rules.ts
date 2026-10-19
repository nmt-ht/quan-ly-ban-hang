// What each Tính chất allows on a product (mirrors the production form).
import { MeasureMode, ProductType } from '../../core/models/domain.models';

export const MEASURE_UNIT: Record<MeasureMode, string> = { AREA: 'm2', LENGTH: 'm' };

export const MEASURE_MODES: { value: MeasureMode; label: string; unitLong: string; unitShort: string; bomUnit: string }[] = [
  { value: 'AREA', label: 'Mét vuông (dài × rộng)', unitLong: 'mét vuông', unitShort: 'm²', bomUnit: 'm²' },
  { value: 'LENGTH', label: 'Mét dài (chiều dài)', unitLong: 'mét dài', unitShort: 'm', bomUnit: 'mét' },
];

// Only Vật tư is counted in a warehouse: Thành phẩm is cut per order, Dịch vụ has nothing to move.
export function tracksStock(type: ProductType): boolean {
  return type === 'VAT_TU';
}

// Thành phẩm has exactly one unit (m2 / m), so no Đơn vị quy đổi.
export function allowsUnitConversions(type: ProductType): boolean {
  return type !== 'THANH_PHAM';
}

// Legacy rows have no measureMode; infer it from the unit when that is unambiguous.
export function inferMeasureMode(baseUnit: string): MeasureMode | null {
  const u = baseUnit.trim().toLowerCase();
  if (u === 'm2' || u === 'm²') return 'AREA';
  if (u === 'm' || u === 'md' || u === 'mét') return 'LENGTH';
  return null;
}
