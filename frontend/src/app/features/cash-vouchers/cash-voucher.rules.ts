import { CashAccountType, CashVoucher, VoucherKind } from '../../core/models/domain.models';

export type PartnerType = CashVoucher['partnerType'];

export interface CashCategory {
  code: string;
  name: string;
  partnerType: PartnerType;
  hint: string;
}

// Loại thu chi (production /thu-chi/loai): the first of each kind is the default.
export const CASH_CATEGORIES: Record<VoucherKind, CashCategory[]> = {
  THU: [
    { code: 'THU_KH', name: 'Thu tiền khách hàng', partnerType: 'KHACH_HANG', hint: 'Gắn với khách hàng và làm giảm công nợ.' },
    { code: 'THU_KHAC', name: 'Thu khác', partnerType: 'KHAC', hint: 'Không gắn đối tác, chỉ ghi sổ quỹ.' },
  ],
  CHI: [
    { code: 'CHI_NCC', name: 'Chi trả nhà cung cấp', partnerType: 'NHA_CUNG_CAP', hint: 'Gắn với nhà cung cấp và làm giảm công nợ.' },
    { code: 'CHI_KHAC', name: 'Chi khác', partnerType: 'KHAC', hint: 'Không gắn đối tác, chỉ ghi sổ quỹ.' },
  ],
};

export const VOUCHER_PREFIX: Record<VoucherKind, string> = { THU: 'PT', CHI: 'PC' };

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
