// Hoá đơn GTGT dựng từ đơn bán — pure, shared by the invoice preview and (as backend modules/sales/invoice.rules.ts,
// checked by the parity test) the server that phát hành hoá đơn điện tử.
import { SalesOrder } from '../../core/models/domain.models';
import { LineSlice, cents, deliverySlices, orderedSlices, receivedSlices, sliceCalc, toFx } from './sales-order.rules';

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

/** Tổng hợp theo một thuế suất. */
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

/**
 * Hoá đơn GTGT dựng từ đơn bán (như MISA dựng hoá đơn từ chứng từ bán hàng): `slices` là phần của từng dòng trên hoá
 * đơn — một đợt giao (thời điểm chuyển giao hàng hoá, NĐ 123), hoặc cả đơn khi chưa giao. Thành tiền = SL × đơn giá
 * chưa thuế; chiết khấu (dòng + cả đơn) ghi thành dòng "Chiết khấu thương mại" âm theo từng thuế suất; hàng tặng ghi
 * số lượng, thành tiền 0. Tiền thuế lấy đúng phần của đơn, nên tổng thanh toán khớp số tiền đợt đã ghi công nợ.
 * `sign` -1: hoá đơn điều chỉnh giảm (hàng trả lại) — every số lượng and số tiền negative, as the điều chỉnh is shown.
 */
export function invoiceData(
  o: SalesOrder, slices: LineSlice[], productName: (id: string) => string, sign: 1 | -1 = 1, fxRate?: number | null,
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

/**
 * Hoá đơn của đơn thu bằng ngoại tệ (as MISA): đơn giá in nguyên tệ (as typed on the dòng, else VND ÷ tỷ giá), thành
 * tiền = SL × đơn giá, and the tổng worked out from the dòng in nguyên tệ, so the hoá đơn multiplies out and adds up.
 * The tổng thanh toán in VND (the công nợ, from đơn giá VND làm tròn đồng) is kept beside it as the quy đổi.
 */
function inForeignCurrency(o: SalesOrder, slices: LineSlice[], d: InvoiceData, rate: number): InvoiceData {
  let goods = 0;
  const rows = d.rows.map((r) => {
    if (r.kind === 'discount') return { ...r, amount: toFx(r.amount, rate) };
    const l = o.lines[slices[goods++].index]; // goods and gift rows follow the slices, in order
    if (r.kind === 'gift') return r;
    const unitPrice = l.unitPriceFx ?? toFx(l.unitPrice, rate);
    return { ...r, unitPrice, amount: cents((r.quantity ?? 0) * unitPrice) };
  });
  // Per thuế suất: tiền hàng = its dòng hàng and chiết khấu (gift rows carry no thuế suất), thuế on that.
  const groups = d.groups.map((g) => {
    const taxable = cents(rows.filter((r) => r.vatRate === g.vatRate).reduce((s, r) => s + r.amount, 0));
    return { vatRate: g.vatRate, taxable, vat: cents((taxable * g.vatRate) / 100) };
  });
  const taxable = cents(groups.reduce((s, g) => s + g.taxable, 0));
  const vat = cents(groups.reduce((s, g) => s + g.vat, 0));
  return { rows, groups, taxable, vat, total: cents(taxable + vat), vndTotal: d.total };
}

/** Một hoá đơn có thể dựng từ đơn: một đợt giao, hàng đã giao gộp lại, cả đơn theo số đặt, hoặc một phiếu trả hàng. */
export interface InvoiceSource {
  key: string;
  label: string;
  date: string; // ngày lập: ngày khách nhận hàng của đợt; chưa giao thì ngày đặt; trả hàng thì ngày trả
  slices: LineSlice[];
  /** Hoá đơn điều chỉnh giảm cho hàng khách trả lại (phiếu TH…): số âm, ghi lý do và chứng từ gốc. */
  adjust?: { code: string; reason: string };
}

const dmy = (d: string) => d.slice(0, 10).split('-').reverse().join('/');

/**
 * Mỗi đợt giao có chi tiết dòng là một hoá đơn. Đơn chỉ có đợt ghi trước khi có chi tiết: hàng đã giao gộp một hoá
 * đơn, ngày giao gần nhất. Chưa giao: cả đơn theo số đặt, ngày đặt.
 */
export function invoiceSources(o: SalesOrder): InvoiceSource[] {
  return [...saleSources(o), ...returnSources(o)];
}

/**
 * Hàng trả lại giảm doanh thu và thuế đã kê khai: a hoá đơn điều chỉnh giảm per phiếu trả hàng chưa huỷ (NĐ 123, sửa
 * đổi bởi NĐ 70/2025), dated the ngày trả. Its tiền equal the phiếu's giá trị (phần của từng dòng theo số trả).
 */
function returnSources(o: SalesOrder): InvoiceSource[] {
  return (o.returns ?? []).filter((r) => !r.isCancelled).map((r) => ({
    key: r.id, label: `Điều chỉnh giảm · ${r.code} · ${dmy(r.date)} · −${r.amount.toLocaleString('vi-VN')} ₫`, date: r.date,
    slices: r.lines.flatMap((x) => {
      const index = o.lines.findIndex((l) => l.id === x.orderLineId);
      return index < 0 || !(x.quantity > 0) ? [] : [{ index, before: 0, quantity: x.quantity }];
    }),
    adjust: { code: r.code, reason: r.reason },
  }));
}

function saleSources(o: SalesOrder): InvoiceSource[] {
  const all = o.deliveries ?? [];
  const detailed = all.flatMap((d, i) =>
    d.lines.length
      ? [{ key: d.id, label: `Đợt ${i + 1} · ${dmy(d.date)} · ${d.amount.toLocaleString('vi-VN')} ₫`, date: d.date, slices: deliverySlices(o, d.id) }]
      : [],
  );
  if (detailed.length) return detailed;
  const received = receivedSlices(o);
  if (received.length) return [{ key: 'received', label: 'Hàng đã giao', date: o.deliveredDate ?? o.orderDate, slices: received }];
  return [{ key: 'ordered', label: 'Theo số đặt (đơn chưa giao)', date: o.orderDate, slices: orderedSlices(o) }];
}
