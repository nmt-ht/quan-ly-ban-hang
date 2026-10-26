import { ProductionOrder, SalesOrder } from '../../core/models/domain.models';
import { canCancelLsx, canComplete, canStart, isLate } from './production-order.rules';

const lsx = (status: ProductionOrder['status']) => ({ id: 'x', status }) as ProductionOrder;

describe('lệnh sản xuất', () => {
  it('trễ hẹn: lệnh còn mở và đơn bán đã quá ngày cần giao', () => {
    const order = { neededByDate: '2026-10-20' } as SalesOrder;
    expect(isLate(lsx('NHAP'), order, '2026-10-26')).toBe(true);
    expect(isLate(lsx('DANG_SAN_XUAT'), order, '2026-10-26')).toBe(true);
    expect(isLate(lsx('HOAN_TAT'), order, '2026-10-26')).toBe(false);
    expect(isLate(lsx('NHAP'), order, '2026-10-20')).toBe(false); // đúng ngày chưa trễ
    expect(isLate(lsx('NHAP'), {} as SalesOrder, '2026-10-26')).toBe(false);
    expect(isLate(lsx('NHAP'), undefined, '2026-10-26')).toBe(false);
  });

  it('bắt đầu khi Nháp, nghiệm thu khi đang sản xuất, huỷ khi chưa hoàn tất', () => {
    expect([canStart(lsx('NHAP')), canComplete(lsx('NHAP')), canCancelLsx(lsx('NHAP'))]).toEqual([true, false, true]);
    expect([canStart(lsx('DANG_SAN_XUAT')), canComplete(lsx('DANG_SAN_XUAT')), canCancelLsx(lsx('DANG_SAN_XUAT'))]).toEqual([false, true, true]);
    expect([canStart(lsx('HOAN_TAT')), canComplete(lsx('HOAN_TAT')), canCancelLsx(lsx('HOAN_TAT'))]).toEqual([false, false, false]);
  });
});
