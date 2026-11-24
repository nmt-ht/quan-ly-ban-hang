// Hợp đồng bán (HDB…) / mua (HDM…): quy tắc thuần, không đụng DB. Ngày là "YYYY-MM-DD".
//  - Hợp đồng bán có một khách hàng, hợp đồng mua có một nhà cung cấp — không bao giờ cả hai.
//  - Chỉ hợp đồng "Đang thực hiện" sửa được và nhận thêm đơn; thanh lý / huỷ là một chiều.
//  - Hợp đồng không ghi sổ, không động tới kho: nó chỉ đo giá trị các đơn gắn vào so với giá trị đã ký.

export type ContractKind = 'BAN' | 'MUA';
export type ContractStatus = 'DANG_THUC_HIEN' | 'DA_THANH_LY' | 'HUY';

/** Hợp đồng còn hiệu lực để sửa và gắn đơn. */
export const isOpen = (status: ContractStatus) => status === 'DANG_THUC_HIEN';

/** Báo trước bao nhiêu ngày thì coi là "sắp hết hạn". */
export const EXPIRING_DAYS = 30;

export function partyIssue(kind: ContractKind, customerId?: string | null, supplierId?: string | null): string | null {
  if (kind === 'BAN') {
    if (!customerId) return 'Chọn khách hàng cho hợp đồng bán.';
    if (supplierId) return 'Hợp đồng bán chỉ có khách hàng, không có nhà cung cấp.';
  } else {
    if (!supplierId) return 'Chọn nhà cung cấp cho hợp đồng mua.';
    if (customerId) return 'Hợp đồng mua chỉ có nhà cung cấp, không có khách hàng.';
  }
  return null;
}

/** Ngày hiệu lực không đảo ngược; giá trị không âm. */
export function termsIssue(t: { startDate?: string | null; endDate?: string | null; value?: number }): string | null {
  if (t.startDate && t.endDate && t.endDate < t.startDate) return 'Ngày hết hiệu lực không được trước ngày bắt đầu.';
  if ((t.value ?? 0) < 0) return 'Giá trị hợp đồng không được âm.';
  return null;
}

export function closeIssue(c: { status: ContractStatus; signedDate: string }, date: string, today: string): string | null {
  if (!isOpen(c.status)) return `Hợp đồng đã ${c.status === 'HUY' ? 'huỷ' : 'thanh lý'} rồi.`;
  if (date < c.signedDate) return 'Ngày thanh lý / huỷ không được trước ngày ký.';
  if (date > today) return 'Ngày thanh lý / huỷ không được sau hôm nay.';
  return null;
}

/**
 * Lý do một đơn không gắn vào hợp đồng này được, hoặc null. `unchanged` = đơn vốn đã gắn hợp đồng này (sửa các phần khác của đơn
 * thì không chặn dù hợp đồng đã thanh lý sau đó).
 */
export function attachIssue(
  c: { code: string; kind: ContractKind; status: ContractStatus; customerId: string | null; supplierId: string | null },
  want: ContractKind, partnerId: string, unchanged: boolean,
): string | null {
  if (c.kind !== want) return `${c.code} là hợp đồng ${c.kind === 'BAN' ? 'bán' : 'mua'}, không gắn được vào đơn ${want === 'BAN' ? 'bán' : 'mua'}.`;
  if ((want === 'BAN' ? c.customerId : c.supplierId) !== partnerId) return `${c.code} là hợp đồng của ${want === 'BAN' ? 'khách hàng' : 'nhà cung cấp'} khác.`;
  if (!unchanged && !isOpen(c.status)) return `${c.code} đã ${c.status === 'HUY' ? 'huỷ' : 'thanh lý'} — không gắn thêm đơn được.`;
  return null;
}

export interface ContractProgress {
  /** Phần trăm giá trị đơn trên giá trị hợp đồng; null khi hợp đồng không ấn định giá trị. */
  percent: number | null;
  remaining: number | null;
  /** Các đơn đã vượt giá trị hợp đồng. */
  over: boolean;
}

export function progressOf(value: number, orderValue: number): ContractProgress {
  if (!(value > 0)) return { percent: null, remaining: null, over: false };
  return { percent: Math.round((orderValue / value) * 1000) / 10, remaining: Math.round(value - orderValue), over: orderValue > value };
}

/** "expired" = quá hạn mà chưa thanh lý; "soon" = còn ≤ EXPIRING_DAYS ngày; chỉ xét hợp đồng đang thực hiện. */
export function expiryOf(endDate: string | null | undefined, status: ContractStatus, today: string): 'none' | 'soon' | 'expired' {
  if (!endDate || !isOpen(status)) return 'none';
  if (endDate < today) return 'expired';
  const days = Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return days <= EXPIRING_DAYS ? 'soon' : 'none';
}
