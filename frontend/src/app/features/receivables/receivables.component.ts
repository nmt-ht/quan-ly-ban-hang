import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { DataStore } from '../../core/services/data-store.service';
import { DebtRow, DebtService } from '../../core/services/debt.service';
import { CustomerType } from '../../core/models/domain.models';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { FilterMultiSelectComponent, FilterOption } from '../../shared/filter-multi-select/filter-multi-select.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { ColumnFilters, applyColumnFilters } from '../../shared/column-filter';
import { ColumnSort, sortByColumn } from '../../shared/column-sort';
import { foldVi, formatVnd } from '../../shared/format.util';
import { formatDay } from '../../shared/period';
import { CUSTOMER_TYPE_SHORT, customerTypeClass } from '../../shared/status-labels';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { DebtLedgerComponent } from '../debts/debt-ledger/debt-ledger.component';
import { AGING_COLUMNS } from '../debts/aging';
import { CUSTOMER_TYPES } from '../customers/customer.rules';
import { AllowedLinkDirective } from '../../shared/allowed-link.directive';

type ReceivableSort = 'code' | 'balance' | 'overdue' | 'due' | 'name';

const SORTS: { value: ReceivableSort; label: string }[] = [
  { value: 'code', label: 'Mã tăng dần' },
  { value: 'balance', label: 'Số dư lớn nhất' },
  { value: 'overdue', label: 'Quá hạn nhiều nhất' },
  { value: 'due', label: 'Hạn gần nhất' },
  { value: 'name', label: 'Tên A → Z' },
];

// /cong-no/khach-hang — list; with ?partnerId= it shows the Sổ chi tiết công nợ (as in production).
@Component({
  selector: 'app-receivables',
  standalone: true,
  imports: [RouterLink, AllowedLinkDirective, DataTableComponent, FilterMultiSelectComponent, PaginationComponent, NavIconComponent, DebtLedgerComponent],
  templateUrl: './receivables.component.html',
})
export class ReceivablesComponent {
  private readonly data = inject(DataStore);
  private readonly debt = inject(DebtService);
  readonly partnerId = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((q) => q.get('partnerId'))), { initialValue: null });

  readonly search = signal('');
  readonly types = signal<string[]>([]);
  readonly owingOnly = signal(true);
  readonly overdueOnly = signal(false);
  readonly sort = signal<ReceivableSort>('code'); // default: Mã tăng dần
  readonly columnFilters = signal<ColumnFilters>({});
  // Clicking a column header overrides the "Sắp xếp" select; picking from the select clears it.
  readonly headerSort = signal<ColumnSort | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly exporting = signal(false);
  readonly notice = signal('');
  readonly sorts = SORTS;
  readonly money = formatVnd;

  private readonly customerById = computed(() => new Map(this.data.customers().map((c) => [c.id, c])));

  readonly typeOptions = computed<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const r of this.debt.receivables()) {
      const t = this.customerById().get(r.partnerId)?.type;
      if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return CUSTOMER_TYPES.map((t) => ({ value: t.value, label: t.label, count: counts.get(t.value) ?? 0, dotClass: customerTypeClass(t.value) }));
  });

  private typeOf(r: DebtRow): CustomerType | undefined {
    return this.customerById().get(r.partnerId)?.type;
  }

  readonly columns: DataTableColumn<DebtRow>[] = [
    { key: 'code', label: 'Mã KH', copy: true, link: () => ['/cong-no/khach-hang'], linkQuery: (r) => ({ partnerId: r.partnerId }) },
    { key: 'name', label: 'Tên khách hàng', format: (r) => { const c = this.customerById().get(r.partnerId); return c?.companyName ? `${c.name} · ${c.companyName}` : r.name; } },
    {
      key: 'type', label: 'Loại', format: (r) => (this.typeOf(r) ? CUSTOMER_TYPE_SHORT[this.typeOf(r)!] : '—'),
      badge: (r) => (this.typeOf(r) ? customerTypeClass(this.typeOf(r)!) : ''),
    },
    { key: 'phone', label: 'Điện thoại', format: (r) => this.customerById().get(r.partnerId)?.phone || '—', mono: true },
    { key: 'creditDays', label: 'Được nợ', align: 'right', format: (r) => r.creditLabel, filterValue: (r) => r.creditDays },
    { key: 'items', label: 'Số khoản', align: 'right', format: (r) => String(r.items.length), filterValue: (r) => r.items.length },
    { key: 'nextDue', label: 'Hạn gần nhất', format: (r) => (r.nextDue ? formatDay(r.nextDue) : '—'), mono: true },
    { key: 'prepaid', label: 'Trả trước', align: 'right', format: (r) => (r.prepaid ? formatVnd(r.prepaid) : '—'), filterValue: (r) => r.prepaid },
    { key: 'overdue', label: 'Quá hạn', align: 'right', format: (r) => (r.overdue ? formatVnd(r.overdue) : '—'), filterValue: (r) => r.overdue },
    { key: 'balance', label: 'Số dư', align: 'right', format: (r) => formatVnd(r.balance), filterValue: (r) => r.balance, tone: (r) => r.balance, toneFlow: false },
  ];

  readonly rows = computed(() => {
    const q = foldVi(this.search().trim());
    const types = this.types();
    const rows = this.debt.receivables().filter((r) => {
      const c = this.customerById().get(r.partnerId);
      if (q && !foldVi(`${r.code} ${r.name} ${c?.companyName ?? ''} ${c?.phone ?? ''}`).includes(q)) return false;
      if (types.length && !types.includes(c?.type ?? '')) return false;
      if (this.owingOnly() && r.balance === 0) return false;
      if (this.overdueOnly() && r.overdue <= 0) return false;
      return true;
    });
    const s = this.sort();
    rows.sort((a, b) =>
      s === 'code' ? a.code.localeCompare(b.code, 'vi', { numeric: true })
        : s === 'balance' ? b.balance - a.balance
        : s === 'overdue' ? b.overdue - a.overdue || b.balance - a.balance
          : s === 'due' ? (a.nextDue ?? '9999').localeCompare(b.nextDue ?? '9999')
            : a.name.localeCompare(b.name, 'vi'),
    );
    return sortByColumn(applyColumnFilters(rows, this.columns, this.columnFilters()), this.columns, this.headerSort());
  });

  readonly pagedRows = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.rows().slice(start, start + this.pageSize());
  });

  readonly totals = computed(() => {
    const rows = this.rows();
    const sum = (f: (r: DebtRow) => number) => rows.reduce((s, r) => s + f(r), 0);
    return {
      balance: sum((r) => r.balance),
      overdue: sum((r) => r.overdue),
      prepaid: sum((r) => r.prepaid),
      open: sum((r) => r.aging.total),
      overdueCustomers: rows.filter((r) => r.overdue > 0).length,
      aging: AGING_COLUMNS.map((a) => ({ ...a, amount: sum((r) => r.aging[a.key]) })),
    };
  });

  readonly hasFilters = computed(
    () => !!this.search().trim() || this.overdueOnly() || this.types().length > 0 || Object.values(this.columnFilters()).some((v) => !!v?.trim()),
  );

  constructor() {
    // Notice from the page we came back from (e.g. a saved phiếu thu); reset when list ↔ sổ chi tiết.
    effect(() => {
      this.partnerId();
      untracked(() => this.notice.set((history.state as { notice?: string } | null)?.notice ?? ''));
    });
    effect(() => {
      this.rows();
      untracked(() => this.page.set(1));
    });
  }

  percent(part: number, whole: number): number {
    return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
  }

  clearAll(): void {
    this.search.set('');
    this.types.set([]);
    this.overdueOnly.set(false);
    this.columnFilters.set({});
  }

  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      await downloadWorkbook(exportFileName('Công nợ phải thu'), [
        {
          name: 'Công nợ phải thu',
          columns: [
            { header: 'Mã KH', width: 13 },
            { header: 'Tên khách hàng', width: 34 },
            { header: 'Loại', width: 10 },
            { header: 'Điện thoại', width: 13 },
            { header: 'Được nợ', width: 10 },
            { header: 'Số khoản', width: 10 },
            { header: 'Hạn gần nhất', width: 13 },
            { header: 'Trả trước', width: 15, numFmt: '#,##0' },
            ...AGING_COLUMNS.map((a) => ({ header: a.label, width: 15, numFmt: '#,##0' })),
            { header: 'Quá hạn', width: 15, numFmt: '#,##0' },
            { header: 'Số dư', width: 16, numFmt: '#,##0' },
          ],
          rows: this.rows().map((r) => {
            const c = this.customerById().get(r.partnerId);
            return [
              r.code, r.name, c ? CUSTOMER_TYPE_SHORT[c.type] : '', c?.phone ?? '', r.creditLabel, r.items.length,
              r.nextDue ? formatDay(r.nextDue) : '', r.prepaid, ...AGING_COLUMNS.map((a) => r.aging[a.key]), r.overdue, r.balance,
            ];
          }),
        },
        {
          name: 'Khoản còn mở',
          columns: [
            { header: 'Mã KH', width: 13 },
            { header: 'Tên khách hàng', width: 34 },
            { header: 'Chứng từ', width: 14 },
            { header: 'Hạn thanh toán', width: 14 },
            { header: 'Còn nợ', width: 15, numFmt: '#,##0' },
            { header: 'Quá hạn (ngày)', width: 14 },
          ],
          rows: this.rows().flatMap((r) =>
            r.items.map((i) => [r.code, r.name, i.ref, formatDay(i.dueDate), i.amount, Math.max(0, i.overdueDays)]),
          ),
        },
      ]);
    } finally {
      this.exporting.set(false);
    }
  }
}
