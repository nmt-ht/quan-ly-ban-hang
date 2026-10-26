import { DeliveryTrip, SalesOrder, SalesOrderLine } from '../../core/models/domain.models';
import {
  canCancel, canComplete, canConfirm, canEditCosts, canLoadOrder, canReturn, canShip, costTotal, remainingValue, unitValues,
} from './delivery-trip.rules';

const trip = (status: DeliveryTrip['status'], extra: Partial<DeliveryTrip> = {}) =>
  ({ id: 't1', code: 'CH', date: '2026-10-26', status, orderIds: ['o1', 'o2'], ...extra }) as DeliveryTrip;
const line = (quantity: number, unitPrice: number, receivedQuantity = 0, extra: Partial<SalesOrderLine> = {}) =>
  ({ id: 'l', productId: 'p', unit: 'Cái', quantity, unitPrice, lineTotal: 0, receivedQuantity, ...extra }) as SalesOrderLine;
const order = (status: SalesOrder['status'], lines: SalesOrderLine[], extra: Partial<SalesOrder> = {}) =>
  ({ id: 'o1', status, lines, discountAmount: 0, ...extra }) as SalesOrder;

describe('chuyến giao hàng: các bước theo trạng thái', () => {
  it('gom đơn → xuất kho → chốt giao → xe về kho → hoàn tất', () => {
    expect([canShip(trip('GOM_DON')), canCancel(trip('GOM_DON')), canConfirm(trip('GOM_DON'))]).toEqual([true, true, false]);
    expect(canShip(trip('GOM_DON', { orderIds: [] }))).toBe(false); // chưa có đơn
    expect([canShip(trip('DA_XUAT_KHO')), canCancel(trip('DA_XUAT_KHO')), canConfirm(trip('DA_XUAT_KHO'))]).toEqual([false, false, true]);
    expect(canComplete(trip('XE_VE_KHO'))).toBe(true);
    expect(canEditCosts(trip('HOAN_TAT'))).toBe(true);
    expect(canEditCosts(trip('HUY'))).toBe(false);
  });

  it('xe về kho chỉ khi mọi đơn đã chốt giao', () => {
    const one = [{ orderId: 'o1', lines: [] }] as unknown as DeliveryTrip['confirmations'];
    const both = [{ orderId: 'o1', lines: [] }, { orderId: 'o2', lines: [] }] as unknown as DeliveryTrip['confirmations'];
    expect(canReturn(trip('DA_XUAT_KHO', { confirmations: one }))).toBe(false);
    expect(canReturn(trip('DA_XUAT_KHO', { confirmations: both }))).toBe(true);
  });

  it('tổng chi phí chuyến', () => {
    expect(costTotal({ fuel: 100000, toll: 20000, other: 5000 } as never)).toBe(125000);
    expect(costTotal(undefined)).toBe(0);
  });
});

describe('đơn trên chuyến', () => {
  it('xếp được: còn phải giao, chưa kết thúc, không nằm trên chuyến đang chạy khác', () => {
    const none = () => undefined;
    expect(canLoadOrder(order('CHO_GIAO_HANG', [line(2, 1)]), none)).toBe(true);
    expect(canLoadOrder(order('CHO_SAN_XUAT', [line(2, 1)]), none)).toBe(false);
    expect(canLoadOrder(order('GIAO_MOT_PHAN', [line(2, 1, 2)]), none)).toBe(false); // giao hết rồi
    expect(canLoadOrder(order('GIAO_MOT_PHAN', [line(2, 1, 1)], { closedDate: '2026-10-26' }), none)).toBe(false);
    const running = order('CHO_GIAO_HANG', [line(2, 1)], { tripId: 't9' });
    expect(canLoadOrder(running, () => trip('DA_XUAT_KHO'))).toBe(false);
    expect(canLoadOrder(running, () => trip('HOAN_TAT'))).toBe(true);
  });

  it('giá trị một ĐVT và phần còn phải giao, sau chiết khấu và gồm thuế', () => {
    const o = order('GIAO_MOT_PHAN', [line(4, 100000, 1, { vatRate: 10 }), line(2, 50000)], { discountAmount: 0 });
    expect(unitValues(o)).toEqual([110000, 50000]);
    expect(remainingValue(o)).toBe(3 * 110000 + 2 * 50000);
  });
});
