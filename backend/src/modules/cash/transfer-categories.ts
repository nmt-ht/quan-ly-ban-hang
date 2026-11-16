/**
 * Loại thu chi hệ thống của chuyển tiền nội bộ (seed: CHI_NOIBO, THU_NOIBO). Phiếu mang các loại này chỉ lập / huỷ qua
 * CashTransfer, và không tính vào thu, chi của báo cáo (chỉ là tiền đổi chỗ, không phải thu nhập hay chi phí).
 */
export const TRANSFER_OUT_CATEGORY = 'Chuyển tiền nội bộ';
export const TRANSFER_IN_CATEGORY = 'Nhận tiền chuyển nội bộ';
export const TRANSFER_CATEGORY_NAMES: ReadonlySet<string> = new Set([TRANSFER_OUT_CATEGORY, TRANSFER_IN_CATEGORY]);
