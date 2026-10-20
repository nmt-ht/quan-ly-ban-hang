import {
  CustomerType, Product, ProductionOrder, SalesOrder, SalesOrderLine, SalesOrderStatus,
} from '../../core/models/domain.models';
import { round4 } from '../purchase-orders/purchase-order.rules';

// Business rules for Đơn hàng bán — pure functions, shared by the list, the voucher screen and
// SalesOrderService. Money is VND, rounded to whole đồng.
//
// Chiết khấu & thuế (MISA): thành tiền = SL × đơn giá; trừ chiết khấu dòng; chiết khấu cả đơn
// chia theo tỷ lệ giá trị từng dòng sau CK; thuế GTGT tính trên phần còn lại của từng dòng.

export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = { LE: 'Khách lẻ', SI: 'Khách sỉ', DROPSHIP: 'Dropship' };
export const CUSTOMER_PRICE_LABEL: Record<CustomerType, string> = { LE: 'Giá lẻ', SI: 'Giá sỉ', DROPSHIP: 'Giá dropship' };

export const lineQty = (l: SalesOrderLine) => l.quantity ?? 0;
export const lineGross = (l: SalesOrderLine) => Math.round(lineQty(l) * (l.unitPrice ?? 0));
export const lineDiscount = (l: SalesOrderLine) =>
  Math.min(lineGross(l), Math.max(0, l.discountAmount ?? Math.round((lineGross(l) * (l.discountRate ?? 0)) / 100)));
export const lineDelivered = (l: SalesOrderLine) => l.receivedQuantity ?? 0;
export const lineRemaining = (l: SalesOrderLine) => Math.max(0, round4(lineQty(l) - lineDelivered(l)));
export const lineRatio = (l: SalesOrderLine) => l.ratioToBase ?? 1;

export interface LineCalc {
  gross: number;
  lineDiscount: number;
  orderDiscount: number; // phần chiết khấu cả đơn phân bổ cho dòng
  taxable: number;
  vat: number;
  total: number; // phải thu của dòng (gồm thuế)
}

export interface OrderTotals {
  goods: number; // tổng tiền hàng
  lineDiscount: number;
  orderDiscount: number;
  discount: number;
  vat: number;
  total: number; // tổng tiền thanh toán
  lines: LineCalc[];
}

export function orderTotals(lines: SalesOrderLine[], orderDiscount: number): OrderTotals {
  const nets = lines.map((l) => lineGross(l) - lineDiscount(l));
  const netSum = nets.reduce((s, n) => s + n, 0);
  const disc = Math.min(Math.max(0, orderDiscount || 0), netSum);
  let given = 0;
  const calc: LineCalc[] = lines.map((l, i) => {
    // Last line with value takes the rounding remainder so shares add up exactly.
    const isLast = nets.slice(i + 1).every((n) => n === 0);
    const share = netSum === 0 ? 0 : isLast ? disc - given : Math.round((disc * nets[i]) / netSum);
    given += share;
    const taxable = nets[i] - share;
    const vat = Math.round((taxable * (l.vatRate ?? 0)) / 100);
    return { gross: lineGross(l), lineDiscount: lineDiscount(l), orderDiscount: share, taxable, vat, total: taxable + vat };
  });
  const sum = (f: (c: LineCalc) => number) => calc.reduce((s, c) => s + f(c), 0);
  return {
    goods: sum((c) => c.gross),
    lineDiscount: sum((c) => c.lineDiscount),
    orderDiscount: disc,
    discount: sum((c) => c.lineDiscount) + disc,
    vat: sum((c) => c.vat),
    total: sum((c) => c.total),
    lines: calc,
  };
}

/** Giá trị khách thực nhận (= công nợ phải thu): phần phải thu của mỗi dòng theo tỷ lệ đã giao. */
export function receivedValueOf(o: Pick<SalesOrder, 'lines' | 'discountAmount'>): number {
  const t = orderTotals(o.lines, o.discountAmount);
  return o.lines.reduce((s, l, i) => (lineQty(l) > 0 ? s + Math.round((t.lines[i].total * lineDelivered(l)) / lineQty(l)) : s), 0);
}

export function deliveredPercent(o: SalesOrder): number {
  return o.totalOrder > 0 ? Math.min(100, Math.round((o.receivedValue / o.totalOrder) * 100)) : 0;
}

/** Đơn giá theo loại khách, theo ĐVT của dòng (đơn vị quy đổi có giá riêng thì dùng giá đó). */
export function priceFor(p: Product, type: CustomerType, unitName: string): number {
  const base = type === 'SI' ? p.wholesalePrice : type === 'DROPSHIP' ? p.dropshipPrice : p.retailPrice;
  const uc = unitName ? p.unitConversions.find((u) => u.unitName === unitName) : undefined;
  if (!uc) return base;
  const listed = type === 'SI' ? uc.wholesalePrice : type === 'DROPSHIP' ? uc.dropshipPrice : uc.price;
  return listed || Math.round(base * uc.ratioToBaseUnit);
}

/** Kho xuất mặc định: thành phẩm về Kho thành phẩm; dịch vụ không có kho. */
export function defaultWarehouse(p: Product | undefined): string {
  if (!p || p.type === 'DICH_VU') return '';
  return p.defaultWarehouseId ?? (p.type === 'THANH_PHAM' ? 'wh-thanhpham' : '');
}

export const needsProduction = (p: Product | undefined) => p?.type === 'THANH_PHAM';
export const movesStock = (p: Product | undefined) => !!p && p.type !== 'DICH_VU';

// ---------- trạng thái ----------

const activeLsx = (lsx: ProductionOrder[]) => lsx.filter((x) => x.status !== 'HUY');

/**
 * Status from what has happened: giao hàng first, then sản xuất.
 * Chờ sản xuất → Đang sản xuất → Chờ giao hàng → Giao một phần / Hoàn thành; Huỷ is terminal.
 * Đang giao / Trả toàn bộ come from Chuyến giao hàng and are kept until a delivery changes them.
 */
export function deriveStatus(o: SalesOrder, lsx: ProductionOrder[], isTp: (productId: string) => boolean): SalesOrderStatus {
  if (o.status === 'HUY') return 'HUY';
  const delivered = o.lines.some((l) => lineDelivered(l) > 0);
  if (delivered) return o.lines.every((l) => lineRemaining(l) === 0) ? 'HOAN_THANH' : 'GIAO_MOT_PHAN';
  if (o.status === 'DANG_GIAO' || o.status === 'TRA_TOAN_BO') return o.status;
  const tpLines = o.lines.filter((l) => isTp(l.productId));
  if (!tpLines.length) return 'CHO_GIAO_HANG';
  const active = activeLsx(lsx);
  const covered = tpLines.every((l) => active.some((x) => x.productId === l.productId));
  if (covered && active.every((x) => x.status === 'HOAN_TAT')) return 'CHO_GIAO_HANG';
  if (active.some((x) => x.status === 'DANG_SAN_XUAT' || x.status === 'HOAN_TAT')) return 'DANG_SAN_XUAT';
  return 'CHO_SAN_XUAT';
}

export const isDelivered = (o: SalesOrder) => o.lines.some((l) => lineDelivered(l) > 0) || o.receivedValue > 0;

export const canEdit = (o: SalesOrder, lsx: ProductionOrder[]) =>
  (o.status === 'CHO_SAN_XUAT' || o.status === 'CHO_GIAO_HANG') && !isDelivered(o) &&
  !lsx.some((x) => x.status === 'DANG_SAN_XUAT' || x.status === 'HOAN_TAT');

export const canCancel = (o: SalesOrder) => o.status !== 'HUY' && !isDelivered(o) && o.status !== 'DANG_GIAO';

export const canDeliver = (o: SalesOrder) =>
  (o.status === 'CHO_GIAO_HANG' || o.status === 'GIAO_MOT_PHAN' || o.status === 'DANG_GIAO') &&
  !o.closedDate && o.lines.some((l) => lineRemaining(l) > 0);

export const canClose = (o: SalesOrder) => o.status === 'GIAO_MOT_PHAN' && !o.closedDate;

/** Thành phẩm lines that have no (non-cancelled) lệnh sản xuất yet. */
export function linesNeedingLsx(o: SalesOrder, lsx: ProductionOrder[], isTp: (productId: string) => boolean): number[] {
  if (o.status === 'HUY' || isDelivered(o)) return [];
  const active = activeLsx(lsx);
  return o.lines.flatMap((l, i) => (isTp(l.productId) && !active.some((x) => x.productId === l.productId) ? [i] : []));
}
