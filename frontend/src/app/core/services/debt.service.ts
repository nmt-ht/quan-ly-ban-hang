import { Injectable, computed } from '@angular/core';
import { DebtAgingBucket } from '../models/domain.models';
import { MockDataService } from './mock-data.service';

export interface DebtItem {
  ref: string; // mã đơn
  dueDate: string; // yyyy-mm-dd
  amount: number; // số còn nợ của khoản này
  overdueDays: number; // <= 0: chưa đến hạn
}

export interface DebtRow {
  partnerId: string;
  code: string;
  name: string;
  creditLabel: string;
  items: DebtItem[]; // chỉ các khoản còn mở (sau khi đối trừ FIFO)
  prepaid: number; // trả trước / thu thừa
  overdue: number;
  balance: number; // >0: còn nợ; <0: trả trước
  aging: DebtAgingBucket;
}

const DAY = 86_400_000;
const SUPPLIER_CREDIT_DAYS = 30; // giả định NCC cho nợ: 30 ngày (CHƯA XÁC MINH ở bản gốc)

const emptyBucket = (): DebtAgingBucket => ({
  notDue: 0, overdue1to30: 0, overdue31to60: 0, overdue61to90: 0, overdueOver90: 0, total: 0,
});

function addToBucket(b: DebtAgingBucket, days: number, amount: number): void {
  if (days <= 0) b.notDue += amount;
  else if (days <= 30) b.overdue1to30 += amount;
  else if (days <= 60) b.overdue31to60 += amount;
  else if (days <= 90) b.overdue61to90 += amount;
  else b.overdueOver90 += amount;
  b.total += amount;
}

export function sumBuckets(rows: DebtRow[]): DebtAgingBucket {
  const t = emptyBucket();
  for (const r of rows) {
    t.notDue += r.aging.notDue;
    t.overdue1to30 += r.aging.overdue1to30;
    t.overdue31to60 += r.aging.overdue31to60;
    t.overdue61to90 += r.aging.overdue61to90;
    t.overdueOver90 += r.aging.overdueOver90;
    t.total += r.aging.total;
  }
  return t;
}

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY).toISOString().slice(0, 10);
}

/** Đối trừ FIFO: tiền thanh toán trừ vào khoản đến hạn sớm nhất trước. */
function settle(
  invoices: { ref: string; dueDate: string; amount: number }[],
  paid: number,
  today: number,
): { items: DebtItem[]; prepaid: number; aging: DebtAgingBucket; overdue: number } {
  const sorted = [...invoices].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  let remain = paid;
  const items: DebtItem[] = [];
  const aging = emptyBucket();
  let overdue = 0;
  for (const inv of sorted) {
    const used = Math.min(remain, inv.amount);
    remain -= used;
    const open = inv.amount - used;
    if (open <= 0) continue;
    const days = Math.floor((today - new Date(inv.dueDate).getTime()) / DAY);
    items.push({ ref: inv.ref, dueDate: inv.dueDate, amount: open, overdueDays: days });
    addToBucket(aging, days, open);
    if (days > 0) overdue += open;
  }
  return { items, prepaid: remain, aging, overdue };
}

@Injectable({ providedIn: 'root' })
export class DebtService {
  private readonly todayMs = new Date(new Date().toISOString().slice(0, 10)).getTime();

  /** Phải thu: ghi nhận theo giá trị khách THỰC NHẬN (receivedValue), hạn = ngày giao + số ngày được nợ. */
  readonly receivables = computed<DebtRow[]>(() => {
    const orders = this.data.salesOrders();
    const vouchers = this.data.cashVouchers().filter((v) => !v.isCancelled);
    return this.data.customers()
      .map((c) => {
        const invoices = orders
          .filter((o) => o.customerId === c.id && o.receivedValue > 0 && o.status !== 'HUY')
          .map((o) => ({
            ref: o.code,
            dueDate: o.dueDate ?? addDays(o.deliveredDate ?? o.orderDate, c.creditDays),
            amount: o.receivedValue,
          }));
        const paid = vouchers
          .filter((v) => v.partnerType === 'KHACH_HANG' && v.partnerId === c.id)
          .reduce((s, v) => s + (v.kind === 'THU' ? v.amount : -v.amount), 0);
        if (invoices.length === 0 && paid === 0) return null;
        const r = settle(invoices, paid, this.todayMs);
        const balance = r.items.reduce((s, i) => s + i.amount, 0) - r.prepaid;
        return {
          partnerId: c.id, code: c.code, name: c.name,
          creditLabel: c.creditDays > 0 ? `${c.creditDays} ngày` : 'Trả ngay',
          items: r.items, prepaid: r.prepaid, overdue: r.overdue, balance, aging: r.aging,
        } satisfies DebtRow;
      })
      .filter((r): r is DebtRow => r !== null);
  });

  /** Phải trả: ghi nhận theo giá trị hàng ĐÃ NHẬN (receivedValue) của đơn nhập. */
  readonly payables = computed<DebtRow[]>(() => {
    const orders = this.data.purchaseOrders();
    const vouchers = this.data.cashVouchers().filter((v) => !v.isCancelled);
    return this.data.suppliers()
      .map((s) => {
        const days = s.creditAllowed ? SUPPLIER_CREDIT_DAYS : 0;
        const invoices = orders
          .filter((o) => o.supplierId === s.id && o.receivedValue > 0 && o.status !== 'HUY')
          .map((o) => ({
            ref: o.code,
            dueDate: addDays(o.receivedDate ?? o.date, days),
            amount: o.receivedValue,
          }));
        const paid = vouchers
          .filter((v) => v.partnerType === 'NHA_CUNG_CAP' && v.partnerId === s.id)
          .reduce((sum, v) => sum + (v.kind === 'CHI' ? v.amount : -v.amount), 0);
        if (invoices.length === 0 && paid === 0) return null;
        const r = settle(invoices, paid, this.todayMs);
        const balance = r.items.reduce((sum, i) => sum + i.amount, 0) - r.prepaid;
        return {
          partnerId: s.id, code: s.code, name: s.name,
          creditLabel: s.creditAllowed ? `${days} ngày` : 'Trả ngay',
          items: r.items, prepaid: r.prepaid, overdue: r.overdue, balance, aging: r.aging,
        } satisfies DebtRow;
      })
      .filter((r): r is DebtRow => r !== null);
  });

  readonly receivableTotal = computed(() => this.receivables().reduce((s, r) => s + r.balance, 0));
  readonly receivableOverdue = computed(() => this.receivables().reduce((s, r) => s + r.overdue, 0));
  readonly payableTotal = computed(() => this.payables().reduce((s, r) => s + r.balance, 0));
  readonly payableOverdue = computed(() => this.payables().reduce((s, r) => s + r.overdue, 0));

  constructor(private readonly data: MockDataService) {}
}
