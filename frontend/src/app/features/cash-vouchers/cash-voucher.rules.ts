import { CashAccountType, CashCategory, CashVoucher, VoucherKind } from '../../core/models/domain.models';

export type PartnerType = CashVoucher['partnerType'];

export const PARTNER_LABEL: Record<PartnerType, string> = { KHACH_HANG: 'Khách hàng', NHA_CUNG_CAP: 'Nhà cung cấp', KHAC: 'Không gắn' };

export function categoryHint(c: Pick<CashCategory, 'partnerType'>): string {
  if (c.partnerType === 'KHACH_HANG') return 'Gắn với khách hàng và làm giảm công nợ.';
  if (c.partnerType === 'NHA_CUNG_CAP') return 'Gắn với nhà cung cấp và làm giảm công nợ.';
  return 'Không gắn đối tác, chỉ ghi sổ quỹ.';
}

export const ACCOUNT_TYPE_LABEL: Record<CashAccountType, string> = { TIEN_MAT: 'Tiền mặt', NGAN_HANG: 'Chuyển khoản' };

// Words that change between phiếu thu and phiếu chi.
export const KIND_TEXT: Record<VoucherKind, {
  title: string; create: string; account: string; partner: string; partnerPick: string; debt: string; debtHint: string;
  descPlaceholder: string; nothingOwed: string; allocHint: string;
}> = {
  THU: {
    title: 'Lập phiếu thu', create: 'Tạo phiếu thu', account: 'Tài khoản nhận tiền', partner: 'Khách hàng',
    partnerPick: 'Chọn khách hàng', debt: 'Công nợ phải thu', debtHint: 'Chọn khách hàng để xem công nợ hiện tại.',
    descPlaceholder: 'VD: Khách thanh toán đợt 1',
    nothingOwed: 'Khách hàng này không còn khoản nợ nào. Toàn bộ số tiền sẽ ghi nhận là trả trước.',
    allocHint: 'Mặc định trừ vào khoản nợ cũ nhất trước. Chọn tay khi khách trả cho đúng một chứng từ cụ thể.',
  },
  CHI: {
    title: 'Lập phiếu chi', create: 'Tạo phiếu chi', account: 'Tài khoản chi tiền', partner: 'Nhà cung cấp',
    partnerPick: 'Chọn nhà cung cấp', debt: 'Công nợ phải trả', debtHint: 'Chọn nhà cung cấp để xem công nợ hiện tại.',
    descPlaceholder: 'VD: trả tiền hàng tháng 9',
    nothingOwed: 'Nhà cung cấp này không còn khoản nợ nào. Toàn bộ số tiền sẽ ghi nhận là trả trước.',
    allocHint: 'Mặc định trừ vào khoản nợ cũ nhất trước. Chọn tay khi mình trả cho đúng một chứng từ cụ thể.',
  },
};

/** Preview of the automatic (oldest due first) allocation of `amount` over open items. */
export function autoAllocate(items: { ref: string; amount: number }[], amount: number): Map<string, number> {
  const out = new Map<string, number>();
  let left = Math.max(0, amount);
  for (const i of items) {
    const used = Math.min(left, i.amount);
    if (used > 0) out.set(i.ref, used);
    left -= used;
  }
  return out;
}
