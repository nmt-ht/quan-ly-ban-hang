import { describe, expect, it } from 'vitest';
import { autoMatch, sameMoney } from './bank-reconciliation.rules.js';

const line = (id: string, date: string, amountIn: number, amountOut: number) => ({ id, date, amountIn, amountOut });
const v = (id: string, code: string, date: string, kind: 'THU' | 'CHI', amount: number) => ({ id, code, date, kind, amount });

describe('đối chiếu sao kê', () => {
  it('tiền vào khớp phiếu thu, tiền ra khớp phiếu chi, cùng số tiền', () => {
    expect(sameMoney(line('l', '2026-11-01', 500, 0), v('a', 'PT1', '2026-11-01', 'THU', 500))).toBe(true);
    expect(sameMoney(line('l', '2026-11-01', 500, 0), v('a', 'PC1', '2026-11-01', 'CHI', 500))).toBe(false);
    expect(sameMoney(line('l', '2026-11-01', 0, 500), v('a', 'PC1', '2026-11-01', 'CHI', 500))).toBe(true);
    expect(sameMoney(line('l', '2026-11-01', 500, 0), v('a', 'PT1', '2026-11-01', 'THU', 501))).toBe(false);
  });

  it('chỉ khớp khi lệch ngày không quá 3 ngày', () => {
    const lines = [line('l1', '2026-11-10', 100, 0), line('l2', '2026-11-20', 100, 0)];
    const vouchers = [v('a', 'PT1', '2026-11-08', 'THU', 100), v('b', 'PT2', '2026-11-30', 'THU', 100)];
    expect(autoMatch(lines, vouchers)).toEqual([{ lineId: 'l1', voucherId: 'a' }]);
  });

  it('mỗi phiếu chỉ dùng một lần; chọn phiếu gần ngày nhất', () => {
    const lines = [line('l1', '2026-11-10', 0, 300), line('l2', '2026-11-11', 0, 300)];
    const vouchers = [v('far', 'PC1', '2026-11-08', 'CHI', 300), v('near', 'PC2', '2026-11-10', 'CHI', 300)];
    const m = autoMatch(lines, vouchers);
    expect(m).toHaveLength(2);
    expect(m.find((x) => x.lineId === 'l1')!.voucherId).toBe('near');
    expect(m.find((x) => x.lineId === 'l2')!.voucherId).toBe('far');
  });

  it('không có phiếu cùng số tiền thì dòng sao kê để chưa khớp', () => {
    expect(autoMatch([line('l1', '2026-11-10', 100, 0)], [v('a', 'PT1', '2026-11-10', 'THU', 101)])).toEqual([]);
  });
});
