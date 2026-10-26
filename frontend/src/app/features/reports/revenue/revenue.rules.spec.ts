import { autoUnit, bucketLabel, bucketOf, bucketsBetween, previousRange, RevenueLine, sumLines } from './revenue.rules';

const line = (orderId: string, customerId: string, extra: Partial<RevenueLine>): RevenueLine => ({
  orderId, orderCode: orderId, date: '2026-10-26', customerId, salesRep: '', productId: 'p',
  baseQty: 0, gross: 0, discount: 0, net: 0, vat: 0, total: 0, ...extra,
});

describe('báo cáo doanh thu: cộng dòng', () => {
  it('cộng tiền, đếm đơn và khách không trùng; số lượng làm tròn 4 chữ số', () => {
    const s = sumLines([
      line('o1', 'kh1', { baseQty: 0.1, gross: 100, discount: 10, net: 90, vat: 9, total: 99 }),
      line('o1', 'kh1', { baseQty: 0.2, gross: 200, discount: 0, net: 200, vat: 0, total: 200 }),
      line('o2', 'kh2', { baseQty: -0.1, gross: -100, discount: -10, net: -90, vat: -9, total: -99 }), // trả hàng
    ]);
    expect(s).toEqual({ orders: 2, customers: 2, qty: 0.2, gross: 200, discount: 0, net: 200, vat: 0, total: 200 });
  });
});

describe('báo cáo doanh thu: kỳ thời gian', () => {
  it('chọn đơn vị: ngày tới 31 ngày, tuần tới 120 ngày, còn lại tháng', () => {
    expect(autoUnit('2026-10-01', '2026-10-31')).toBe('day');
    expect(autoUnit('2026-10-01', '2026-11-01')).toBe('week');
    expect(autoUnit('2026-01-01', '2026-04-30')).toBe('week');
    expect(autoUnit('2026-01-01', '2026-05-01')).toBe('month');
  });

  it('tuần bắt đầu thứ Hai', () => {
    expect(bucketOf('2026-10-28', 'week')).toBe('2026-10-26'); // thứ Tư → thứ Hai
    expect(bucketOf('2026-11-01', 'week')).toBe('2026-10-26'); // Chủ nhật vẫn thuộc tuần đó
    expect(bucketOf('2026-10-28', 'month')).toBe('2026-10');
    expect(bucketLabel('2026-10-26', 'week')).toBe('Tuần 26/10 – 01/11');
  });

  it('mọi ô từ đầu tới cuối kỳ, kể cả ô không có doanh thu', () => {
    expect(bucketsBetween('2026-01-15', '2026-03-02', 'month')).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(bucketsBetween('2026-10-30', '2026-11-02', 'day')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(bucketsBetween('2026-10-28', '2026-11-10', 'week')).toEqual(['2026-10-26', '2026-11-02', '2026-11-09']);
  });

  it('kỳ trước cùng độ dài, ngay trước ngày bắt đầu', () => {
    expect(previousRange('2026-10-01', '2026-10-31')).toEqual({ from: '2026-08-31', to: '2026-09-30' });
    expect(previousRange('2026-10-26', '2026-10-26')).toEqual({ from: '2026-10-25', to: '2026-10-25' });
  });
});
