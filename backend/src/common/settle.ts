// Đối trừ công nợ — the same algorithm as the frontend's core/services/debt.service.ts › settle(),
// so the server and the screens agree on every balance. Pure functions, no database.

export interface DebtAgingBucket {
  notDue: number;
  overdue1to30: number;
  overdue31to60: number;
  overdue61to90: number;
  overdueOver90: number;
  total: number;
}

export interface DebtItem {
  ref: string; // mã chứng từ còn nợ
  dueDate: string; // YYYY-MM-DD
  amount: number; // số còn nợ của khoản này
  overdueDays: number; // <= 0: chưa đến hạn
}

export interface DebtInvoice {
  ref: string;
  dueDate: string;
  amount: number;
}

export interface DebtPayment {
  id: string;
  date: string;
  amount: number; // > 0
  allocations?: { ref: string; amount: number }[];
}

export interface SettleResult {
  items: DebtItem[];
  prepaid: number;
  aging: DebtAgingBucket;
  overdue: number;
  invoiceOpen: Map<string, number>; // ref → còn nợ
  paymentUsed: Map<string, number>; // payment id → đã đối trừ
}

const DAY = 86_400_000;

export const emptyBucket = (): DebtAgingBucket => ({ notDue: 0, overdue1to30: 0, overdue31to60: 0, overdue61to90: 0, overdueOver90: 0, total: 0 });

function addToBucket(b: DebtAgingBucket, days: number, amount: number): void {
  if (days <= 0) b.notDue += amount;
  else if (days <= 30) b.overdue1to30 += amount;
  else if (days <= 60) b.overdue31to60 += amount;
  else if (days <= 90) b.overdue61to90 += amount;
  else b.overdueOver90 += amount;
  b.total += amount;
}

export function addDays(day: string, days: number): string {
  return new Date(new Date(day.slice(0, 10)).getTime() + days * DAY).toISOString().slice(0, 10);
}

/** Midnight UTC of a YYYY-MM-DD (or today), the reference point for "quá hạn N ngày". */
export const dayMs = (day: string = new Date().toISOString().slice(0, 10)) => new Date(day.slice(0, 10)).getTime();

export const daysBetween = (fromDay: string, today: number) => Math.floor((today - new Date(fromDay).getTime()) / DAY);

/**
 * "Chọn tay" allocations of each payment settle exactly the chosen documents first; what is left
 * (and every "Tự động" payment) settles the earliest due khoản first, oldest money first (FIFO).
 */
export function settle(invoices: DebtInvoice[], payments: DebtPayment[], today: number): SettleResult {
  const open = new Map(invoices.map((i) => [i.ref, i.amount]));
  const used = new Map(payments.map((p) => [p.id, 0]));
  const byDate = [...payments].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  for (const p of byDate) {
    for (const a of p.allocations ?? []) {
      const take = Math.min(a.amount, open.get(a.ref) ?? 0, p.amount - used.get(p.id)!);
      if (take <= 0) continue;
      open.set(a.ref, open.get(a.ref)! - take);
      used.set(p.id, used.get(p.id)! + take);
    }
  }

  const queue = byDate.map((p) => ({ id: p.id, left: p.amount - used.get(p.id)! })).filter((q) => q.left > 0);
  const sorted = [...invoices].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.ref.localeCompare(b.ref));
  for (const inv of sorted) {
    let need = open.get(inv.ref) ?? 0;
    while (need > 0 && queue.length) {
      const q = queue[0];
      const take = Math.min(need, q.left);
      need -= take;
      q.left -= take;
      used.set(q.id, used.get(q.id)! + take);
      if (q.left <= 0) queue.shift();
    }
    open.set(inv.ref, need);
  }

  const items: DebtItem[] = [];
  const aging = emptyBucket();
  let overdue = 0;
  for (const inv of sorted) {
    const amount = open.get(inv.ref) ?? 0;
    if (amount <= 0) continue;
    const days = daysBetween(inv.dueDate, today);
    items.push({ ref: inv.ref, dueDate: inv.dueDate, amount, overdueDays: days });
    addToBucket(aging, days, amount);
    if (days > 0) overdue += amount;
  }
  const prepaid = queue.reduce((s, q) => s + q.left, 0);
  return { items, prepaid, aging, overdue, invoiceOpen: open, paymentUsed: used };
}
