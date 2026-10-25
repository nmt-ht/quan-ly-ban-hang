import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataStore } from '../../core/services/data-store.service';
import { PurchaseOrder, PurchaseOrderStatus } from '../../core/models/domain.models';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { FilterMultiSelectComponent, FilterOption } from '../../shared/filter-multi-select/filter-multi-select.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { PeriodFilterComponent, PeriodValue, NO_PERIOD } from '../../shared/period-filter/period-filter.component';
import { NumberRange, RangeFilterComponent } from '../../shared/range-filter/range-filter.component';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { ColumnSort } from '../../shared/column-sort';
import { formatVnd } from '../../shared/format.util';
import { PERIOD_PRESETS, formatDay, rangeLabel } from '../../shared/period';
import { PURCHASE_ORDER_STATUS_LABEL, purchaseOrderStatusClass } from '../../shared/status-labels';
import { tagClass } from '../../shared/tag-class';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { canEdit, receivedPercent } from './purchase-order.rules';
import { AllowedLinkDirective } from '../../shared/allowed-link.directive';
import { AuthService } from '../../core/services/auth.service';
import { seesPurchasePrices } from '../../core/auth/purchase-prices';
import { errorText } from '../../core/api/api.service';
import { PurchaseOrderPage, PurchaseOrderPageQuery, PurchaseOrderService } from './purchase-order.service';
import { SearchOption, SearchSelectComponent } from '../../shared/search-select/search-select.component';

interface ActiveChip {
  label: string;
  clear: () => void;
}

const ALL = 'all';

/** Column header → server sort key. */
const COLUMN_SORT: Record<string, string> = {
  code: 'code', date: 'date', supplierId: 'supplier', lines: 'lines', totalValue: 'totalValue', receivedValue: 'receivedValue', status: 'status',
  createdBy: 'createdBy',
};

const EMPTY_PAGE: PurchaseOrderPage = { rows: [], total: 0, page: 1, pageSize: 20, statusCounts: {}, totals: { value: 0, received: 0 } };

// Đơn nhập hàng (Pha 1.1): every order, page by page from the server — search, filters, sort and the totals cover all
// orders, not only those the app loaded at sign-in.
@Component({
  selector: 'app-purchase-orders',
  standalone: true,
  imports: [SearchSelectComponent, 
    CommonModule, RouterLink, AllowedLinkDirective, DataTableComponent, FilterMultiSelectComponent, PaginationComponent,
    PeriodFilterComponent, RangeFilterComponent, NavIconComponent,
  ],
  templateUrl: './purchase-orders.component.html',
})
export class PurchaseOrdersComponent {
  /** Giá nhập hidden from roles that only receive goods (the server sends no prices then). */
  private readonly auth = inject(AuthService);
  private readonly svc = inject(PurchaseOrderService);
  readonly prices = seesPurchasePrices((c) => this.auth.can(c));
  readonly search = signal('');
  readonly statuses = signal<string[]>([]);
  readonly supplierId = signal(ALL);
  readonly period = signal<PeriodValue>(NO_PERIOD);
  readonly createdBy = signal<string[]>([]);
  readonly value = signal<NumberRange>({ min: null, max: null });
  // Clicking a column header sorts; again reverses; a third click goes back to the default order.
  readonly headerSort = signal<ColumnSort | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly exporting = signal(false);

  readonly result = signal<PurchaseOrderPage>(EMPTY_PAGE);
  readonly loading = signal(false);
  readonly error = signal('');
  /** The search box waits for typing to pause before asking the server. */
  private readonly searchQuery = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private requestSeq = 0;

  private readonly supplierById = computed(() => new Map(this.data.suppliers().map((s) => [s.id, s])));
  private readonly userByEmail = computed(() => new Map(this.data.users().map((u) => [u.email, u.name])));

  /** Lọc theo NCC: every NCC, Mã tăng dần, searchable. */
  readonly supplierOptions = computed<SearchOption[]>(() =>
    [...this.data.suppliers()].sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true }))
      .map((s) => ({ value: s.id, code: s.code, label: s.name, hint: s.contactPhone, search: s.taxCode })),
  );

  // Người lập options: every user as "Tên — Chức vụ" (as in production).
  readonly creatorOptions = computed<FilterOption[]>(() => {
    const roleName = new Map(this.data.roles().map((r) => [r.id, r.name]));
    return this.data.users().map((u) => ({ value: u.email, label: `${u.name} — ${roleName.get(u.roleId) ?? ''}` }));
  });

  readonly statusOptions = computed<FilterOption[]>(() => {
    const counts = this.result().statusCounts;
    return (Object.keys(PURCHASE_ORDER_STATUS_LABEL) as PurchaseOrderStatus[]).map((s) => ({
      value: s,
      label: PURCHASE_ORDER_STATUS_LABEL[s],
      count: counts[s] ?? 0,
      dotClass: tagClass('purchase-order', s),
    }));
  });

  readonly rows = computed(() => this.result().rows);
  readonly total = computed(() => this.result().total);
  readonly totals = computed(() => this.result().totals);

  /** Everything the server needs for the current view (all pages). */
  private readonly filters = computed<PurchaseOrderPageQuery>(() => {
    const hs = this.headerSort();
    const range = this.period().range;
    const { min, max } = this.value();
    const sup = this.supplierId();
    return {
      q: this.searchQuery().trim() || undefined,
      status: this.statuses(), supplierId: sup === ALL ? undefined : sup, createdBy: this.createdBy(),
      from: range.from || undefined, to: range.to || undefined, min: min ?? undefined, max: max ?? undefined,
      // default: Mã tăng dần
      ...(hs ? { sort: COLUMN_SORT[hs.key] ?? 'code', dir: hs.dir } : { sort: 'code', dir: 'asc' as const }),
    };
  });

  readonly chips = computed<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];
    for (const s of this.statuses()) {
      chips.push({
        label: PURCHASE_ORDER_STATUS_LABEL[s as PurchaseOrderStatus],
        clear: () => this.statuses.update((v) => v.filter((x) => x !== s)),
      });
    }
    if (this.supplierId() !== ALL) {
      chips.push({ label: this.supplierById().get(this.supplierId())?.name ?? '', clear: () => this.supplierId.set(ALL) });
    }
    const p = this.period();
    if (p.preset !== null) {
      const label = p.preset === 'custom' ? rangeLabel(p.range) : PERIOD_PRESETS.find((x) => x.value === p.preset)?.label;
      chips.push({ label: `Kỳ: ${label}`, clear: () => this.period.set(NO_PERIOD) });
    }
    for (const email of this.createdBy()) {
      chips.push({ label: `Người lập: ${this.userName(email)}`, clear: () => this.createdBy.update((v) => v.filter((x) => x !== email)) });
    }
    const { min, max } = this.value();
    if (min !== null || max !== null) {
      const t = min !== null && max !== null ? `${formatVnd(min)} – ${formatVnd(max)}` : min !== null ? `≥ ${formatVnd(min)}` : `≤ ${formatVnd(max!)}`;
      chips.push({ label: `Giá trị: ${t}`, clear: () => this.value.set({ min: null, max: null }) });
    }
    return chips;
  });

  private readonly allColumns: DataTableColumn<PurchaseOrder>[] = [
    { key: 'code', label: 'Mã đơn', copy: true, link: (r) => ['/mua-hang', r.id] },
    { key: 'date', label: 'Ngày đặt', format: (r) => formatDay(r.date), mono: true },
    { key: 'supplierId', sortByText: true, label: 'Nhà cung cấp', format: (r) => this.supplierById().get(r.supplierId)?.name ?? r.supplierId },
    { key: 'lines', label: 'Mặt hàng', align: 'right', format: (r) => String(r.lines.length) },
    { key: 'totalValue', label: 'Giá trị đơn', align: 'right', format: (r) => formatVnd(r.totalValue ?? 0) },
    {
      key: 'receivedValue',
      label: 'Đã nhận',
      align: 'right',
      format: (r) => (r.receivedValue ? `${formatVnd(r.receivedValue)} · ${receivedPercent(r)}%` : '—'),
    },
    {
      key: 'status', sortByText: true,
      label: 'Trạng thái',
      format: (r) => PURCHASE_ORDER_STATUS_LABEL[r.status],
      badge: (r) => purchaseOrderStatusClass(r.status),
    },
    { key: 'createdBy', sortByText: true, label: 'Người lập', format: (r) => this.userName(r.createdBy) },
  ];

  /** Giá trị đơn / Đã nhận only for roles that see giá nhập; others follow receipts by quantity on the order itself. */
  readonly columns = this.prices ? this.allColumns : this.allColumns.filter((c) => c.key !== 'totalValue' && c.key !== 'receivedValue');

  readonly canEdit = canEdit;

  constructor(readonly data: DataStore) {
    // New filters start again from page 1.
    effect(() => {
      this.filters();
      untracked(() => this.page.set(1));
    });
    // Ask the server whenever the filters, the page or the orders in memory change (a save elsewhere).
    effect(() => {
      const query = { ...this.filters(), page: this.page(), pageSize: this.pageSize() };
      this.data.purchaseOrders();
      untracked(() => void this.load(query));
    });
  }

  setSearch(text: string): void {
    this.search.set(text);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.searchQuery.set(text), 300);
  }

  private async load(query: PurchaseOrderPageQuery): Promise<void> {
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

  userName(email: string): string {
    return this.userByEmail().get(email) ?? email;
  }

  money(n: number): string {
    return formatVnd(n);
  }

  clearAll(): void {
    this.statuses.set([]);
    this.supplierId.set(ALL);
    this.period.set(NO_PERIOD);
    this.createdBy.set([]);
    this.value.set({ min: null, max: null });
  }

  /** Every matching order (not only this page), in the list's order. */
  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      const all = (await this.svc.page({ ...this.filters(), page: 1, pageSize: 5000 })).rows;
      await downloadWorkbook(exportFileName('Đơn nhập hàng'), [{
        name: 'Đơn nhập hàng',
        columns: [
          { header: 'Mã đơn', width: 14 },
          { header: 'Ngày đặt', width: 12 },
          { header: 'Mã NCC', width: 14 },
          { header: 'Nhà cung cấp', width: 34 },
          { header: 'Số mặt hàng', width: 12 },
          ...(this.prices ? [
            { header: 'Giá trị đơn', width: 16, numFmt: '#,##0' },
            { header: 'Đã nhận', width: 16, numFmt: '#,##0' },
            { header: 'Còn lại', width: 16, numFmt: '#,##0' },
          ] : []),
          { header: 'Trạng thái', width: 16 },
          { header: 'Người lập', width: 22 },
          { header: 'Ghi chú', width: 30 },
        ],
        rows: all.map((o) => {
          const s = this.supplierById().get(o.supplierId);
          return [
            o.code, formatDay(o.date), s?.code ?? '', s?.name ?? o.supplierId, o.lines.length,
            ...(this.prices ? [o.totalValue ?? 0, o.receivedValue ?? 0, Math.max(0, (o.totalValue ?? 0) - (o.receivedValue ?? 0))] : []),
            PURCHASE_ORDER_STATUS_LABEL[o.status], this.userName(o.createdBy), o.note ?? '',
          ];
        }),
      }]);
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.exporting.set(false);
    }
  }
}
