import { CostService } from '../../core/services/cost.service';
import { MockDataService } from '../../core/services/mock-data.service';

// Báo cáo dạng bảng: each report is a plain definition (metadata + a `run` function). The shared
// <app-table-report> owns everything around it — kỳ, cách nhóm, tìm kiếm, KPI, biểu đồ, sắp xếp,
// phân trang, xuất Excel — so a new report is only "what rows, what columns".

export type ColKind = 'text' | 'money' | 'qty' | 'int' | 'pct' | 'date';

export interface ReportCol {
  key: string;
  label: string;
  kind?: ColKind; // default text
  /** Colour by sign (+ green / − red): money flows, chênh lệch, lãi / lỗ. */
  tone?: boolean;
  /** Router link for the cell, or null for plain text on that row. */
  link?: (row: ReportRow) => unknown[] | null;
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

export interface ReportOptions {
  range: { from: string; to: string };
  group: string;
}

export interface ReportEnv {
  data: MockDataService;
  cost: CostService;
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
  searchHint?: string;
  notes?: string[]; // definitions printed under the table
  links?: ReportLink[]; // for kind 'link'
  run?: (env: ReportEnv, opts: ReportOptions) => ReportResult;
}
