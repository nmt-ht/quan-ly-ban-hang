import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { CashAllocation, CashVoucher, DebtAgingBucket } from '../models/domain.models';
import { MockDataService } from './mock-data.service';
import { AuthService } from './auth.service';
import { ApiService } from '../api/api.service';
import { CatalogLoader } from '../api/catalog-loader.service';
import { CASH_FROM_API } from '../api/api.config';

export interface DebtItem {
  ref: string; // mã chứng từ còn nợ (đơn nhập / đơn bán / phiếu hoàn tiền)
  dueDate: string; // yyyy-mm-dd
  amount: number; // số còn nợ của khoản này
  overdueDays: number; // <= 0: chưa đến hạn
}

/** One line of the sổ chi tiết công nợ. */
export interface DebtEntry {
  date: string; // yyyy-mm-dd
  kind: 'PHAT_SINH' | 'THANH_TOAN';
  typeLabel: string; // Nhập kho, Phiếu chi, Giao hàng, Phiếu thu, Hoàn tiền…
  ref: string; // chứng từ gốc
  link?: unknown[]; // router link to the source document
  description: string;
  amount: number; // + làm tăng nợ, − làm giảm nợ
  settled: number; // phần đã đối trừ (luôn ≥ 0)
  remaining: number; // phần còn lại: nợ còn mở, hoặc tiền chưa dùng (trả trước)
  dueDate?: string;
  overdueDays?: number;
  balance: number; // số dư luỹ kế sau dòng này
}

export interface DebtRow {
  partnerId: string;
  code: string;
  name: string;
  creditDays: number;
  creditLabel: string;
  items: DebtItem[]; // chỉ các khoản còn mở (sau khi đối trừ)
  prepaid: number; // trả trước / thu thừa chưa dùng
  overdue: number;
  balance: number; // >0: còn nợ; <0: trả trước
  aging: DebtAgingBucket;
  nextDue?: string; // hạn gần nhất của khoản còn mở
  lastActivity?: string; // ngày phát sinh / thanh toán gần nhất
  entries: DebtEntry[]; // sổ chi tiết, cũ → mới
}

const DAY = 86_400_000;

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
  return new Date(new Date(iso.slice(0, 10)).getTime() + days * DAY).toISOString().slice(0, 10);
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
  allocations?: CashAllocation[];
}

export interface SettleResult {
  items: DebtItem[];
  prepaid: number;
  aging: DebtAgingBucket;
  overdue: number;
  invoiceOpen: Map<string, number>; // ref → còn nợ
  paymentUsed: Map<string, number>; // payment id → đã đối trừ
}

/**
 * Đối trừ: phần "Chọn tay" của từng phiếu trừ đúng chứng từ đã chọn trước; phần còn lại (và mọi
 * phiếu "Tự động") trừ vào khoản đến hạn sớm nhất trước, tiền của phiếu cũ dùng trước (FIFO).
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
    const days = Math.floor((today - new Date(inv.dueDate).getTime()) / DAY);
    items.push({ ref: inv.ref, dueDate: inv.dueDate, amount, overdueDays: days });
    addToBucket(aging, days, amount);
    if (days > 0) overdue += amount;
  }
  const prepaid = queue.reduce((s, q) => s + q.left, 0);
  return { items, prepaid, aging, overdue, invoiceOpen: open, paymentUsed: used };
}

/** A document that raises the debt (nhập kho / giao hàng / tiền hoàn lại). */
interface Charge extends DebtInvoice {
  date: string;
  typeLabel: string;
  link?: unknown[];
  description: string;
}

interface PartnerInput {
  partnerId: string;
  code: string;
  name: string;
  creditDays: number;
  charges: Charge[];
  payments: (DebtPayment & { voucher: CashVoucher })[];
}

const creditLabel = (days: number) => (days > 0 ? `${days} ngày` : 'Trả ngay');

/** A DebtRow as /receivables and /payables send it: entries name their document by id. */
type ApiDebtRow = Omit<DebtRow, 'entries'> & { entries: (Omit<DebtEntry, 'link'> & { sourceId?: string })[] };

const withLinks = (path: string) => (r: ApiDebtRow): DebtRow => ({
  ...r, entries: r.entries.map(({ sourceId, ...e }) => (sourceId ? { ...e, link: [path, sourceId] } : e)),
});

@Injectable({ providedIn: 'root' })
export class DebtService {
  private readonly todayMs = new Date(new Date().toISOString().slice(0, 10)).getTime();
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly loader = inject(CatalogLoader);

  /** Công nợ as the server computed it (CASH_FROM_API). */
  private readonly server = signal<{ receivables: DebtRow[]; payables: DebtRow[] }>({ receivables: [], payables: [] });
  private readSeq = 0;

  readonly receivables = computed<DebtRow[]>(() => (CASH_FROM_API ? this.server().receivables : this.localReceivables()));
  readonly payables = computed<DebtRow[]>(() => (CASH_FROM_API ? this.server().payables : this.localPayables()));

  constructor(private readonly data: MockDataService) {
    if (!CASH_FROM_API) return;
    // Every write that moves công nợ (giao / nhận hàng, chốt giao, phiếu thu chi, số ngày được nợ) puts
    // its result into one of these lists, so a change there reads công nợ again.
    effect(() => {
      if (this.loader.status() !== 'ready') return;
      this.data.salesOrders();
      this.data.purchaseOrders();
      this.data.cashVouchers();
      this.data.customers();
      this.data.suppliers();
      untracked(() => void this.refresh());
    });
  }

  /** Read /receivables and /payables again; empty without debt.view (the server refuses them). */
  async refresh(): Promise<void> {
    const seq = ++this.readSeq;
    if (!this.auth.can('debt.view')) {
      this.server.set({ receivables: [], payables: [] });
      return;
    }
    try {
      const [receivables, payables] = await Promise.all([
        this.api.get<ApiDebtRow[]>('/receivables'),
        this.api.get<ApiDebtRow[]>('/payables'),
      ]);
      // Only the latest read counts: an older answer may predate the write that started a newer one.
      if (seq === this.readSeq) {
        this.server.set({ receivables: receivables.map(withLinks('/don-hang')), payables: payables.map(withLinks('/mua-hang')) });
      }
    } catch {
      // Keep the last công nợ shown; the next change reads again.
    }
  }

  /** Phải thu: theo giá trị khách THỰC NHẬN (receivedValue), hạn = ngày giao + số ngày được nợ. */
  private readonly localReceivables = computed<DebtRow[]>(() => {
    const orders = this.data.salesOrders();
    const vouchers = this.data.cashVouchers().filter((v) => !v.isCancelled && v.partnerType === 'KHACH_HANG');
    return this.data.customers()
      .map((c) => {
        const charges: Charge[] = orders
          .filter((o) => o.customerId === c.id && o.receivedValue > 0 && o.status !== 'HUY')
          .map((o) => {
            const date = (o.deliveredDate ?? o.orderDate).slice(0, 10);
            return {
              ref: o.code, date, dueDate: o.dueDate ?? addDays(date, c.creditDays), amount: o.receivedValue,
              typeLabel: 'Giao hàng', link: ['/don-hang', o.id], description: `Khách nhận hàng đơn ${o.code}`,
            };
          });
        return this.build({
          partnerId: c.id, code: c.code, name: c.name, creditDays: c.creditDays, charges,
          ...this.splitVouchers(vouchers.filter((v) => v.partnerId === c.id), 'THU', 'Phiếu chi hoàn tiền', charges),
        });
      })
      .filter((r): r is DebtRow => r !== null);
  });

  /** Phải trả: theo giá trị hàng ĐÃ NHẬN (receivedValue) của đơn nhập; hạn = ngày nhập kho + số ngày được nợ. */
  private readonly localPayables = computed<DebtRow[]>(() => {
    const orders = this.data.purchaseOrders();
    const vouchers = this.data.cashVouchers().filter((v) => !v.isCancelled && v.partnerType === 'NHA_CUNG_CAP');
    const receipts = this.data.warehouseVouchers().filter((w) => !w.isCancelled && w.type === 'NHAP');
    return this.data.suppliers()
      .map((s) => {
        const charges: Charge[] = orders
          .filter((o) => o.supplierId === s.id && o.receivedValue > 0 && o.status !== 'HUY')
          .map((o) => {
            const date = (o.receivedDate ?? o.date).slice(0, 10);
            const pnk = receipts.filter((w) => w.purchaseOrderId === o.id || (w.reason ?? '').includes(o.code)).map((w) => w.code);
            return {
              ref: o.code, date, dueDate: addDays(date, s.creditDays), amount: o.receivedValue,
              typeLabel: 'Nhập kho', link: ['/mua-hang', o.id],
              description: `Nhận hàng đơn nhập ${o.code}` + (pnk.length ? ` (${pnk.join(', ')})` : ''),
            };
          });
        return this.build({
          partnerId: s.id, code: s.code, name: s.name, creditDays: s.creditDays, charges,
          ...this.splitVouchers(vouchers.filter((v) => v.partnerId === s.id), 'CHI', 'Phiếu thu hoàn tiền', charges),
        });
      })
      .filter((r): r is DebtRow => r !== null);
  });

  readonly receivableTotal = computed(() => this.receivables().reduce((s, r) => s + r.balance, 0));
  readonly receivableOverdue = computed(() => this.receivables().reduce((s, r) => s + r.overdue, 0));
  readonly payableTotal = computed(() => this.payables().reduce((s, r) => s + r.balance, 0));
  readonly payableOverdue = computed(() => this.payables().reduce((s, r) => s + r.overdue, 0));

  /**
   * Vouchers of the paying kind settle the debt; vouchers the other way (đối tác hoàn tiền) are
   * charges — they eat into the prepayment first, like any other khoản nợ.
   */
  private splitVouchers(
    list: CashVoucher[], payKind: CashVoucher['kind'], refundLabel: string, charges: Charge[],
  ): { payments: PartnerInput['payments'] } {
    const payments: PartnerInput['payments'] = [];
    for (const v of list) {
      if (v.kind === payKind) {
        payments.push({ id: v.id, date: v.date.slice(0, 10), amount: v.amount, allocations: v.allocations, voucher: v });
      } else {
        charges.push({
          ref: v.code, date: v.date.slice(0, 10), dueDate: v.date.slice(0, 10), amount: v.amount,
          typeLabel: refundLabel, description: v.description || v.category,
        });
      }
    }
    return { payments };
  }

  private build(p: PartnerInput): DebtRow | null {
    if (p.charges.length === 0 && p.payments.length === 0) return null;
    const r = settle(p.charges, p.payments, this.todayMs);
    const balance = r.items.reduce((s, i) => s + i.amount, 0) - r.prepaid;

    const lines: Omit<DebtEntry, 'balance'>[] = [
      ...p.charges.map((c) => {
        const remaining = r.invoiceOpen.get(c.ref) ?? 0;
        return {
          date: c.date, kind: 'PHAT_SINH' as const, typeLabel: c.typeLabel, ref: c.ref, link: c.link, description: c.description,
          amount: c.amount, settled: c.amount - remaining, remaining, dueDate: c.dueDate,
          overdueDays: remaining > 0 ? Math.floor((this.todayMs - new Date(c.dueDate).getTime()) / DAY) : undefined,
        };
      }),
      ...p.payments.map((x) => {
        const settled = r.paymentUsed.get(x.id) ?? 0;
        return {
          date: x.date, kind: 'THANH_TOAN' as const, typeLabel: x.voucher.kind === 'CHI' ? 'Phiếu chi' : 'Phiếu thu', ref: x.voucher.code,
          description: x.voucher.description || x.voucher.category, amount: -x.amount, settled, remaining: x.amount - settled,
        };
      }),
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? a.ref.localeCompare(b.ref) : a.kind === 'PHAT_SINH' ? -1 : 1));
    let running = 0;
    const entries = lines.map((l) => ({ ...l, balance: (running += l.amount) }));

    return {
      partnerId: p.partnerId, code: p.code, name: p.name, creditDays: p.creditDays, creditLabel: creditLabel(p.creditDays),
      items: r.items, prepaid: r.prepaid, overdue: r.overdue, balance, aging: r.aging,
      nextDue: r.items[0]?.dueDate, lastActivity: entries.at(-1)?.date, entries,
    };
  }
}
