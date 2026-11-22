// Shapes of /api/accounting/cit (backend src/modules/accounting/corporate-tax.ts).
export type CitPeriod = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Y';

export interface CitAssessmentRow {
  id: string;
  period: CitPeriod;
  label: string;
  periodEnd: string;
  rate: number;
  revenue: number;
  accountingProfit: number;
  addbacks: number;
  deductions: number;
  lossUsed: number;
  taxableIncome: number;
  taxCumulative: number;
  taxPrior: number;
  taxBooked: number;
  note: string | null;
  createdByName: string;
  createdAt: string;
  reversedAt: string | null;
  canReverse: boolean;
}

export interface CitOverview {
  year: number;
  ledgerStartDate: string | null;
  yearClosed: boolean;
  assessments: CitAssessmentRow[];
  nextPeriod: CitPeriod | null;
  /** Thuế đã ghi trong năm (tổng các kỳ còn hiệu lực). */
  booked: number;
  /** Số dư 3334 đến hôm nay: còn phải nộp. */
  payable: number;
  /** Lỗ các năm trước còn chuyển được sang năm này. */
  lossAvailable: number;
}

export interface CitPreview {
  year: number;
  period: CitPeriod;
  periodEnd: string;
  rate: number;
  suggestedRate: number;
  revenue: number;
  accountingProfit: number;
  addbacks: number;
  deductions: number;
  beforeLoss: number;
  lossAvailable: number;
  lossUsed: number;
  taxableIncome: number;
  taxCumulative: number;
  taxPrior: number;
  taxBooked: number;
  /** Lý do chưa ghi được kỳ này (null = ghi được). */
  blocker: string | null;
}

export interface CitInput {
  year: number;
  period: CitPeriod;
  rate?: number;
  addbacks?: number;
  deductions?: number;
  lossUsed?: number;
  note?: string;
}
