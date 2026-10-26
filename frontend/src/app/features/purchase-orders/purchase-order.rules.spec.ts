import { PurchaseOrder, PurchaseOrderLine } from '../../core/models/domain.models';
import {
  canCancel, canComplete, canEdit, canReceive, canSend, lineReceivedTotal, lineRemaining, orderTotals, receivedPercent,
  receivedValueOf, statusAfterReceipt,
} from './purchase-order.rules';

const line = (quantity: number, unitPrice: number, receivedQuantity = 0, vatRate = 0) =>
  ({ productId: 'p', quantity, unitPrice, receivedQuantity, vatRate }) as PurchaseOrderLine;
const order = (status: PurchaseOrder['status'], lines: PurchaseOrderLine[], extra: Partial<PurchaseOrder> = {}) =>
  ({ id: 'o', code: 'DN', supplierId: 'ncc', status, date: '2026-10-26', lines, totalValue: 0, receivedValue: 0, ...extra }) as PurchaseOrder;

describe('đơn nhập hàng: tiền', () => {
  it('tiền hàng chưa thuế, thuế theo dòng, tổng thanh toán gồm thuế', () => {
    expect(orderTotals([line(10, 120000, 0, 10), line(3, 1500)])).toEqual({ goods: 1_204_500, vat: 120_000, total: 1_324_500 });
  });

  it('giá trị đã nhận (= công nợ phải trả) theo số đã nhận, gồm thuế', () => {
    expect(lineReceivedTotal(line(10, 120000, 4, 10))).toBe(528_000);
    expect(receivedValueOf([line(10, 120000, 4, 10), line(3, 1500, 3)])).toBe(532_500);
  });

  it('% đã nhận theo giá trị; theo số lượng khi chức vụ không xem giá nhập', () => {
    expect(receivedPercent(order('NHAN_MOT_PHAN', [], { totalValue: 1000, receivedValue: 250 }))).toBe(25);
    expect(receivedPercent(order('NHAN_MOT_PHAN', [line(10, 0, 4), line(10, 0, 0)], { totalValue: null, receivedValue: null }))).toBe(20);
    expect(receivedPercent(order('NHAP', [], { totalValue: 0 }))).toBe(0);
  });

  it('số còn phải nhận không âm, làm tròn 4 chữ số', () => {
    expect(lineRemaining(line(0.3, 1, 0.1))).toBe(0.2);
    expect(lineRemaining(line(5, 1, 6))).toBe(0);
  });
});

describe('đơn nhập hàng: trạng thái', () => {
  it('sau mỗi lần nhận: chưa nhận / một phần / đủ', () => {
    expect(statusAfterReceipt([line(5, 1), line(2, 1)])).toBe('DA_GUI_NCC');
    expect(statusAfterReceipt([line(5, 1, 5), line(2, 1)])).toBe('NHAN_MOT_PHAN');
    expect(statusAfterReceipt([line(5, 1, 5), line(2, 1, 3)])).toBe('DA_NHAN_DU');
  });

  it('sửa và gửi chỉ khi Nháp; nhận khi đã gửi hoặc nhận một phần; hoàn tất khi đã nhận', () => {
    expect([canEdit('NHAP'), canSend('NHAP'), canReceive('NHAP'), canComplete('NHAP')]).toEqual([true, true, false, false]);
    expect([canEdit('DA_GUI_NCC'), canReceive('DA_GUI_NCC'), canComplete('DA_GUI_NCC')]).toEqual([false, true, false]);
    expect([canReceive('NHAN_MOT_PHAN'), canComplete('NHAN_MOT_PHAN')]).toEqual([true, true]);
    expect([canReceive('DA_NHAN_DU'), canComplete('DA_NHAN_DU')]).toEqual([false, true]);
  });

  it('huỷ chỉ khi chưa nhận gì', () => {
    expect(canCancel(order('DA_GUI_NCC', [line(5, 1)]))).toBe(true);
    expect(canCancel(order('DA_GUI_NCC', [line(5, 1, 1)]))).toBe(false);
    expect(canCancel(order('HOAN_TAT', [line(5, 1)]))).toBe(false);
  });
});
