import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { DebtAgingBucket } from '../models/domain.models';
import { DataStore } from './data-store.service';
import { AuthService } from './auth.service';
import { ApiService } from '../api/api.service';
import { CatalogLoader } from '../api/catalog-loader.service';

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

/** A DebtRow as /receivables and /payables send it: entries name their document by id. */
type ApiDebtRow = Omit<DebtRow, 'entries'> & { entries: (Omit<DebtEntry, 'link'> & { sourceId?: string })[] };

const withLinks = (path: string) => (r: ApiDebtRow): DebtRow => ({
  ...r, entries: r.entries.map(({ sourceId, ...e }) => (sourceId ? { ...e, link: [path, sourceId] } : e)),
});

/** Công nợ phải thu / phải trả as the server computes them (GET /receivables, /payables). */
@Injectable({ providedIn: 'root' })
export class DebtService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly loader = inject(CatalogLoader);

  private readonly server = signal<{ receivables: DebtRow[]; payables: DebtRow[] }>({ receivables: [], payables: [] });
  private readSeq = 0;

  readonly receivables = computed<DebtRow[]>(() => this.server().receivables);
  readonly payables = computed<DebtRow[]>(() => this.server().payables);

  readonly receivableTotal = computed(() => this.receivables().reduce((s, r) => s + r.balance, 0));
  readonly receivableOverdue = computed(() => this.receivables().reduce((s, r) => s + r.overdue, 0));
  readonly payableTotal = computed(() => this.payables().reduce((s, r) => s + r.balance, 0));
  readonly payableOverdue = computed(() => this.payables().reduce((s, r) => s + r.overdue, 0));

  constructor(private readonly data: DataStore) {
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
}
