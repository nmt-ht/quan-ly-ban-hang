import { formatVnd } from '../../../shared/format.util';
import { inRange } from '../../../shared/period';
import { ReportDef, ReportEnv, ReportResult } from '../report.types';

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
  label: 'Tồn kho hiện tại',
  group: 'stock',
  summary: 'Tồn và giá trị tồn tại thời điểm xem, theo mặt hàng hoặc theo kho.',
  kind: 'snapshot',
  groups: [
    { value: 'product', label: 'Theo mặt hàng' },
    { value: 'warehouse', label: 'Theo kho' },
  ],
  searchHint: 'Tìm mã, tên mặt hàng hoặc kho…',
  notes: [
    'Báo cáo hiện trạng: tính tại thời điểm xem, không lọc theo ngày. Chỉ vật tư và thành phẩm (dịch vụ không có tồn); tồn âm giữ nguyên, không làm tròn về 0.',
    'Giá trị tồn = tồn dương × giá vốn ước tính (xem Lãi gộp); tồn âm không làm giá trị âm. Hàng đã lên xe chưa chốt giao đã trừ khỏi tồn kho.',
  ],
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
        { key: 'name', label: 'Mặt hàng', link: (r) => r['link'] },
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
  label: 'Hàng dưới tồn tối thiểu',
  group: 'stock',
  summary: 'Mặt hàng tồn thấp hơn mức tối thiểu đã đặt — cần nhập thêm, kèm số tiền ước tính để bù.',
  kind: 'snapshot',
  searchHint: 'Tìm mã hoặc tên mặt hàng…',
  notes: [
    'Chỉ mặt hàng còn kinh doanh, không phải dịch vụ và có tồn tối thiểu > 0; so sánh tổng tồn các kho với mức tối thiểu.',
    'Tiền cần bù = số thiếu × giá vốn ước tính hiện tại (không phải giá chào của nhà cung cấp). Xếp theo tiền cần bù giảm dần.',
  ],
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
        { key: 'name', label: 'Mặt hàng', link: (r) => r['link'] },
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
  label: 'Nhập xuất tồn',
  group: 'stock',
  summary: 'Tồn đầu kỳ, nhập, xuất và tồn cuối kỳ của từng mặt hàng (ĐVT chính).',
  kind: 'period',
  searchHint: 'Tìm mã hoặc tên mặt hàng…',
  notes: [
    'Cộng dồn từ chứng từ kho, quy về ĐVT chính. Chuyển kho giữa các kho không đổi tổng tồn nên không hiện; kiểm kê thừa tính vào Nhập, thiếu tính vào Xuất.',
    'Tồn cuối kỳ = tồn đầu + nhập − xuất. Tồn đầu và cuối được suy ra từ tồn hiện tại và các biến động; phiếu đã huỷ không tính.',
  ],
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
        { key: 'name', label: 'Mặt hàng', link: (r) => r['link'] },
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

export const STOCK_DEFS: ReportDef[] = [stockNow, belowMin, movement];
