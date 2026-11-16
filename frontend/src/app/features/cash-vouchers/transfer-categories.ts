/**
 * Loại thu chi hệ thống chỉ lập và huỷ ở màn hình riêng nên không đưa vào danh sách chọn loại của phiếu thu / phiếu chi: chuyển tiền
 * nội bộ (khớp backend cash/transfer-categories.ts) và xử lý chênh lệch kiểm kê quỹ (khớp backend cash/cash-count.rules.ts).
 */
export const TRANSFER_CATEGORY_NAMES: ReadonlySet<string> = new Set([
  'Chuyển tiền nội bộ', 'Nhận tiền chuyển nội bộ',
  'Thiếu quỹ chờ xử lý', 'Thiếu quỹ tính vào chi phí khác', 'Thừa quỹ chờ giải quyết', 'Thừa quỹ tính vào thu nhập khác',
]);
