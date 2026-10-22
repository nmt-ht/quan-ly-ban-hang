// Business rules for Đơn hàng bán — the same as the frontend's features/sales-orders/sales-order.rules.ts.
// Chiết khấu & thuế (MISA): thành tiền = SL × đơn giá; trừ chiết khấu dòng; chiết khấu cả đơn chia
// theo tỷ lệ giá trị từng dòng sau CK; thuế GTGT tính trên phần còn lại của từng dòng. VND, whole đồng.
import { CustomerType, ProductType, SalesOrderStatus } from '@prisma/client';

export const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

export interface SaleLine {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountRate?: number | null;
  discountAmount?: number | null; // when absent, taken from discountRate
  vatRate: number;
  receivedQuantity: number;
  ratioToBase: number;
}

const gross = (l: SaleLine) => Math.round(l.quantity * l.unitPrice);
export const lineDiscount = (l: SaleLine) =>
  Math.min(gross(l), Math.max(0, l.discountAmount ?? Math.round((gross(l) * (l.discountRate ?? 0)) / 100)));
export const lineGross = gross;
export const lineRemaining = (l: SaleLine) => Math.max(0, round4(l.quantity - l.receivedQuantity));

export function orderTotals(lines: SaleLine[], orderDiscount: number) {
  const nets = lines.map((l) => gross(l) - lineDiscount(l));
  const netSum = nets.reduce((s, n) => s + n, 0);
  const disc = Math.min(Math.max(0, orderDiscount || 0), netSum);
  let given = 0;
  const calc = lines.map((l, i) => {
    // Last line with value takes the rounding remainder so shares add up exactly.
    const isLast = nets.slice(i + 1).every((n) => n === 0);
    const share = netSum === 0 ? 0 : isLast ? disc - given : Math.round((disc * nets[i]) / netSum);
    given += share;
    const taxable = nets[i] - share;
    const vat = Math.round((taxable * l.vatRate) / 100);
    return { gross: gross(l), lineDiscount: lineDiscount(l), orderDiscount: share, taxable, vat, total: taxable + vat };
  });
  return {
    goods: calc.reduce((s, c) => s + c.gross, 0),
    vat: calc.reduce((s, c) => s + c.vat, 0),
    total: calc.reduce((s, c) => s + c.total, 0),
    lines: calc,
  };
}

/** Giá trị khách thực nhận (= công nợ phải thu): phần phải thu của mỗi dòng theo tỷ lệ đã giao. */
export function receivedValueOf(lines: SaleLine[], orderDiscount: number): number {
  const t = orderTotals(lines, orderDiscount);
  return lines.reduce((s, l, i) => (l.quantity > 0 ? s + Math.round((t.lines[i].total * l.receivedQuantity) / l.quantity) : s), 0);
}

export interface PriceSource {
  type: ProductType;
  retailPrice: number;
  wholesalePrice: number;
  dropshipPrice: number;
  unitConversions: { unitName: string; ratioToBaseUnit: number; price: number; wholesalePrice: number | null; dropshipPrice: number | null }[];
}

/** Đơn giá theo loại khách, theo ĐVT của dòng (đơn vị quy đổi có giá riêng thì dùng giá đó). */
export function priceFor(p: PriceSource, type: CustomerType, unitName: string | null | undefined): number {
  const base = type === 'SI' ? p.wholesalePrice : type === 'DROPSHIP' ? p.dropshipPrice : p.retailPrice;
  const uc = unitName ? p.unitConversions.find((u) => u.unitName === unitName) : undefined;
  if (!uc) return base;
  const listed = type === 'SI' ? uc.wholesalePrice : type === 'DROPSHIP' ? uc.dropshipPrice : uc.price;
  return listed || Math.round(base * uc.ratioToBaseUnit);
}

export interface LsxState {
  productId: string;
  status: 'NHAP' | 'DANG_SAN_XUAT' | 'HOAN_TAT' | 'HUY';
}

interface OrderState {
  status: SalesOrderStatus;
  lines: SaleLine[];
  receivedValue: number;
  closedDate?: Date | string | null;
}

const activeLsx = (lsx: LsxState[]) => lsx.filter((x) => x.status !== 'HUY');

/**
 * Status from what has happened: giao hàng first, then sản xuất.
 * Chờ sản xuất → Đang sản xuất → Chờ giao hàng → Giao một phần / Hoàn thành; Huỷ is terminal.
 * Đang giao / Trả toàn bộ come from Chuyến giao hàng and are kept until a delivery changes them.
 */
export function deriveStatus(o: OrderState, lsx: LsxState[], isTp: (productId: string) => boolean): SalesOrderStatus {
  if (o.status === 'HUY') return 'HUY';
  const delivered = o.lines.some((l) => l.receivedQuantity > 0);
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

const isDelivered = (o: OrderState) => o.lines.some((l) => l.receivedQuantity > 0) || o.receivedValue > 0;

export const canEdit = (o: OrderState, lsx: LsxState[]) =>
  (o.status === 'CHO_SAN_XUAT' || o.status === 'CHO_GIAO_HANG') && !isDelivered(o) &&
  !lsx.some((x) => x.status === 'DANG_SAN_XUAT' || x.status === 'HOAN_TAT');

export const canCancel = (o: OrderState) => o.status !== 'HUY' && !isDelivered(o) && o.status !== 'DANG_GIAO';

export const canDeliver = (o: OrderState) =>
  (o.status === 'CHO_GIAO_HANG' || o.status === 'GIAO_MOT_PHAN' || o.status === 'DANG_GIAO') &&
  !o.closedDate && o.lines.some((l) => lineRemaining(l) > 0);

export const canClose = (o: OrderState) => o.status === 'GIAO_MOT_PHAN' && !o.closedDate;

/** Indexes of thành phẩm lines that have no (non-cancelled) lệnh sản xuất yet. */
export function linesNeedingLsx(o: OrderState, lsx: LsxState[], isTp: (productId: string) => boolean): number[] {
  if (o.status === 'HUY' || isDelivered(o)) return [];
  const active = activeLsx(lsx);
  return o.lines.flatMap((l, i) => (isTp(l.productId) && !active.some((x) => x.productId === l.productId) ? [i] : []));
}

export const STATUS_LABEL: Record<SalesOrderStatus, string> = {
  CHO_SAN_XUAT: 'Chờ sản xuất', DANG_SAN_XUAT: 'Đang sản xuất', CHO_GIAO_HANG: 'Chờ giao hàng', DANG_GIAO: 'Đang giao',
  HOAN_THANH: 'Hoàn thành', GIAO_MOT_PHAN: 'Giao một phần', TRA_TOAN_BO: 'Trả toàn bộ', HUY: 'Đã huỷ',
};
