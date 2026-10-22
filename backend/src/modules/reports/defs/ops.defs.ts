// Ported from the frontend's features/reports/defs — same figures as the screens computed before.
import { formatVnd, inRange } from '../report.rules.js';
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

export const OPS_DEFS: ReportDef[] = [purchase, production, vehicleCost, cashflow, cashbook];
