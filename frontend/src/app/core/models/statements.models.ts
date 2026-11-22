// Shapes of /api/accounting/statements and /api/accounting/books/journal (backend statements.ts, books.ts).
export interface StatementLineView {
  code: string;
  label: string;
  /** Cấp thụt vào: 0 = mục lớn, 1 = I, II…, 2 = 1., 2.… */
  level: number;
  bold?: boolean;
  /** Số kỳ này (vắng = chỉ tiêu không có số, ví dụ "Trong đó: chi phí lãi vay"). */
  amount?: number;
  prior?: number;
}

export interface FinancialPositionView {
  date: string;
  openingDate: string;
  lines: StatementLineView[];
  balanced: boolean;
  /** TK còn số dư nhưng báo cáo chưa có chỉ tiêu cho nó. */
  unmapped: string[];
}

export interface IncomeStatementTt133View {
  from: string;
  to: string;
  priorFrom: string;
  priorTo: string;
  lines: StatementLineView[];
}

export interface JournalBookView {
  from: string;
  to: string;
  truncated: boolean;
  rows: { id: string; code: string; date: string; description?: string; lines: { accountCode: string; debit: number; credit: number }[] }[];
}
