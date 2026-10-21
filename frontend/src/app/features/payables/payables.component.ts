import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { DebtRow, DebtService } from '../../core/services/debt.service';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { ColumnFilters, applyColumnFilters } from '../../shared/column-filter';
import { foldVi, formatVnd } from '../../shared/format.util';
import { formatDay } from '../../shared/period';
import { downloadWorkbook, todayStamp } from '../../shared/excel.util';
import { DebtLedgerComponent } from '../debts/debt-ledger/debt-ledger.component';
import { AGING_COLUMNS } from '../debts/aging';

type PayableSort = 'balance' | 'overdue' | 'due' | 'name';

const SORTS: { value: PayableSort; label: string }[] = [
  { value: 'balance', label: 'Số dư lớn nhất' },
  { value: 'overdue', label: 'Quá hạn nhiều nhất' },
  { value: 'due', label: 'Hạn gần nhất' },
  { value: 'name', label: 'Tên A → Z' },
];

// /cong-no/nha-cung-cap — list; with ?partnerId= it shows the Sổ chi tiết công nợ (as in production).
@Component({
  selector: 'app-payables',
  standalone: true,
  imports: [RouterLink, DataTableComponent, PaginationComponent, NavIconComponent, DebtLedgerComponent],
  templateUrl: './payables.component.html',
})
export class PayablesComponent {
  private readonly debt = inject(DebtService);
  readonly partnerId = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((q) => q.get('partnerId'))), { initialValue: null });

  readonly search = signal('');
  readonly owingOnly = signal(true);
  readonly overdueOnly = signal(false);
  readonly sort = signal<PayableSort>('balance');
  readonly columnFilters = signal<ColumnFilters>({});
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly exporting = signal(false);
  readonly sorts = SORTS;
  readonly agingCols = AGING_COLUMNS;
  readonly money = formatVnd;
  readonly notice = signal('');

  readonly columns: DataTableColumn<DebtRow>[] = [
    { key: 'code', label: 'Mã NCC', copy: true, link: () => ['/cong-no/nha-cung-cap'], linkQuery: (r) => ({ partnerId: r.partnerId }) },
    { key: 'name', label: 'Tên nhà cung cấp' },
    { key: 'creditDays', label: 'Được nợ', align: 'right', format: (r) => r.creditLabel, filterValue: (r) => r.creditDays },
    { key: 'items', label: 'Số khoản', align: 'right', format: (r) => String(r.items.length), filterValue: (r) => r.items.length },
    { key: 'nextDue', label: 'Hạn gần nhất', format: (r) => (r.nextDue ? formatDay(r.nextDue) : '—'), mono: true },
    { key: 'prepaid', label: 'Trả trước', align: 'right', format: (r) => (r.prepaid ? formatVnd(r.prepaid) : '—'), filterValue: (r) => r.prepaid },
    { key: 'overdue', label: 'Quá hạn', align: 'right', format: (r) => (r.overdue ? formatVnd(r.overdue) : '—'), filterValue: (r) => r.overdue },
    { key: 'balance', label: 'Số dư', align: 'right', format: (r) => formatVnd(r.balance), filterValue: (r) => r.balance, tone: (r) => r.balance, toneFlow: false },
  ];

  readonly rows = computed(() => {
    const q = foldVi(this.search().trim());
    const rows = this.debt.payables().filter((r) => {
      if (q && !foldVi(`${r.code} ${r.name}`).includes(q)) return false;
      if (this.owingOnly() && r.balance === 0) return false;
      if (this.overdueOnly() && r.overdue <= 0) return false;
      return true;
    });
    const s = this.sort();
    rows.sort((a, b) =>
      s === 'balance' ? b.balance - a.balance
        : s === 'overdue' ? b.overdue - a.overdue || b.balance - a.balance
          : s === 'due' ? (a.nextDue ?? '9999').localeCompare(b.nextDue ?? '9999')
            : a.name.localeCompare(b.name, 'vi'),
    );
    return applyColumnFilters(rows, this.columns, this.columnFilters());
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
      aging: AGING_COLUMNS.map((a) => ({ ...a, amount: sum((r) => r.aging[a.key]) })),
    };
  });

  readonly hasFilters = computed(
    () => !!this.search().trim() || this.overdueOnly() || Object.values(this.columnFilters()).some((v) => !!v?.trim()),
  );

  constructor() {
    // Notice from the page we came back from (e.g. a saved phiếu chi); reset when list ↔ sổ chi tiết.
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
    this.overdueOnly.set(false);
    this.columnFilters.set({});
  }

  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      await downloadWorkbook(`cong-no-phai-tra-${todayStamp()}.xlsx`, [
        {
          name: 'Công nợ phải trả',
          columns: [
            { header: 'Mã NCC', width: 14 },
            { header: 'Tên nhà cung cấp', width: 34 },
            { header: 'Được nợ', width: 10 },
            { header: 'Số khoản', width: 10 },
            { header: 'Hạn gần nhất', width: 13 },
            { header: 'Trả trước', width: 15, numFmt: '#,##0' },
            ...AGING_COLUMNS.map((a) => ({ header: a.label, width: 15, numFmt: '#,##0' })),
            { header: 'Quá hạn', width: 15, numFmt: '#,##0' },
            { header: 'Số dư', width: 16, numFmt: '#,##0' },
          ],
          rows: this.rows().map((r) => [
            r.code, r.name, r.creditLabel, r.items.length, r.nextDue ? formatDay(r.nextDue) : '', r.prepaid,
            ...AGING_COLUMNS.map((a) => r.aging[a.key]), r.overdue, r.balance,
          ]),
        },
        {
          name: 'Khoản còn mở',
          columns: [
            { header: 'Mã NCC', width: 14 },
            { header: 'Tên nhà cung cấp', width: 34 },
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
