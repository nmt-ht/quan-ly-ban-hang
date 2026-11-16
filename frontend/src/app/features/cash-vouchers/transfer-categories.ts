/**
 * Loại thu chi hệ thống của chuyển tiền nội bộ (khớp backend cash/transfer-categories.ts). Phiếu mang các loại này chỉ lập và huỷ ở
 * màn hình Chuyển tiền nội bộ, nên không đưa vào danh sách chọn loại của phiếu thu / phiếu chi.
 */
export const TRANSFER_CATEGORY_NAMES: ReadonlySet<string> = new Set(['Chuyển tiền nội bộ', 'Nhận tiền chuyển nội bộ']);
