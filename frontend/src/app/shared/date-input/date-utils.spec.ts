import { dmyToIso, isoToDmy, maskDmy, monthGrid } from './date-utils';

describe('ô nhập ngày dd/mm/yyyy', () => {
  it('đổi qua lại giữa dd/mm/yyyy và YYYY-MM-DD', () => {
    expect(isoToDmy('2026-11-16')).toBe('16/11/2026');
    expect(isoToDmy('2026-11-16T00:00:00.000Z')).toBe('16/11/2026');
    expect(isoToDmy('')).toBe('');
    expect(isoToDmy(null)).toBe('');
    expect(dmyToIso('16/11/2026')).toBe('2026-11-16');
    expect(dmyToIso('1/2/2026')).toBe('2026-02-01');
    expect(dmyToIso('16.11.2026')).toBe('2026-11-16');
  });

  it('chỉ nhận ngày có thật', () => {
    expect(dmyToIso('30/02/2026')).toBeNull();
    expect(dmyToIso('29/02/2028')).toBe('2028-02-29'); // năm nhuận
    expect(dmyToIso('29/02/2026')).toBeNull();
    expect(dmyToIso('31/04/2026')).toBeNull();
    expect(dmyToIso('16/13/2026')).toBeNull();
    expect(dmyToIso('16/11/26')).toBeNull();
    expect(dmyToIso('16/11')).toBeNull();
    expect(dmyToIso('')).toBeNull();
  });

  it('gõ số thì tự chèn dấu "/"; xoá lùi không bị dấu "/" chặn', () => {
    expect(maskDmy('1')).toBe('1');
    expect(maskDmy('16')).toBe('16/');
    expect(maskDmy('161')).toBe('16/1');
    expect(maskDmy('1611')).toBe('16/11/');
    expect(maskDmy('16112026')).toBe('16/11/2026');
    expect(maskDmy('161120269999')).toBe('16/11/2026');
    expect(maskDmy('16/11/2026')).toBe('16/11/2026');
    expect(maskDmy('16a/b11', true)).toBe('16/11/');
    expect(maskDmy('16', false)).toBe('16'); // vừa xoá dấu "/" sau "16"
    expect(maskDmy('1611', false)).toBe('16/11');
  });

  it('lưới tháng: 6 tuần, thứ Hai đầu tuần, ngày ngoài tháng đánh dấu', () => {
    const g = monthGrid(2026, 11); // 01/11/2026 là Chủ nhật
    expect(g).toHaveLength(42);
    expect(g[0]).toEqual({ iso: '2026-10-26', day: 26, inMonth: false });
    expect(g[6]).toEqual({ iso: '2026-11-01', day: 1, inMonth: true });
    expect(g.filter((c) => c.inMonth)).toHaveLength(30);
    expect(monthGrid(2026, 6)[0].iso).toBe('2026-06-01'); // 01/06/2026 là thứ Hai
  });
});
