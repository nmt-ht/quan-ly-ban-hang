import { AccountBookView } from '../../../core/models/books-vat.models';
import { JournalBookView } from '../../../core/models/statements.models';
import { BookRow } from './book-print.component';
import { BookSpec, accountBookSpec, atDayText, cashFlowLines, journalBookSpec, ledgerBookSpec, yearBefore } from './tt133-books';

/** Mỗi dòng của sổ phải phủ đúng số cột của mẫu (kể cả ô gộp), nếu không bảng in bị lệch. */
const covered = (r: BookRow) => r.cells.reduce<number>((n, c) => n + (typeof c === 'object' && c !== null ? c.span : 1), 0);
const expectAligned = (s: BookSpec) => { for (const r of s.rows) expect(covered(r)).toBe(s.columns.length); };

const book = (code: string, extra: Partial<AccountBookView> = {}): AccountBookView => ({
  account: { code, name: 'Tài khoản thử', normalSide: code === '331' ? 'CO' : 'NO' },
  from: '2026-01-01', to: '2026-12-31', openingNo: 1000, openingCo: 0, totalDebit: 500, totalCredit: 200, closingNo: 1300, closingCo: 0, truncated: false,
  rows: [
    { date: '2026-03-01', entryId: 'a', code: 'BT0000001', description: 'Thu tiền', counterAccounts: '131', debit: 500, credit: 0, balance: 1500 },
    { date: '2026-03-02', entryId: 'b', code: 'BT0000002', description: 'Chi tiền', counterAccounts: '331', debit: 0, credit: 200, balance: 1300 },
  ],
  ...extra,
});

describe('Sổ kế toán theo mẫu TT133', () => {
  it('chọn mẫu theo tài khoản: 111 → S04a, 112 → S05, công nợ một đối tượng → S12, còn lại → S19', () => {
    expect(accountBookSpec(book('111')).formNo).toBe('S04a-DNN');
    expect(accountBookSpec(book('112')).formNo).toBe('S05-DNN');
    expect(accountBookSpec(book('131', { partnerId: 'kh1' }), 'Khách A').formNo).toBe('S12-DNN');
    expect(accountBookSpec(book('131')).formNo).toBe('S19-DNN');
    expect(accountBookSpec(book('642')).formNo).toBe('S19-DNN');
  });

  it('mọi dòng phủ đủ số cột của mẫu', () => {
    for (const code of ['111', '112', '331', '642']) expectAligned(accountBookSpec(book(code)));
    expectAligned(ledgerBookSpec(book('111')));
  });

  it('sổ quỹ: phát sinh bên Nợ vào cột Thu, bên Có vào cột Chi, tồn luỹ kế', () => {
    const s = accountBookSpec(book('111'));
    expect(s.rows[1].cells).toEqual(['01/03/2026', 'BT0000001', '', 'Thu tiền', 500, null, 1500, '']);
    expect(s.rows[2].cells).toEqual(['02/03/2026', '', 'BT0000002', 'Chi tiền', null, 200, 1300, '']);
  });

  it('sổ chi tiết: số dư luỹ kế tách thành hai cột Nợ | Có (TK 331 dư Có)', () => {
    const s = accountBookSpec(book('331', { openingNo: 0, openingCo: 900, closingNo: 0, closingCo: 1200 }));
    expect(s.rows[0].cells.slice(-2)).toEqual([null, 900]);
    expect(s.rows[1].cells.slice(-2)).toEqual([null, 1500]);
    expect(s.rows.at(-1)!.cells.slice(-2)).toEqual([null, 1200]);
  });

  it('sổ nhật ký chung: chỉ dòng đầu của bút toán có ngày, số hiệu, diễn giải; STT dòng liên tục; cộng cuối sổ', () => {
    const j: JournalBookView = {
      from: '2026-01-01', to: '2026-12-31', truncated: false,
      rows: [
        { id: '1', code: 'BT1', date: '2026-02-01', description: 'Bán hàng', lines: [{ accountCode: '131', debit: 110, credit: 0 }, { accountCode: '511', debit: 0, credit: 100 }, { accountCode: '3331', debit: 0, credit: 10 }] },
        { id: '2', code: 'BT2', date: '2026-02-02', description: 'Thu tiền', lines: [{ accountCode: '111', debit: 110, credit: 0 }, { accountCode: '131', debit: 0, credit: 110 }] },
      ],
    };
    const s = journalBookSpec(j);
    expectAligned(s);
    expect(s.rows[0].cells.slice(0, 5)).toEqual(['01/02/2026', 'BT1', '01/02/2026', 'Bán hàng', 'x']);
    expect(s.rows[1].cells.slice(0, 5)).toEqual(['', '', '', '', '']);
    expect(s.rows.slice(0, 5).map((r) => r.cells[5])).toEqual([1, 2, 3, 4, 5]);
    expect(s.rows.at(-1)!.cells.slice(1)).toEqual([220, 220]);
  });
});

describe('Báo cáo B03-DNN và ngày', () => {
  it('lưu chuyển tiền tệ: tiêu đề phần I–III, chỉ tiêu theo mã số, kỳ trước ở cột riêng', () => {
    const view = (amount: number) => ({
      from: '2026-01-01', to: '2026-12-31', net: 0, opening: 0, closing: 0, check: { ledgerClosing: 0, difference: 0 },
      items: ['01', '20', '30', '40', '50', '60', '61', '70'].map((code) => ({ code, label: `Chỉ tiêu ${code}`, amount, total: false, detail: [] })),
    });
    const lines = cashFlowLines(view(5), view(3));
    expect(lines[0]).toMatchObject({ code: '', label: 'I. Lưu chuyển tiền từ hoạt động kinh doanh', bold: true });
    expect(lines.find((l) => l.code === '01')).toMatchObject({ label: '1. Chỉ tiêu 01', amount: 5, prior: 3 });
    expect(lines.at(-1)).toMatchObject({ code: '70', amount: 5, prior: 3 });
  });

  it('ngày: "Tại ngày …" và cùng ngày năm trước (29/02 → 28/02)', () => {
    expect(atDayText('2026-12-31')).toBe('Tại ngày 31 tháng 12 năm 2026');
    expect(yearBefore('2024-02-29')).toBe('2023-02-28');
    expect(yearBefore('2026-06-30')).toBe('2025-06-30');
  });
});
