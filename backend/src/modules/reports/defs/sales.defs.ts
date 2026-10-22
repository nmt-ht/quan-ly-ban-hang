// Ported from the frontend's features/reports/defs — same figures as the screens computed before.
import { formatVnd, inRange, RevenueLine, revenueLines } from '../report.rules.js';
import { ReportCol, ReportDef, ReportEnv, ReportResult } from '../report.types.js';

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const days = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86_400_000);

interface Ctx {
  lines: RevenueLine[];
  customer: (id: string) => { name: string; code?: string; link?: unknown[] };
  product: (id: string) => { name: string; code?: string; link?: unknown[]; category: string };
  rep: (email: string) => string;
}

function ctxOf(env: ReportEnv): Ctx {
  const customers = new Map(env.data.customers().map((c) => [c.id, c]));
  const products = new Map(env.data.products().map((p) => [p.id, p]));
  const cats = new Map(env.data.categories().map((c) => [c.id, c.name]));
  const users = new Map(env.data.users().map((u) => [u.email, u.name]));
  return {
    lines: revenueLines(env.data.salesOrders()),
    customer: (id) => {
      const c = customers.get(id);
      return { name: c?.name ?? 'Khách đã xoá', code: c?.code, link: c ? ['/khach-hang', c.id] : undefined };
    },
    product: (id) => {
      const p = products.get(id);
      return { name: p?.name ?? 'Hàng đã xoá', code: p?.code, link: p ? ['/hang-hoa', p.id] : undefined, category: cats.get(p?.categoryId ?? '') ?? '(Chưa phân nhóm)' };
    },
    rep: (email) => users.get(email) ?? (email || '(Chưa gán nhân viên)'),
  };
}

// ---------------------------------------------------------------- Chiết khấu đã cấp
const discount: ReportDef = {
  slug: 'chiet-khau',
  group: 'sell',
  groups: ['customer', 'product', 'rep', 'order'],
  run(env, { range, group }): ReportResult {
    const cx = ctxOf(env);
    const lines = cx.lines.filter((l) => inRange(l.date, range) && l.discount > 0);
    const key = (l: RevenueLine) => (group === 'product' ? l.productId : group === 'rep' ? l.salesRep : group === 'order' ? l.orderId : l.customerId);
    const by = new Map<string, RevenueLine[]>();
    for (const l of lines) by.set(key(l), [...(by.get(key(l)) ?? []), l]);
    const rows = [...by].map(([k, ls]) => {
      const gross = ls.reduce((s, x) => s + x.gross, 0);
      const disc = ls.reduce((s, x) => s + x.discount, 0);
      const first = ls[0];
      const meta = group === 'product' ? cx.product(k) : group === 'customer' ? cx.customer(k) : null;
      return {
        id: k,
        name: group === 'rep' ? cx.rep(k) : group === 'order' ? first.orderCode : meta!.name,
        code: group === 'order' ? '' : meta?.code ?? '',
        link: group === 'order' ? ['/don-hang', k] : meta?.link ?? null,
        orders: new Set(ls.map((x) => x.orderId)).size,
        gross, discount: disc, rate: pct(disc, gross), net: ls.reduce((s, x) => s + x.net, 0),
      };
    }).sort((a, b) => b.discount - a.discount);
    const gross = rows.reduce((s, r) => s + r.gross, 0);
    const disc = rows.reduce((s, r) => s + r.discount, 0);
    return {
      kpis: [
        { label: 'Tổng chiết khấu đã cấp', value: formatVnd(disc), sub: `${pct(disc, gross).toLocaleString('vi-VN')}% trên tiền hàng ${formatVnd(gross)}` },
        { label: group === 'order' ? 'Số đơn có chiết khấu' : 'Số đối tượng được chiết khấu', value: String(rows.length) },
        { label: 'Cao nhất', value: rows[0] ? formatVnd(rows[0].discount) : '—', sub: rows[0]?.name },
      ],
      columns: ([
        { key: 'code', label: group === 'customer' ? 'Mã KH' : group === 'product' ? 'Mã hàng' : '' },
        { key: 'name', label: { customer: 'Khách hàng', product: 'Mặt hàng', rep: 'Nhân viên bán hàng', order: 'Đơn hàng' }[group] ?? 'Đối tượng', link: 'link' },
        { key: 'orders', label: 'Số đơn', kind: 'int' },
        { key: 'gross', label: 'Tiền hàng', kind: 'money' },
        { key: 'discount', label: 'Chiết khấu', kind: 'money' },
        { key: 'rate', label: 'Tỷ lệ', kind: 'pct' },
        { key: 'net', label: 'Doanh thu thuần', kind: 'money' },
      ] as ReportCol[]).filter((c) => c.label),
      rows,
      totals: { name: 'TỔNG CỘNG', orders: new Set(lines.map((l) => l.orderId)).size, gross, discount: disc, rate: pct(disc, gross), net: rows.reduce((s, r) => s + r.net, 0) },
      chart: { title: 'Top chiết khấu', items: rows.slice(0, 10).map((r) => ({ label: r.name, value: r.discount })) },
      emptyHint: 'Không có chiết khấu nào trong kỳ này.',
    };
  },
};

// ---------------------------------------------------------------- Khách ngừng mua
const lostCustomers: ReportDef = {
  slug: 'khach-ngung-mua',
  group: 'sell',
  run(env, { range }): ReportResult {
    const cx = ctxOf(env);
    const active = new Set(cx.lines.filter((l) => inRange(l.date, range)).map((l) => l.customerId));
    const before = new Map<string, RevenueLine[]>();
    for (const l of cx.lines) if (l.date < range.from) before.set(l.customerId, [...(before.get(l.customerId) ?? []), l]);
    const customers = new Map(env.data.customers().map((c) => [c.id, c]));
    const rows = [...before]
      .filter(([id]) => !active.has(id) && customers.get(id)?.isActive)
      .map(([id, ls]) => {
        const c = customers.get(id)!;
        const last = ls.map((l) => l.date).sort().at(-1)!;
        return {
          id, code: c.code, name: c.name, link: ['/khach-hang', id], phone: c.phone ?? '', last, since: days(last, range.to),
          orders: new Set(ls.map((l) => l.orderId)).size, revenue: ls.reduce((s, l) => s + l.total, 0),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
    return {
      kpis: [
        { label: 'Khách ngừng mua', value: String(rows.length), tone: rows.length ? 'neg' : undefined },
        { label: 'Doanh thu trước kỳ của nhóm này', value: formatVnd(rows.reduce((s, r) => s + r.revenue, 0)) },
        { label: 'Lâu nhất', value: rows.length ? `${Math.max(...rows.map((r) => r.since))} ngày` : '—' },
      ],
      columns: [
        { key: 'code', label: 'Mã KH' },
        { key: 'name', label: 'Khách hàng', link: 'link' },
        { key: 'phone', label: 'Điện thoại' },
        { key: 'last', label: 'Lần mua cuối', kind: 'date' },
        { key: 'since', label: 'Số ngày chưa mua', kind: 'int' },
        { key: 'orders', label: 'Số đơn trước kỳ', kind: 'int' },
        { key: 'revenue', label: 'Doanh thu trước kỳ', kind: 'money' },
      ],
      rows,
      totals: { name: 'TỔNG CỘNG', orders: rows.reduce((s, r) => s + r.orders, 0), revenue: rows.reduce((s, r) => s + r.revenue, 0) },
      emptyHint: 'Mọi khách từng mua đều đã nhận hàng trong kỳ này.',
    };
  },
};

// ---------------------------------------------------------------- Lãi gộp
const grossProfit: ReportDef = {
  slug: 'loi-nhuan',
  group: 'profit',
  groups: ['product', 'customer', 'category'],
  run(env, { range, group }): ReportResult {
    const cx = ctxOf(env);
    const lines = cx.lines.filter((l) => inRange(l.date, range));
    const keyOf = (l: RevenueLine) => (group === 'customer' ? l.customerId : group === 'category' ? cx.product(l.productId).category : l.productId);
    const by = new Map<string, RevenueLine[]>();
    for (const l of lines) by.set(keyOf(l), [...(by.get(keyOf(l)) ?? []), l]);
    const cost = (l: RevenueLine) => Math.round(l.baseQty * env.cost.costOf(l.productId));
    const rows = [...by].map(([k, ls]) => {
      const net = ls.reduce((s, l) => s + l.net, 0);
      const c = ls.reduce((s, l) => s + cost(l), 0);
      const meta = group === 'product' ? cx.product(k) : group === 'customer' ? cx.customer(k) : null;
      return {
        id: k, code: meta?.code ?? '', name: group === 'category' ? k : meta!.name, link: meta?.link ?? null,
        qty: group === 'product' ? Math.round(ls.reduce((s, l) => s + l.baseQty, 0) * 10000) / 10000 : undefined,
        net, cost: c, profit: net - c, margin: pct(net - c, net),
        zero: ls.filter((l) => env.cost.costOf(l.productId) === 0).length,
      };
    }).sort((a, b) => b.profit - a.profit);
    const net = rows.reduce((s, r) => s + r.net, 0);
    const c = rows.reduce((s, r) => s + r.cost, 0);
    return {
      kpis: [
        { label: 'Doanh thu thuần', value: formatVnd(net) },
        { label: 'Giá vốn ước tính', value: formatVnd(c) },
        { label: 'Lãi gộp', value: formatVnd(net - c), tone: net - c < 0 ? 'neg' : 'pos', sub: `Tỷ suất ${pct(net - c, net).toLocaleString('vi-VN')}%` },
      ],
      columns: ([
        { key: 'code', label: group === 'customer' ? 'Mã KH' : group === 'product' ? 'Mã hàng' : '' },
        { key: 'name', label: { product: 'Mặt hàng', customer: 'Khách hàng', category: 'Nhóm hàng' }[group] ?? 'Đối tượng', link: 'link' },
        ...(group === 'product' ? [{ key: 'qty', label: 'SL bán (ĐVT chính)', kind: 'qty' as const }] : []),
        { key: 'net', label: 'Doanh thu thuần', kind: 'money' as const },
        { key: 'cost', label: 'Giá vốn', kind: 'money' as const },
        { key: 'profit', label: 'Lãi gộp', kind: 'money' as const, tone: true },
        { key: 'margin', label: 'Tỷ suất', kind: 'pct' as const },
        { key: 'zero', label: 'Dòng giá vốn 0', kind: 'int' as const },
      ] as ReportCol[]).filter((col) => col.label),
      rows,
      totals: { name: 'TỔNG CỘNG', net, cost: c, profit: net - c, margin: pct(net - c, net), zero: rows.reduce((s, r) => s + r.zero, 0) },
      chart: { title: 'Top lãi gộp', items: rows.slice(0, 10).map((r) => ({ label: r.name, value: r.profit })) },
      emptyHint: 'Chưa có hàng giao trong kỳ này.',
    };
  },
};

// ---------------------------------------------------------------- Hàng bán dưới giá vốn
const belowCost: ReportDef = {
  slug: 'ban-duoi-gia-von',
  group: 'profit',
  run(env, { range }): ReportResult {
    const cx = ctxOf(env);
    const orders = new Map(env.data.salesOrders().map((o) => [o.id, o]));
    const rows = cx.lines
      .filter((l) => inRange(l.date, range) && l.baseQty > 0)
      .map((l) => {
        const cost = env.cost.costOf(l.productId);
        const price = l.net / l.baseQty;
        const p = cx.product(l.productId);
        return {
          id: l.orderId + ':' + l.productId, date: l.date, order: l.orderCode, orderLink: ['/don-hang', l.orderId],
          customer: cx.customer(l.customerId).name, code: p.code ?? '', name: p.name, link: p.link ?? null,
          qty: l.baseQty, price: Math.round(price), cost: Math.round(cost), loss: Math.round((cost - price) * l.baseQty),
          paid: orders.get(l.orderId)?.status,
        };
      })
      .filter((r) => r.cost > 0 && r.price < r.cost)
      .sort((a, b) => b.loss - a.loss);
    const loss = rows.reduce((s, r) => s + r.loss, 0);
    return {
      kpis: [
        { label: 'Số dòng bán dưới giá vốn', value: String(rows.length), tone: rows.length ? 'neg' : undefined },
        { label: 'Tổng lỗ ước tính', value: formatVnd(-loss), tone: loss ? 'neg' : undefined },
        { label: 'Lỗ lớn nhất', value: rows[0] ? formatVnd(-rows[0].loss) : '—', sub: rows[0]?.name },
      ],
      columns: [
        { key: 'date', label: 'Ngày giao', kind: 'date' },
        { key: 'order', label: 'Đơn hàng', link: 'orderLink' },
        { key: 'customer', label: 'Khách hàng' },
        { key: 'code', label: 'Mã hàng' },
        { key: 'name', label: 'Mặt hàng', link: 'link' },
        { key: 'qty', label: 'SL (ĐVT chính)', kind: 'qty' },
        { key: 'price', label: 'Giá bán thực', kind: 'money' },
        { key: 'cost', label: 'Giá vốn', kind: 'money' },
        { key: 'loss', label: 'Lỗ', kind: 'money' },
      ],
      rows,
      totals: { order: 'TỔNG CỘNG', loss },
      emptyHint: 'Không có dòng nào bán dưới giá vốn trong kỳ này.',
    };
  },
};

export const SALES_DEFS: ReportDef[] = [discount, lostCustomers, grossProfit, belowCost];

