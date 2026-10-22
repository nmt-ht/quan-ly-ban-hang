import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../core/services/mock-data.service';
import { DebtService } from '../../core/services/debt.service';
import { CashVoucher } from '../../core/models/domain.models';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { FilterMultiSelectComponent, FilterOption } from '../../shared/filter-multi-select/filter-multi-select.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { PeriodFilterComponent, PeriodValue, NO_PERIOD } from '../../shared/period-filter/period-filter.component';
import { NumberRange, RangeFilterComponent } from '../../shared/range-filter/range-filter.component';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { ColumnFilters, applyColumnFilters } from '../../shared/column-filter';
import { amountTone, foldVi, formatVnd, formatVndSigned } from '../../shared/format.util';
import { PERIOD_PRESETS, formatDay, inRange, rangeLabel } from '../../shared/period';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { ACCOUNT_TYPE_LABEL } from './cash-voucher.rules';
import { CashVoucherService } from './cash-voucher.service';

interface ActiveChip {
  label: string;
  clear: () => void;
}

const KIND_LABEL = { THU: 'Phiếu thu', CHI: 'Phiếu chi' } as const;

@Component({
  selector: 'app-cash-vouchers',
  standalone: true,
  imports: [
    CommonModule, RouterLink, DataTableComponent, FilterMultiSelectComponent, PaginationComponent, PeriodFilterComponent,
    RangeFilterComponent, NavIconComponent,
  ],
  templateUrl: './cash-vouchers.component.html',
  styleUrl: './cash-vouchers.component.scss',
})
export class CashVouchersComponent {
  readonly data = inject(MockDataService);
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
  readonly columnFilters = signal<ColumnFilters>({});
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly exporting = signal(false);
  readonly money = formatVnd;
  readonly signed = formatVndSigned;
  readonly tone = amountTone;
  readonly accountTypeLabel = ACCOUNT_TYPE_LABEL;

  constructor() {
    // Keep balances true to the vouchers (demo data and any earlier session edits).
    this.svc.recomputeBalances();
    effect(() => {
      this.vouchers();
      untracked(() => this.page.set(1));
    });
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
    const counts = new Map<string, number>();
    for (const v of this.data.cashVouchers()) counts.set(v.category, (counts.get(v.category) ?? 0) + 1);
    const names = new Set([...this.data.cashCategories().map((c) => c.name), ...counts.keys()]);
    return [...names].map((n) => ({ value: n, label: n, count: counts.get(n) ?? 0 }));
  });

  readonly userOptions = computed<FilterOption[]>(() => {
    const roles = new Map(this.data.roles().map((r) => [r.id, r.name]));
    return this.data.users().map((u) => ({ value: u.email, label: `${u.name} — ${roles.get(u.roleId) ?? ''}` }));
  });

  /** Every filter (except kind & cancelled) — the period cards use the same set. */
  private readonly matched = computed(() => {
    const q = foldVi(this.search().trim());
    const cats = this.categories();
    const method = this.method();
    const acc = this.accountId();
    const range = this.period().range;
    const by = this.createdBy();
    const { min, max } = this.amount();
    return this.data.cashVouchers().filter((v) => {
      if (q && !foldVi(`${v.code} ${this.partnerName(v)} ${v.description ?? ''} ${v.category}`).includes(q)) return false;
      if (cats.length && !cats.includes(v.category)) return false;
      if (method !== 'all' && this.accountById().get(v.accountId)?.type !== method) return false;
      if (acc !== 'all' && v.accountId !== acc) return false;
      if (!inRange(v.date, range)) return false;
      if (by.length && !by.includes(v.createdBy)) return false;
      if (min !== null && v.amount < min) return false;
      if (max !== null && v.amount > max) return false;
      return true;
    });
  });

  readonly vouchers = computed(() => {
    const k = this.kind();
    const rows = this.matched()
      .filter((v) => (k === 'all' || v.kind === k) && (this.showCancelled() || !v.isCancelled))
      .sort((a, b) => b.date.localeCompare(a.date) || b.code.localeCompare(a.code));
    return applyColumnFilters(rows, this.columns, this.columnFilters());
  });

  readonly paged = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.vouchers().slice(start, start + this.pageSize());
  });

  /** Thẻ tổng theo kỳ đang lọc (phiếu huỷ không tính); Tồn quỹ là toàn bộ lịch sử. */
  readonly cards = computed(() => {
    const rows = this.matched().filter((v) => !v.isCancelled);
    const sum = (kind: 'THU' | 'CHI', type?: 'TIEN_MAT' | 'NGAN_HANG') =>
      rows.filter((v) => v.kind === kind && (!type || this.accountById().get(v.accountId)?.type === type)).reduce((s, v) => s + v.amount, 0);
    const thu = sum('THU');
    const chi = sum('CHI');
    return {
      thu, thuCash: sum('THU', 'TIEN_MAT'), thuBank: sum('THU', 'NGAN_HANG'),
      chi, chiCash: sum('CHI', 'TIEN_MAT'), chiBank: sum('CHI', 'NGAN_HANG'),
      net: thu - chi,
      count: rows.length,
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
    for (const col of this.columns) {
      const v = (this.columnFilters()[col.key] ?? '').trim();
      if (v) chips.push({ label: `${col.label}: ${v}`, clear: () => this.columnFilters.update((f) => ({ ...f, [col.key]: '' })) });
    }
    return chips;
  });

  readonly columns: DataTableColumn<CashVoucher>[] = [
    { key: 'code', label: 'Số phiếu', copy: true, link: (r) => ['/thu-chi', r.id] },
    { key: 'date', label: 'Ngày', format: (r) => formatDay(r.date), mono: true },
    { key: 'category', label: 'Loại', format: (r) => `${KIND_LABEL[r.kind]} · ${r.category}` },
    { key: 'partnerId', label: 'Đối tượng', format: (r) => this.partnerName(r) },
    { key: 'accountId', label: 'Tài khoản', format: (r) => this.accountText(r) },
    { key: 'amount', label: 'Số tiền', align: 'right', format: (r) => formatVndSigned(r.kind === 'THU' ? r.amount : -r.amount), filterValue: (r) => r.amount,
      tone: (r) => (r.isCancelled ? 0 : r.kind === 'THU' ? r.amount : -r.amount) },
    { key: 'settled', label: 'Đã đối trừ', align: 'right', format: (r) => this.settledText(r), filter: false },
    { key: 'description', label: 'Diễn giải', format: (r) => (r.isCancelled ? `[Đã huỷ] ` : '') + (r.description || '—') },
    { key: 'createdBy', label: 'Người lập', format: (r) => this.userName(r.createdBy) },
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
    this.columnFilters.set({});
  }

  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      await downloadWorkbook(exportFileName('Phiếu thu chi'), [{
        name: 'Phiếu thu chi',
        columns: [
          { header: 'Số phiếu', width: 13 }, { header: 'Ngày', width: 12 }, { header: 'Loại phiếu', width: 11 }, { header: 'Loại thu chi', width: 22 },
          { header: 'Đối tượng', width: 34 }, { header: 'Tài khoản', width: 26 }, { header: 'Thu', width: 15, numFmt: '#,##0' },
          { header: 'Chi', width: 15, numFmt: '#,##0' }, { header: 'Diễn giải', width: 36 }, { header: 'Người lập', width: 20 }, { header: 'Trạng thái', width: 12 },
        ],
        rows: this.vouchers().map((v) => [
          v.code, formatDay(v.date), KIND_LABEL[v.kind], v.category, this.partnerName(v), this.accountText(v),
          v.kind === 'THU' ? v.amount : '', v.kind === 'CHI' ? v.amount : '', v.description ?? '', this.userName(v.createdBy),
          v.isCancelled ? 'Đã huỷ' : '',
        ]),
      }]);
    } finally {
      this.exporting.set(false);
    }
  }
}
