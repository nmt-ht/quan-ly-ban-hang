import { addDays, addMonths, dmyToIso, isoToDmy, maskDmy, monthGrid } from './date-utils';

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

  it('gõ dấu ngăn sau ngày / tháng một chữ số thì thêm số 0; dán ngày YYYY-MM-DD thì đổi sang dd/mm/yyyy', () => {
    expect(maskDmy('1/')).toBe('01/');
    expect(maskDmy('01/2/')).toBe('01/02/');
    expect(maskDmy('1/2/2026')).toBe('01/02/2026');
    expect(maskDmy('16.11.2026')).toBe('16/11/2026');
    expect(maskDmy('2026-11-16')).toBe('16/11/2026');
    expect(maskDmy('2026-1-5')).toBe('05/01/2026');
    expect(maskDmy('1/11/', false)).toBe('11/1'); // xoá lùi không tự thêm số 0
  });

  it('cộng ngày và tháng', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-11-16', 7)).toBe('2026-11-23');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
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
