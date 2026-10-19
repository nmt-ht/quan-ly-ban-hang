import { UnitConversion, UnitOperation } from '../../core/models/domain.models';

export const UNIT_OPERATIONS: { value: UnitOperation; label: string }[] = [
  { value: 'MUL', label: 'Nhân (×)' },
  { value: 'DIV', label: 'Chia (÷)' },
  { value: 'ADD', label: 'Cộng (+)' },
  { value: 'SUB', label: 'Trừ (−)' },
];

export function isPriceShift(op: UnitOperation): boolean {
  return op === 'ADD' || op === 'SUB';
}

// Base units contained in one of this unit — what stock is converted with.
export function ratioFor(op: UnitOperation, factor: number): number {
  if (op === 'MUL') return factor;
  if (op === 'DIV') return factor ? 1 / factor : 0;
  return 1;
}

// Price of one of this unit, derived from the base-unit price.
export function priceFor(op: UnitOperation, factor: number, basePrice: number): number {
  switch (op) {
    case 'MUL': return Math.round(basePrice * factor);
    case 'DIV': return factor ? Math.round(basePrice / factor) : 0;
    case 'ADD': return Math.round(basePrice + factor);
    case 'SUB': return Math.max(0, Math.round(basePrice - factor));
  }
}

const n = (x: number) => x.toLocaleString('vi-VN', { maximumFractionDigits: 4 });

// "1 bó = 12 cái" · "10 lạng = 1 kg" · "1 hộp = 1 cái, giá +5.000 ₫"
export function describe(op: UnitOperation, factor: number, unit: string, baseUnit: string): string {
  const u = unit.trim() || 'đơn vị';
  const b = baseUnit.trim() || 'đơn vị chính';
  if (!factor && !isPriceShift(op)) return '';
  switch (op) {
    case 'MUL': return `1 ${u} = ${n(factor)} ${b}`;
    case 'DIV': return `${n(factor)} ${u} = 1 ${b}`;
    case 'ADD': return `1 ${u} = 1 ${b}, giá cộng thêm ${n(factor)} ₫`;
    case 'SUB': return `1 ${u} = 1 ${b}, giá bớt ${n(factor)} ₫`;
  }
}

// Fills fields missing on rows saved before they existed (older rows only had a retail
// price): operation defaults to ×, missing tier prices are derived from the base prices.
export function normalize(
  u: UnitConversion,
  base: { wholesalePrice: number; dropshipPrice: number },
): Required<UnitConversion> {
  const operation = u.operation ?? 'MUL';
  const factor = u.factor ?? u.ratioToBaseUnit;
  return {
    unitName: u.unitName,
    operation,
    factor,
    ratioToBaseUnit: u.ratioToBaseUnit,
    price: u.price,
    wholesalePrice: u.wholesalePrice ?? priceFor(operation, factor, base.wholesalePrice),
    dropshipPrice: u.dropshipPrice ?? priceFor(operation, factor, base.dropshipPrice),
  };
}
