import { SalesOrder } from '../../../core/models/domain.models';
import { lineGross, orderTotals } from '../../sales-orders/sales-order.rules';

// Báo cáo Doanh thu (slug ban-hang). Doanh thu ghi nhận khi khách THỰC NHẬN hàng, đúng bằng số đã
// vào công nợ phải thu (receivedValue, ngày = ngày giao — như DebtService). Chiết khấu cả đơn phân
// bổ về từng dòng theo tỷ lệ giá trị (orderTotals). Pure functions — no Angular here.

/** One sales line as far as the customer received it. Sum of `total` per order = receivedValue. */
export interface RevenueLine {
  orderId: string;
  orderCode: string;
  date: string; // ngày ghi nhận doanh thu
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

export function revenueLines(orders: SalesOrder[]): RevenueLine[] {
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

export interface RevenueSums {
  orders: number;
  customers: number;
  qty: number;
  gross: number;
  discount: number;
  net: number;
  vat: number;
  total: number;
}

export function sumLines(lines: RevenueLine[]): RevenueSums {
  const s = { orders: 0, customers: 0, qty: 0, gross: 0, discount: 0, net: 0, vat: 0, total: 0 };
  for (const l of lines) {
    s.qty += l.baseQty;
    s.gross += l.gross;
    s.discount += l.discount;
    s.net += l.net;
    s.vat += l.vat;
    s.total += l.total;
  }
  s.qty = Math.round(s.qty * 10000) / 10000;
  s.orders = new Set(lines.map((l) => l.orderId)).size;
  s.customers = new Set(lines.map((l) => l.customerId)).size;
  return s;
}

// ---------- kỳ thời gian ----------

export type TimeUnit = 'day' | 'week' | 'month';
export const TIME_UNIT_LABEL: Record<TimeUnit, string> = { day: 'Ngày', week: 'Tuần', month: 'Tháng' };

const DAY = 86_400_000;
const ms = (iso: string) => new Date(iso + 'T00:00:00').getTime();
const iso = (t: number) => {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Ngày nếu kỳ ≤ 31 ngày, tuần nếu ≤ 120 ngày, còn lại theo tháng. */
export function autoUnit(from: string, to: string): TimeUnit {
  const days = Math.round((ms(to) - ms(from)) / DAY) + 1;
  return days <= 31 ? 'day' : days <= 120 ? 'week' : 'month';
}

/** Key of the bucket a day falls in: the day, the Monday of its week, or 'YYYY-MM'. */
export function bucketOf(date: string, unit: TimeUnit): string {
  if (unit === 'month') return date.slice(0, 7);
  if (unit === 'day') return date;
  const t = ms(date);
  const dow = (new Date(t).getDay() + 6) % 7;
  return iso(t - dow * DAY);
}

/** Every bucket from `from` to `to`, so empty days/weeks/months still show on the chart. */
export function bucketsBetween(from: string, to: string, unit: TimeUnit): string[] {
  const keys: string[] = [];
  let t = ms(bucketOf(from, unit) + (unit === 'month' ? '-01' : ''));
  const end = ms(to);
  while (t <= end && keys.length < 400) {
    const k = bucketOf(iso(t), unit);
    keys.push(k);
    if (unit === 'month') {
      const d = new Date(t);
      t = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    } else {
      t += (unit === 'day' ? 1 : 7) * DAY;
    }
  }
  return keys;
}

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export function bucketLabel(key: string, unit: TimeUnit): string {
  if (unit === 'month') return `Tháng ${key.slice(5, 7)}/${key.slice(0, 4)}`;
  if (unit === 'day') return `${dm(key)}/${key.slice(0, 4)}`;
  return `Tuần ${dm(key)} – ${dm(iso(ms(key) + 6 * DAY))}`;
}

export function shortBucketLabel(key: string, unit: TimeUnit): string {
  if (unit === 'month') return `${key.slice(5, 7)}/${key.slice(2, 4)}`;
  if (unit === 'day') return key.slice(8, 10);
  return dm(key);
}

/** Kỳ trước cùng độ dài, ngay trước `from`. */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const len = Math.round((ms(to) - ms(from)) / DAY) + 1;
  return { from: iso(ms(from) - len * DAY), to: iso(ms(from) - DAY) };
}
