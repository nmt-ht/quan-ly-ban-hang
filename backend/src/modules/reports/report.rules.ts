// Shared by báo cáo and tổng quan: number formats, kỳ, giá vốn ước tính and doanh thu lines — the same
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
 * Giá vốn ước tính theo ĐVT chính — there is no costing engine yet: vật tư = giá nhập gần nhất (đơn
 * nhập chưa huỷ), thành phẩm = định mức × giá vật tư, dịch vụ = 0.
 */
export function unitCosts(data: ReportData): Map<string, number> {
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
  }
  return out;
}
