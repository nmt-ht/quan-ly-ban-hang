// Báo cáo dạng bảng: each report is a plain definition (what the screen says about it); the server
// computes its rows (GET /api/reports/:slug, backend modules/reports). The shared <app-table-report>
// owns everything around them — kỳ, cách nhóm, tìm kiếm, KPI, biểu đồ, sắp xếp, phân trang, xuất Excel.

import type { PeriodPreset } from '../../shared/period';

export type ColKind = 'text' | 'money' | 'qty' | 'int' | 'pct' | 'date';

export interface ReportCol {
  key: string;
  label: string;
  kind?: ColKind; // default text
  /** Colour by sign (+ green / − red): money flows, chênh lệch, lãi / lỗ.
   * 'inverse': + red / − green, for figures where up is bad (giá mua tăng). */
  tone?: boolean | 'inverse';
  /** Row field holding the router link of the cell (absent on a row = plain text). */
  link?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ReportRow = Record<string, any> & { id: string };

export interface ReportKpi {
  label: string;
  value: string;
  sub?: string;
  tone?: 'pos' | 'neg';
}

export interface ReportChart {
  title: string;
  items: { label: string; value: number }[];
}

export interface ReportResult {
  columns: ReportCol[];
  rows: ReportRow[];
  /** Footer row; keys match columns. */
  totals?: Record<string, string | number>;
  kpis?: ReportKpi[];
  chart?: ReportChart;
  emptyHint?: string;
}

export type ReportGroupKey = 'sell' | 'profit' | 'stock' | 'buy' | 'make' | 'deliver' | 'debt' | 'cash';

export interface ReportLink {
  label: string;
  path: string;
  query?: Record<string, string>;
}

export interface ReportDef {
  slug: string; // ?name= — slugs as on production (docs/crawl/02-bao-cao.md), not derived from the label
  label: string;
  group: ReportGroupKey;
  summary: string;
  /** period = has Từ ngày / Đến ngày; snapshot = tính tại thời điểm xem; custom = own component; link = lives on another page; soon = not built yet. */
  kind: 'period' | 'snapshot' | 'custom' | 'link' | 'soon';
  groups?: { value: string; label: string }[]; // "Cách nhóm"
  /** The report is about one record the reader picks first (Thẻ kho: one mặt hàng); sent as ?item=. */
  pick?: 'product';
  /** Kỳ the report opens on (default Tháng này) — a price trend needs more than a month. */
  defaultPeriod?: PeriodPreset;
  searchHint?: string;
  notes?: string[]; // definitions printed under the table
  links?: ReportLink[]; // for kind 'link'
}
