// Shapes of /api/accounting/closing (backend src/modules/accounting/period-closing.ts).
export interface ClosingPreviewView {
  date: string;
  accounts: { code: string; name: string; kind: 'DOANH_THU' | 'CHI_PHI'; amount: number }[];
  revenue: number;
  expense: number;
  profit: number;
}

export interface PeriodClosingRow {
  id: string;
  date: string;
  profit: number;
  createdByName: string;
  createdAt: string;
  reversedAt: string | null;
  canReverse: boolean;
}

export interface ClosingOverview {
  year: number;
  ledgerStartDate: string | null;
  lockDate: string | null;
  closings: PeriodClosingRow[];
  lastClosedDate: string | null;
  yearClose: { year: number; profit: number; closedByName: string; closedAt: string } | null;
  citAssessed: boolean;
  previousYearClosed: boolean;
  nextYearClosed: boolean;
  /** Lý do chưa đóng sổ được năm (null = đóng được). */
  yearBlocker: string | null;
}
