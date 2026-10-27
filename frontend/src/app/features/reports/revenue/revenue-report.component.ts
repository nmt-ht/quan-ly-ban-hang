import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataStore } from '../../../core/services/data-store.service';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { PeriodFilterComponent, PeriodValue } from '../../../shared/period-filter/period-filter.component';
import { amountTone, foldVi, formatQty, formatVnd } from '../../../shared/format.util';
import { PERIOD_PRESETS, formatDay, inRange, isoDay, presetRange, rangeLabel } from '../../../shared/period';
import { downloadWorkbook, exportFileName } from '../../../shared/excel.util';
import { apiQuery, queryString } from '../../../core/api/api-query';
import { FrozenColsDirective } from '../../../shared/frozen-cols.directive';
import { CUSTOMER_TYPE_LABEL } from '../../sales-orders/sales-order.rules';
import {
  RevenueLine, RevenueSums, TIME_UNIT_LABEL, TimeUnit, autoUnit, bucketLabel, bucketOf, bucketsBetween, previousRange,
  shortBucketLabel, sumLines,
} from './revenue.rules';

export type RevenueGroup = 'time' | 'customer' | 'product' | 'category' | 'rep';

export const REVENUE_GROUP_LABEL: Record<RevenueGroup, string> = {
  time: 'Theo thời gian', customer: 'Theo khách hàng', product: 'Theo mặt hàng', category: 'Theo nhóm hàng', rep: 'Theo nhân viên bán hàng',
};

const TITLE: Record<RevenueGroup, string> = {
  time: 'Doanh thu theo thời gian', customer: 'Doanh thu theo khách hàng', product: 'Doanh thu theo mặt hàng',
  category: 'Doanh thu theo nhóm hàng', rep: 'Doanh thu theo nhân viên bán hàng',
};

interface Row extends RevenueSums {
  key: string;
  label: string;
  code?: string; // mã khách / mã hàng
  link?: unknown[];
  sub?: string; // loại khách, ĐVT…
  unit?: string;
  share: number; // tỷ trọng % trên tổng thanh toán
  lines: RevenueLine[];
}

interface OrderDetail {
  id: string;
  code: string;
  date: string;
  customer: string;
  net: number;
  total: number;
}

@Component({
  selector: 'app-revenue-report',
  standalone: true,
  imports: [RouterLink, NavIconComponent, PeriodFilterComponent, FrozenColsDirective],
  templateUrl: './revenue-report.component.html',
  styleUrl: './revenue-report.component.scss',
})
export class RevenueReportComponent {
  readonly data = inject(DataStore);

  readonly groups = Object.entries(REVENUE_GROUP_LABEL) as [RevenueGroup, string][];
  readonly units = Object.entries(TIME_UNIT_LABEL) as [TimeUnit, string][];
  readonly today = isoDay(new Date());

  readonly group = signal<RevenueGroup>('time');
  readonly unitChoice = signal<TimeUnit | 'auto'>('auto');
  readonly period = signal<PeriodValue>({ preset: 'thisMonth', range: presetRange('thisMonth') });
  readonly search = signal('');
  readonly expanded = signal<string | null>(null);
  readonly exporting = signal(false);

  readonly money = formatVnd;
  readonly qty = formatQty;
  readonly tone = amountTone;
  readonly day = formatDay;
  readonly title = computed(() => TITLE[this.group()]);

  constructor() {
    effect(() => {
      this.group();
      this.period();
      untracked(() => {
        this.expanded.set(null);
        this.search.set('');
      });
    });
  }

  // Doanh thu lines from the server (GET /api/reports/revenue-lines): the kỳ and the kỳ trước before it,
  // or every line for "Toàn bộ". Grouping, chart and Excel stay on this page.
  private readonly query = apiQuery<{ first?: string; lines: RevenueLine[] }>(() => {
    const r = this.period().range;
    const to = !r.to || r.to > this.today ? this.today : r.to;
    return '/reports/revenue-lines' + queryString({ from: r.from ? previousRange(r.from, to).from : null, to });
  }, { lines: [] });
  private readonly all = computed(() => this.query.value().lines);
  readonly loading = this.query.loading;
  readonly failure = this.query.error;

  /** Kỳ đang xem, ngày cuối không vượt quá hôm nay ("Tháng này" chỉ tính tới hôm nay). */
  readonly range = computed(() => {
    const r = this.period().range;
    const first = this.query.value().first ?? this.today;
    const to = !r.to || r.to > this.today ? this.today : r.to;
    return { from: r.from ?? first, to };
  });

  readonly periodLabel = computed(() => {
    const p = this.period();
    return p.preset && p.preset !== 'custom' ? PERIOD_PRESETS.find((x) => x.value === p.preset)?.label ?? '' : rangeLabel(p.range);
  });

  readonly lines = computed(() => this.all().filter((l) => inRange(l.date, this.range())));
  readonly totals = computed(() => sumLines(this.lines()));

  readonly hasPrevious = computed(() => this.period().preset !== 'all' && this.period().range.from !== null);
  readonly prevRange = computed(() => previousRange(this.range().from, this.range().to));
  readonly prevTotals = computed(() => sumLines(this.all().filter((l) => inRange(l.date, this.prevRange()))));

  /** % change vs kỳ trước, or null when there is nothing to compare with. */
  change(now: number, before: number): number | null {
    if (!this.hasPrevious() || !before) return null;
    return Math.round(((now - before) / Math.abs(before)) * 1000) / 10;
  }

  /** "▲ +12,5%" / "▼ −60,8%" — same as Tổng quan. */
  pct(c: number): string {
    const v = Math.abs(c).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
    return c > 0 ? `▲ +${v}%` : c < 0 ? `▼ −${v}%` : '0%';
  }

  percent(n: number): string {
    return n.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  }

  readonly unitWord = computed(() => TIME_UNIT_LABEL[this.unit()].toLowerCase());
  readonly avg = computed(() => (this.totals().orders ? Math.round(this.totals().total / this.totals().orders) : 0));

  readonly unit = computed<TimeUnit>(() => (this.unitChoice() === 'auto' ? autoUnit(this.range().from, this.range().to) : (this.unitChoice() as TimeUnit)));

  // ---------- lookups ----------
  private readonly customers = computed(() => new Map(this.data.customers().map((c) => [c.id, c])));
  private readonly products = computed(() => new Map(this.data.products().map((p) => [p.id, p])));
  private readonly categories = computed(() => new Map(this.data.categories().map((c) => [c.id, c.name])));
  private readonly users = computed(() => new Map(this.data.users().map((u) => [u.email, u.name])));

  private keyOf(l: RevenueLine): string {
    switch (this.group()) {
      case 'time': return bucketOf(l.date, this.unit());
      case 'customer': return l.customerId;
      case 'product': return l.productId;
      case 'category': return this.products().get(l.productId)?.categoryId ?? '';
      case 'rep': return l.salesRep ?? '';
    }
  }

  private describe(key: string): Pick<Row, 'label' | 'code' | 'link' | 'sub' | 'unit'> {
    switch (this.group()) {
      case 'time': return { label: bucketLabel(key, this.unit()) };
      case 'customer': {
        const c = this.customers().get(key);
        return { label: c?.name ?? 'Khách đã xoá', code: c?.code, link: c ? ['/khach-hang', c.id] : undefined, sub: c ? CUSTOMER_TYPE_LABEL[c.type] : undefined };
      }
      case 'product': {
        const p = this.products().get(key);
        return { label: p?.name ?? 'Hàng đã xoá', code: p?.code, link: p ? ['/hang-hoa', p.code] : undefined, unit: p?.baseUnit };
      }
      case 'category': return { label: this.categories().get(key) ?? '(Chưa phân nhóm)' };
      case 'rep': return { label: this.users().get(key) ?? (key || '(Chưa gán nhân viên)'), sub: key || undefined };
    }
  }

  readonly rows = computed<Row[]>(() => {
    const by = new Map<string, RevenueLine[]>();
    for (const l of this.lines()) {
      const k = this.keyOf(l);
      by.set(k, [...(by.get(k) ?? []), l]);
    }
    const grand = this.totals().total;
    const keys = this.group() === 'time' ? bucketsBetween(this.range().from, this.range().to, this.unit()) : [...by.keys()];
    const rows = keys.map((key) => {
      const ls = by.get(key) ?? [];
      const s = sumLines(ls);
      return { key, ...this.describe(key), ...s, share: grand ? (s.total / grand) * 100 : 0, lines: ls };
    });
    // Thời gian: theo thứ tự ngày; nhóm khác: doanh thu giảm dần.
    return this.group() === 'time' ? rows : rows.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'vi'));
  });

  readonly visibleRows = computed(() => {
    const q = foldVi(this.search().trim());
    // Kỳ không phát sinh vẫn hiện trên biểu đồ, nhưng bảng chỉ liệt kê kỳ có doanh thu.
    const rows = this.group() === 'time' ? this.rows().filter((r) => r.total) : this.rows();
    return q ? rows.filter((r) => foldVi(`${r.code ?? ''} ${r.label} ${r.sub ?? ''}`).includes(q)) : rows;
  });

  readonly visibleTotals = computed(() => sumLines(this.visibleRows().flatMap((r) => r.lines)));

  /** Biểu đồ: theo thời gian thì cột; các nhóm khác là top 10 dạng thanh ngang. */
  readonly chart = computed(() => {
    const rows = this.group() === 'time' ? this.rows() : this.rows().slice(0, 10);
    const max = Math.max(0, ...rows.map((r) => r.total));
    return {
      max,
      bars: rows.map((r) => ({
        key: r.key, label: this.group() === 'time' ? shortBucketLabel(r.key, this.unit()) : r.label, full: r.label,
        value: r.total, pct: max ? (r.total / max) * 100 : 0,
      })),
    };
  });

  readonly best = computed(() => (this.group() === 'time' ? [...this.rows()].sort((a, b) => b.total - a.total)[0] : undefined));

  toggle(key: string): void {
    this.expanded.update((k) => (k === key ? null : key));
  }

  /** Đơn hàng tạo nên một dòng báo cáo (phần doanh thu của đơn thuộc nhóm đó). */
  details(row: Row): OrderDetail[] {
    const by = new Map<string, OrderDetail>();
    for (const l of row.lines) {
      const d = by.get(l.orderId) ?? { id: l.orderId, code: l.orderCode, date: l.date, customer: this.customers().get(l.customerId)?.name ?? '—', net: 0, total: 0 };
      d.net += l.net;
      d.total += l.total;
      by.set(l.orderId, d);
    }
    return [...by.values()].sort((a, b) => b.date.localeCompare(a.date) || b.code.localeCompare(a.code));
  }

  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      const g = this.group();
      const summary = this.visibleRows().map((r) => [
        r.code ?? '', r.label, ...(g === 'product' ? [r.unit ?? '', r.qty] : []), r.orders, r.gross, r.discount, r.net, r.vat, r.total, Math.round(r.share * 10) / 10,
      ]);
      const t = this.visibleTotals();
      summary.push(['', 'TỔNG CỘNG', ...(g === 'product' ? ['', ''] : []), t.orders, t.gross, t.discount, t.net, t.vat, t.total, 100]);
      const money = (header: string) => ({ header, width: 15, numFmt: '#,##0' });
      const detail = [...this.lines()].sort((a, b) => a.date.localeCompare(b.date) || a.orderCode.localeCompare(b.orderCode)).map((l) => {
        const p = this.products().get(l.productId);
        const c = this.customers().get(l.customerId);
        return [formatDay(l.date), l.orderCode, c?.code ?? '', c?.name ?? '', p?.code ?? '', p?.name ?? '', p?.baseUnit ?? '', l.baseQty,
          l.gross, l.discount, l.net, l.vat, l.total, this.users().get(l.salesRep) ?? l.salesRep ?? ''];
      });
      await downloadWorkbook(exportFileName('Báo cáo Doanh thu'), [
        {
          name: 'Tổng hợp',
          columns: [
            { header: g === 'customer' ? 'Mã khách' : g === 'product' ? 'Mã hàng' : '', width: 12 },
            { header: REVENUE_GROUP_LABEL[g].replace('Theo ', '').replace(/^./, (x) => x.toUpperCase()), width: 34 },
            ...(g === 'product' ? [{ header: 'ĐVT', width: 8 }, { header: 'Số lượng', width: 11 }] : []),
            { header: 'Số đơn', width: 9 }, money('Tiền hàng'), money('Chiết khấu'), money('Doanh thu thuần'), money('Thuế GTGT'), money('Tổng thanh toán'),
            { header: 'Tỷ trọng (%)', width: 11 },
          ],
          rows: summary,
        },
        {
          name: 'Sổ chi tiết bán hàng',
          columns: [
            { header: 'Ngày ghi nhận', width: 12 }, { header: 'Số đơn', width: 12 }, { header: 'Mã khách', width: 11 }, { header: 'Khách hàng', width: 28 },
            { header: 'Mã hàng', width: 12 }, { header: 'Tên hàng', width: 32 }, { header: 'ĐVT', width: 8 }, { header: 'SL thực nhận', width: 11 },
            money('Tiền hàng'), money('Chiết khấu'), money('Doanh thu thuần'), money('Thuế GTGT'), money('Tổng thanh toán'), { header: 'NV bán hàng', width: 18 },
          ],
          rows: detail,
        },
      ]);
    } finally {
      this.exporting.set(false);
    }
  }
}
