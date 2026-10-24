import { CashAccount } from '../../core/models/domain.models';
import { DebtRow } from '../../core/services/debt.service';
import { formatVnd } from '../../shared/format.util';
import { formatDay } from '../../shared/period';
import { bankNameOf, transferNote } from '../../shared/vietqr/vietqr';

// Nhắc nợ (Pha 2): who to remind, and the message. Pure — the dialog and the list use them.

export type ReminderChannel = 'ZALO' | 'SMS' | 'GOI_DIEN' | 'EMAIL' | 'GAP_TRUC_TIEP' | 'KHAC';

export const CHANNEL_LABEL: Record<ReminderChannel, string> = {
  ZALO: 'Zalo', SMS: 'SMS', GOI_DIEN: 'Gọi điện', EMAIL: 'Email', GAP_TRUC_TIEP: 'Gặp trực tiếp', KHAC: 'Khác',
};

export interface DebtReminder {
  id: string;
  customerId: string;
  channel: ReminderChannel;
  note?: string | null;
  balance: number;
  overdue: number;
  promisedDate?: string | null;
  promisedAmount?: number | null;
  createdBy: string;
  createdAt: string;
}

/** Nội dung chuyển khoản của khách: "KH0000002 TT CONG NO". */
export const debtTransferNote = (customerCode: string) => transferNote(`${customerCode} TT CONG NO`);

/** Open khoản of a customer (phát sinh còn nợ), oldest due first. */
export function openCharges(row: DebtRow) {
  return row.entries
    .filter((e) => e.kind === 'PHAT_SINH' && e.remaining > 0)
    .sort((a, b) => (a.dueDate ?? a.date).localeCompare(b.dueDate ?? b.date));
}

/** Days the oldest open khoản is past due (0 = none overdue). */
export const maxOverdueDays = (row: DebtRow) => Math.max(0, ...openCharges(row).map((e) => e.overdueDays ?? 0));

export interface ReminderMessageInput {
  companyName: string;
  customerName: string;
  customerCode: string;
  row: DebtRow;
  today: string;
  account?: CashAccount | null;
}

/** The message to send: số còn nợ, quá hạn, từng chứng từ còn mở với hạn, và tài khoản nhận tiền. */
export function reminderMessage(m: ReminderMessageInput): string {
  const r = m.row;
  const lines = openCharges(r).slice(0, 10).map((e) => {
    const late = (e.overdueDays ?? 0) > 0 ? `, quá hạn ${e.overdueDays} ngày` : '';
    return `- ${e.ref}: ${formatVnd(e.remaining)} (hạn ${formatDay(e.dueDate ?? e.date)}${late})`;
  });
  const more = openCharges(r).length > 10 ? [`- … và ${openCharges(r).length - 10} chứng từ khác`] : [];
  const owe = `Quý khách còn nợ ${formatVnd(Math.max(0, r.balance))}` + (r.overdue > 0 ? `, trong đó quá hạn ${formatVnd(r.overdue)}` : '') + '.';
  const a = m.account;
  const bank = a?.accountNumber
    ? [`Quý khách vui lòng chuyển khoản vào: ${bankNameOf(a.bankBin) ?? a.bankName ?? 'Ngân hàng'} — STK ${a.accountNumber}${a.accountHolder ? ` — ${a.accountHolder}` : ''}, nội dung: ${debtTransferNote(m.customerCode)}.`]
    : [];
  return [
    `Kính gửi ${m.customerName},`,
    `${m.companyName || 'Chúng tôi'} xin thông báo công nợ tính đến ngày ${formatDay(m.today)}: ${owe}`,
    ...(lines.length ? ['Chứng từ còn nợ:', ...lines, ...more] : []),
    ...bank,
    'Nếu Quý khách đã thanh toán, vui lòng bỏ qua tin nhắn này. Trân trọng cảm ơn!',
  ].join('\n');
}

/** Số điện thoại cho link Zalo / gọi: chỉ chữ số, đầu 0 (84… → 0…). */
export function phoneDigits(phone: string | null | undefined): string {
  const d = (phone ?? '').replace(/\D/g, '');
  return d.startsWith('84') && d.length > 10 ? `0${d.slice(2)}` : d;
}
