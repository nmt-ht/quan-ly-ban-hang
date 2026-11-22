// Cách bày các sổ và báo cáo kế toán theo mẫu Thông tư 133/2016/TT-BTC từ dữ liệu sổ cái đã có. Số hiệu mẫu theo danh mục sổ kế toán
// của Thông tư 133 (đối chiếu trước khi nộp hồ sơ): S03a-DNN Sổ nhật ký chung, S03b-DNN Sổ Cái, S04a-DNN Sổ quỹ tiền mặt,
// S05-DNN Sổ tiền gửi ngân hàng, S12-DNN Sổ chi tiết thanh toán với người mua (người bán), S19-DNN Sổ chi tiết các tài khoản.
import { AccountBookView } from '../../../core/models/books-vat.models';
import { CashFlowView } from '../../../core/models/cash-ops.models';
import { JournalBookView } from '../../../core/models/statements.models';
import { formatDay } from '../../period';
import { BookColumn, BookRow } from './book-print.component';
import { StatementPrintLine } from './statement-print.component';

export interface BookSpec {
  formNo: string;
  title: string;
  sub: string;
  sub2?: string;
  columns: BookColumn[];
  rows: BookRow[];
}

const range = (from: string, to: string) => `Từ ngày ${formatDay(from)} đến ngày ${formatDay(to)}`;
const nz = (n: number) => (n ? n : null);
/** Số dư theo chiều Nợ − Có thành hai cột Nợ | Có. */
const sides = (netNo: number): [number | null, number | null] => [netNo > 0 ? netNo : null, netNo < 0 ? -netNo : null];
const netNoOf = (balance: number, d: AccountBookView) => (d.account.normalSide === 'NO' ? balance : -balance);

const DATE: BookColumn = { head: 'Ngày, tháng ghi sổ', center: true };
const CODE: BookColumn = { head: 'Số hiệu', group: 'Chứng từ', center: true };
const CODE_DATE: BookColumn = { head: 'Ngày, tháng', group: 'Chứng từ', center: true };
const TEXT: BookColumn = { head: 'Diễn giải' };
const COUNTER: BookColumn = { head: 'Tài khoản đối ứng', center: true };

/** Tên mẫu và bố cục theo tài khoản: 111 → S04a, 112 → S05, 131 / 331 của một đối tượng → S12, còn lại → S19. */
export function accountBookSpec(d: AccountBookView, partnerName?: string): BookSpec {
  const code = d.account.code;
  const base = { sub: range(d.from, d.to) };
  const label = `Tài khoản: ${code} - ${d.account.name}`;
  const description = (r: AccountBookView['rows'][number]) => (r.partner && !partnerName ? `${r.partner}: ${r.description ?? ''}` : (r.description ?? ''));

  if (code === '111') {
    const columns: BookColumn[] = [
      DATE, { head: 'Thu', group: 'Số hiệu chứng từ', center: true }, { head: 'Chi', group: 'Số hiệu chứng từ', center: true }, TEXT,
      { head: 'Thu', group: 'Số tiền', num: true }, { head: 'Chi', group: 'Số tiền', num: true }, { head: 'Tồn', group: 'Số tiền', num: true }, { head: 'Ghi chú' },
    ];
    const rows: BookRow[] = [
      { kind: 'open', cells: [{ text: 'Số dư đầu kỳ', span: 6 }, d.openingNo - d.openingCo, ''] },
      ...d.rows.map((r): BookRow => ({
        cells: [formatDay(r.date), r.debit ? r.code : '', r.credit ? r.code : '', description(r), nz(r.debit), nz(r.credit), r.balance, ''],
      })),
      { kind: 'sum', cells: [{ text: 'Cộng phát sinh trong kỳ', span: 4 }, d.totalDebit, d.totalCredit, '', ''] },
      { kind: 'sum', cells: [{ text: 'Số dư cuối kỳ', span: 6 }, d.closingNo - d.closingCo, ''] },
    ];
    return { ...base, formNo: 'S04a-DNN', title: 'SỔ QUỸ TIỀN MẶT', sub2: `${label} · Đơn vị tính: đồng`, columns, rows };
  }

  if (code === '112') {
    const columns: BookColumn[] = [
      DATE, CODE, CODE_DATE, TEXT, COUNTER,
      { head: 'Gửi vào', group: 'Số tiền', num: true }, { head: 'Rút ra', group: 'Số tiền', num: true }, { head: 'Còn lại', group: 'Số tiền', num: true },
    ];
    const rows: BookRow[] = [
      { kind: 'open', cells: [{ text: 'Số dư đầu kỳ', span: 7 }, d.openingNo - d.openingCo] },
      ...d.rows.map((r): BookRow => ({
        cells: [formatDay(r.date), r.code, formatDay(r.date), description(r), r.counterAccounts, nz(r.debit), nz(r.credit), r.balance],
      })),
      { kind: 'sum', cells: [{ text: 'Cộng phát sinh trong kỳ', span: 5 }, d.totalDebit, d.totalCredit, ''] },
      { kind: 'sum', cells: [{ text: 'Số dư cuối kỳ', span: 7 }, d.closingNo - d.closingCo] },
    ];
    return { ...base, formNo: 'S05-DNN', title: 'SỔ TIỀN GỬI NGÂN HÀNG', sub2: `${label} · Đơn vị tính: đồng`, columns, rows };
  }

  // Sổ chi tiết có hai cột số dư Nợ | Có: công nợ theo đối tượng (S12) và mọi tài khoản khác (S19).
  const columns: BookColumn[] = [
    DATE, CODE, CODE_DATE, TEXT, COUNTER,
    { head: 'Nợ', group: 'Số phát sinh', num: true }, { head: 'Có', group: 'Số phát sinh', num: true },
    { head: 'Nợ', group: 'Số dư', num: true }, { head: 'Có', group: 'Số dư', num: true },
  ];
  const rows: BookRow[] = [
    { kind: 'open', cells: [{ text: 'Số dư đầu kỳ', span: 7 }, ...sides(d.openingNo - d.openingCo)] },
    ...d.rows.map((r): BookRow => ({
      cells: [formatDay(r.date), r.code, formatDay(r.date), description(r), r.counterAccounts, nz(r.debit), nz(r.credit), ...sides(netNoOf(r.balance, d))],
    })),
    { kind: 'sum', cells: [{ text: 'Cộng phát sinh trong kỳ', span: 5 }, d.totalDebit, d.totalCredit, '', ''] },
    { kind: 'sum', cells: [{ text: 'Số dư cuối kỳ', span: 7 }, ...sides(d.closingNo - d.closingCo)] },
  ];
  const partner = (code === '131' || code === '331') && d.partnerId;
  return partner
    ? { ...base, formNo: 'S12-DNN', title: 'SỔ CHI TIẾT THANH TOÁN VỚI NGƯỜI MUA (NGƯỜI BÁN)', sub2: `${label}${partnerName ? ` · Đối tượng: ${partnerName}` : ''} · Đơn vị tính: đồng`, columns, rows }
    : { ...base, formNo: 'S19-DNN', title: 'SỔ CHI TIẾT CÁC TÀI KHOẢN', sub2: `${label} · Đơn vị tính: đồng`, columns, rows };
}

/** Sổ Cái (S03b-DNN, dùng cho hình thức Nhật ký chung) của một tài khoản. Cột "Nhật ký chung: Trang số, STT dòng" để trống cho người ghi sổ. */
export function ledgerBookSpec(d: AccountBookView): BookSpec {
  const columns: BookColumn[] = [
    DATE, CODE, CODE_DATE, TEXT, { head: 'Trang số', group: 'Nhật ký chung', center: true }, { head: 'STT dòng', group: 'Nhật ký chung', center: true }, COUNTER,
    { head: 'Nợ', group: 'Số phát sinh', num: true }, { head: 'Có', group: 'Số phát sinh', num: true },
  ];
  const rows: BookRow[] = [
    { kind: 'open', cells: [{ text: 'Số dư đầu kỳ', span: 7 }, nz(d.openingNo), nz(d.openingCo)] },
    ...d.rows.map((r): BookRow => ({
      cells: [formatDay(r.date), r.code, formatDay(r.date), r.description ?? '', '', '', r.counterAccounts, nz(r.debit), nz(r.credit)],
    })),
    { kind: 'sum', cells: [{ text: 'Cộng số phát sinh trong kỳ', span: 7 }, d.totalDebit, d.totalCredit] },
    { kind: 'sum', cells: [{ text: 'Số dư cuối kỳ', span: 7 }, nz(d.closingNo), nz(d.closingCo)] },
  ];
  return { formNo: 'S03b-DNN', title: 'SỔ CÁI', sub: range(d.from, d.to), sub2: `Tên tài khoản: ${d.account.code} - ${d.account.name} · Đơn vị tính: đồng`, columns, rows };
}

/** Sổ nhật ký chung (S03a-DNN): mỗi bút toán một nhóm dòng Nợ / Có, theo ngày tăng dần. */
export function journalBookSpec(d: JournalBookView): BookSpec {
  const columns: BookColumn[] = [
    DATE, CODE, CODE_DATE, TEXT, { head: 'Đã ghi Sổ Cái', center: true }, { head: 'STT dòng', center: true }, { head: 'Số hiệu tài khoản', center: true },
    { head: 'Nợ', group: 'Số phát sinh', num: true }, { head: 'Có', group: 'Số phát sinh', num: true },
  ];
  const rows: BookRow[] = [];
  let line = 0;
  let debit = 0;
  let credit = 0;
  for (const e of d.rows) {
    e.lines.forEach((l, k) => {
      line++;
      debit += l.debit;
      credit += l.credit;
      rows.push({
        cells: [k === 0 ? formatDay(e.date) : '', k === 0 ? e.code : '', k === 0 ? formatDay(e.date) : '', k === 0 ? (e.description ?? '') : '', k === 0 ? 'x' : '', line, l.accountCode, nz(l.debit), nz(l.credit)],
      });
    });
  }
  rows.push({ kind: 'sum', cells: [{ text: 'Cộng phát sinh trong kỳ', span: 7 }, debit, credit] });
  return { formNo: 'S03a-DNN', title: 'SỔ NHẬT KÝ CHUNG', sub: range(d.from, d.to), sub2: 'Đơn vị tính: đồng', columns, rows };
}

const FLOW_SECTIONS: { title: string; codes: string[]; total: string }[] = [
  { title: 'I. Lưu chuyển tiền từ hoạt động kinh doanh', codes: ['01', '02', '03', '04', '05', '06', '07'], total: '20' },
  { title: 'II. Lưu chuyển tiền từ hoạt động đầu tư', codes: ['21', '22', '23', '24', '25'], total: '30' },
  { title: 'III. Lưu chuyển tiền từ hoạt động tài chính', codes: ['31', '32', '33', '34', '35'], total: '40' },
];
const FLOW_TAIL = ['50', '60', '61', '70'];

/** B03-DNN (phương pháp trực tiếp): kỳ này và cùng kỳ năm trước, theo thứ tự và mã số của mẫu. */
export function cashFlowLines(current: CashFlowView, prior: CashFlowView | null): StatementPrintLine[] {
  const get = (v: CashFlowView | null, code: string) => v?.items.find((i) => i.code === code)?.amount ?? null;
  const out: StatementPrintLine[] = [];
  const add = (code: string, label: string, level: number, bold = false) =>
    out.push({ code, label, level, bold, amount: get(current, code), prior: prior ? get(prior, code) : null });
  for (const s of FLOW_SECTIONS) {
    out.push({ code: '', label: s.title, level: 0, bold: true });
    s.codes.forEach((c, i) => add(c, `${i + 1}. ${current.items.find((x) => x.code === c)?.label ?? c}`, 1));
    add(s.total, current.items.find((x) => x.code === s.total)?.label ?? s.total, 0, true);
  }
  for (const c of FLOW_TAIL) add(c, current.items.find((x) => x.code === c)?.label ?? c, 0, true);
  return out;
}

/** "Tại ngày 31 tháng 12 năm 2026" từ ngày ISO. */
export function atDayText(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `Tại ngày ${d} tháng ${m} năm ${y}`;
}

/** Cùng ngày năm trước (29/02 → 28/02): kỳ trước của báo cáo. */
export function yearBefore(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dim = new Date(Date.UTC(y - 1, m, 0)).getUTCDate();
  return `${y - 1}-${String(m).padStart(2, '0')}-${String(Math.min(d, dim)).padStart(2, '0')}`;
}
