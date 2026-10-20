import { Customer, CustomerType } from '../../core/models/domain.models';
import { foldVi } from '../../shared/format.util';

export const CUSTOMER_CODE_PREFIX = 'KH';

export const CUSTOMER_TYPES: { value: CustomerType; label: string; hint: string }[] = [
  { value: 'LE', label: 'Lẻ', hint: 'Áp giá lẻ' },
  { value: 'SI', label: 'Sỉ', hint: 'Áp giá sỉ' },
  { value: 'DROPSHIP', label: 'Dropship', hint: 'Áp giá dropship' },
];

export type CustomerSort = 'name-asc' | 'name-desc' | 'code-asc' | 'newest' | 'revenue' | 'debt';

export const CUSTOMER_SORTS: { value: CustomerSort; label: string }[] = [
  { value: 'name-asc', label: 'Tên A → Z' },
  { value: 'name-desc', label: 'Tên Z → A' },
  { value: 'code-asc', label: 'Mã tăng dần' },
  { value: 'newest', label: 'Mới thêm nhất' },
  { value: 'revenue', label: 'Mua nhiều nhất' },
  { value: 'debt', label: 'Nợ nhiều nhất' },
];

export const creditLabel = (days: number) => (days > 0 ? `${days} ngày` : 'Trả ngay');

/** Tên hiện trên chứng từ: có tên công ty thì dùng tên công ty. */
export const displayName = (c: Pick<Customer, 'name' | 'companyName'>) => c.companyName || c.name;

export const taxCodeOf = (c: Customer) => c.companyTaxCode || c.personalTaxCode || '';

export const PHONE_PATTERN = /^[0-9+().\s-]{8,15}$/;
export const TAX_CODE_PATTERN = /^\d{10}(-\d{3})?$/;
export const ID_NUMBER_PATTERN = /^\d{9}(\d{3})?$/; // CMND 9 số / CCCD 12 số

const digits = (s: string) => s.replace(/\D/g, '');

/** Another customer with the same phone / tax code / name, if any (to warn about duplicates). */
export function duplicateOf(
  list: Customer[], selfId: string | null, key: 'phone' | 'companyTaxCode' | 'name', value: string,
): Customer | undefined {
  const v = key === 'name' ? foldVi(value.trim()) : key === 'phone' ? digits(value) : value.trim();
  if (!v) return undefined;
  return list.find((c) => {
    if (c.id === selfId) return false;
    const other = key === 'name' ? foldVi(c.name) : key === 'phone' ? digits(c.phone ?? '') : (c.companyTaxCode ?? '');
    return other === v;
  });
}
