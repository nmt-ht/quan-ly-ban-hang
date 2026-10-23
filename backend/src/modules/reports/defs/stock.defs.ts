// Ported from the frontend's features/reports/defs — same figures as the screens computed before.
import { formatVnd, inRange, isoDay } from '../report.rules.js';
import { ReportDef, ReportEnv, ReportResult } from '../report.types.js';

const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** Tồn hiện tại per product (all kho), non-service. */
function stockByProduct(env: ReportEnv): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of env.data.stockLevels()) m.set(s.productId, r4((m.get(s.productId) ?? 0) + s.quantity));
  return m;
}

// ---------------------------------------------------------------- Tồn kho hiện tại
const stockNow: ReportDef = {
  slug: 'ton-kho',
  group: 'stock',
  groups: ['product', 'warehouse'],
  run(env, { group }): ReportResult {
    const products = env.data.products().filter((p) => p.type !== 'DICH_VU');
    const warehouses = new Map(env.data.warehouses().map((w) => [w.id, w.name]));
    const pById = new Map(products.map((p) => [p.id, p]));
    if (group === 'warehouse') {
      const by = new Map<string, { items: number; qtyLines: number; neg: number; value: number }>();
      for (const s of env.data.stockLevels()) {
        const p = pById.get(s.productId);
        if (!p) continue;
        const cur = by.get(s.warehouseId) ?? { items: 0, qtyLines: 0, neg: 0, value: 0 };
        if (s.quantity !== 0) cur.items++;
        if (s.quantity < 0) cur.neg++;
        cur.value += Math.round(Math.max(0, s.quantity) * env.cost.costOf(p.id));
        by.set(s.warehouseId, cur);
      }
      const rows = [...by].map(([id, v]) => ({ id, name: warehouses.get(id) ?? id, items: v.items, neg: v.neg, value: v.value })).sort((a, b) => b.value - a.value);
      return {
        kpis: [{ label: 'Tổng giá trị tồn', value: formatVnd(rows.reduce((s, r) => s + r.value, 0)) }, { label: 'Số kho có hàng', value: String(rows.length) }],
        columns: [
          { key: 'name', label: 'Kho' },
          { key: 'items', label: 'Số mặt hàng còn tồn', kind: 'int' },
          { key: 'neg', label: 'Mặt hàng tồn âm', kind: 'int' },
          { key: 'value', label: 'Giá trị tồn', kind: 'money' },
        ],
        rows,
        totals: { name: 'TỔNG CỘNG', items: rows.reduce((s, r) => s + r.items, 0), neg: rows.reduce((s, r) => s + r.neg, 0), value: rows.reduce((s, r) => s + r.value, 0) },
        chart: { title: 'Giá trị tồn theo kho', items: rows.map((r) => ({ label: r.name, value: r.value })) },
      };
    }
    const qty = stockByProduct(env);
    const rows = products
      .map((p) => {
        const q = qty.get(p.id) ?? 0;
        const cost = env.cost.costOf(p.id);
        return { id: p.id, code: p.code, name: p.name, link: ['/hang-hoa', p.id], unit: p.baseUnit, qty: q, cost: Math.round(cost), value: Math.round(Math.max(0, q) * cost) };
      })
      .filter((r) => r.qty !== 0)
      .sort((a, b) => b.value - a.value);
    return {
      kpis: [
        { label: 'Tổng giá trị tồn', value: formatVnd(rows.reduce((s, r) => s + r.value, 0)) },
        { label: 'Mặt hàng còn tồn', value: String(rows.filter((r) => r.qty > 0).length) },
        { label: 'Mặt hàng tồn âm', value: String(rows.filter((r) => r.qty < 0).length), tone: rows.some((r) => r.qty < 0) ? 'neg' : undefined },
      ],
      columns: [
        { key: 'code', label: 'Mã hàng' },
        { key: 'name', label: 'Mặt hàng', link: 'link' },
        { key: 'unit', label: 'ĐVT' },
        { key: 'qty', label: 'Tồn', kind: 'qty', tone: false },
        { key: 'cost', label: 'Giá vốn', kind: 'money' },
        { key: 'value', label: 'Giá trị tồn', kind: 'money' },
      ],
      rows,
      totals: { name: 'TỔNG CỘNG', value: rows.reduce((s, r) => s + r.value, 0) },
      chart: { title: 'Top giá trị tồn', items: rows.slice(0, 10).map((r) => ({ label: r.name, value: r.value })) },
      emptyHint: 'Kho chưa có hàng.',
    };
  },
};

// ---------------------------------------------------------------- Hàng dưới tồn tối thiểu
const belowMin: ReportDef = {
  slug: 'duoi-ton-toi-thieu',
  group: 'stock',
  run(env): ReportResult {
    const qty = stockByProduct(env);
    const rows = env.data.products()
      .filter((p) => p.type !== 'DICH_VU' && p.isActive && p.minStock > 0 && (qty.get(p.id) ?? 0) < p.minStock)
      .map((p) => {
        const q = qty.get(p.id) ?? 0;
        const short = r4(p.minStock - q);
        const cost = env.cost.costOf(p.id);
        return { id: p.id, code: p.code, name: p.name, link: ['/hang-hoa', p.id], unit: p.baseUnit, qty: q, min: p.minStock, short, need: Math.round(short * cost) };
      })
      .sort((a, b) => b.need - a.need);
    return {
      kpis: [
        { label: 'Mặt hàng dưới mức tối thiểu', value: String(rows.length), tone: rows.length ? 'neg' : undefined },
        { label: 'Tiền cần bù (ước tính)', value: formatVnd(rows.reduce((s, r) => s + r.need, 0)) },
      ],
      columns: [
        { key: 'code', label: 'Mã hàng' },
        { key: 'name', label: 'Mặt hàng', link: 'link' },
        { key: 'unit', label: 'ĐVT' },
        { key: 'qty', label: 'Tồn hiện tại', kind: 'qty' },
        { key: 'min', label: 'Tối thiểu', kind: 'qty' },
        { key: 'short', label: 'Còn thiếu', kind: 'qty' },
        { key: 'need', label: 'Tiền cần bù', kind: 'money' },
      ],
      rows,
      totals: { name: 'TỔNG CỘNG', need: rows.reduce((s, r) => s + r.need, 0) },
      emptyHint: 'Không có mặt hàng nào dưới mức tối thiểu.',
    };
  },
};

// ---------------------------------------------------------------- Nhập xuất tồn
const movement: ReportDef = {
  slug: 'nhap-xuat-ton',
  group: 'stock',
  run(env, { range }): ReportResult {
    const now = stockByProduct(env);
    const inQty = new Map<string, number>();
    const outQty = new Map<string, number>();
    const afterNet = new Map<string, number>(); // net movement after the period end
    for (const v of env.data.warehouseVouchers()) {
      if (v.isCancelled || v.type === 'CHUYEN') continue;
      const d = v.date.slice(0, 10);
      for (const l of v.lines ?? []) {
        // signed effect on stock: NHAP +, XUAT −, KIEM_KE +delta
        const signed = v.type === 'NHAP' ? l.quantity : v.type === 'XUAT' ? -l.quantity : l.delta;
        if (inRange(d, range)) {
          if (signed >= 0) inQty.set(l.productId, r4((inQty.get(l.productId) ?? 0) + signed));
          else outQty.set(l.productId, r4((outQty.get(l.productId) ?? 0) - signed));
        } else if (d > range.to) {
          afterNet.set(l.productId, r4((afterNet.get(l.productId) ?? 0) + signed));
        }
      }
    }
    const rows = env.data.products()
      .filter((p) => p.type !== 'DICH_VU')
      .map((p) => {
        const closing = r4((now.get(p.id) ?? 0) - (afterNet.get(p.id) ?? 0));
        const i = inQty.get(p.id) ?? 0;
        const o = outQty.get(p.id) ?? 0;
        return { id: p.id, code: p.code, name: p.name, link: ['/hang-hoa', p.id], unit: p.baseUnit, opening: r4(closing - i + o), in: i, out: o, closing };
      })
      .filter((r) => r.opening !== 0 || r.in !== 0 || r.out !== 0 || r.closing !== 0)
      .sort((a, b) => a.code.localeCompare(b.code));
    return {
      kpis: [
        { label: 'Mặt hàng có biến động', value: String(rows.filter((r) => r.in !== 0 || r.out !== 0).length) },
        { label: 'Tổng nhập (số lượng)', value: rows.reduce((s, r) => s + r.in, 0).toLocaleString('vi-VN') },
        { label: 'Tổng xuất (số lượng)', value: rows.reduce((s, r) => s + r.out, 0).toLocaleString('vi-VN') },
      ],
      columns: [
        { key: 'code', label: 'Mã hàng' },
        { key: 'name', label: 'Mặt hàng', link: 'link' },
        { key: 'unit', label: 'ĐVT' },
        { key: 'opening', label: 'Tồn đầu kỳ', kind: 'qty' },
        { key: 'in', label: 'Nhập', kind: 'qty' },
        { key: 'out', label: 'Xuất', kind: 'qty' },
        { key: 'closing', label: 'Tồn cuối kỳ', kind: 'qty' },
      ],
      rows,
      emptyHint: 'Không có biến động kho trong kỳ này.',
    };
  },
};

// ---------------------------------------------------------------- shared: stock moves per line

interface Move {
  voucherId: string;
  code: string;
  type: 'NHAP' | 'XUAT' | 'KIEM_KE';
  date: string; // YYYY-MM-DD
  at: string; // createdAt, orders moves of one day
  warehouseId: string;
  reason: string | null;
  productId: string;
  signed: number; // effect on total stock: NHAP +, XUAT −, KIEM_KE ± chênh lệch
}

/**
 * Every live stock move, oldest first. Chuyển kho is left out: it moves stock between kho without
 * changing the total, the same rule as Nhập xuất tồn.
 */
function moves(env: ReportEnv): Move[] {
  const out: Move[] = [];
  for (const v of env.data.warehouseVouchers()) {
    if (v.isCancelled || v.type === 'CHUYEN') continue;
    for (const l of v.lines ?? []) {
      const signed = v.type === 'NHAP' ? l.quantity : v.type === 'XUAT' ? -l.quantity : l.delta;
      out.push({
        voucherId: v.id, code: v.code, type: v.type, date: v.date.slice(0, 10), at: String(v.createdAt ?? ''),
        warehouseId: v.warehouseId, reason: v.reason ?? null, productId: l.productId, signed,
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at) || a.code.localeCompare(b.code));
}

/** Whole days from `from` to `to`, both counted. */
function daysBetween(from: string, to: string): number {
  return Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1);
}

const TYPE_LABEL: Record<Move['type'], string> = { NHAP: 'Nhập kho', XUAT: 'Xuất kho', KIEM_KE: 'Kiểm kê' };

// ---------------------------------------------------------------- Hàng không phát sinh lâu ngày
const idle: ReportDef = {
  slug: 'hang-nam-im',
  group: 'stock',
  groups: ['60', '90', '180', '365'],
  run(env, { group }): ReportResult {
    const minDays = Number(group) || 60;
    const today = isoDay();
    const qty = stockByProduct(env);
    const lastAny = new Map<string, string>();
    const lastOut = new Map<string, string>();
    for (const m of moves(env)) {
      lastAny.set(m.productId, m.date); // oldest first, so the last write is the latest date
      if (m.signed < 0) lastOut.set(m.productId, m.date);
    }
    const all = env.data.products()
      .filter((p) => p.type !== 'DICH_VU' && (qty.get(p.id) ?? 0) > 0)
      .map((p) => {
        const q = qty.get(p.id) ?? 0;
        const last = lastAny.get(p.id) ?? null;
        const value = Math.round(q * env.cost.costOf(p.id));
        return {
          id: p.id, code: p.code, name: p.name, link: ['/hang-hoa', p.id], unit: p.baseUnit, qty: q, value,
          last, lastOut: lastOut.get(p.id) ?? null,
          // No voucher at all = idle since before records began; ranks first.
          days: last ? daysBetween(last, today) - 1 : null,
        };
      });
    const rows = all
      .filter((r) => r.days === null || r.days >= minDays)
      .sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity) || b.value - a.value);
    const idleValue = rows.reduce((s, r) => s + r.value, 0);
    const allValue = all.reduce((s, r) => s + r.value, 0);
    return {
      kpis: [
        { label: `Mặt hàng nằm im từ ${minDays} ngày`, value: String(rows.length), tone: rows.length ? 'neg' : undefined },
        { label: 'Giá trị tồn đang nằm im', value: formatVnd(idleValue), sub: allValue ? `${Math.round((idleValue / allValue) * 1000) / 10}% giá trị tồn kho` : undefined },
        { label: 'Mặt hàng còn tồn', value: String(all.length) },
      ],
      columns: [
        { key: 'code', label: 'Mã hàng' },
        { key: 'name', label: 'Mặt hàng', link: 'link' },
        { key: 'unit', label: 'ĐVT' },
        { key: 'qty', label: 'Tồn', kind: 'qty' },
        { key: 'value', label: 'Giá trị tồn', kind: 'money' },
        { key: 'last', label: 'Chứng từ gần nhất', kind: 'date' },
        { key: 'lastOut', label: 'Xuất gần nhất', kind: 'date' },
        { key: 'days', label: 'Số ngày nằm im', kind: 'int' },
      ],
      rows,
      totals: { name: 'TỔNG CỘNG', value: idleValue },
      chart: { title: 'Giá trị tồn nằm im lớn nhất', items: [...rows].sort((a, b) => b.value - a.value).slice(0, 10).map((r) => ({ label: r.name, value: r.value })) },
      emptyHint: `Không có mặt hàng còn tồn nào nằm im từ ${minDays} ngày trở lên.`,
    };
  },
};

// ---------------------------------------------------------------- Thẻ kho
const stockCard: ReportDef = {
  slug: 'the-kho',
  group: 'stock',
  run(env, { range, item }): ReportResult {
    const columns: ReportResult['columns'] = [
      { key: 'date', label: 'Ngày', kind: 'date' },
      { key: 'code', label: 'Số phiếu', link: 'link' },
      { key: 'kind', label: 'Loại' },
      { key: 'warehouse', label: 'Kho' },
      { key: 'reason', label: 'Diễn giải' },
      { key: 'in', label: 'Nhập', kind: 'qty' },
      { key: 'out', label: 'Xuất', kind: 'qty' },
      { key: 'balance', label: 'Tồn', kind: 'qty' },
    ];
    const p = env.data.products().find((x) => x.id === item);
    if (!p) return { columns, rows: [], emptyHint: 'Chọn một mặt hàng để xem thẻ kho.' };

    const warehouses = new Map(env.data.warehouses().map((w) => [w.id, w.name]));
    const mine = moves(env).filter((m) => m.productId === p.id);
    const now = stockByProduct(env).get(p.id) ?? 0;
    const after = mine.filter((m) => m.date > range.to).reduce((s, m) => s + m.signed, 0);
    const inside = mine.filter((m) => inRange(m.date, range));
    const closing = r4(now - after);
    const opening = r4(closing - inside.reduce((s, m) => s + m.signed, 0));

    let balance = opening;
    const openStart = range.from <= '1970-01-01';
    const rows: ReportResult['rows'] = [
      { id: 'opening', date: openStart ? null : range.from, code: '', link: null, kind: 'Tồn đầu kỳ', warehouse: '', reason: '', in: null, out: null, balance: opening },
    ];
    inside.forEach((m, i) => {
      balance = r4(balance + m.signed);
      rows.push({
        id: `${m.voucherId}-${i}`, date: m.date, code: m.code, link: ['/kho/phieu', m.voucherId],
        kind: m.type === 'KIEM_KE' ? (m.signed >= 0 ? 'Kiểm kê thừa' : 'Kiểm kê thiếu') : TYPE_LABEL[m.type],
        warehouse: warehouses.get(m.warehouseId) ?? '', reason: m.reason ?? '',
        in: m.signed > 0 ? m.signed : null, out: m.signed < 0 ? -m.signed : null, balance,
      });
    });
    const totalIn = r4(inside.reduce((s, m) => s + Math.max(0, m.signed), 0));
    const totalOut = r4(inside.reduce((s, m) => s + Math.max(0, -m.signed), 0));
    return {
      kpis: [
        { label: 'Tồn đầu kỳ', value: `${opening.toLocaleString('vi-VN')} ${p.baseUnit}` },
        { label: 'Nhập trong kỳ', value: `${totalIn.toLocaleString('vi-VN')} ${p.baseUnit}`, sub: `${inside.filter((m) => m.signed > 0).length} chứng từ` },
        { label: 'Xuất trong kỳ', value: `${totalOut.toLocaleString('vi-VN')} ${p.baseUnit}`, sub: `${inside.filter((m) => m.signed < 0).length} chứng từ` },
        { label: 'Tồn cuối kỳ', value: `${closing.toLocaleString('vi-VN')} ${p.baseUnit}`, tone: closing < 0 ? 'neg' : undefined },
      ],
      columns,
      rows,
      totals: { kind: 'TỔNG CỘNG', in: totalIn, out: totalOut, balance: closing },
      emptyHint: 'Mặt hàng này chưa có chứng từ kho.',
    };
  },
};

// ---------------------------------------------------------------- Vòng quay tồn kho
const turnover: ReportDef = {
  slug: 'vong-quay-ton-kho',
  group: 'stock',
  run(env, { range }): ReportResult {
    const all = moves(env);
    // An open start counts from the first stock move, not from 1970.
    const from = range.from <= '1970-01-01' ? all[0]?.date ?? range.to : range.from;
    const days = daysBetween(from, range.to);
    const now = stockByProduct(env);
    const out = new Map<string, number>();
    const net = new Map<string, number>();
    const after = new Map<string, number>();
    for (const m of all) {
      if (m.date > range.to) after.set(m.productId, (after.get(m.productId) ?? 0) + m.signed);
      else if (m.date >= from) {
        net.set(m.productId, (net.get(m.productId) ?? 0) + m.signed);
        if (m.type === 'XUAT') out.set(m.productId, (out.get(m.productId) ?? 0) - m.signed);
      }
    }
    const rows = env.data.products()
      .filter((p) => p.type !== 'DICH_VU')
      .map((p) => {
        const closing = r4((now.get(p.id) ?? 0) - (after.get(p.id) ?? 0));
        const opening = r4(closing - (net.get(p.id) ?? 0));
        const used = r4(out.get(p.id) ?? 0);
        const perDay = used / days;
        const avgStock = (Math.max(0, opening) + Math.max(0, closing)) / 2;
        const cost = env.cost.costOf(p.id);
        return {
          id: p.id, code: p.code, name: p.name, link: ['/hang-hoa', p.id], unit: p.baseUnit,
          stock: closing, used, perDay: r4(perDay),
          // Days the stock lasts at this pace; none moved = cannot tell (shown as —).
          cover: perDay > 0 ? Math.round(Math.max(0, closing) / perDay) : null,
          turns: avgStock > 0 ? Math.round((used / avgStock) * 100) / 100 : null,
          value: Math.round(Math.max(0, closing) * cost), usedValue: Math.round(used * cost),
        };
      })
      .filter((r) => r.stock !== 0 || r.used !== 0)
      .sort((a, b) => (b.cover ?? Infinity) - (a.cover ?? Infinity) || b.value - a.value);
    const stockValue = rows.reduce((s, r) => s + r.value, 0);
    const usedValue = rows.reduce((s, r) => s + r.usedValue, 0);
    const overallCover = usedValue > 0 ? Math.round(stockValue / (usedValue / days)) : null;
    const still = rows.filter((r) => r.used === 0 && r.stock > 0);
    return {
      kpis: [
        { label: 'Số ngày tồn toàn kho', value: overallCover === null ? '—' : `${overallCover.toLocaleString('vi-VN')} ngày`, sub: 'giá trị tồn ÷ giá trị xuất bình quân mỗi ngày' },
        { label: 'Giá trị xuất trong kỳ', value: formatVnd(usedValue), sub: `${days} ngày` },
        { label: 'Mặt hàng còn tồn không xuất', value: String(still.length), tone: still.length ? 'neg' : undefined },
      ],
      columns: [
        { key: 'code', label: 'Mã hàng' },
        { key: 'name', label: 'Mặt hàng', link: 'link' },
        { key: 'unit', label: 'ĐVT' },
        { key: 'stock', label: 'Tồn cuối kỳ', kind: 'qty' },
        { key: 'used', label: 'Xuất trong kỳ', kind: 'qty' },
        { key: 'perDay', label: 'Xuất / ngày', kind: 'qty' },
        { key: 'cover', label: 'Số ngày tồn', kind: 'int' },
        { key: 'turns', label: 'Vòng quay', kind: 'qty' },
        { key: 'value', label: 'Giá trị tồn', kind: 'money' },
      ],
      rows,
      totals: { name: 'TỔNG CỘNG', value: stockValue },
      chart: {
        title: 'Giá trị tồn của hàng quay chậm nhất',
        items: rows.filter((r) => r.value > 0).slice(0, 10).map((r) => ({ label: r.name, value: r.value })),
      },
      emptyHint: 'Không có mặt hàng nào còn tồn hoặc có xuất trong kỳ.',
    };
  },
};

export const STOCK_DEFS: ReportDef[] = [stockNow, belowMin, movement, idle, stockCard, turnover];
