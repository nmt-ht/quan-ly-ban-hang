// Business rules for Đơn nhập hàng, shared by the list and the voucher screen.
// Source: production UI (crawl 06-don-nhap-hang) §3.
//  - An order never touches stock; stock and công nợ phải trả appear only on "Nhận hàng",
//    which writes a phiếu nhập kho.
//  - Lifecycle: Nháp → Đã gửi NCC → Nhận một phần / Đã nhận đủ → Hoàn tất; Huỷ branch.
// Money: line amounts exclude VAT; totalValue / receivedValue include VAT (= tổng thanh toán,
// = công nợ phải trả once received).
import { PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus } from '../../core/models/domain.models';

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export const lineAmount = (l: PurchaseOrderLine) => Math.round(l.quantity * l.unitPrice);
export const lineVat = (l: PurchaseOrderLine) => Math.round((lineAmount(l) * (l.vatRate ?? 0)) / 100);
export const lineTotal = (l: PurchaseOrderLine) => lineAmount(l) + lineVat(l);
export const lineReceivedTotal = (l: PurchaseOrderLine) =>
  Math.round(l.receivedQuantity * l.unitPrice * (1 + (l.vatRate ?? 0) / 100));
export const lineRemaining = (l: PurchaseOrderLine) => Math.max(0, round4(l.quantity - l.receivedQuantity));
export const lineRatio = (l: PurchaseOrderLine) => l.ratioToBase ?? 1;

export function orderTotals(lines: PurchaseOrderLine[]) {
  const goods = lines.reduce((s, l) => s + lineAmount(l), 0);
  const vat = lines.reduce((s, l) => s + lineVat(l), 0);
  return { goods, vat, total: goods + vat };
}

export function receivedValueOf(lines: PurchaseOrderLine[]): number {
  return lines.reduce((s, l) => s + lineReceivedTotal(l), 0);
}

export function receivedPercent(o: PurchaseOrder): number {
  return o.totalValue ? Math.round((o.receivedValue / o.totalValue) * 100) : 0;
}

export const canEdit = (s: PurchaseOrderStatus) => s === 'NHAP';
export const canSend = (s: PurchaseOrderStatus) => s === 'NHAP';
export const canReceive = (s: PurchaseOrderStatus) => s === 'DA_GUI_NCC' || s === 'NHAN_MOT_PHAN';
// "Đã nhận đủ" closes into "Hoàn tất"; a partly received order can also be closed short.
export const canComplete = (s: PurchaseOrderStatus) => s === 'DA_NHAN_DU' || s === 'NHAN_MOT_PHAN';
// Once goods are in, the order cannot be cancelled (stock and công nợ already exist).
export const canCancel = (o: PurchaseOrder) => (o.status === 'NHAP' || o.status === 'DA_GUI_NCC') && o.receivedValue === 0;

export function statusAfterReceipt(lines: PurchaseOrderLine[]): PurchaseOrderStatus {
  const anyReceived = lines.some((l) => l.receivedQuantity > 0);
  const allReceived = lines.every((l) => l.receivedQuantity >= l.quantity);
  return allReceived ? 'DA_NHAN_DU' : anyReceived ? 'NHAN_MOT_PHAN' : 'DA_GUI_NCC';
}

export function nextCode(codes: string[], prefix: string): string {
  const re = new RegExp(`^${prefix}(\\d+)$`);
  const max = codes.reduce((m, c) => Math.max(m, Number(re.exec(c)?.[1] ?? 0)), 0);
  return prefix + String(max + 1).padStart(7, '0');
}

export const VAT_RATES = [0, 5, 8, 10];
