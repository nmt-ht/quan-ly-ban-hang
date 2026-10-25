import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataStore } from '../../core/services/data-store.service';
import { DebtService } from '../../core/services/debt.service';
import { CashVoucher } from '../../core/models/domain.models';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { FilterMultiSelectComponent, FilterOption } from '../../shared/filter-multi-select/filter-multi-select.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { PeriodFilterComponent, PeriodValue, NO_PERIOD } from '../../shared/period-filter/period-filter.component';
import { NumberRange, RangeFilterComponent } from '../../shared/range-filter/range-filter.component';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { ColumnSort } from '../../shared/column-sort';
import { amountTone, formatVnd, formatVndSigned } from '../../shared/format.util';
import { PERIOD_PRESETS, formatDay, rangeLabel } from '../../shared/period';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { ACCOUNT_TYPE_LABEL } from './cash-voucher.rules';
import { CashVoucherPage, CashVoucherPageQuery, CashVoucherService } from './cash-voucher.service';
import { errorText } from '../../core/api/api.service';
import { AllowedLinkDirective } from '../../shared/allowed-link.directive';

interface ActiveChip {
  label: string;
  clear: () => void;
}

const KIND_LABEL = { THU: 'Phiếu thu', CHI: 'Phiếu chi' } as const;

/** Column header → server sort key. */
const COLUMN_SORT: Record<string, string> = {
  code: 'code', date: 'date', category: 'category', partnerId: 'partner', accountId: 'account', amount: 'amount', description: 'description',
  createdBy: 'createdBy',
};

const EMPTY_PAGE: CashVoucherPage = {
  rows: [], total: 0, page: 1, pageSize: 20, categoryCounts: {},
  cards: { thu: 0, thuCash: 0, thuBank: 0, chi: 0, chiCash: 0, chiBank: 0, net: 0, count: 0 },
};

// Phiếu thu chi (Pha 1.1): every phiếu, page by page from the server — search, filters, sort and the period cards cover
// all of them, not only those the app loaded at sign-in.
@Component({
  selector: 'app-cash-vouchers',
  standalone: true,
  imports: [
    CommonModule, RouterLink, AllowedLinkDirective, DataTableComponent, FilterMultiSelectComponent, PaginationComponent, PeriodFilterComponent,
    RangeFilterComponent, NavIconComponent,
  ],
  templateUrl: './cash-vouchers.component.html',
  styleUrl: './cash-vouchers.component.scss',
})
export class CashVouchersComponent {
  readonly data = inject(DataStore);
  private readonly debt = inject(DebtService);
  private readonly svc = inject(CashVoucherService);

  readonly notice = signal((history.state as { notice?: string } | null)?.notice ?? '');
  readonly search = signal('');
  readonly kind = signal<'all' | 'THU' | 'CHI'>('all');
  readonly categories = signal<string[]>([]);
  readonly method = signal<'all' | 'TIEN_MAT' | 'NGAN_HANG'>('all');
  readonly accountId = signal('all');
  readonly period = signal<PeriodValue>(NO_PERIOD);
  readonly createdBy = signal<string[]>([]);
  readonly amount = signal<NumberRange>({ min: null, max: null });
  readonly showCancelled = signal(false);
  // Clicking a column header sorts; again reverses; a third click goes back to the default order.
  readonly headerSort = signal<ColumnSort | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly exporting = signal(false);
  readonly money = formatVnd;
  readonly signed = formatVndSigned;
  readonly tone = amountTone;
  readonly accountTypeLabel = ACCOUNT_TYPE_LABEL;

  readonly result = signal<CashVoucherPage>(EMPTY_PAGE);
  readonly loading = signal(false);
  readonly error = signal('');
  /** The search box waits for typing to pause before asking the server. */
  private readonly searchQuery = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private requestSeq = 0;

  constructor() {
    // Số dư quỹ as of now (another user may have lập phiếu since the list was loaded).
    void this.svc.refreshBalances();
    // New filters start again from page 1.
    effect(() => {
      this.filters();
      untracked(() => this.page.set(1));
    });
    // Ask the server whenever the filters, the page or the phiếu in memory change (a save elsewhere).
    effect(() => {
      const query = { ...this.filters(), page: this.page(), pageSize: this.pageSize() };
      this.data.cashVouchers();
      untracked(() => void this.load(query));
    });
  }

  setSearch(text: string): void {
    this.search.set(text);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.searchQuery.set(text), 300);
  }

  private async load(query: CashVoucherPageQuery): Promise<void> {
    const seq = ++this.requestSeq;
    this.loading.set(true);
    try {
      const res = await this.svc.page(query);
      if (seq !== this.requestSeq) return; // a newer request answered first
      this.result.set(res);
      this.error.set('');
    } catch (e) {
      if (seq === this.requestSeq) this.error.set(errorText(e));
    } finally {
      if (seq === this.requestSeq) this.loading.set(false);
    }
  }

  private readonly accountById = computed(() => new Map(this.data.cashAccounts().map((a) => [a.id, a])));
  private readonly customerById = computed(() => new Map(this.data.customers().map((c) => [c.id, c])));
  private readonly supplierById = computed(() => new Map(this.data.suppliers().map((s) => [s.id, s])));
  private readonly userByEmail = computed(() => new Map(this.data.users().map((u) => [u.email, u.name])));

  readonly accounts = computed(() => [...this.data.cashAccounts()].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
  readonly totalBalance = computed(() => this.data.cashAccounts().filter((a) => a.isActive !== false).reduce((s, a) => s + a.balance, 0));

  /** Đã đối trừ / chưa dùng of each phiếu, straight from the debt engine. */
  private readonly settlement = computed(() => {
    const m = new Map<string, { settled: number; remaining: number }>();
    for (const r of [...this.debt.receivables(), ...this.debt.payables()]) {
      for (const e of r.entries) if (e.kind === 'THANH_TOAN') m.set(e.ref, { settled: e.settled, remaining: e.remaining });
    }
    return m;
  });

  partnerName(v: CashVoucher): string {
    if (v.partnerType === 'KHACH_HANG') {
      const c = this.customerById().get(v.partnerId ?? '');
      return c ? `${c.code} · ${c.companyName || c.name}` : '—';
    }
    if (v.partnerType === 'NHA_CUNG_CAP') {
      const s = this.supplierById().get(v.partnerId ?? '');
      return s ? `${s.code} · ${s.name}` : '—';
    }
    return '—';
  }

  accountText(v: CashVoucher): string {
    const a = this.accountById().get(v.accountId);
    return a ? `${a.name} (${ACCOUNT_TYPE_LABEL[a.type]})` : v.accountId;
  }

  settledText(v: CashVoucher): string {
    if (v.partnerType === 'KHAC' || v.isCancelled) return '—';
    const s = this.settlement().get(v.code);
    if (!s) return '—';
    return s.remaining > 0 ? `${formatVnd(s.settled)} · trả trước ${formatVnd(s.remaining)}` : formatVnd(s.settled);
  }

  userName(email: string): string {
    return this.userByEmail().get(email) ?? email;
  }

  readonly categoryOptions = computed<FilterOption[]>(() => {
    const counts = this.result().categoryCounts;
    const names = new Set([...this.data.cashCategories().map((c) => c.name), ...Object.keys(counts)]);
    return [...names].map((n) => ({ value: n, label: n, count: counts[n] ?? 0 }));
  });

  readonly userOptions = computed<FilterOption[]>(() => {
    const roles = new Map(this.data.roles().map((r) => [r.id, r.name]));
    return this.data.users().map((u) => ({ value: u.email, label: `${u.name} — ${roles.get(u.roleId) ?? ''}` }));
  });

  readonly rows = computed(() => this.result().rows);
  readonly total = computed(() => this.result().total);
  /** Thẻ tổng theo kỳ đang lọc (phiếu huỷ không tính); Tồn quỹ là toàn bộ lịch sử. */
  readonly cards = computed(() => this.result().cards);

  /** Everything the server needs for the current view (all pages). */
  private readonly filters = computed<CashVoucherPageQuery>(() => {
    const hs = this.headerSort();
    const range = this.period().range;
    const { min, max } = this.amount();
    const k = this.kind();
    const m = this.method();
    const a = this.accountId();
    return {
      q: this.searchQuery().trim() || undefined,
      kind: k === 'all' ? undefined : k, categories: this.categories(), method: m === 'all' ? undefined : m, accountId: a === 'all' ? undefined : a,
      from: range.from || undefined, to: range.to || undefined, createdBy: this.createdBy(),
      min: min ?? undefined, max: max ?? undefined, cancelled: this.showCancelled() || undefined,
      // default: Mã tăng dần
      ...(hs ? { sort: COLUMN_SORT[hs.key] ?? 'code', dir: hs.dir } : { sort: 'code', dir: 'asc' as const }),
    };
  });

  readonly chips = computed<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];
    if (this.kind() !== 'all') chips.push({ label: KIND_LABEL[this.kind() as 'THU' | 'CHI'], clear: () => this.kind.set('all') });
    for (const c of this.categories()) chips.push({ label: c, clear: () => this.categories.update((v) => v.filter((x) => x !== c)) });
    if (this.method() !== 'all') chips.push({ label: ACCOUNT_TYPE_LABEL[this.method() as 'TIEN_MAT'], clear: () => this.method.set('all') });
    if (this.accountId() !== 'all') chips.push({ label: this.accountById().get(this.accountId())?.name ?? '', clear: () => this.accountId.set('all') });
    const p = this.period();
    if (p.preset !== null) {
      const label = p.preset === 'custom' ? rangeLabel(p.range) : PERIOD_PRESETS.find((x) => x.value === p.preset)?.label;
      chips.push({ label: `Kỳ: ${label}`, clear: () => this.period.set(NO_PERIOD) });
    }
    for (const e of this.createdBy()) chips.push({ label: `Người lập: ${this.userName(e)}`, clear: () => this.createdBy.update((v) => v.filter((x) => x !== e)) });
    const { min, max } = this.amount();
    if (min !== null || max !== null) {
      const t = min !== null && max !== null ? `${formatVnd(min)} – ${formatVnd(max)}` : min !== null ? `≥ ${formatVnd(min)}` : `≤ ${formatVnd(max!)}`;
      chips.push({ label: `Số tiền: ${t}`, clear: () => this.amount.set({ min: null, max: null }) });
    }
    if (this.showCancelled()) chips.push({ label: 'Gồm phiếu đã huỷ', clear: () => this.showCancelled.set(false) });
    return chips;
  });

  readonly columns: DataTableColumn<CashVoucher>[] = [
    { key: 'code', label: 'Số phiếu', copy: true, link: (r) => ['/thu-chi', r.id] },
    { key: 'date', label: 'Ngày', format: (r) => formatDay(r.date), mono: true },
    { key: 'category', label: 'Loại', format: (r) => `${KIND_LABEL[r.kind]} · ${r.category}` },
    { key: 'partnerId', sortByText: true, label: 'Đối tượng', format: (r) => this.partnerName(r) },
    { key: 'accountId', sortByText: true, label: 'Tài khoản', format: (r) => this.accountText(r) },
    { key: 'amount', label: 'Số tiền', align: 'right', format: (r) => formatVndSigned(r.kind === 'THU' ? r.amount : -r.amount),
      tone: (r) => (r.isCancelled ? 0 : r.kind === 'THU' ? r.amount : -r.amount) },
    { key: 'settled', label: 'Đã đối trừ', align: 'right', format: (r) => this.settledText(r), filter: false },
    { key: 'description', label: 'Diễn giải', format: (r) => (r.isCancelled ? `[Đã huỷ] ` : '') + (r.description || '—') },
    { key: 'createdBy', sortByText: true, label: 'Người lập', format: (r) => this.userName(r.createdBy) },
  ];

  clearAll(): void {
    this.search.set('');
    this.kind.set('all');
    this.categories.set([]);
    this.method.set('all');
    this.accountId.set('all');
    this.period.set(NO_PERIOD);
    this.createdBy.set([]);
    this.amount.set({ min: null, max: null });
    this.showCancelled.set(false);
  }

  /** Every matching phiếu (not only this page), in the list's order. */
  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      const all = (await this.svc.page({ ...this.filters(), page: 1, pageSize: 5000 })).rows;
      await downloadWorkbook(exportFileName('Phiếu thu chi'), [{
        name: 'Phiếu thu chi',
        columns: [
          { header: 'Số phiếu', width: 13 }, { header: 'Ngày', width: 12 }, { header: 'Loại phiếu', width: 11 }, { header: 'Loại thu chi', width: 22 },
          { header: 'Đối tượng', width: 34 }, { header: 'Tài khoản', width: 26 }, { header: 'Thu', width: 15, numFmt: '#,##0' },
          { header: 'Chi', width: 15, numFmt: '#,##0' }, { header: 'Diễn giải', width: 36 }, { header: 'Người lập', width: 20 }, { header: 'Trạng thái', width: 12 },
        ],
        rows: all.map((v) => [
          v.code, formatDay(v.date), KIND_LABEL[v.kind], v.category, this.partnerName(v), this.accountText(v),
          v.kind === 'THU' ? v.amount : '', v.kind === 'CHI' ? v.amount : '', v.description ?? '', this.userName(v.createdBy),
          v.isCancelled ? 'Đã huỷ' : '',
        ]),
      }]);
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.exporting.set(false);
    }
  }
}
