import { Supplier } from '../../core/models/domain.models';
import { foldVi } from '../../shared/format.util';

export type SupplierSort = 'name-asc' | 'name-desc' | 'code-asc' | 'newest';

export const SUPPLIER_SORTS: { value: SupplierSort; label: string }[] = [
  { value: 'name-asc', label: 'Tên A → Z' },
  { value: 'name-desc', label: 'Tên Z → A' },
  { value: 'code-asc', label: 'Mã tăng dần' },
  { value: 'newest', label: 'Mới thêm nhất' },
];

export const creditLabel = (days: number) => (days > 0 ? `${days} ngày` : 'Trả ngay');

const byName = (a: Supplier, b: Supplier) => a.name.localeCompare(b.name, 'vi');

export function sortSuppliers(rows: Supplier[], sort: SupplierSort): Supplier[] {
  const list = [...rows];
  switch (sort) {
    case 'name-asc': return list.sort(byName);
    case 'name-desc': return list.sort((a, b) => byName(b, a));
    case 'code-asc': return list.sort((a, b) => a.code.localeCompare(b.code));
    case 'newest': return list.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.code.localeCompare(a.code));
  }
}

export const PHONE_PATTERN = /^[0-9+().\s-]{8,15}$/;
export const TAX_CODE_PATTERN = /^\d{10}(-\d{3})?$/; // MST 10 số, chi nhánh thêm "-xxx"

/** Another supplier already using this tax code / name (diacritic-insensitive), if any. */
export function duplicateOf(list: Supplier[], selfId: string | null, key: 'taxCode' | 'name', value: string): Supplier | undefined {
  const v = key === 'name' ? foldVi(value.trim()) : value.trim();
  if (!v) return undefined;
  return list.find((s) => s.id !== selfId && (key === 'name' ? foldVi(s.name) : (s.taxCode ?? '')) === v);
}
