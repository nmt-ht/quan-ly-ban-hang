import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { PeriodFilterComponent, PeriodValue } from '../../shared/period-filter/period-filter.component';
import { amountTone, formatVnd, formatVndSigned } from '../../shared/format.util';
import { PERIOD_PRESETS, formatDay, isoDay, presetRange, rangeLabel } from '../../shared/period';
import { AllowedLinkDirective } from '../../shared/allowed-link.directive';
import { apiQuery, queryString } from '../../core/api/api-query';

const INACTIVE_DAYS = 60; // khách ngừng mua: không mua trong 60 ngày gần nhất (the server counts them)

type IssueArea = 'sell' | 'stock' | 'profit' | 'debt' | 'cash';

interface Issue {
  key: string;
  area: IssueArea;
  level: 'bad' | 'warn'; // bad = đã gây thiệt hại / quá hạn; warn = sắp xảy ra hoặc nên xem
  title: string;
  detail: string;
  to: string;
  query?: Record<string, string | number | boolean>;
  cta: string;
}

interface Kpis {
  revenue: number;
  orders: number;
  avg: number;
  profit?: number; // absent without report.view_profit
  margin?: number;
}

/** GET /api/dashboard. Lãi gộp / giá vốn come only with report.view_profit, công nợ only with debt.view. */
interface Dashboard {
  today: string;
  range: { from: string; to: string };
  previousRange: { from: string; to: string };
  kpis: Kpis;
  prevKpis: Kpis;
  attention: { pendingProduction: number; shipping: number; late: number; belowMin: number; poWaiting: number };
  debt?: {
    receivableTotal: number;
    receivableOverdue: number;
    overdueCustomers: number;
    payableTotal: number;
    payableOverdue: number;
    payableDue: number;
    payableDueCount: number;
  };
  leaks: { belowCostLines?: number; belowCostLoss?: number; discount: number; discountPct: number; stopped: number };
  byDay: { unit: string; bars: { key: string; label: string; value: number; pct: number }[] };
  topProducts: { id: string; code: string; name: string; unit: string; qty: number; value: number; share: number }[];
  cash: { thu: number; chi: number; net: number; balance: number; accounts: { id: string; name: string; balance: number }[] };
}

const today = isoDay(new Date());
const NO_KPIS: Kpis = { revenue: 0, orders: 0, avg: 0 };
const EMPTY: Dashboard = {
  today, range: { from: today, to: today }, previousRange: { from: today, to: today }, kpis: NO_KPIS, prevKpis: NO_KPIS,
  attention: { pendingProduction: 0, shipping: 0, late: 0, belowMin: 0, poWaiting: 0 },
  leaks: { discount: 0, discountPct: 0, stopped: 0 }, byDay: { unit: 'ngày', bars: [] }, topProducts: [],
  cash: { thu: 0, chi: 0, net: 0, balance: 0, accounts: [] },
};

// Tổng quan: số liệu theo kỳ đang chọn (so với kỳ liền trước cùng độ dài); tồn quỹ và công nợ là toàn bộ
// lịch sử. The server computes the figures (GET /api/dashboard); this page decides what needs attention.
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, AllowedLinkDirective, PeriodFilterComponent, NavIconComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  readonly money = formatVnd;
  readonly signed = formatVndSigned;
  readonly tone = amountTone;
  readonly day = formatDay;

  readonly period = signal<PeriodValue>({ preset: 'thisMonth', range: presetRange('thisMonth') });

  // "Toàn bộ" starts at the first sale; the end is never past today (the server applies both).
  private readonly query = apiQuery<Dashboard>(
    () => '/dashboard' + queryString({ from: this.period().range.from, to: this.period().range.to }),
    EMPTY,
  );
  private readonly d = this.query.value;
  readonly loading = this.query.loading;
  readonly failure = this.query.error;

  readonly today = computed(() => this.d().today);
  readonly range = computed(() => this.d().range);
  readonly previousRange = computed(() => this.d().previousRange);
  readonly kpis = computed(() => this.d().kpis);
  readonly prevKpis = computed(() => this.d().prevKpis);
  readonly attention = computed(() => this.d().attention);
  /** Null without debt.view. */
  readonly debts = computed(() => this.d().debt ?? null);
  readonly leaks = computed(() => this.d().leaks);
  readonly byDay = computed(() => this.d().byDay);
  readonly topProducts = computed(() => this.d().topProducts);
  readonly cash = computed(() => this.d().cash);
  /** Lãi gộp is shown only to roles that may see giá vốn. */
  readonly showProfit = computed(() => this.kpis().profit !== undefined);

  readonly periodLabel = computed(() => {
    const p = this.period();
    return p.preset && p.preset !== 'custom' ? PERIOD_PRESETS.find((x) => x.value === p.preset)?.label ?? '' : rangeLabel(p.range);
  });

  /** % change vs kỳ trước, or null when there is nothing to compare with. */
  change(now: number, before: number): number | null {
    if (!before) return null;
    return Math.round(((now - before) / Math.abs(before)) * 1000) / 10;
  }

  /** "▲ +12,5%" / "▼ −60,8%" (Vietnamese decimal comma, true minus). */
  pct(c: number): string {
    const v = Math.abs(c).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
    return c > 0 ? `▲ +${v}%` : c < 0 ? `▼ −${v}%` : '0%';
  }

  /** Change of tỷ suất lãi gộp in percentage points, one decimal. */
  points(now: number | undefined, before: number | undefined): number {
    return Math.round(((now ?? 0) - (before ?? 0)) * 10) / 10;
  }

  /** "▲ +3,6 điểm" / "▼ −2,1 điểm" / "Không đổi". */
  pointsLabel(d: number): string {
    const v = Math.abs(d).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
    return d > 0 ? `▲ +${v} điểm` : d < 0 ? `▼ −${v} điểm` : 'Không đổi';
  }

  percent(n: number | undefined): string {
    return (n ?? 0).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  }

  // ---------- vấn đề cần xử lý ----------
  // Ngưỡng đặt ở đây để cả trang dùng chung một định nghĩa "có vấn đề" (xem design.md › Tổng quan).
  readonly issues = computed<Issue[]>(() => {
    const a = this.attention();
    const dt = this.debts();
    const l = this.leaks();
    const k = this.kpis();
    const p = this.prevKpis();
    const c = this.cash();
    const m = formatVnd;
    const out: Issue[] = [];

    if (a.late > 0) out.push({ key: 'late', area: 'sell', level: 'bad', title: `${a.late} đơn trễ hẹn giao`, detail: 'Đã quá ngày khách cần hàng mà vẫn còn dòng chưa giao.', to: '/don-hang', query: { late: 1 }, cta: 'Xem đơn' });
    if (dt && dt.receivableOverdue > 0) out.push({ key: 'ar', area: 'debt', level: 'bad', title: `Khách nợ quá hạn ${m(dt.receivableOverdue)}`, detail: `${dt.overdueCustomers} khách đã quá hạn thanh toán — cần nhắc nợ.`, to: '/cong-no/tuoi-no', query: { loai: 'phai-thu' }, cta: 'Xem tuổi nợ' });
    if (dt && dt.payableOverdue > 0) out.push({ key: 'ap', area: 'debt', level: 'bad', title: `Nợ nhà cung cấp quá hạn ${m(dt.payableOverdue)}`, detail: 'Trả chậm có thể bị siết hạn mức hoặc giao hàng.', to: '/cong-no/tuoi-no', cta: 'Xem tuổi nợ' });
    else if (dt && dt.payableDue > 0) out.push({ key: 'ap', area: 'debt', level: 'warn', title: `Phải trả NCC đến hạn trong 7 ngày: ${m(dt.payableDue)}`, detail: `${dt.payableDueCount} khoản — chuẩn bị tiền để trả đúng hạn.`, to: '/cong-no/tuoi-no', cta: 'Xem tuổi nợ' });
    if (l.belowCostLines) out.push({ key: 'below', area: 'profit', level: 'bad', title: `Bán dưới giá vốn: ${l.belowCostLines} dòng`, detail: `Lỗ ${m(l.belowCostLoss ?? 0)} trong kỳ — kiểm tra giá bán hoặc chiết khấu.`, to: '/bao-cao', query: { name: 'ban-duoi-gia-von' }, cta: 'Xem báo cáo' });
    if (k.profit !== undefined && k.margin !== undefined) {
      if (k.orders > 0 && k.profit < 0) out.push({ key: 'loss', area: 'profit', level: 'bad', title: `Lãi gộp âm ${m(k.profit)}`, detail: 'Giá vốn hàng bán cao hơn doanh thu trong kỳ.', to: '/bao-cao', query: { name: 'loi-nhuan' }, cta: 'Xem lãi gộp' });
      else if (p.revenue > 0 && k.revenue > 0 && k.margin < (p.margin ?? 0) - 5) out.push({ key: 'margin', area: 'profit', level: 'warn', title: 'Tỷ suất lãi gộp giảm', detail: `${this.percent(k.margin)} so với ${this.percent(p.margin)} kỳ trước.`, to: '/bao-cao', query: { name: 'loi-nhuan' }, cta: 'Xem lãi gộp' });
    }
    if (l.discountPct >= 10) out.push({ key: 'disc', area: 'profit', level: 'warn', title: `Chiết khấu ${l.discountPct}% giá trị hàng`, detail: `${m(l.discount)} đã cấp trong kỳ.`, to: '/bao-cao', query: { name: 'chiet-khau' }, cta: 'Xem chiết khấu' });
    if (p.revenue > 0 && k.revenue < p.revenue * 0.8) out.push({ key: 'rev', area: 'sell', level: 'warn', title: `Doanh thu giảm ${Math.round((1 - k.revenue / p.revenue) * 100)}% so với kỳ trước`, detail: `${m(k.revenue)} so với ${m(p.revenue)}.`, to: '/bao-cao', query: { name: 'ban-hang' }, cta: 'Xem doanh thu' });
    if (l.stopped > 0) out.push({ key: 'lost', area: 'sell', level: 'warn', title: `${l.stopped} khách ngừng mua`, detail: `Không mua trong ${INACTIVE_DAYS} ngày gần nhất — nên chăm sóc lại.`, to: '/bao-cao', query: { name: 'khach-ngung-mua', ngay: INACTIVE_DAYS }, cta: 'Xem khách' });
    if (a.belowMin > 0) out.push({ key: 'min', area: 'stock', level: 'warn', title: `${a.belowMin} mặt hàng dưới tồn tối thiểu`, detail: 'Cần nhập hoặc sản xuất thêm để không đứt hàng.', to: '/kho/ton-kho', query: { belowMin: true }, cta: 'Xem tồn kho' });
    const negative = c.accounts.filter((x) => x.balance < 0);
    if (negative.length) out.push({ key: 'neg', area: 'cash', level: 'bad', title: `Quỹ âm: ${negative.map((x) => x.name).join(', ')}`, detail: 'Số dư tài khoản nhỏ hơn 0 — thường do thiếu phiếu thu hoặc nhập sai.', to: '/thu-chi', cta: 'Xem thu chi' });
    else if (c.net < 0) out.push({ key: 'net', area: 'cash', level: 'warn', title: `Chi vượt thu ${m(-c.net)} trong kỳ`, detail: `Thu ${m(c.thu)} · chi ${m(c.chi)}.`, to: '/thu-chi', cta: 'Xem thu chi' });

    return [...out.filter((i) => i.level === 'bad'), ...out.filter((i) => i.level === 'warn')];
  });

  readonly badCount = computed(() => this.issues().filter((i) => i.level === 'bad').length);
  readonly warnCount = computed(() => this.issues().filter((i) => i.level === 'warn').length);

  /** Worst level among the issues of one area; areas with none are "ok". */
  areaLevel(area: IssueArea): 'bad' | 'warn' | 'ok' {
    const list = this.issues().filter((i) => i.area === area);
    return list.some((i) => i.level === 'bad') ? 'bad' : list.length ? 'warn' : 'ok';
  }

  readonly areaName: Record<IssueArea, string> = { sell: 'Bán hàng', stock: 'Kho', profit: 'Lợi nhuận', debt: 'Công nợ', cash: 'Dòng tiền' };
  readonly levelName = { bad: 'Có vấn đề', warn: 'Cần theo dõi', ok: 'Ổn' };

  /** Phải trả due within 7 days but not overdue yet (payableDue counts both). */
  dueSoon(dt: { payableDue: number; payableOverdue: number }): number {
    return Math.max(0, dt.payableDue - dt.payableOverdue);
  }

  /** Width of a Thu / Chi bar: share of the larger of the two, so the bars compare at a glance. */
  flowPct(value: number, c: { thu: number; chi: number }): number {
    const max = Math.max(c.thu, c.chi);
    return max > 0 ? Math.round((Math.max(0, value) / max) * 100) : 0;
  }

  // ---------- biểu đồ doanh thu ----------
  // A "nice" axis top (12 tr, not 11.242.000) with gridlines at top / half / 0, at most ~8 x labels,
  // an average line, and per-bar tooltip text. The same figures go to a visually-hidden table for screen readers.
  readonly chart = computed(() => {
    const { unit, bars } = this.byDay();
    const byMonth = unit === 'tháng';
    const max = Math.max(0, ...bars.map((b) => b.value));
    const top = niceCeil(max);
    const total = bars.reduce((s, b) => s + b.value, 0);
    const avg = bars.length ? Math.round(total / bars.length) : 0;
    const step = Math.max(1, Math.ceil(bars.length / 8));
    const peak = max > 0 ? bars.findIndex((b) => b.value === max) : -1;
    const n = bars.length;
    return {
      unit,
      total,
      avg,
      max,
      peakLabel: peak >= 0 ? (byMonth ? bars[peak].label : shortDay(bars[peak].key)) : '',
      active: bars.filter((b) => b.value > 0).length,
      ticks: top ? [top, top / 2, 0].map((v) => ({ value: v, label: compactVnd(v), pct: (v / top) * 100 })) : [],
      avgPct: top ? (avg / top) * 100 : 0,
      bars: bars.map((b, i) => ({
        key: b.key,
        value: b.value,
        h: top ? (b.value / top) * 100 : 0,
        axis: i % step === 0 ? (byMonth ? b.label : shortDay(b.key)) : '',
        // Every other label drops out on a narrow plot (see .db-axis) so they never run together.
        minor: i % (step * 2) !== 0,
        tip: byMonth ? `Tháng ${b.label}` : formatDay(b.key),
        peak: i === peak,
        // Tooltips near the edges open inward so they never leave the card.
        edge: i < n * 0.2 ? 'start' : i >= n * 0.8 ? 'end' : '',
      })),
    };
  });

  compact(n: number): string {
    return compactVnd(n);
  }
}

/** Round an axis maximum up to 1 · 1.2 · 1.5 · 2 · 2.5 · 3 · 4 · 5 · 6 · 8 × 10ⁿ. */
function niceCeil(v: number): number {
  if (v <= 0) return 0;
  const exp = 10 ** Math.floor(Math.log10(v));
  const f = v / exp;
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => f <= s + 1e-9) ?? 10;
  return step * exp;
}

/** Axis-size money: 1,2 tỷ · 12 tr · 850 k · 0. */
function compactVnd(v: number): string {
  const f = (x: number) => x.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  const a = Math.abs(v);
  if (a >= 1e9) return `${f(v / 1e9)} tỷ`;
  if (a >= 1e6) return `${f(v / 1e6)} tr`;
  if (a >= 1e3) return `${f(Math.round(v / 1e3))} k`;
  return f(v);
}

/** "2026-10-05" → "5/10". */
function shortDay(iso: string): string {
  return `${+iso.slice(8, 10)}/${+iso.slice(5, 7)}`;
}
