// Hoá đơn GTGT dựng từ đơn bán — the same rules as the frontend's features/sales-orders/invoice.rules.ts (the parity
// test runs both on the same orders and wants them equal to the đồng). The server uses this to phát hành hoá đơn điện
// tử: what goes to the provider is what the screen previewed.
import { SaleLine, orderTotals, round4 } from './sales-order.rules.js';

export interface InvoiceLine extends SaleLine {
  id: string;
  unit: string;
  /** Đơn giá nguyên tệ (đơn bán bằng ngoại tệ); null on a VND đơn. */
  unitPriceFx?: number | null;
  isGift?: boolean;
  length?: number | null;
  width?: number | null;
}

export interface InvoiceOrder {
  lines: InvoiceLine[];
  discountAmount: number;
  deliveries?: { id: string; lines: { orderLineId: string; quantity: number }[] }[];
}

/** Phần của một dòng trên hoá đơn: `quantity` nhận thêm sau `before` đã nhận (ĐVT của dòng). */
export interface LineSlice {
  index: number;
  before: number;
  quantity: number;
}

export interface SliceCalc {
  gross: number;
  lineDiscount: number;
  orderDiscount: number;
  taxable: number;
  vat: number;
  total: number;
}

/** One row of the goods table: hàng hoá, hàng khuyến mại or a chiết khấu thương mại row (negative). */
export interface InvoiceRow {
  no: number;
  /** The order line it comes from (goods and gift rows); null on a chiết khấu row. */
  lineId: string | null;
  name: string;
  unit: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number;
  vatRate: number | null;
  kind: 'goods' | 'gift' | 'discount';
}

export interface InvoiceRateGroup {
  vatRate: number;
  taxable: number;
  vat: number;
}

export interface InvoiceData {
  rows: InvoiceRow[];
  groups: InvoiceRateGroup[];
  taxable: number;
  vat: number;
  total: number;
  /** Hoá đơn bằng ngoại tệ: every số tiền above is nguyên tệ; this is the tổng thanh toán quy đổi ra VND. */
  vndTotal?: number;
}

export const cents = (n: number) => Math.round(n * 100) / 100;
export const toFx = (vnd: number, rate: number) => cents(vnd / rate);

/**
 * Tiền của từng phần dòng: phần của dòng theo số đã nhận cộng dồn, trừ phần đã tính trước đó — làm tròn như
 * receivedValueOf, nên các đợt cộng lại đúng bằng giá trị khách nhận và mỗi đợt đúng số tiền đã ghi công nợ.
 */
export function sliceCalc(o: Pick<InvoiceOrder, 'lines' | 'discountAmount'>, slices: LineSlice[]): SliceCalc[] {
  const t = orderTotals(o.lines, o.discountAmount);
  return slices.map(({ index, before, quantity }) => {
    const c = t.lines[index];
    const q = o.lines[index].quantity;
    const part = (v: number) => (q > 0 ? Math.round((v * (before + quantity)) / q) - Math.round((v * before) / q) : 0);
    const gross = part(c.gross);
    const lineDiscountPart = part(c.lineDiscount);
    const taxable = part(c.taxable);
    const total = part(c.total);
    return { gross, lineDiscount: lineDiscountPart, orderDiscount: gross - lineDiscountPart - taxable, taxable, vat: total - taxable, total };
  });
}

/** Cả đơn theo số đặt (chưa giao). */
export const orderedSlices = (o: Pick<InvoiceOrder, 'lines'>): LineSlice[] => o.lines.map((l, index) => ({ index, before: 0, quantity: l.quantity }));

/** Mọi hàng khách đã nhận, gộp một lần. */
export const receivedSlices = (o: Pick<InvoiceOrder, 'lines'>): LineSlice[] =>
  o.lines.flatMap((l, index) => (l.receivedQuantity > 0 ? [{ index, before: 0, quantity: l.receivedQuantity }] : []));

/** Các dòng của một đợt giao (`deliveries` oldest first). */
export function deliverySlices(o: Pick<InvoiceOrder, 'lines' | 'deliveries'>, deliveryId: string): LineSlice[] {
  const list = o.deliveries ?? [];
  const at = list.findIndex((d) => d.id === deliveryId);
  if (at < 0) return [];
  const later = new Map<string, number>();
  for (const d of list.slice(at + 1)) for (const x of d.lines) later.set(x.orderLineId, (later.get(x.orderLineId) ?? 0) + x.quantity);
  return list[at].lines.flatMap((x) => {
    const index = o.lines.findIndex((l) => l.id === x.orderLineId);
    if (index < 0) return [];
    const after = round4(o.lines[index].receivedQuantity - (later.get(x.orderLineId) ?? 0));
    return [{ index, before: Math.max(0, round4(after - x.quantity)), quantity: x.quantity }];
  });
}

/**
 * Thành tiền = SL × đơn giá chưa thuế; chiết khấu (dòng + cả đơn) ghi thành dòng "Chiết khấu thương mại" âm theo từng
 * thuế suất; hàng tặng ghi số lượng, thành tiền 0. `sign` -1: hoá đơn điều chỉnh giảm (hàng trả lại).
 */
export function invoiceData(
  o: InvoiceOrder, slices: LineSlice[], productName: (id: string) => string, sign: 1 | -1 = 1, fxRate?: number | null,
): InvoiceData {
  const calc = sliceCalc(o, slices).map((c) => ({
    gross: sign * c.gross, lineDiscount: sign * c.lineDiscount, orderDiscount: sign * c.orderDiscount, taxable: sign * c.taxable, vat: sign * c.vat, total: sign * c.total,
  }));
  const rows: InvoiceRow[] = [];
  const groups = new Map<number, InvoiceRateGroup & { discount: number }>();
  slices.forEach((s, i) => {
    const l = o.lines[s.index];
    const c = calc[i];
    const size = l.length && l.width ? ` (${l.length}×${l.width} cm)` : '';
    const name = productName(l.productId) + size;
    if (l.isGift) {
      rows.push({ no: 0, lineId: l.id, name: `${name} (Hàng khuyến mại không thu tiền)`, unit: l.unit, quantity: sign * s.quantity, unitPrice: null, amount: 0, vatRate: null, kind: 'gift' });
      return;
    }
    const rate = l.vatRate ?? 0;
    rows.push({ no: 0, lineId: l.id, name, unit: l.unit, quantity: sign * s.quantity, unitPrice: l.unitPrice, amount: c.gross, vatRate: rate, kind: 'goods' });
    const g = groups.get(rate) ?? { vatRate: rate, taxable: 0, vat: 0, discount: 0 };
    g.taxable += c.taxable;
    g.vat += c.vat;
    g.discount += c.lineDiscount + c.orderDiscount;
    groups.set(rate, g);
  });
  const sorted = [...groups.values()].sort((a, b) => b.vatRate - a.vatRate);
  for (const g of sorted) {
    if (!g.discount) continue;
    const name = sorted.length > 1 ? `Chiết khấu thương mại (hàng thuế suất ${g.vatRate}%)` : 'Chiết khấu thương mại';
    rows.push({ no: 0, lineId: null, name, unit: '', quantity: null, unitPrice: null, amount: -g.discount, vatRate: g.vatRate, kind: 'discount' });
  }
  rows.forEach((r, i) => (r.no = i + 1));
  const data: InvoiceData = {
    rows,
    groups: sorted.map(({ vatRate, taxable, vat }) => ({ vatRate, taxable, vat })),
    taxable: calc.reduce((s, c) => s + c.taxable, 0),
    vat: calc.reduce((s, c) => s + c.vat, 0),
    total: calc.reduce((s, c) => s + c.total, 0),
  };
  return fxRate ? inForeignCurrency(o, slices, data, fxRate) : data;
}

/** Đơn thu bằng ngoại tệ: đơn giá nguyên tệ, tổng tính từ dòng nguyên tệ; tổng VND (công nợ) giữ làm quy đổi. */
function inForeignCurrency(o: InvoiceOrder, slices: LineSlice[], d: InvoiceData, rate: number): InvoiceData {
  let goods = 0;
  const rows = d.rows.map((r) => {
    if (r.kind === 'discount') return { ...r, amount: toFx(r.amount, rate) };
    const l = o.lines[slices[goods++].index];
    if (r.kind === 'gift') return r;
    const unitPrice = l.unitPriceFx ?? toFx(l.unitPrice, rate);
    return { ...r, unitPrice, amount: cents((r.quantity ?? 0) * unitPrice) };
  });
  const groups = d.groups.map((g) => {
    const taxable = cents(rows.filter((r) => r.vatRate === g.vatRate).reduce((s, r) => s + r.amount, 0));
    return { vatRate: g.vatRate, taxable, vat: cents((taxable * g.vatRate) / 100) };
  });
  const taxable = cents(groups.reduce((s, g) => s + g.taxable, 0));
  const vat = cents(groups.reduce((s, g) => s + g.vat, 0));
  return { rows, groups, taxable, vat, total: cents(taxable + vat), vndTotal: d.total };
}
