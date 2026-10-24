// Ported from the frontend's features/reports/defs — same figures as the screens computed before.
import { orderTotals } from '../../sales/sales-order.rules.js';
import { formatVnd, inRange } from '../report.rules.js';
import type { ReportEnv } from '../report.types.js';
import { ReportDef, ReportResult } from '../report.types.js';

const r4 = (n: number) => Math.round(n * 10000) / 10000;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);

// ---------------------------------------------------------------- Nhập hàng
const purchase: ReportDef = {
  slug: 'mua-hang',
  group: 'buy',
  groups: ['supplier', 'product'],
  run(env, { range, group }): ReportResult {
    const orders = new Map(env.data.purchaseOrders().map((o) => [o.id, o]));
    const suppliers = new Map(env.data.suppliers().map((s) => [s.id, s]));
    const products = new Map(env.data.products().map((p) => [p.id, p]));
    interface Line { supplierId: string; productId: string; voucher: string; qty: number; value: number }
    const lines: Line[] = [];
    for (const v of env.data.warehouseVouchers()) {
      if (v.isCancelled || v.type !== 'NHAP' || !inRange(v.date, range)) continue;
      // New receipts carry purchaseOrderId; demo ones name the order code in the reason (same rule as the debt ledger).
      const o = v.purchaseOrderId ? orders.get(v.purchaseOrderId) : [...orders.values()].find((x) => (v.reason ?? '').includes(x.code));
      if (!o) continue;
      for (const l of v.lines ?? []) {
        // A receipt line without a price takes the order's price, converted to the main unit.
        const ol = o.lines.find((x) => x.productId === l.productId);
        const price = l.unitPrice ?? (ol ? ol.unitPrice / (ol.ratioToBase || 1) : 0);
        lines.push({ supplierId: o.supplierId, productId: l.productId, voucher: v.id, qty: l.quantity, value: Math.round(price * l.quantity) });
      }
    }
    const by = new Map<string, Line[]>();
    for (const l of lines) {
      const k = group === 'product' ? l.productId : l.supplierId;
      by.set(k, [...(by.get(k) ?? []), l]);
    }
    const rows = [...by].map(([k, ls]) => {
      const meta = group === 'product' ? products.get(k) : suppliers.get(k);
      const value = ls.reduce((s, l) => s + l.value, 0);
      const qty = r4(ls.reduce((s, l) => s + l.qty, 0));
      return {
        id: k, code: meta?.code ?? '', name: meta?.name ?? '—', link: meta ? [group === 'product' ? '/hang-hoa' : '/nha-cung-cap', k] : null,
        unit: group === 'product' ? (meta as { baseUnit?: string })?.baseUnit ?? '' : '', vouchers: new Set(ls.map((l) => l.voucher)).size,
        qty, value, avg: qty ? Math.round(value / qty) : 0,
      };
    }).sort((a, b) => b.value - a.value);
    const total = rows.reduce((s, r) => s + r.value, 0);
    return {
      kpis: [
        { label: 'Giá trị nhập (chưa thuế)', value: formatVnd(total) },
        { label: 'Số phiếu nhập', value: String(new Set(lines.map((l) => l.voucher)).size) },
        { label: group === 'product' ? 'Số mặt hàng' : 'Số nhà cung cấp', value: String(rows.length) },
      ],
      columns: [
        { key: 'code', label: group === 'product' ? 'Mã hàng' : 'Mã NCC' },
        { key: 'name', label: group === 'product' ? 'Mặt hàng' : 'Nhà cung cấp', link: 'link' },
        ...(group === 'product' ? [{ key: 'unit', label: 'ĐVT' }, { key: 'qty', label: 'Số lượng', kind: 'qty' as const }] : []),
        { key: 'vouchers', label: 'Số phiếu', kind: 'int' as const },
        { key: 'value', label: 'Giá trị nhập', kind: 'money' as const },
        ...(group === 'product' ? [{ key: 'avg', label: 'Đơn giá TB', kind: 'money' as const }] : []),
      ],
      rows,
      totals: { name: 'TỔNG CỘNG', vouchers: new Set(lines.map((l) => l.voucher)).size, value: total },
      chart: { title: group === 'product' ? 'Top mặt hàng nhập' : 'Top nhà cung cấp', items: rows.slice(0, 10).map((r) => ({ label: r.name, value: r.value })) },
      emptyHint: 'Chưa nhập hàng trong kỳ này.',
    };
  },
};

// ---------------------------------------------------------------- Sản xuất
const production: ReportDef = {
  slug: 'san-xuat',
  group: 'make',
  run(env, { range }): ReportResult {
    const products = new Map(env.data.products().map((p) => [p.id, p]));
    const done = env.data.productionOrders().filter((x) => x.status === 'HOAN_TAT' && x.completeDate && inRange(x.completeDate, range));
    const by = new Map<string, typeof done>();
    for (const x of done) by.set(x.productId, [...(by.get(x.productId) ?? []), x]);
    // bomSnapshot is a JSON column: the định mức copied when the lệnh was made.
    const bomOf = (productId: string, json: unknown) => {
      const snap = json as { componentId: string; quantityPerUnit: number }[] | null;
      return snap?.length ? snap : env.data.bomLines().filter((b) => b.finishedProductId === productId);
    };
    const rows = [...by].map(([id, ls]) => {
      const p = products.get(id);
      const planned = r4(ls.reduce((s, x) => s + x.quantity, 0));
      const made = r4(ls.reduce((s, x) => s + (x.producedQuantity ?? x.quantity), 0));
      const cost = Math.round(ls.reduce((s, x) => s + bomOf(id, x.bomSnapshot).reduce((c, b) => c + b.quantityPerUnit * x.quantity * env.cost.costOf(b.componentId), 0), 0));
      return {
        id, code: p?.code ?? '', name: p?.name ?? '—', link: p ? ['/hang-hoa', id] : null, unit: p?.baseUnit ?? '', orders: ls.length,
        planned, made, waste: pct(planned - made, planned), cost, unit_cost: made ? Math.round(cost / made) : 0,
      };
    }).sort((a, b) => b.cost - a.cost);
    return {
      kpis: [
        { label: 'Lệnh hoàn tất', value: String(done.length) },
        { label: 'Thực nhập kho (số lượng)', value: rows.reduce((s, r) => s + r.made, 0).toLocaleString('vi-VN') },
        { label: 'Chi phí vật tư (ước tính)', value: formatVnd(rows.reduce((s, r) => s + r.cost, 0)) },
      ],
      columns: [
        { key: 'code', label: 'Mã TP' },
        { key: 'name', label: 'Thành phẩm', link: 'link' },
        { key: 'unit', label: 'ĐVT' },
        { key: 'orders', label: 'Số lệnh', kind: 'int' },
        { key: 'planned', label: 'SL theo lệnh', kind: 'qty' },
        { key: 'made', label: 'Thực nhập kho', kind: 'qty' },
        { key: 'waste', label: 'Hao hụt', kind: 'pct' },
        { key: 'cost', label: 'Chi phí vật tư', kind: 'money' },
        { key: 'unit_cost', label: 'Giá thành / ĐVT', kind: 'money' },
      ],
      rows,
      totals: { name: 'TỔNG CỘNG', orders: done.length, cost: rows.reduce((s, r) => s + r.cost, 0) },
      emptyHint: 'Chưa có lệnh sản xuất hoàn tất trong kỳ này.',
    };
  },
};

// ---------------------------------------------------------------- Chi phí xe
const vehicleCost: ReportDef = {
  slug: 'chi-phi-xe',
  group: 'deliver',
  groups: ['vehicle', 'driver'],
  run(env, { range, group }): ReportResult {
    const trips = env.data.deliveryTrips().filter((t) => t.status !== 'HUY' && inRange(t.date, range));
    const vehicles = new Map(env.data.vehicles().map((v) => [v.id, v]));
    const keyOf = (t: (typeof trips)[number]) => (group === 'driver' ? t.driverName || '(Chưa ghi tài xế)' : t.vehicleId ?? `ext:${t.plateNumber ?? ''}`);
    const by = new Map<string, typeof trips>();
    for (const t of trips) by.set(keyOf(t), [...(by.get(keyOf(t)) ?? []), t]);
    const rows = [...by].map(([k, ts]) => {
      const fuel = ts.reduce((s, t) => s + (t.costs?.fuel ?? 0), 0);
      const toll = ts.reduce((s, t) => s + (t.costs?.toll ?? 0), 0);
      const other = ts.reduce((s, t) => s + (t.costs?.other ?? 0), 0);
      const v = group === 'vehicle' ? vehicles.get(k) : undefined;
      const plate = group === 'vehicle' ? (v?.plateNumber ?? ts[0].plateNumber ?? '—') : '';
      return {
        id: k, name: group === 'driver' ? k : `${plate}${v?.name ? ' · ' + v.name : v ? '' : ' (thuê ngoài)'}`, link: v ? ['/xe', v.id] : null,
        trips: ts.length, fuel, toll, other, total: fuel + toll + other, avg: ts.length ? Math.round((fuel + toll + other) / ts.length) : 0,
      };
    }).sort((a, b) => b.total - a.total);
    const total = rows.reduce((s, r) => s + r.total, 0);
    return {
      kpis: [
        { label: 'Tổng chi phí xe', value: formatVnd(total) },
        { label: 'Số chuyến', value: String(trips.length) },
        { label: 'Trung bình mỗi chuyến', value: formatVnd(trips.length ? Math.round(total / trips.length) : 0) },
      ],
      columns: [
        { key: 'name', label: group === 'driver' ? 'Tài xế' : 'Xe', link: 'link' },
        { key: 'trips', label: 'Số chuyến', kind: 'int' },
        { key: 'fuel', label: 'Tiền dầu', kind: 'money' },
        { key: 'toll', label: 'Cầu đường, bến bãi', kind: 'money' },
        { key: 'other', label: 'Chi phí khác', kind: 'money' },
        { key: 'total', label: 'Tổng', kind: 'money' },
        { key: 'avg', label: 'TB / chuyến', kind: 'money' },
      ],
      rows,
      totals: { name: 'TỔNG CỘNG', trips: trips.length, fuel: rows.reduce((s, r) => s + r.fuel, 0), toll: rows.reduce((s, r) => s + r.toll, 0), other: rows.reduce((s, r) => s + r.other, 0), total },
      chart: { title: group === 'driver' ? 'Chi phí theo tài xế' : 'Chi phí theo xe', items: rows.slice(0, 10).map((r) => ({ label: r.name, value: r.total })) },
      emptyHint: 'Chưa có chuyến giao hàng trong kỳ này.',
    };
  },
};

// ---------------------------------------------------------------- Giao hàng (chốt giao)
type TripOf = ReturnType<ReportEnv['data']['deliveryTrips']>[number];

/** One đơn on one chuyến, as far as the customer has confirmed it (chưa chốt = no outcome yet). */
interface Drop {
  trip: TripOf;
  orderId: string;
  customerId: string;
  confirmed: boolean;
  loaded: number; // giá trị hàng xếp lên xe cho đơn này
  received: number; // giá trị khách thực nhận
  outcome: 'open' | 'full' | 'partial' | 'none';
}

function drops(env: ReportEnv, range: { from: string; to: string }): Drop[] {
  const orders = new Map(env.data.salesOrders().map((o) => [o.id, o]));
  const out: Drop[] = [];
  for (const t of env.data.deliveryTrips()) {
    if (t.status === 'HUY' || !inRange(t.date, range)) continue;
    for (const orderId of t.orderIds) {
      const o = orders.get(orderId);
      if (!o) continue;
      // Phải thu for one unit of each line (after chiết khấu, VAT included), as the chuyến itself values it.
      const totals = orderTotals(o.lines, o.discountAmount);
      const unit = o.lines.map((l, i) => (l.quantity > 0 ? totals.lines[i].total / l.quantity : 0));
      const loads = (t.loads ?? []).filter((l) => l.orderId === orderId);
      const conf = (t.confirmations ?? []).find((c) => c.orderId === orderId);
      const loaded = loads.reduce((s, l) => s + l.quantity * (unit[l.lineIndex] ?? 0), 0);
      const received = (conf?.lines ?? []).reduce((s, r) => s + r.received * (unit[r.lineIndex] ?? 0), 0);
      const full = loads.every((l) => (conf?.lines.find((r) => r.lineIndex === l.lineIndex)?.received ?? 0) >= l.quantity - 1e-9);
      out.push({
        trip: t, orderId, customerId: o.customerId, confirmed: !!conf, loaded: Math.round(loaded), received: Math.round(received),
        outcome: !conf ? 'open' : received <= 0 ? 'none' : full ? 'full' : 'partial',
      });
    }
  }
  return out;
}

/** Aggregates drops into one row: counts of đơn by outcome and giá trị xếp / nhận of the đơn đã chốt. */
function dropStats(ds: Drop[]) {
  const done = ds.filter((d) => d.confirmed);
  const loaded = done.reduce((s, d) => s + d.loaded, 0);
  const received = done.reduce((s, d) => s + d.received, 0);
  return {
    orders: ds.length, confirmed: done.length, open: ds.length - done.length,
    full: done.filter((d) => d.outcome === 'full').length,
    partial: done.filter((d) => d.outcome === 'partial').length,
    none: done.filter((d) => d.outcome === 'none').length,
    loaded, received, back: loaded - received,
    rate: pct(received, loaded), fullRate: pct(done.filter((d) => d.outcome === 'full').length, done.length),
  };
}

const delivery: ReportDef = {
  slug: 'giao-hang',
  group: 'deliver',
  groups: ['trip', 'customer'],
  run(env, { range, group }): ReportResult {
    const ds = drops(env, range);
    const customers = new Map(env.data.customers().map((c) => [c.id, c.name]));
    const by = new Map<string, Drop[]>();
    for (const d of ds) {
      const k = group === 'customer' ? d.customerId : d.trip.id;
      by.set(k, [...(by.get(k) ?? []), d]);
    }
    const rows = [...by].map(([k, list]) => {
      const st = dropStats(list);
      const t = list[0].trip;
      return group === 'customer'
        ? { id: k, name: customers.get(k) ?? '(Khách đã xoá)', link: ['/khach-hang', k], ...st }
        : { id: k, name: t.code, link: ['/giao-hang', k], date: t.date, driver: t.driverName || '—', ...st };
    }).sort((a, b) => (group === 'customer' ? b.back - a.back : String((b as { date?: string }).date).localeCompare(String((a as { date?: string }).date))));
    const all = dropStats(ds);
    const columns: ReportResult['columns'] = group === 'customer'
      ? [{ key: 'name', label: 'Khách hàng', link: 'link' }]
      : [{ key: 'name', label: 'Chuyến', link: 'link' }, { key: 'date', label: 'Ngày', kind: 'date' }, { key: 'driver', label: 'Tài xế' }];
    columns.push(
      { key: 'orders', label: 'Số đơn', kind: 'int' },
      { key: 'confirmed', label: 'Đã chốt', kind: 'int' },
      { key: 'full', label: 'Giao đủ', kind: 'int' },
      { key: 'partial', label: 'Giao một phần', kind: 'int' },
      { key: 'none', label: 'Khách không nhận', kind: 'int' },
      { key: 'open', label: 'Chưa chốt', kind: 'int' },
      { key: 'loaded', label: 'Giá trị xuất', kind: 'money' },
      { key: 'received', label: 'Khách nhận', kind: 'money' },
      { key: 'rate', label: 'Tỷ lệ giao thành công', kind: 'pct' },
    );
    return {
      kpis: [
        { label: 'Tỷ lệ giao thành công', value: `${all.rate}%`, sub: 'giá trị khách nhận ÷ giá trị xuất của đơn đã chốt', tone: all.confirmed && all.rate < 90 ? 'neg' : 'pos' },
        { label: 'Đơn đã chốt giao', value: String(all.confirmed), sub: all.open ? `${all.open} đơn chưa chốt` : undefined },
        { label: 'Giao đủ', value: `${all.full} / ${all.confirmed}`, sub: `${all.fullRate}% số đơn đã chốt` },
        { label: 'Hàng mang về', value: formatVnd(all.back), tone: all.back ? 'neg' : undefined },
      ],
      columns,
      rows,
      totals: { name: 'TỔNG CỘNG', orders: all.orders, confirmed: all.confirmed, full: all.full, partial: all.partial, none: all.none, open: all.open, loaded: all.loaded, received: all.received, rate: all.rate },
      chart: group === 'customer'
        ? { title: 'Hàng mang về theo khách', items: rows.filter((r) => r.back > 0).slice(0, 10).map((r) => ({ label: r.name, value: r.back })) }
        : undefined,
      emptyHint: 'Chưa có chuyến giao hàng nào trong kỳ này.',
    };
  },
};

// ---------------------------------------------------------------- Hiệu quả theo tài xế
const driverReport: ReportDef = {
  slug: 'tai-xe',
  group: 'deliver',
  run(env, { range }): ReportResult {
    const ds = drops(env, range);
    const by = new Map<string, Drop[]>();
    for (const d of ds) {
      const k = d.trip.driverName || '(Chưa ghi tài xế)';
      by.set(k, [...(by.get(k) ?? []), d]);
    }
    const rows = [...by].map(([k, list]) => {
      const st = dropStats(list);
      return { id: k, name: k, trips: new Set(list.map((d) => d.trip.id)).size, ...st, backRate: st.loaded ? pct(st.back, st.loaded) : 0 };
    }).sort((a, b) => b.back - a.back);
    const all = dropStats(ds);
    return {
      kpis: [
        { label: 'Tài xế có chuyến', value: String(rows.length) },
        { label: 'Tỷ lệ khách lấy đủ', value: `${all.fullRate}%`, sub: 'số đơn giao đủ ÷ số đơn đã chốt', tone: all.confirmed && all.fullRate < 90 ? 'neg' : 'pos' },
        { label: 'Hàng mang về', value: formatVnd(all.back), tone: all.back ? 'neg' : undefined },
      ],
      columns: [
        { key: 'name', label: 'Tài xế' },
        { key: 'trips', label: 'Số chuyến', kind: 'int' },
        { key: 'confirmed', label: 'Đơn đã chốt', kind: 'int' },
        { key: 'full', label: 'Khách lấy đủ', kind: 'int' },
        { key: 'fullRate', label: 'Tỷ lệ lấy đủ', kind: 'pct' },
        { key: 'loaded', label: 'Giá trị xuất', kind: 'money' },
        { key: 'back', label: 'Hàng mang về', kind: 'money', tone: 'inverse' },
        { key: 'backRate', label: 'Tỷ lệ mang về', kind: 'pct' },
      ],
      rows,
      totals: { name: 'TỔNG CỘNG', trips: new Set(ds.map((d) => d.trip.id)).size, confirmed: all.confirmed, full: all.full, fullRate: all.fullRate, loaded: all.loaded, back: all.back, backRate: all.loaded ? pct(all.back, all.loaded) : 0 },
      chart: { title: 'Hàng mang về theo tài xế', items: rows.filter((r) => r.back > 0).slice(0, 10).map((r) => ({ label: r.name, value: r.back })) },
      emptyHint: 'Chưa có chuyến giao hàng nào trong kỳ này.',
    };
  },
};

// ---------------------------------------------------------------- Thu chi
const cashflow: ReportDef = {
  slug: 'thu-chi',
  group: 'cash',
  groups: ['category', 'account', 'partner'],
  run(env, { range, group }): ReportResult {
    const accounts = new Map(env.data.cashAccounts().map((a) => [a.id, a.name]));
    const customers = new Map(env.data.customers().map((c) => [c.id, c.name]));
    const suppliers = new Map(env.data.suppliers().map((s) => [s.id, s.name]));
    const vs = env.data.cashVouchers().filter((v) => !v.isCancelled && inRange(v.date, range));
    const keyOf = (v: (typeof vs)[number]) =>
      group === 'account' ? accounts.get(v.accountId) ?? v.accountId
        : group === 'partner' ? (v.partnerType === 'KHACH_HANG' ? customers.get(v.partnerId ?? '') : v.partnerType === 'NHA_CUNG_CAP' ? suppliers.get(v.partnerId ?? '') : undefined) ?? '(Không gắn đối tác)'
          : v.category;
    const by = new Map<string, typeof vs>();
    for (const v of vs) by.set(keyOf(v), [...(by.get(keyOf(v)) ?? []), v]);
    const rows = [...by].map(([k, ls]) => {
      const thu = ls.filter((v) => v.kind === 'THU').reduce((s, v) => s + v.amount, 0);
      const chi = ls.filter((v) => v.kind === 'CHI').reduce((s, v) => s + v.amount, 0);
      return { id: k, name: k, count: ls.length, thu, chi, net: thu - chi };
    }).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
    const thu = rows.reduce((s, r) => s + r.thu, 0);
    const chi = rows.reduce((s, r) => s + r.chi, 0);
    return {
      kpis: [
        { label: 'Tổng thu', value: formatVnd(thu), tone: 'pos' },
        { label: 'Tổng chi', value: formatVnd(chi), tone: chi ? 'neg' : undefined },
        { label: 'Ròng (thu − chi)', value: formatVnd(thu - chi), tone: thu - chi < 0 ? 'neg' : 'pos' },
      ],
      columns: [
        { key: 'name', label: { category: 'Loại thu chi', account: 'Tài khoản tiền', partner: 'Đối tác' }[group] ?? 'Nhóm' },
        { key: 'count', label: 'Số phiếu', kind: 'int' },
        { key: 'thu', label: 'Thu', kind: 'money' },
        { key: 'chi', label: 'Chi', kind: 'money' },
        { key: 'net', label: 'Ròng', kind: 'money', tone: true },
      ],
      rows,
      totals: { name: 'TỔNG CỘNG', count: vs.length, thu, chi, net: thu - chi },
      emptyHint: 'Chưa có phiếu thu chi trong kỳ này.',
    };
  },
};

// ---------------------------------------------------------------- Sổ quỹ
const cashbook: ReportDef = {
  slug: 'so-quy',
  group: 'cash',
  run(env, { range }): ReportResult {
    const vouchers = env.data.cashVouchers().filter((v) => !v.isCancelled);
    const rows = env.data.cashAccounts().map((a) => {
      const mine = vouchers.filter((v) => v.accountId === a.id);
      const sign = (v: (typeof mine)[number]) => (v.kind === 'THU' ? v.amount : -v.amount);
      const opening = (a.openingBalance ?? 0) + mine.filter((v) => v.date < range.from).reduce((s, v) => s + sign(v), 0);
      const inRangeV = mine.filter((v) => inRange(v.date, range));
      const thu = inRangeV.filter((v) => v.kind === 'THU').reduce((s, v) => s + v.amount, 0);
      const chi = inRangeV.filter((v) => v.kind === 'CHI').reduce((s, v) => s + v.amount, 0);
      return { id: a.id, name: a.name, link: ['/thu-chi/tai-khoan'], opening, thu, chi, closing: opening + thu - chi };
    });
    const sum = (k: 'opening' | 'thu' | 'chi' | 'closing') => rows.reduce((s, r) => s + r[k], 0);
    return {
      kpis: [
        { label: 'Tồn quỹ đầu kỳ', value: formatVnd(sum('opening')) },
        { label: 'Thu − Chi trong kỳ', value: formatVnd(sum('thu') - sum('chi')), tone: sum('thu') - sum('chi') < 0 ? 'neg' : 'pos' },
        { label: 'Tồn quỹ cuối kỳ', value: formatVnd(sum('closing')) },
      ],
      columns: [
        { key: 'name', label: 'Tài khoản tiền', link: 'link' },
        { key: 'opening', label: 'Tồn đầu kỳ', kind: 'money' },
        { key: 'thu', label: 'Thu', kind: 'money' },
        { key: 'chi', label: 'Chi', kind: 'money' },
        { key: 'closing', label: 'Tồn cuối kỳ', kind: 'money' },
      ],
      rows,
      totals: { name: 'TỔNG CỘNG', opening: sum('opening'), thu: sum('thu'), chi: sum('chi'), closing: sum('closing') },
      emptyHint: 'Chưa có tài khoản tiền nào.',
    };
  },
};

// ---------------------------------------------------------------- Giá mua biến động
const priceDrift: ReportDef = {
  slug: 'gia-mua',
  group: 'buy',
  groups: ['product', 'line'],
  run(env, { range, group }): ReportResult {
    const orders = env.data.purchaseOrders();
    const byId = new Map(orders.map((o) => [o.id, o]));
    const suppliers = new Map(env.data.suppliers().map((s) => [s.id, s]));
    const products = new Map(env.data.products().map((p) => [p.id, p]));
    interface Buy { id: string; date: string; voucherId: string; voucher: string; orderId: string; order: string; supplierId: string; productId: string; qty: number; price: number }
    const buys: Buy[] = [];
    // Each receipt line from an đơn nhập is one purchase — the same receipts the Nhập hàng report counts.
    for (const v of env.data.warehouseVouchers()) {
      if (v.isCancelled || v.type !== 'NHAP' || !inRange(v.date, range)) continue;
      const o = v.purchaseOrderId ? byId.get(v.purchaseOrderId) : orders.find((x) => (v.reason ?? '').includes(x.code));
      if (!o) continue;
      (v.lines ?? []).forEach((l, i) => {
        const ol = o.lines.find((x) => x.productId === l.productId);
        const price = l.unitPrice || (ol ? ol.unitPrice / (ol.ratioToBase || 1) : 0); // per main unit
        if (!price || !l.quantity) return;
        buys.push({
          id: `${v.id}-${i}`, date: v.date.slice(0, 10), voucherId: v.id, voucher: v.code, orderId: o.id, order: o.code,
          supplierId: o.supplierId, productId: l.productId, qty: l.quantity, price: Math.round(price * 100) / 100,
        });
      });
    }
    buys.sort((a, b) => a.date.localeCompare(b.date) || a.voucher.localeCompare(b.voucher));
    const change = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 1000) / 10 : 0);

    // Per mặt hàng: first / latest / min / max price over the kỳ, oldest purchase first.
    const per = new Map<string, Buy[]>();
    for (const b of buys) per.set(b.productId, [...(per.get(b.productId) ?? []), b]);
    const summary = [...per].map(([pid, bs]) => {
      const p = products.get(pid);
      const prices = bs.map((b) => b.price);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const qty = bs.reduce((s, b) => s + b.qty, 0);
      const last = bs[bs.length - 1];
      return {
        id: pid, code: p?.code ?? '', name: p?.name ?? '—', link: p ? ['/hang-hoa', pid] : null, unit: p?.baseUnit ?? '',
        times: bs.length, first: bs[0].price, last: last.price, min, max,
        avg: Math.round(bs.reduce((s, b) => s + b.price * b.qty, 0) / (qty || 1)),
        spread: change(max, min), change: change(last.price, bs[0].price),
        supplier: suppliers.get(last.supplierId)?.name ?? '',
      };
    });
    const up = summary.filter((r) => r.change > 0).sort((a, b) => b.change - a.change);
    const down = summary.filter((r) => r.change < 0);
    const kpis: ReportResult['kpis'] = [
      { label: 'Mặt hàng mua từ 2 lần', value: String(summary.filter((r) => r.times > 1).length), sub: `${summary.length} mặt hàng có nhập trong kỳ` },
      { label: 'Tăng giá', value: String(up.length), sub: up[0] ? `mạnh nhất: ${up[0].name} +${up[0].change.toLocaleString('vi-VN')}%` : undefined, tone: up.length ? 'neg' : undefined },
      { label: 'Giảm giá', value: String(down.length), tone: down.length ? 'pos' : undefined },
    ];
    const emptyHint = 'Không có lần nhập theo đơn nhập nào trong kỳ này.';

    if (group === 'line') {
      const prev = new Map<string, number>();
      const rows = buys.map((b) => {
        const p = products.get(b.productId);
        const before = prev.get(b.productId);
        prev.set(b.productId, b.price);
        return {
          id: b.id, date: b.date, voucher: b.voucher, voucherLink: ['/kho/phieu', b.voucherId], order: b.order, orderLink: ['/mua-hang', b.orderId],
          supplier: suppliers.get(b.supplierId)?.name ?? '', code: p?.code ?? '', name: p?.name ?? '—', link: p ? ['/hang-hoa', b.productId] : null,
          unit: p?.baseUnit ?? '', qty: b.qty, price: b.price,
          // First purchase of the item in the kỳ has nothing to compare with.
          vsPrev: before === undefined ? null : change(b.price, before),
        };
      }).reverse(); // newest first to read
      return {
        kpis,
        columns: [
          { key: 'date', label: 'Ngày nhập', kind: 'date' },
          { key: 'voucher', label: 'Phiếu nhập', link: 'voucherLink' },
          { key: 'order', label: 'Đơn nhập', link: 'orderLink' },
          { key: 'supplier', label: 'Nhà cung cấp' },
          { key: 'code', label: 'Mã hàng' },
          { key: 'name', label: 'Mặt hàng', link: 'link' },
          { key: 'unit', label: 'ĐVT' },
          { key: 'qty', label: 'Số lượng', kind: 'qty' },
          { key: 'price', label: 'Đơn giá', kind: 'money' },
          { key: 'vsPrev', label: 'So với lần trước', kind: 'pct', tone: 'inverse' },
        ],
        rows,
        emptyHint,
      };
    }

    const rows = summary.sort((a, b) => b.spread - a.spread || Math.abs(b.change) - Math.abs(a.change) || a.code.localeCompare(b.code));
    return {
      kpis,
      columns: [
        { key: 'code', label: 'Mã hàng' },
        { key: 'name', label: 'Mặt hàng', link: 'link' },
        { key: 'unit', label: 'ĐVT' },
        { key: 'times', label: 'Số lần nhập', kind: 'int' },
        { key: 'first', label: 'Giá lần đầu', kind: 'money' },
        { key: 'last', label: 'Giá gần nhất', kind: 'money' },
        { key: 'min', label: 'Thấp nhất', kind: 'money' },
        { key: 'max', label: 'Cao nhất', kind: 'money' },
        { key: 'avg', label: 'Bình quân', kind: 'money' },
        { key: 'spread', label: 'Biên độ', kind: 'pct' },
        { key: 'change', label: 'Thay đổi', kind: 'pct', tone: 'inverse' },
        { key: 'supplier', label: 'NCC gần nhất' },
      ],
      rows,
      emptyHint,
    };
  },
};

export const OPS_DEFS: ReportDef[] = [purchase, priceDrift, production, delivery, vehicleCost, driverReport, cashflow, cashbook];
