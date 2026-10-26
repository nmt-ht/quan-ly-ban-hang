import { inRange, presetRange, rangeLabel } from './period';

describe('Chọn kỳ', () => {
  const wednesday = new Date(2026, 9, 28, 15, 30); // thứ Tư 28/10/2026, giờ không ảnh hưởng

  it('ngày, tuần (bắt đầu thứ Hai), tháng', () => {
    expect(presetRange('today', wednesday)).toEqual({ from: '2026-10-28', to: '2026-10-28' });
    expect(presetRange('yesterday', wednesday)).toEqual({ from: '2026-10-27', to: '2026-10-27' });
    expect(presetRange('last7', wednesday)).toEqual({ from: '2026-10-22', to: '2026-10-28' });
    expect(presetRange('last30', wednesday)).toEqual({ from: '2026-09-29', to: '2026-10-28' });
    expect(presetRange('thisWeek', wednesday)).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    expect(presetRange('lastWeek', wednesday)).toEqual({ from: '2026-10-19', to: '2026-10-25' });
    expect(presetRange('thisMonth', wednesday)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(presetRange('lastMonth', wednesday)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('quý, năm, toàn bộ; tháng Một lùi sang năm trước', () => {
    expect(presetRange('thisQuarter', wednesday)).toEqual({ from: '2026-10-01', to: '2026-12-31' });
    expect(presetRange('lastQuarter', wednesday)).toEqual({ from: '2026-07-01', to: '2026-09-30' });
    expect(presetRange('thisYear', wednesday)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(presetRange('lastYear', wednesday)).toEqual({ from: '2025-01-01', to: '2025-12-31' });
    expect(presetRange('all', wednesday)).toEqual({ from: null, to: null });
    const jan = new Date(2026, 0, 15);
    expect(presetRange('lastMonth', jan)).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(presetRange('lastQuarter', jan)).toEqual({ from: '2025-10-01', to: '2025-12-31' });
  });

  it('inRange tính cả hai đầu, so theo ngày của chuỗi có giờ', () => {
    const r = { from: '2026-10-01', to: '2026-10-31' };
    expect(inRange('2026-10-01', r)).toBe(true);
    expect(inRange('2026-10-31T23:59:00.000Z', r)).toBe(true);
    expect(inRange('2026-11-01', r)).toBe(false);
    expect(inRange('1999-01-01', { from: null, to: '2026-10-31' })).toBe(true);
  });

  it('nhãn kỳ', () => {
    expect(rangeLabel({ from: null, to: null })).toBe('Toàn bộ');
    expect(rangeLabel({ from: '2026-10-28', to: '2026-10-28' })).toBe('28/10/2026');
    expect(rangeLabel({ from: '2026-10-01', to: null })).toBe('01/10/2026 → …');
  });
});
