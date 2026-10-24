// Báo cáo dạng bảng, as the frontend's <app-table-report> shows them. The screen owns kỳ, cách nhóm,
// tìm kiếm, sắp xếp, phân trang and xuất Excel; the server answers "what rows, what columns".
import type { ReportData } from './report-data.service.js';
import type { CostBook } from './report.rules.js';

export type ColKind = 'text' | 'money' | 'qty' | 'int' | 'pct' | 'date';

export interface ReportCol {
  key: string;
  label: string;
  kind?: ColKind; // default text
  /** Colour by sign (+ green / − red).
   * 'inverse': + red / − green, for figures where up is bad (giá mua tăng). */
  tone?: boolean | 'inverse';
  /** Row field holding the router link of the cell (null on a row = plain text). */
  link?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ReportRow = Record<string, any> & { id: string };

export interface ReportResult {
  columns: ReportCol[];
  rows: ReportRow[];
  totals?: Record<string, string | number>;
  kpis?: { label: string; value: string; sub?: string; tone?: 'pos' | 'neg' }[];
  chart?: { title: string; items: { label: string; value: number }[] };
  emptyHint?: string;
}

export interface ReportOptions {
  range: { from: string; to: string };
  group: string;
  /** The one record a report is about (Thẻ kho: a mặt hàng id); '' when none is picked. */
  item: string;
}

export interface ReportEnv {
  data: ReportData;
  cost: CostBook;
}

export type ReportGroupKey = 'sell' | 'profit' | 'stock' | 'buy' | 'make' | 'deliver' | 'debt' | 'cash';

export interface ReportDef {
  slug: string; // ?name= on the screen
  group: ReportGroupKey;
  /** Cách nhóm the report accepts; the first is the default. */
  groups?: string[];
  run: (env: ReportEnv, opts: ReportOptions) => ReportResult;
}

/** Who may run a report of each group (the screen hides the others). */
export const GROUP_PERMISSION: Record<ReportGroupKey, string> = {
  sell: 'report.sales',
  profit: 'report.view_profit',
  stock: 'report.stock',
  buy: 'report.purchase',
  make: 'report.production',
  deliver: 'report.delivery',
  debt: 'report.debt',
  cash: 'report.cashflow',
};
