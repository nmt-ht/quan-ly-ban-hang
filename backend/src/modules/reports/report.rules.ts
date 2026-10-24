// Shared by báo cáo and tổng quan: number formats, kỳ, giá vốn and doanh thu lines — the same
// as the frontend's shared/format.util.ts, shared/period.ts, CostService and revenue.rules.ts.
import { lineGross, orderTotals } from '../sales/sales-order.rules.js';
import type { ReportData } from './report-data.service.js';

const MINUS = '−'; // U+2212, as on screen

export function formatVnd(amount: number): string {
  const text = Math.abs(amount).toLocaleString('vi-VN') + '₫';
  return amount < 0 ? MINUS + text : text;
}

export const r4 = (n: number) => Math.round(n * 10000) / 10000;
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);

export interface DayRange {
  from?: string | null;
  to?: string | null;
}

export function inRange(date: string, range: DayRange): boolean {
  const d = date.slice(0, 10);
  return (!range.from || d >= range.from) && (!range.to || d <= range.to);
}

/** Today on the server's clock, YYYY-MM-DD (local, like the screens). */
export function isoDay(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Giá vốn theo ĐVT chính hôm nay: the bình quân gia quyền di động InventoryService keeps (Pha 1.3). A product that
 * has none yet (never moved since) falls back to the old estimate: vật tư = giá nhập gần nhất (đơn nhập chưa huỷ),
 * thành phẩm = định mức × giá vật tư, dịch vụ = 0.
 */
export function unitCosts(data: ReportData): Map<string, number> {
  const estimate = estimatedCosts(data);
  const avg = data.averageCosts();
  return new Map([...estimate].map(([id, c]) => [id, avg[id] > 0 ? avg[id] : c]));
}

/** What revenue costs: giá vốn frozen on the phiếu xuất that took the goods out, today's cost where none did. */
export interface CostBook {
  /** Giá vốn hôm nay (tồn kho, định mức …). */
  costOf(productId: string): number;
  /** Giá vốn per base unit of what an order sold: its own phiếu xuất, else those of its chuyến, else today's. */
  issued(orderId: string, productId: string): number;
}

export function costBook(data: ReportData): CostBook {
  const now = unitCosts(data);
  const sum = new Map<string, { q: number; v: number }>();
  const add = (key: string, q: number, c: number) => {
    const s = sum.get(key) ?? { q: 0, v: 0 };
    sum.set(key, { q: s.q + q, v: s.v + q * c });
  };
  for (const x of data.issueCosts()) {
    if (x.salesOrderId) add(`o|${x.salesOrderId}|${x.productId}`, x.quantity, x.unitCost);
    if (x.deliveryTripId) add(`t|${x.deliveryTripId}|${x.productId}`, x.quantity, x.unitCost);
  }
  const trips = new Map<string, string[]>();
  for (const t of data.orderTrips()) trips.set(t.orderId, [...(trips.get(t.orderId) ?? []), t.tripId]);
  const frozen = (keys: string[]) => {
    let q = 0;
    let v = 0;
    for (const k of keys) {
      const s = sum.get(k);
      if (s && s.q > 0) {
        q += s.q;
        v += s.v;
      }
    }
    return q > 0 ? v / q : undefined;
  };
  const costOf = (id: string) => now.get(id) ?? 0;
  return {
    costOf,
    issued: (orderId, productId) =>
      frozen([`o|${orderId}|${productId}`]) ?? frozen((trips.get(orderId) ?? []).map((t) => `t|${t}|${productId}`)) ?? costOf(productId),
  };
}

function estimatedCosts(data: ReportData): Map<string, number> {
  const last = new Map<string, { date: string; price: number }>();
  for (const o of data.purchaseOrders()) {
    if (o.status === 'HUY') continue;
    for (const l of o.lines) {
      const price = l.unitPrice / (l.ratioToBase ?? 1);
      const cur = last.get(l.productId);
      if (!cur || o.date > cur.date) last.set(l.productId, { date: o.date, price });
    }
  }
  const cost = new Map<string, number>();
  for (const p of data.products()) {
    if (p.type === 'DICH_VU') cost.set(p.id, 0);
    else if (p.type === 'THANH_PHAM') {
      const bom = data.bomLines().filter((b) => b.finishedProductId === p.id);
      cost.set(p.id, bom.reduce((s, b) => s + b.quantityPerUnit * (last.get(b.componentId)?.price ?? 0), 0));
    } else cost.set(p.id, last.get(p.id)?.price ?? 0);
  }
  return cost;
}

type Order = ReturnType<ReportData['salesOrders']>[number];

/** One sales line as far as the customer received it. Sum of `total` per order = receivedValue. */
export interface RevenueLine {
  orderId: string;
  orderCode: string;
  date: string; // ngày ghi nhận doanh thu = ngày giao
  customerId: string;
  salesRep: string;
  productId: string;
  baseQty: number; // SL thực nhận, quy về ĐVT chính
  gross: number; // tiền hàng
  discount: number; // chiết khấu dòng + phần chiết khấu đơn phân bổ
  net: number; // doanh thu thuần (chưa thuế)
  vat: number;
  total: number; // tổng thanh toán = phải thu
  /** Set on the negative lines of a phiếu trả hàng (Pha 1.5): counted on the return's date, not the delivery's. */
  returnCode?: string;
}

export function revenueLines(orders: Order[]): RevenueLine[] {
  const out: RevenueLine[] = [];
  for (const o of orders) {
    if (o.status === 'HUY' || !(o.receivedValue > 0)) continue;
    const date = (o.deliveredDate ?? o.orderDate).slice(0, 10);
    const t = orderTotals(o.lines, o.discountAmount);
    o.lines.forEach((l, i) => {
      const got = l.receivedQuantity ?? 0;
      if (!got || !l.quantity) return;
      const share = got / l.quantity;
      // Same rounding as receivedValueOf, so the report ties out to công nợ phải thu to the đồng.
      const total = Math.round(t.lines[i].total * share);
      const vat = Math.round(t.lines[i].vat * share);
      const net = total - vat;
      const gross = Math.round(lineGross(l) * share);
      out.push({
        orderId: o.id, orderCode: o.code, date, customerId: o.customerId, salesRep: o.salesRep, productId: l.productId,
        baseQty: Math.round(got * (l.ratioToBase ?? 1) * 10000) / 10000, gross, discount: gross - net, net, vat, total,
      });
    });
    // Trả hàng: the same line, negative, on the ngày trả — total is the phiếu's own amount, so doanh thu ties to công nợ.
    for (const r of o.returns ?? []) {
      if (r.isCancelled) continue;
      for (const rl of r.lines) {
        const i = o.lines.findIndex((l) => l.id === rl.orderLineId);
        const l = o.lines[i];
        if (i < 0 || !l.quantity) continue;
        const share = rl.quantity / l.quantity;
        const total = -rl.amount;
        const vat = -Math.round(t.lines[i].vat * share);
        const net = total - vat;
        const gross = -Math.round(lineGross(l) * share);
        out.push({
          orderId: o.id, orderCode: o.code, date: r.date.slice(0, 10), customerId: o.customerId, salesRep: o.salesRep, productId: l.productId,
          baseQty: -Math.round(rl.quantity * (l.ratioToBase ?? 1) * 10000) / 10000, gross, discount: gross - net, net, vat, total, returnCode: r.code,
        });
      }
    }
  }
  return out;
}
