import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiQuery, queryString } from '../../../core/api/api-query';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { amountTone, foldVi, formatQty, formatVnd } from '../../../shared/format.util';
import { downloadWorkbook, exportFileName } from '../../../shared/excel.util';
import { PERIOD_PRESETS, formatDay, isoDay, presetRange } from '../../../shared/period';
import { PeriodFilterComponent, PeriodValue } from '../../../shared/period-filter/period-filter.component';
import { FrozenColsDirective, identityColumns } from '../../../shared/frozen-cols.directive';
import { ReportCol, ReportDef, ReportResult, ReportRow } from '../report.types';
import { DataStore } from '../../../core/services/data-store.service';
import { SearchOption, SearchSelectComponent } from '../../../shared/search-select/search-select.component';

const PAGE = 100;
type Sort = { key: string; dir: 1 | -1 } | null;

// The shell around every table report: filters (kỳ · cách nhóm · tìm), KPI strip, top-10 chart, a table
// you can sort, "hiện thêm" paging, a totals row, definition notes and Excel export. The rows come from
// GET /api/reports/:slug; nothing here knows about sales, stock or cash.
@Component({
  selector: 'app-table-report',
  standalone: true,
  imports: [SearchSelectComponent, RouterLink, NavIconComponent, PeriodFilterComponent, FrozenColsDirective],
  templateUrl: './table-report.component.html',
  styleUrl: './table-report.component.scss',
})
export class TableReportComponent {
  readonly def = input.required<ReportDef>();
  /** Open on "the last N days" instead of this month (the dashboard's 60-day alert links here). */
  readonly startDays = input<number | null>(null);
  /** The record a pick report opens on (?sp= — Thẻ kho of this mặt hàng). */
  readonly startItem = input<string | null>(null);

  private readonly data = inject(DataStore);

  readonly today = isoDay(new Date());
  readonly period = signal<PeriodValue>({ preset: 'thisMonth', range: presetRange('thisMonth') });
  readonly group = signal('');
  readonly search = signal('');
  /** Picked record for a pick report ('' = none yet). */
  readonly item = signal('');
  readonly sort = signal<Sort>(null);
  readonly limit = signal(PAGE);
  readonly exporting = signal(false);

  readonly money = formatVnd;
  readonly day = formatDay;
  readonly tone = amountTone;

  constructor() {
    // A different report starts from a clean slate.
    effect(() => {
      const d = this.def();
      const n = this.startDays();
      const start = this.startItem();
      untracked(() => {
        this.group.set(d.groups?.[0]?.value ?? '');
        this.item.set(d.pick ? start ?? '' : '');
        this.search.set('');
        this.sort.set(null);
        this.limit.set(PAGE);
        if (n && n > 0) {
          const from = new Date();
          from.setDate(from.getDate() - n);
          this.period.set({ preset: 'custom', range: { from: isoDay(from), to: this.today } });
        } else {
          const preset = d.defaultPeriod ?? 'thisMonth';
          this.period.set({ preset, range: presetRange(preset) });
        }
      });
    });
    effect(() => {
      this.search();
      this.sort();
      this.period();
      this.group();
      this.item();
      untracked(() => this.limit.set(PAGE));
    });
  }

  /** The period actually reported: open start = from the beginning, end never later than today. */
  readonly range = computed(() => {
    const r = this.period().range;
    return { from: r.from ?? '1970-01-01', to: !r.to || r.to > this.today ? this.today : r.to };
  });

  readonly periodLabel = computed(() => {
    const p = this.period();
    return p.preset && p.preset !== 'custom' ? PERIOD_PRESETS.find((x) => x.value === p.preset)?.label ?? '' : '';
  });

  private readonly query = apiQuery<ReportResult>(() => {
    const d = this.def();
    if (d.kind !== 'period' && d.kind !== 'snapshot') return null;
    if (d.pick && !this.item()) return null; // nothing to ask until a record is picked
    const r = this.range();
    const period = d.kind === 'period';
    return `/reports/${d.slug}` + queryString({ from: period ? r.from : null, to: period ? r.to : null, group: this.group() || null, item: this.item() || null });
  }, { columns: [], rows: [] });

  /** Choices of a pick report: mặt hàng with stock (not dịch vụ), by mã. */
  /** Mặt hàng to report on, Mã tăng dần — searchable by mã, mã đối chiếu, tên. */
  readonly pickItems = computed<SearchOption[]>(() =>
    this.def().pick === 'product'
      ? this.data.products().filter((p) => p.type !== 'DICH_VU').sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true }))
        .map((p) => ({ value: p.id, code: p.code, label: p.name, search: p.crossRefCode ?? undefined }))
      : [],
  );
  readonly needsPick = computed(() => !!this.def().pick && !this.item());

  readonly result = this.query.value;
  readonly loading = this.query.loading;
  readonly failure = this.query.error;

  readonly columns = computed(() => this.result().columns);
  /** Mã / Tên stay in view when the table scrolls sideways. */
  readonly frozen = computed(() => identityColumns(this.columns().map((c) => c.key)));

  readonly filtered = computed<ReportRow[]>(() => {
    const q = foldVi(this.search().trim());
    let rows = this.result().rows;
    if (q) rows = rows.filter((r) => Object.entries(r).some(([k, v]) => typeof v === 'string' && k !== 'id' && foldVi(v).includes(q)));
    const s = this.sort();
    if (s) {
      rows = [...rows].sort((a, b) => {
        const x = a[s.key];
        const y = b[s.key];
        const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), 'vi');
        return cmp * s.dir;
      });
    }
    return rows;
  });

  readonly visible = computed(() => this.filtered().slice(0, this.limit()));

  /** Footer figures re-summed over the searched rows when a search narrows the table. */
  readonly totals = computed(() => {
    const t = this.result().totals;
    if (!t) return null;
    if (!this.search().trim()) return t;
    const out: Record<string, string | number> = { ...t };
    for (const c of this.columns()) {
      if (typeof t[c.key] === 'number' && (c.kind === 'money' || c.kind === 'int' || c.kind === 'qty')) {
        out[c.key] = this.filtered().reduce((s, r) => s + (typeof r[c.key] === 'number' ? (r[c.key] as number) : 0), 0);
      }
    }
    return out;
  });

  readonly chartMax = computed(() => Math.max(0, ...(this.result().chart?.items.map((i) => Math.abs(i.value)) ?? [0])));

  toggleSort(c: ReportCol): void {
    this.sort.update((s) => (!s || s.key !== c.key ? { key: c.key, dir: -1 } : s.dir === -1 ? { key: c.key, dir: 1 } : null));
  }

  ariaSort(c: ReportCol): 'ascending' | 'descending' | 'none' {
    const s = this.sort();
    return !s || s.key !== c.key ? 'none' : s.dir === 1 ? 'ascending' : 'descending';
  }

  /** Document and item codes read in mono, as on the list pages. */
  isCode(c: ReportCol): boolean {
    return CODE_KEYS.has(c.key);
  }

  isNumeric(c: ReportCol): boolean {
    return c.kind === 'money' || c.kind === 'qty' || c.kind === 'int' || c.kind === 'pct';
  }

  text(c: ReportCol, v: unknown): string {
    if (v === undefined || v === null || v === '') return '';
    if (typeof v === 'string') return c.kind === 'date' ? formatDay(v) : v;
    switch (c.kind) {
      case 'money': return formatVnd(v as number);
      case 'qty': return formatQty(v as number);
      case 'int': return (v as number).toLocaleString('vi-VN');
      case 'pct': return (v as number).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
      default: return String(v);
    }
  }

  toneClass(c: ReportCol, v: unknown): string {
    if (!c.tone || typeof v !== 'number') return '';
    return amountTone(c.tone === 'inverse' ? -v : v);
  }

  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      const d = this.def();
      const cols = this.columns();
      const fmt = (c: ReportCol) => (c.kind === 'money' || c.kind === 'int' ? '#,##0' : c.kind === 'qty' ? '#,##0.####' : c.kind === 'pct' ? '0.0' : undefined);
      const cell = (c: ReportCol, v: unknown) => (typeof v === 'string' && c.kind === 'date' ? formatDay(v) : v ?? '');
      const rows = this.filtered().map((r) => cols.map((c) => cell(c, r[c.key])));
      const t = this.totals();
      if (t) rows.push(cols.map((c) => cell(c, t[c.key])));
      await downloadWorkbook(exportFileName(`Báo cáo ${d.label}`), [{
        name: d.label.slice(0, 28),
        columns: cols.map((c) => ({ header: c.label, width: this.isNumeric(c) ? 16 : c.key === 'name' ? 34 : 18, numFmt: fmt(c) })),
        rows,
      }]);
    } finally {
      this.exporting.set(false);
    }
  }
}

const CODE_KEYS = new Set(['code', 'voucher', 'order']);
