import { CompanyInfo } from '../../core/models/domain.models';

export interface ContactItem {
  label: string;
  value: string;
}

/**
 * Details printed under the company name, every one labelled so the reader never has to guess what a
 * number or address is: Địa chỉ / Mã số thuế · Điện thoại / Email · Website. Empty items and rows are skipped.
 */
export function companyContactRows(c: Pick<CompanyInfo, 'address' | 'taxCode' | 'phone' | 'email' | 'website'>): ContactItem[][] {
  const item = (label: string, value: string | undefined): ContactItem[] => {
    const v = (value ?? '').trim();
    return v ? [{ label, value: v }] : [];
  };
  return [
    item('Địa chỉ', c.address),
    [...item('Mã số thuế', c.taxCode), ...item('Điện thoại', c.phone)],
    [...item('Email', c.email), ...item('Website', c.website)],
  ].filter((row) => row.length > 0);
}
