import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../core/services/mock-data.service';
import { DebtService } from '../../core/services/debt.service';
import { CostService } from '../../core/services/cost.service';
import { SalesOrder } from '../../core/models/domain.models';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { PeriodFilterComponent, PeriodValue } from '../../shared/period-filter/period-filter.component';
import { amountTone, formatVnd, formatVndSigned } from '../../shared/format.util';
import { DateRange, PERIOD_PRESETS, formatDay, inRange, isoDay, presetRange, rangeLabel } from '../../shared/period';
import { lineRemaining, orderTotals } from '../sales-orders/sales-order.rules';

const DAY = 86_400_000;
const INACTIVE_DAYS = 60; // khách ngừng mua: không mua trong 60 ngày gần nhất

const ms = (d: string) => new Date(d.slice(0, 10)).getTime();
const toIso = (t: number) => new Date(t).toISOString().slice(0, 10);

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

interface Sale {
  order: SalesOrder;
  date: string; // ngày khách nhận
  revenue: number; // khách thực nhận (gồm thuế, sau chiết khấu)
  cost: number; // giá vốn ước tính phần đã nhận
  discount: number; // chiết khấu dòng + đơn, theo phần đã nhận
}

// Tổng quan: số liệu theo kỳ đang chọn (so với kỳ liền trước cùng độ dài); tồn quỹ và công nợ là toàn bộ lịch sử.
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, PeriodFilterComponent, NavIconComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  readonly data = inject(MockDataService);
  readonly debt = inject(DebtService);

  readonly money = formatVnd;
  readonly signed = formatVndSigned;
  readonly tone = amountTone;
  readonly day = formatDay;
  readonly today = isoDay(new Date());

  readonly period = signal<PeriodValue>({ preset: 'thisMonth', range: presetRange('thisMonth') });

  /**
   * Effective range: never past today (so "Quý này" compares quarter-to-date with the same number of
   * days before it); "Toàn bộ" starts at the first sale.
   */
  readonly range = computed<{ from: string; to: string }>(() => {
    const r: DateRange = this.period().range;
    const to = !r.to || r.to > this.today ? this.today : r.to;
    const first = this.data.salesOrders().map((o) => o.orderDate.slice(0, 10)).sort()[0] ?? this.today;
    return { from: r.from ?? first, to };
  });

  readonly previousRange = computed(() => {
    const { from, to } = this.range();
    const len = Math.round((ms(to) - ms(from)) / DAY) + 1;
    return { from: toIso(ms(from) - len * DAY), to: toIso(ms(from) - DAY) };
  });

  readonly periodLabel = computed(() => {
    const p = this.period();
    return p.preset && p.preset !== 'custom' ? PERIOD_PRESETS.find((x) => x.value === p.preset)?.label ?? '' : rangeLabel(p.range);
  });

  // ---------- giá vốn ước tính (CostService) ----------
  private readonly unitCost = inject(CostService).unitCost;

  /** Every delivered order as a sale, with revenue / cost / discount for what the customer received. */
  private readonly sales = computed<Sale[]>(() => {
    const cost = this.unitCost();
    return this.data.salesOrders()
      .filter((o) => o.status !== 'HUY' && o.receivedValue > 0 && o.deliveredDate)
      .map((o) => {
        const t = orderTotals(o.lines, o.discountAmount);
        let c = 0;
        let disc = 0;
        o.lines.forEach((l, i) => {
          const got = l.receivedQuantity ?? 0;
          if (!got || !l.quantity) return;
          c += got * (l.ratioToBase ?? 1) * (cost.get(l.productId) ?? 0);
          disc += ((t.lines[i].lineDiscount + t.lines[i].orderDiscount) * got) / l.quantity;
        });
        return { order: o, date: o.deliveredDate!.slice(0, 10), revenue: o.receivedValue, cost: Math.round(c), discount: Math.round(disc) };
      });
  });

  private salesIn(r: { from: string; to: string }): Sale[] {
    return this.sales().filter((s) => inRange(s.date, r));
  }

  readonly current = computed(() => this.salesIn(this.range()));
  readonly previous = computed(() => this.salesIn(this.previousRange()));

  private kpi(list: Sale[]) {
    const revenue = list.reduce((s, x) => s + x.revenue, 0);
    const cost = list.reduce((s, x) => s + x.cost, 0);
    const orders = list.length;
    return { revenue, orders, avg: orders ? Math.round(revenue / orders) : 0, profit: revenue - cost, margin: revenue ? ((revenue - cost) / revenue) * 100 : 0 };
  }

  readonly kpis = computed(() => this.kpi(this.current()));
  readonly prevKpis = computed(() => this.kpi(this.previous()));

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

  percent(n: number): string {
    return n.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  }

  // ---------- cần chú ý ----------
  readonly attention = computed(() => {
    const orders = this.data.salesOrders();
    const stock = new Map<string, number>();
    for (const s of this.data.stockLevels()) stock.set(s.productId, (stock.get(s.productId) ?? 0) + s.quantity);
    const week = toIso(ms(this.today) + 7 * DAY);
    const payDue = this.debt.payables().flatMap((r) => r.items).filter((i) => i.dueDate <= week);
    return {
      pendingProduction: orders.filter((o) => o.status === 'CHO_SAN_XUAT').length,
      shipping: orders.filter((o) => o.status === 'DANG_GIAO').length,
      late: orders.filter((o) => !!o.neededByDate && o.neededByDate.slice(0, 10) < this.today && !o.closedDate &&
        !['HUY', 'HOAN_THANH', 'TRA_TOAN_BO'].includes(o.status) && o.lines.some((l) => lineRemaining(l) > 0)).length,
      belowMin: this.data.products().filter((p) => p.type !== 'DICH_VU' && p.isActive && p.minStock > 0 && (stock.get(p.id) ?? 0) < p.minStock).length,
      receivableOverdue: this.debt.receivableOverdue(),
      overdueCustomers: this.debt.receivables().filter((r) => r.overdue > 0).length,
      payableDue: payDue.reduce((s, i) => s + i.amount, 0),
      payableDueCount: payDue.length,
      poWaiting: this.data.purchaseOrders().filter((o) => o.status === 'DA_GUI_NCC' || o.status === 'NHAN_MOT_PHAN').length,
    };
  });

  // ---------- rò rỉ tiền ----------
  readonly leaks = computed(() => {
    const cur = this.current();
    const cost = this.unitCost();
    let belowCostLines = 0;
    let belowCostLoss = 0;
    for (const s of cur) {
      const t = orderTotals(s.order.lines, s.order.discountAmount);
      s.order.lines.forEach((l, i) => {
        const got = l.receivedQuantity ?? 0;
        if (!got || !l.quantity) return;
        const netPerBase = t.lines[i].taxable / l.quantity / (l.ratioToBase ?? 1);
        const c = cost.get(l.productId) ?? 0;
        if (c > 0 && netPerBase < c) {
          belowCostLines++;
          belowCostLoss += Math.round((c - netPerBase) * got * (l.ratioToBase ?? 1));
        }
      });
    }
    const discount = cur.reduce((s, x) => s + x.discount, 0);
    const revenue = this.kpis().revenue;
    // Khách đã từng mua nhưng không mua trong 60 ngày gần nhất.
    const cutoff = toIso(ms(this.today) - INACTIVE_DAYS * DAY);
    const lastBuy = new Map<string, string>();
    for (const s of this.sales()) if (!lastBuy.has(s.order.customerId) || s.date > lastBuy.get(s.order.customerId)!) lastBuy.set(s.order.customerId, s.date);
    const stopped = [...lastBuy].filter(([id, d]) => d < cutoff && this.data.customers().find((c) => c.id === id)?.isActive).length;
    return { belowCostLines, belowCostLoss, discount, discountPct: revenue ? Math.round((discount / (revenue + discount)) * 1000) / 10 : 0, stopped };
  });

  // ---------- vấn đề cần xử lý ----------
  // Ngưỡng đặt ở đây để cả trang dùng chung một định nghĩa "có vấn đề" (xem design.md › Tổng quan).
  readonly issues = computed<Issue[]>(() => {
    const a = this.attention();
    const l = this.leaks();
    const k = this.kpis();
    const p = this.prevKpis();
    const c = this.cash();
    const m = formatVnd;
    const out: Issue[] = [];

    if (a.late > 0) out.push({ key: 'late', area: 'sell', level: 'bad', title: `${a.late} đơn trễ hẹn giao`, detail: 'Đã quá ngày khách cần hàng mà vẫn còn dòng chưa giao.', to: '/don-hang', query: { late: 1 }, cta: 'Xem đơn' });
    if (a.receivableOverdue > 0) out.push({ key: 'ar', area: 'debt', level: 'bad', title: `Khách nợ quá hạn ${m(a.receivableOverdue)}`, detail: `${a.overdueCustomers} khách đã quá hạn thanh toán — cần nhắc nợ.`, to: '/cong-no/tuoi-no', query: { loai: 'phai-thu' }, cta: 'Xem tuổi nợ' });
    if (this.debt.payableOverdue() > 0) out.push({ key: 'ap', area: 'debt', level: 'bad', title: `Nợ nhà cung cấp quá hạn ${m(this.debt.payableOverdue())}`, detail: 'Trả chậm có thể bị siết hạn mức hoặc giao hàng.', to: '/cong-no/tuoi-no', cta: 'Xem tuổi nợ' });
    else if (a.payableDue > 0) out.push({ key: 'ap', area: 'debt', level: 'warn', title: `Phải trả NCC đến hạn trong 7 ngày: ${m(a.payableDue)}`, detail: `${a.payableDueCount} khoản — chuẩn bị tiền để trả đúng hạn.`, to: '/cong-no/tuoi-no', cta: 'Xem tuổi nợ' });
    if (l.belowCostLines > 0) out.push({ key: 'below', area: 'profit', level: 'bad', title: `Bán dưới giá vốn: ${l.belowCostLines} dòng`, detail: `Lỗ ${m(l.belowCostLoss)} trong kỳ — kiểm tra giá bán hoặc chiết khấu.`, to: '/bao-cao', query: { name: 'ban-duoi-gia-von' }, cta: 'Xem báo cáo' });
    if (k.orders > 0 && k.profit < 0) out.push({ key: 'loss', area: 'profit', level: 'bad', title: `Lãi gộp âm ${m(k.profit)}`, detail: 'Giá vốn ước tính cao hơn doanh thu trong kỳ.', to: '/bao-cao', query: { name: 'loi-nhuan' }, cta: 'Xem lãi gộp' });
    else if (p.revenue > 0 && k.revenue > 0 && k.margin < p.margin - 5) out.push({ key: 'margin', area: 'profit', level: 'warn', title: 'Tỷ suất lãi gộp giảm', detail: `${this.percent(k.margin)} so với ${this.percent(p.margin)} kỳ trước.`, to: '/bao-cao', query: { name: 'loi-nhuan' }, cta: 'Xem lãi gộp' });
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

  // ---------- biểu đồ & bán chạy ----------
  readonly byDay = computed(() => {
    const { from, to } = this.range();
    const days = Math.round((ms(to) - ms(from)) / DAY) + 1;
    const map = new Map<string, number>();
    for (const s of this.current()) map.set(s.date, (map.get(s.date) ?? 0) + s.revenue);
    // Long periods group by month so the chart stays readable.
    if (days > 62) {
      const months = new Map<string, number>();
      for (const [d, v] of map) months.set(d.slice(0, 7), (months.get(d.slice(0, 7)) ?? 0) + v);
      const keys = [...months.keys()].sort();
      const max = Math.max(1, ...months.values());
      return { unit: 'tháng', bars: keys.map((k) => ({ key: k, label: `${k.slice(5)}/${k.slice(2, 4)}`, value: months.get(k)!, pct: (months.get(k)! / max) * 100 })) };
    }
    const bars = [];
    for (let i = 0; i < days; i++) {
      const d = toIso(ms(from) + i * DAY);
      bars.push({ key: d, label: d.slice(8, 10), value: map.get(d) ?? 0, pct: 0 });
    }
    const max = Math.max(1, ...bars.map((b) => b.value));
    for (const b of bars) b.pct = (b.value / max) * 100;
    return { unit: 'ngày', bars };
  });

  readonly chartMax = computed(() => Math.max(0, ...this.byDay().bars.map((b) => b.value)));

  readonly topProducts = computed(() => {
    const map = new Map<string, { qty: number; value: number }>();
    for (const s of this.current()) {
      const t = orderTotals(s.order.lines, s.order.discountAmount);
      s.order.lines.forEach((l, i) => {
        const got = l.receivedQuantity ?? 0;
        if (!got || !l.quantity) return;
        const cur = map.get(l.productId) ?? { qty: 0, value: 0 };
        cur.qty += got * (l.ratioToBase ?? 1);
        cur.value += (t.lines[i].total * got) / l.quantity;
        map.set(l.productId, cur);
      });
    }
    const total = [...map.values()].reduce((s, v) => s + v.value, 0);
    return [...map]
      .map(([id, v]) => {
        const p = this.data.products().find((x) => x.id === id);
        return { id, code: p?.code ?? '', name: p?.name ?? id, unit: p?.baseUnit ?? '', qty: Math.round(v.qty * 100) / 100, value: Math.round(v.value), share: total ? (v.value / total) * 100 : 0 };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  });

  // ---------- dòng tiền ----------
  readonly cash = computed(() => {
    const r = this.range();
    const vs = this.data.cashVouchers().filter((v) => !v.isCancelled && inRange(v.date, r));
    const thu = vs.filter((v) => v.kind === 'THU').reduce((s, v) => s + v.amount, 0);
    const chi = vs.filter((v) => v.kind === 'CHI').reduce((s, v) => s + v.amount, 0);
    const accounts = this.data.cashAccounts().filter((a) => a.isActive !== false);
    return { thu, chi, net: thu - chi, balance: accounts.reduce((s, a) => s + a.balance, 0), accounts };
  });
}
