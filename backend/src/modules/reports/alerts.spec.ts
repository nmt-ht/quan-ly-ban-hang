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

  it('hoá đơn: đợt giao quá hạn chưa có hoá đơn là theo dõi, trỏ tới màn Hoá đơn bán ra; không có thì im lặng', () => {
    expect(alerts({ ...none, uninvoiced: null })).toEqual([]);
    expect(alerts({ ...none, uninvoiced: { count: 0, oldest: '2026-11-01' } })).toEqual([]);
    const [a] = alerts({ ...none, uninvoiced: { count: 4, oldest: '2026-11-01' } });
    expect(a).toMatchObject({ key: 'invoice', level: 'warn', area: 'sell', to: '/hoa-don-ban', title: '4 đợt giao chưa có hoá đơn quá 3 ngày', sig: 'invoice:4:2026-11-01' });
    expect(a.detail).toContain('01/11/2026');
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

  it('hợp đồng: sắp hết hạn trong 30 ngày và quá hạn chưa thanh lý, tách bán / mua; không có thì im lặng', () => {
    expect(alerts({ ...none, openContracts: null })).toEqual([]);
    const openContracts = [
      { kind: 'BAN' as const, endDate: '2026-11-20' }, { kind: 'BAN' as const, endDate: '2026-12-31' }, { kind: 'BAN' as const, endDate: '2026-11-01' },
      { kind: 'MUA' as const, endDate: '2026-11-30' }, { kind: 'BAN' as const, endDate: '2026-01-01' },
    ];
    const list = alerts({ ...none, openContracts });
    expect(list.map((a) => [a.key, a.title])).toEqual([
      ['contract-lapsed-BAN', '1 hợp đồng bán quá hạn chưa thanh lý'],
      ['contract-soon-BAN', '1 hợp đồng bán sắp hết hạn'],
      ['contract-soon-MUA', '1 hợp đồng mua sắp hết hạn'],
    ]);
    expect(list[2]).toMatchObject({ to: '/hop-dong/mua', query: { expiry: 'soon' }, area: 'purchase' });
  });

  it('the signature follows the size of the problem, so a "đã xem" mark lapses when it grows', () => {
    expect(alerts({ ...none, draftPurchases: 2 })[0].sig).not.toBe(alerts({ ...none, draftPurchases: 3 })[0].sig);
  });
});
