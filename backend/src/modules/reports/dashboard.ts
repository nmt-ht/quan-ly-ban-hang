// Tổng quan — the figures the frontend's DashboardComponent used to compute in the browser. The screen
// keeps the wording ("Cần xử lý", ngưỡng cảnh báo); the server answers the numbers.
import type { DebtRow } from '../../common/debt-rows.js';
import { lineRemaining, orderTotals } from '../sales/sales-order.rules.js';
import type { ReportData } from './report-data.service.js';
import { type CostBook, inRange } from './report.rules.js';

const DAY = 86_400_000;
const INACTIVE_DAYS = 60; // khách ngừng mua: không mua trong 60 ngày gần nhất

const ms = (d: string) => new Date(d.slice(0, 10)).getTime();
const toIso = (t: number) => new Date(t).toISOString().slice(0, 10);

type Order = ReturnType<ReportData['salesOrders']>[number];

interface Sale {
  order: Order;
  date: string; // ngày khách nhận — or, for a phiếu trả hàng, ngày trả
  revenue: number; // khách thực nhận (gồm thuế, sau chiết khấu); a return is negative
  cost: number; // giá vốn phần đã nhận, as the phiếu xuất froze it (negative for a return)
  discount: number; // chiết khấu dòng + đơn, theo phần đã nhận (negative for a return)
  /** A phiếu trả hàng (Pha 1.5): counts against doanh thu on its own date, not as an order. */
  isReturn: boolean;
  /** Line index → quantity (line unit) this entry is about: received, or returned. */
  items: { i: number; qty: number }[];
}

export interface DashboardInput {
  data: ReportData;
  cost: CostBook;
  /** Null without debt.view: the screen leaves công nợ out. */
  debt: { receivables: DebtRow[]; payables: DebtRow[] } | null;
  /** Without report.view_profit, lãi gộp and giá vốn stay out. */
  showProfit: boolean;
  /** Kỳ đang xem; `from` missing = from the first sale. */
  from?: string;
  to: string;
  today: string;
}

export function dashboard({ data, cost, debt, showProfit, from: askedFrom, to: askedTo, today }: DashboardInput) {
  // Never past today, so "Quý này" compares quarter-to-date with the same number of days before it.
  const to = askedTo > today ? today : askedTo;
  const from = askedFrom ?? data.salesOrders().map((o) => o.orderDate.slice(0, 10)).sort()[0] ?? today;
  const range = { from, to };
  const len = Math.round((ms(to) - ms(from)) / DAY) + 1;
  const previousRange = { from: toIso(ms(from) - len * DAY), to: toIso(ms(from) - DAY) };

  const entry = (o: Order, date: string, revenue: number, items: { i: number; qty: number }[], isReturn: boolean): Sale => {
    const t = orderTotals(o.lines, o.discountAmount);
    const sign = isReturn ? -1 : 1;
    let c = 0;
    let disc = 0;
    for (const { i, qty } of items) {
      const l = o.lines[i];
      c += qty * (l.ratioToBase ?? 1) * cost.issued(o.id, l.productId);
      disc += ((t.lines[i].lineDiscount + t.lines[i].orderDiscount) * qty) / l.quantity;
    }
    return { order: o, date: date.slice(0, 10), revenue, cost: sign * Math.round(c), discount: sign * Math.round(disc), isReturn, items };
  };
  const sales: Sale[] = data.salesOrders()
    .filter((o) => o.status !== 'HUY' && o.receivedValue > 0 && o.deliveredDate)
    .flatMap((o) => {
      const got = o.lines.flatMap((l, i) => ((l.receivedQuantity ?? 0) && l.quantity ? [{ i, qty: l.receivedQuantity ?? 0 }] : []));
      const back = (o.returns ?? []).filter((r) => !r.isCancelled).map((r) => entry(o, r.date, -r.amount,
        r.lines.flatMap((rl) => { const i = o.lines.findIndex((l) => l.id === rl.orderLineId); return i < 0 ? [] : [{ i, qty: rl.quantity }]; }), true));
      return [entry(o, o.deliveredDate!, o.receivedValue, got, false), ...back];
    });
  const current = sales.filter((s) => inRange(s.date, range));
  const previous = sales.filter((s) => inRange(s.date, previousRange));

  const kpi = (list: Sale[]) => {
    const revenue = list.reduce((s, x) => s + x.revenue, 0);
    const c = list.reduce((s, x) => s + x.cost, 0);
    const orders = list.filter((x) => !x.isReturn).length;
    return {
      revenue, orders, avg: orders ? Math.round(revenue / orders) : 0,
      profit: showProfit ? revenue - c : null, margin: showProfit ? (revenue ? ((revenue - c) / revenue) * 100 : 0) : null,
    };
  };

  // ---------- cần chú ý ----------
  const orders = data.salesOrders();
  const stock = new Map<string, number>();
  for (const s of data.stockLevels()) stock.set(s.productId, (stock.get(s.productId) ?? 0) + s.quantity);
  const week = toIso(ms(today) + 7 * DAY);
  const payDue = debt ? debt.payables.flatMap((r) => r.items).filter((i) => i.dueDate <= week) : [];
  const attention = {
    pendingProduction: orders.filter((o) => o.status === 'CHO_SAN_XUAT').length,
    shipping: orders.filter((o) => o.status === 'DANG_GIAO').length,
    late: orders.filter((o) => !!o.neededByDate && o.neededByDate.slice(0, 10) < today && !o.closedDate &&
      !['HUY', 'HOAN_THANH', 'TRA_TOAN_BO'].includes(o.status) && o.lines.some((l) => lineRemaining(l) > 0)).length,
    belowMin: data.products().filter((p) => p.type !== 'DICH_VU' && p.isActive && p.minStock > 0 && (stock.get(p.id) ?? 0) < p.minStock).length,
    poWaiting: data.purchaseOrders().filter((o) => o.status === 'DA_GUI_NCC' || o.status === 'NHAN_MOT_PHAN').length,
  };

  const sum = (rows: DebtRow[], f: (r: DebtRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  const debts = debt && {
    receivableTotal: sum(debt.receivables, (r) => r.balance),
    receivableOverdue: sum(debt.receivables, (r) => r.overdue),
    overdueCustomers: debt.receivables.filter((r) => r.overdue > 0).length,
    payableTotal: sum(debt.payables, (r) => r.balance),
    payableOverdue: sum(debt.payables, (r) => r.overdue),
    payableDue: payDue.reduce((s, i) => s + i.amount, 0),
    payableDueCount: payDue.length,
  };

  // ---------- rò rỉ tiền ----------
  let belowCostLines = 0;
  let belowCostLoss = 0;
  for (const s of current.filter((x) => !x.isReturn)) {
    const t = orderTotals(s.order.lines, s.order.discountAmount);
    s.order.lines.forEach((l, i) => {
      const got = l.receivedQuantity ?? 0;
      if (!got || !l.quantity) return;
      const netPerBase = t.lines[i].taxable / l.quantity / (l.ratioToBase ?? 1);
      const c = cost.issued(s.order.id, l.productId);
      if (c > 0 && netPerBase < c) {
        belowCostLines++;
        belowCostLoss += Math.round((c - netPerBase) * got * (l.ratioToBase ?? 1));
      }
    });
  }
  const discount = current.reduce((s, x) => s + x.discount, 0);
  const revenue = current.reduce((s, x) => s + x.revenue, 0);
  // Khách đã từng mua nhưng không mua trong 60 ngày gần nhất.
  const cutoff = toIso(ms(today) - INACTIVE_DAYS * DAY);
  const lastBuy = new Map<string, string>();
  for (const s of sales.filter((x) => !x.isReturn)) if (!lastBuy.has(s.order.customerId) || s.date > lastBuy.get(s.order.customerId)!) lastBuy.set(s.order.customerId, s.date);
  const activeCustomers = new Set(data.customers().filter((c) => c.isActive).map((c) => c.id));
  const leaks = {
    belowCostLines: showProfit ? belowCostLines : null,
    belowCostLoss: showProfit ? belowCostLoss : null,
    discount,
    discountPct: revenue ? Math.round((discount / (revenue + discount)) * 1000) / 10 : 0,
    stopped: [...lastBuy].filter(([id, d]) => d < cutoff && activeCustomers.has(id)).length,
  };

  // ---------- biểu đồ & bán chạy ----------
  const byDay = (() => {
    const map = new Map<string, number>();
    for (const s of current) map.set(s.date, (map.get(s.date) ?? 0) + s.revenue);
    // Long periods group by month so the chart stays readable.
    if (len > 62) {
      const months = new Map<string, number>();
      for (const [d, v] of map) months.set(d.slice(0, 7), (months.get(d.slice(0, 7)) ?? 0) + v);
      const keys = [...months.keys()].sort();
      const max = Math.max(1, ...months.values());
      return { unit: 'tháng', bars: keys.map((k) => ({ key: k, label: `${k.slice(5)}/${k.slice(2, 4)}`, value: months.get(k)!, pct: (months.get(k)! / max) * 100 })) };
    }
    const bars: { key: string; label: string; value: number; pct: number }[] = [];
    for (let i = 0; i < len; i++) {
      const d = toIso(ms(from) + i * DAY);
      bars.push({ key: d, label: d.slice(8, 10), value: map.get(d) ?? 0, pct: 0 });
    }
    const max = Math.max(1, ...bars.map((b) => b.value));
    for (const b of bars) b.pct = (b.value / max) * 100;
    return { unit: 'ngày', bars };
  })();

  const top = new Map<string, { qty: number; value: number }>();
  for (const s of current) {
    const t = orderTotals(s.order.lines, s.order.discountAmount);
    const sign = s.isReturn ? -1 : 1;
    for (const { i, qty } of s.items) {
      const l = s.order.lines[i];
      const cur = top.get(l.productId) ?? { qty: 0, value: 0 };
      cur.qty += sign * qty * (l.ratioToBase ?? 1);
      cur.value += (sign * t.lines[i].total * qty) / l.quantity;
      top.set(l.productId, cur);
    }
  }
  const topTotal = [...top.values()].reduce((s, v) => s + v.value, 0);
  const products = new Map(data.products().map((p) => [p.id, p]));
  const topProducts = [...top]
    .map(([id, v]) => {
      const p = products.get(id);
      return { id, code: p?.code ?? '', name: p?.name ?? id, unit: p?.baseUnit ?? '', qty: Math.round(v.qty * 100) / 100, value: Math.round(v.value), share: topTotal ? (v.value / topTotal) * 100 : 0 };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // ---------- dòng tiền ----------
  const vs = data.cashVouchers().filter((v) => !v.isCancelled && inRange(v.date, range));
  const thu = vs.filter((v) => v.kind === 'THU').reduce((s, v) => s + v.amount, 0);
  const chi = vs.filter((v) => v.kind === 'CHI').reduce((s, v) => s + v.amount, 0);
  const accounts = data.cashAccounts().filter((a) => a.isActive !== false).map((a) => ({ id: a.id, name: a.name, balance: a.balance }));
  const cash = { thu, chi, net: thu - chi, balance: accounts.reduce((s, a) => s + a.balance, 0), accounts };

  return { today, range, previousRange, kpis: kpi(current), prevKpis: kpi(previous), attention, debt: debts, leaks, byDay, topProducts, cash };
}
