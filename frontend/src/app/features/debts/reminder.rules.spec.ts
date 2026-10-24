import { DebtRow } from '../../core/services/debt.service';
import { CashAccount } from '../../core/models/domain.models';
import { maxOverdueDays, openCharges, phoneDigits, reminderMessage } from './reminder.rules';

const row = {
  partnerId: 'c1', code: 'KH0000002', name: 'Trần Quốc Bảo', creditDays: 7, creditLabel: '7 ngày', items: [], prepaid: 0,
  overdue: 100_000, balance: 250_000, aging: {} as DebtRow['aging'],
  entries: [
    { date: '2026-10-01', kind: 'PHAT_SINH', typeLabel: 'Giao hàng', ref: 'DH1', description: '', amount: 100_000, settled: 0, remaining: 100_000, dueDate: '2026-10-08', overdueDays: 16, balance: 100_000 },
    { date: '2026-10-20', kind: 'PHAT_SINH', typeLabel: 'Giao hàng', ref: 'DH2', description: '', amount: 200_000, settled: 50_000, remaining: 150_000, dueDate: '2026-10-27', overdueDays: -3, balance: 300_000 },
    { date: '2026-10-21', kind: 'THANH_TOAN', typeLabel: 'Phiếu thu', ref: 'PT1', description: '', amount: -50_000, settled: 50_000, remaining: 0, balance: 250_000 },
    { date: '2026-09-01', kind: 'PHAT_SINH', typeLabel: 'Giao hàng', ref: 'DH0', description: '', amount: 10_000, settled: 10_000, remaining: 0, dueDate: '2026-09-08', balance: 10_000 },
  ],
} as DebtRow;

describe('nhắc nợ', () => {
  it('chứng từ còn mở theo hạn, ngày quá hạn lâu nhất', () => {
    expect(openCharges(row).map((e) => e.ref)).toEqual(['DH1', 'DH2']);
    expect(maxOverdueDays(row)).toBe(16);
  });

  it('tin nhắn có số nợ, quá hạn, từng chứng từ và tài khoản nhận tiền', () => {
    const account = { id: 'a', name: 'TK', type: 'NGAN_HANG', balance: 0, bankBin: '970436', accountNumber: '0123456789', accountHolder: 'CTY NINH TRANG' } as CashAccount;
    const m = reminderMessage({ companyName: 'Ninh Trang', customerName: 'Trần Quốc Bảo', customerCode: 'KH0000002', row, today: '2026-10-24', account });
    expect(m).toContain('Kính gửi Trần Quốc Bảo,');
    expect(m).toContain('24/10/2026');
    expect(m).toMatch(/còn nợ 250\.000\s?₫, trong đó quá hạn 100\.000\s?₫/);
    expect(m).toContain('- DH1: 100.000');
    expect(m).toContain('quá hạn 16 ngày');
    expect(m).not.toContain('PT1');
    expect(m).toContain('Vietcombank — STK 0123456789 — CTY NINH TRANG');
    expect(m).toContain('KH0000002 TT CONG NO');
  });

  it('số điện thoại cho Zalo / gọi', () => {
    expect(phoneDigits('+84 912 000 002')).toBe('0912000002');
    expect(phoneDigits('0912.000.002')).toBe('0912000002');
  });
});
