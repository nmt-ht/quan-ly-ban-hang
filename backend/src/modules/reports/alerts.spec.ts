import { describe, expect, it } from 'vitest';
import type { DebtRow } from '../../common/debt-rows.js';
import { alerts, type AlertInput } from './alerts.js';

const none: AlertInput = { today: '2026-11-08', lateOrders: null, debt: null, cashAccounts: null, belowMin: null, draftPurchases: null, openQuotes: null };
const row = (p: Partial<DebtRow>): DebtRow => ({ partnerId: 'x', code: 'X', name: 'X', creditDays: 0, creditLabel: '', items: [], prepaid: 0, overdue: 0, balance: 0, aging: {} as DebtRow['aging'], entries: [], ...p });

describe('alerts (thông báo)', () => {
  it('nothing the user may see → nothing to report', () => {
    expect(alerts(none)).toEqual([]);
    expect(alerts({ ...none, lateOrders: 0, belowMin: 0, draftPurchases: 0, openQuotes: [], cashAccounts: [], debt: { receivables: [], payables: [] } })).toEqual([]);
  });

  it('nghiêm trọng first, then theo dõi; each links to the screen that fixes it', () => {
    const list = alerts({ ...none, lateOrders: 3, belowMin: 2, cashAccounts: [{ name: 'Quỹ', balance: -5, isActive: true }] });
    expect(list.map((a) => [a.key, a.level])).toEqual([['late', 'bad'], ['neg', 'bad'], ['min', 'warn']]);
    expect(list[0]).toMatchObject({ to: '/don-hang', query: { late: 1 } });
    expect(list[2]).toMatchObject({ to: '/kho/ton-kho', query: { belowMin: true } });
  });

  it('công nợ: overdue receivables; payables overdue win over "đến hạn trong 7 ngày"', () => {
    const receivables = [row({ overdue: 100 }), row({ overdue: 0 })];
    const due = row({ items: [{ ref: 'A', dueDate: '2026-11-10', amount: 50, overdueDays: -2 }, { ref: 'B', dueDate: '2026-12-30', amount: 70, overdueDays: -52 }] });
    const soon = alerts({ ...none, debt: { receivables, payables: [due] } });
    expect(soon.map((a) => a.key)).toEqual(['ar', 'ap-due']);
    expect(soon[0].detail).toContain('1 khách');
    expect(soon[1].sig).toBe('ap-due:50');
    const late = alerts({ ...none, debt: { receivables: [], payables: [row({ overdue: 9, items: due.items })] } });
    expect(late.map((a) => a.key)).toEqual(['ap']);
  });

  it('a ngừng dùng quỹ below zero is not news', () => {
    expect(alerts({ ...none, cashAccounts: [{ name: 'Cũ', balance: -1, isActive: false }] })).toEqual([]);
  });

  it('báo giá: expiring within 3 days, and lapsed in the last 14 days only', () => {
    const openQuotes = ['2026-11-08', '2026-11-11', '2026-11-12', '2026-11-01', '2026-10-20'].map((validUntil) => ({ validUntil }));
    const list = alerts({ ...none, openQuotes });
    expect(list.map((a) => [a.key, a.title])).toEqual([
      ['quote-lapsed', '1 báo giá đã hết hạn chưa chốt'],
      ['quote-soon', '2 báo giá sắp hết hạn'],
    ]);
  });

  it('the signature follows the size of the problem, so a "đã xem" mark lapses when it grows', () => {
    expect(alerts({ ...none, draftPurchases: 2 })[0].sig).not.toBe(alerts({ ...none, draftPurchases: 3 })[0].sig);
  });
});
