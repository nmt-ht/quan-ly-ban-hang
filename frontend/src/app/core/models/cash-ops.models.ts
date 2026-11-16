// Chuyển tiền nội bộ, kiểm kê quỹ, đối chiếu sao kê và lưu chuyển tiền tệ — dạng server trả về (khoá null bị bỏ nên trường có thể vắng).

export interface CashTransferView {
  id: string;
  code: string;
  date: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amount: number;
  description?: string;
  outVoucherCode: string;
  inVoucherCode: string;
  isCancelled: boolean;
  cancelReason?: string;
}

export interface CashTransferInput {
  fromAccountId: string;
  toAccountId: string;
  date: string;
  amount: number;
  description?: string;
}

export interface Denomination {
  value: number;
  count: number;
}

export interface CashCountView {
  id: string;
  code: string;
  date: string;
  accountId: string;
  accountName: string;
  bookAmount: number;
  countedAmount: number;
  difference: number; // thực tế − sổ sách: dương = thừa quỹ
  denominations: Denomination[];
  countedBy?: string;
  note?: string;
  isCancelled: boolean;
  cancelReason?: string;
  createdBy: string;
  /** Xử lý chênh lệch: CHO_XU_LY (Nợ 1381 / Có 3381) hoặc TINH_VAO_KET_QUA (811 / 711), kèm số phiếu thu / chi đã lập. */
  resolution?: CountResolution;
  resolutionVoucherCode?: string;
}

export type CountResolution = 'CHO_XU_LY' | 'TINH_VAO_KET_QUA';

export interface CashCountInput {
  accountId: string;
  date: string;
  denominations: Denomination[];
  countedBy?: string;
  note?: string;
}

export interface StatementLineView {
  id: string;
  date: string;
  description?: string;
  reference?: string;
  amountIn: number;
  amountOut: number;
  voucherId?: string;
  voucherCode?: string;
}

export interface ReconVoucherView {
  id: string;
  code: string;
  date: string;
  kind: 'THU' | 'CHI';
  amount: number;
  category: string;
  description?: string;
  matched: boolean;
}

export interface ReconciliationView {
  account: { id: string; name: string; bankName?: string; accountNumber?: string };
  from: string;
  to: string;
  bookBalance: number;
  lines: StatementLineView[];
  vouchers: ReconVoucherView[];
  summary: { lines: number; matched: number; unmatchedLines: number; unmatchedVouchers: number; unmatchedLinesNet: number; unmatchedVouchersNet: number };
}

export interface StatementRowInput {
  date: string;
  description?: string;
  reference?: string;
  amountIn?: number;
  amountOut?: number;
}

export interface CashFlowItem {
  code: string;
  label: string;
  amount: number;
  total: boolean;
  detail: { account: string; amount: number }[];
}

export interface CashFlowView {
  from: string;
  to: string;
  items: CashFlowItem[];
  net: number;
  opening: number;
  closing: number;
  check: { ledgerClosing: number; difference: number };
}
