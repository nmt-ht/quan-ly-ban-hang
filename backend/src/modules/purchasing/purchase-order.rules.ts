// Business rules for Đơn nhập hàng — the same as the frontend's features/purchase-orders/purchase-order.rules.ts.
//  - An order never touches stock; stock and công nợ phải trả appear only on "Nhận hàng" (phiếu nhập kho).
//  - Lifecycle: Nháp → Đã gửi NCC → Nhận một phần / Đã nhận đủ → Hoàn tất; Huỷ branch.
// Money: line amounts exclude VAT; totalValue / receivedValue include VAT (= công nợ phải trả once received).
import { PurchaseOrderStatus } from '@prisma/client';

export interface LineNumbers {
  quantity: number;
  unitPrice: number;
  receivedQuantity: number;
  vatRate: number;
}

export const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

const lineAmount = (l: LineNumbers) => Math.round(l.quantity * l.unitPrice);
const lineVat = (l: LineNumbers) => Math.round((lineAmount(l) * l.vatRate) / 100);
const lineReceivedTotal = (l: LineNumbers) => Math.round(l.receivedQuantity * l.unitPrice * (1 + l.vatRate / 100));

export const totalValueOf = (lines: LineNumbers[]) => lines.reduce((s, l) => s + lineAmount(l) + lineVat(l), 0);
export const receivedValueOf = (lines: LineNumbers[]) => lines.reduce((s, l) => s + lineReceivedTotal(l), 0);

export const canEdit = (s: PurchaseOrderStatus) => s === 'NHAP';
export const canSend = (s: PurchaseOrderStatus) => s === 'NHAP';
export const canReceive = (s: PurchaseOrderStatus) => s === 'DA_GUI_NCC' || s === 'NHAN_MOT_PHAN';
// "Đã nhận đủ" closes into "Hoàn tất"; a partly received order can also be closed short.
export const canComplete = (s: PurchaseOrderStatus) => s === 'DA_NHAN_DU' || s === 'NHAN_MOT_PHAN';
// Once goods are in, the order cannot be cancelled (stock and công nợ already exist).
export const canCancel = (s: PurchaseOrderStatus, receivedValue: number) => (s === 'NHAP' || s === 'DA_GUI_NCC') && receivedValue === 0;

export function statusAfterReceipt(lines: LineNumbers[]): PurchaseOrderStatus {
  const anyReceived = lines.some((l) => l.receivedQuantity > 0);
  const allReceived = lines.every((l) => l.receivedQuantity >= l.quantity);
  return allReceived ? 'DA_NHAN_DU' : anyReceived ? 'NHAN_MOT_PHAN' : 'DA_GUI_NCC';
}

export const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  NHAP: 'Nháp', DA_GUI_NCC: 'Đã gửi NCC', NHAN_MOT_PHAN: 'Nhận một phần', DA_NHAN_DU: 'Đã nhận đủ', HOAN_TAT: 'Hoàn tất', HUY: 'Đã huỷ',
};
