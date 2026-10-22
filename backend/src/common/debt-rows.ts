// One partner's công nợ (phải trả or phải thu) as the frontend's DebtService builds it: open khoản
// after đối trừ, aging, and the sổ chi tiết with a running balance. Pure, no database.
import { DebtAgingBucket, DebtInvoice, DebtItem, DebtPayment, daysBetween, settle } from './settle.js';

/** A document that raises the debt (nhận hàng / giao hàng / tiền hoàn lại). */
export interface DebtCharge extends DebtInvoice {
  date: string;
  typeLabel: string;
  description: string;
  sourceId?: string; // id of the đơn nhập / đơn bán, for a link
}

/** Money that settles the debt (phiếu chi to a supplier, phiếu thu from a customer). */
export interface DebtSettlement extends DebtPayment {
  code: string;
  typeLabel: string;
  description: string;
}

export interface DebtPartner {
  partnerId: string;
  code: string;
  name: string;
  creditDays: number;
}

export interface DebtRow extends DebtPartner {
  creditLabel: string;
  items: DebtItem[];
  prepaid: number;
  overdue: number;
  balance: number; // > 0: còn nợ; < 0: trả trước
  aging: DebtAgingBucket;
  nextDue?: string;
  lastActivity?: string;
  entries: {
    date: string;
    kind: 'PHAT_SINH' | 'THANH_TOAN';
    typeLabel: string;
    ref: string;
    sourceId?: string;
    description: string;
    amount: number; // + raises, − lowers the debt
    settled: number;
    remaining: number;
    dueDate?: string;
    overdueDays?: number;
    balance: number;
  }[];
}

export const creditLabel = (days: number) => (days > 0 ? `${days} ngày` : 'Trả ngay');

/** Null when the partner has neither charges nor payments. */
export function debtRow(p: DebtPartner, charges: DebtCharge[], payments: DebtSettlement[], today: number): DebtRow | null {
  if (!charges.length && !payments.length) return null;
  const r = settle(charges, payments, today);
  const balance = r.items.reduce((s, i) => s + i.amount, 0) - r.prepaid;
  const lines = [
    ...charges.map((c) => {
      const remaining = r.invoiceOpen.get(c.ref) ?? 0;
      return {
        date: c.date, kind: 'PHAT_SINH' as const, typeLabel: c.typeLabel, ref: c.ref, sourceId: c.sourceId, description: c.description,
        amount: c.amount, settled: c.amount - remaining, remaining, dueDate: c.dueDate,
        overdueDays: remaining > 0 ? daysBetween(c.dueDate, today) : undefined,
      };
    }),
    ...payments.map((x) => {
      const settled = r.paymentUsed.get(x.id) ?? 0;
      return {
        date: x.date, kind: 'THANH_TOAN' as const, typeLabel: x.typeLabel, ref: x.code, description: x.description,
        amount: -x.amount, settled, remaining: x.amount - settled,
      };
    }),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? a.ref.localeCompare(b.ref) : a.kind === 'PHAT_SINH' ? -1 : 1));
  let running = 0;
  const entries = lines.map((l) => ({ ...l, balance: (running += l.amount) }));
  return {
    ...p, creditLabel: creditLabel(p.creditDays), items: r.items, prepaid: r.prepaid, overdue: r.overdue, balance, aging: r.aging,
    nextDue: r.items[0]?.dueDate, lastActivity: entries.at(-1)?.date, entries,
  };
}
