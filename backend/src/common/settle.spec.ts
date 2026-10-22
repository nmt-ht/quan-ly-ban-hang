import { addDays, dayMs, settle } from './settle.js';

describe('settle (đối trừ công nợ)', () => {
  const today = dayMs('2026-10-20');

  it('pays the earliest due khoản first and keeps the rest as trả trước', () => {
    const r = settle(
      [
        { ref: 'DN2', dueDate: '2026-10-30', amount: 500 },
        { ref: 'DN1', dueDate: '2026-09-01', amount: 300 },
      ],
      [{ id: 'pc1', date: '2026-10-01', amount: 400 }],
      today,
    );
    expect(r.invoiceOpen.get('DN1')).toBe(0);
    expect(r.items).toEqual([{ ref: 'DN2', dueDate: '2026-10-30', amount: 400, overdueDays: -10 }]);
    expect(r.prepaid).toBe(0);
    expect(r.aging.notDue).toBe(400);
  });

  it('honours "Chọn tay" allocations before the FIFO rest, and reports overdue ages', () => {
    const r = settle(
      [
        { ref: 'DN1', dueDate: '2026-08-01', amount: 300 },
        { ref: 'DN2', dueDate: '2026-09-15', amount: 200 },
      ],
      [{ id: 'pc1', date: '2026-10-01', amount: 250, allocations: [{ ref: 'DN2', amount: 200 }] }],
      today,
    );
    expect(r.invoiceOpen.get('DN2')).toBe(0);
    expect(r.items).toEqual([{ ref: 'DN1', dueDate: '2026-08-01', amount: 250, overdueDays: 80 }]);
    expect(r.overdue).toBe(250);
    expect(r.aging.overdue61to90).toBe(250);
  });

  it('money beyond every khoản is trả trước', () => {
    const r = settle([{ ref: 'DN1', dueDate: '2026-10-01', amount: 100 }], [{ id: 'pc1', date: '2026-10-02', amount: 150 }], today);
    expect(r.items).toEqual([]);
    expect(r.prepaid).toBe(50);
  });

  it('addDays works on day strings', () => {
    expect(addDays('2026-10-20', 15)).toBe('2026-11-04');
  });
});
