import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DataStore } from '../../core/services/data-store.service';
import { ApiService, errorText } from '../../core/api/api.service';
import { SalesOrder, SalesOrderStatus } from '../../core/models/domain.models';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { FilterMultiSelectComponent, FilterOption } from '../../shared/filter-multi-select/filter-multi-select.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { PeriodFilterComponent, PeriodValue, NO_PERIOD } from '../../shared/period-filter/period-filter.component';
import { NumberRange, RangeFilterComponent } from '../../shared/range-filter/range-filter.component';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { ColumnSort } from '../../shared/column-sort';
import { formatVnd } from '../../shared/format.util';
import { PERIOD_PRESETS, formatDay, isoDay, rangeLabel } from '../../shared/period';
import { SALES_ORDER_STATUS_LABEL, salesOrderStatusClass } from '../../shared/status-labels';
import { tagClass } from '../../shared/tag-class';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { tagStyle } from '../../shared/tag-colors';
import { canEdit, deliveredPercent, lineRemaining } from './sales-order.rules';
import { AllowedLinkDirective } from '../../shared/allowed-link.directive';
import { SalesOrderPage, SalesOrderPageQuery, SalesOrderService } from './sales-order.service';

interface ActiveChip {
  label: string;
  clear: () => void;
}

type SalesSort = 'newest' | 'oldest' | 'value' | 'code';

const SORTS: { value: SalesSort; label: string }[] = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'value', label: 'Giá trị cao nhất' },
  { value: 'code', label: 'Mã tăng dần' },
];

/** The "Sắp xếp" choices as the server's sort key + direction. */
const SORT_QUERY: Record<SalesSort, Pick<SalesOrderPageQuery, 'sort' | 'dir'>> = {
  newest: { sort: 'orderDate', dir: 'desc' },
  oldest: { sort: 'orderDate', dir: 'asc' },
  value: { sort: 'totalOrder', dir: 'desc' },
  code: { sort: 'code', dir: 'asc' },
};

/** Column header → server sort key. */
const COLUMN_SORT: Record<string, string> = {
  code: 'code', orderDate: 'orderDate', customerId: 'customer', lines: 'lines', totalOrder: 'totalOrder',
  receivedValue: 'receivedValue', neededByDate: 'neededByDate', status: 'status', salesRep: 'salesRep',
};

// Links from Trang chủ / Lệnh sản xuất use production's English status keys.
const STATUS_ALIASES: Record<string, SalesOrderStatus> = { PENDING: 'CHO_SAN_XUAT', SHIPPING: 'DANG_GIAO' };

const EMPTY_PAGE: SalesOrderPage = { rows: [], total: 0, page: 1, pageSize: 20, statusCounts: {}, totals: { value: 0, received: 0, pending: 0, late: 0 } };

// Đơn hàng bán (Pha 1.1): every order, page by page from the server — search, filters, sort and the totals cover all
// orders, not only those the app loaded at sign-in.
@Component({
  selector: 'app-sales-orders',
  standalone: true,
  imports: [
    CommonModule, RouterLink, AllowedLinkDirective, DataTableComponent, FilterMultiSelectComponent, PaginationComponent, PeriodFilterComponent,
    RangeFilterComponent, NavIconComponent,
  ],
  templateUrl: './sales-orders.component.html',
})
export class SalesOrdersComponent {
  readonly data = inject(DataStore);
  private readonly orders = inject(SalesOrderService);
  private readonly api = inject(ApiService);

  readonly search = signal('');
  readonly statuses = signal<string[]>([]);
  readonly tags = signal<string[]>([]);
  readonly period = signal<PeriodValue>(NO_PERIOD);
  readonly reps = signal<string[]>([]);
  readonly createdBy = signal<string[]>([]);
  readonly value = signal<NumberRange>({ min: null, max: null });
  readonly lateOnly = signal(false);
  readonly sort = signal<SalesSort>('code'); // default: Mã tăng dần
  // Clicking a column header overrides the "Sắp xếp" select; picking from the select clears it.
  readonly headerSort = signal<ColumnSort | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly exporting = signal(false);
  readonly sorts = SORTS;
  readonly today = isoDay(new Date());

  readonly result = signal<SalesOrderPage>(EMPTY_PAGE);
  readonly loading = signal(false);
  readonly error = signal('');
  private readonly tagUsage = signal<Record<string, { orders: number }>>({});
  /** The search box waits for typing to pause before asking the server. */
  private readonly searchQuery = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private requestSeq = 0;

  private readonly customerById = computed(() => new Map(this.data.customers().map((c) => [c.id, c])));
  private readonly userByEmail = computed(() => new Map(this.data.users().map((u) => [u.email, u.name])));
  private readonly tagById = computed(() => new Map(this.data.tags().map((t) => [t.id, t.name])));

  readonly userOptions = computed<FilterOption[]>(() => {
    const roleName = new Map(this.data.roles().map((r) => [r.id, r.name]));
    return this.data.users().map((u) => ({ value: u.email, label: `${u.name} — ${roleName.get(u.roleId) ?? ''}` }));
  });

  readonly tagOptions = computed<FilterOption[]>(() =>
    this.data.tags().map((t) => ({ value: t.id, label: t.name, count: this.tagUsage()[t.id]?.orders ?? 0 })),
  );

  /** Chưa giao xong mà đã quá ngày cần giao. */
  isLate(o: SalesOrder): boolean {
    return !!o.neededByDate && o.neededByDate.slice(0, 10) < this.today && !o.closedDate &&
      o.status !== 'HUY' && o.status !== 'HOAN_THANH' && o.status !== 'TRA_TOAN_BO' && o.lines.some((l) => lineRemaining(l) > 0);
  }

  readonly statusOptions = computed<FilterOption[]>(() =>
    (Object.keys(SALES_ORDER_STATUS_LABEL) as SalesOrderStatus[]).map((s) => ({
      value: s, label: SALES_ORDER_STATUS_LABEL[s], count: this.result().statusCounts[s] ?? 0, dotClass: tagClass('sales-order', s),
    })),
  );

  readonly rows = computed(() => this.result().rows);
  readonly total = computed(() => this.result().total);
  readonly totals = computed(() => this.result().totals);

  /** Everything the server needs for the current view (all pages). */
  private readonly filters = computed<SalesOrderPageQuery>(() => {
    const hs = this.headerSort();
    const { min, max } = this.value();
    const range = this.period().range;
    return {
      q: this.searchQuery().trim() || undefined,
      status: this.statuses(), tags: this.tags(), reps: this.reps(), createdBy: this.createdBy(),
      from: range.from || undefined, to: range.to || undefined,
      min: min ?? undefined, max: max ?? undefined, late: this.lateOnly() || undefined,
      ...(hs ? { sort: COLUMN_SORT[hs.key] ?? 'code', dir: hs.dir } : SORT_QUERY[this.sort()]),
    };
  });

  readonly chips = computed<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];
    for (const s of this.statuses()) {
      chips.push({ label: SALES_ORDER_STATUS_LABEL[s as SalesOrderStatus], clear: () => this.statuses.update((v) => v.filter((x) => x !== s)) });
    }
    for (const t of this.tags()) {
      chips.push({ label: `Thẻ: ${this.tagById().get(t) ?? t}`, clear: () => this.tags.update((v) => v.filter((x) => x !== t)) });
    }
    const p = this.period();
    if (p.preset !== null) {
      const label = p.preset === 'custom' ? rangeLabel(p.range) : PERIOD_PRESETS.find((x) => x.value === p.preset)?.label;
      chips.push({ label: `Kỳ: ${label}`, clear: () => this.period.set(NO_PERIOD) });
    }
    for (const e of this.reps()) chips.push({ label: `NV bán: ${this.userName(e)}`, clear: () => this.reps.update((v) => v.filter((x) => x !== e)) });
    for (const e of this.createdBy()) chips.push({ label: `Người lập: ${this.userName(e)}`, clear: () => this.createdBy.update((v) => v.filter((x) => x !== e)) });
    const { min, max } = this.value();
    if (min !== null || max !== null) {
      const t = min !== null && max !== null ? `${formatVnd(min)} – ${formatVnd(max)}` : min !== null ? `≥ ${formatVnd(min)}` : `≤ ${formatVnd(max!)}`;
      chips.push({ label: `Giá trị: ${t}`, clear: () => this.value.set({ min: null, max: null }) });
    }
    if (this.lateOnly()) chips.push({ label: 'Trễ hẹn giao', clear: () => this.lateOnly.set(false) });
    return chips;
  });

  readonly columns: DataTableColumn<SalesOrder>[] = [
    { key: 'code', label: 'Mã đơn', sortable: true, copy: true, link: (r) => ['/don-hang', r.id] },
    { key: 'orderDate', label: 'Ngày đặt', sortable: true, format: (r) => formatDay(r.orderDate), mono: true },
    { key: 'customerId', label: 'Khách hàng', sortable: true, format: (r) => this.customerName(r) },
    { key: 'lines', label: 'Mặt hàng', sortable: true, align: 'right', format: (r) => String(r.lines.length) },
    { key: 'totalOrder', label: 'Giá trị đơn', sortable: true, align: 'right', format: (r) => formatVnd(r.totalOrder) },
    {
      key: 'receivedValue', label: 'Khách đã nhận', sortable: true, align: 'right',
      format: (r) => (r.receivedValue ? `${formatVnd(r.receivedValue)} · ${deliveredPercent(r)}%` : '—'),
    },
    {
      key: 'neededByDate', label: 'Cần giao', sortable: true,
      format: (r) => (r.neededByDate ? formatDay(r.neededByDate) + (this.isLate(r) ? ' · trễ' : '') : '—'), mono: true,
    },
    { key: 'status', label: 'Trạng thái', sortable: true, format: (r) => SALES_ORDER_STATUS_LABEL[r.status], badge: (r) => salesOrderStatusClass(r.status) },
    { key: 'salesRep', label: 'Nhân viên bán', sortable: true, format: (r) => this.userName(r.salesRep) },
    {
      key: 'tagIds', label: 'Thẻ', format: (r) => r.tagIds.map((t) => this.tagById().get(t) ?? t).join(', ') || '—',
      chips: (r) => r.tagIds.flatMap((id) => {
        const t = this.data.tags().find((x) => x.id === id);
        return t ? [{ label: t.name, style: tagStyle(t.color) }] : [];
      }),
    },
  ];

  readonly canEdit = (o: SalesOrder) => canEdit(o, this.data.productionOrders().filter((x) => x.sourceOrderId === o.id));

  constructor() {
    // ?status=PENDING|SHIPPING|<code> from dashboard shortcuts.
    const params = inject(ActivatedRoute).snapshot.queryParamMap;
    if (params.get('late')) this.lateOnly.set(true);
    const q = params.get('status');
    if (q) {
      const s = STATUS_ALIASES[q] ?? (q in SALES_ORDER_STATUS_LABEL ? (q as SalesOrderStatus) : null);
      if (s) this.statuses.set([s]);
    }
    // New filters start again from page 1.
    effect(() => {
      this.filters();
      untracked(() => this.page.set(1));
    });
    // Ask the server whenever the filters, the page or the orders in memory change (a save elsewhere).
    effect(() => {
      const query = { ...this.filters(), page: this.page(), pageSize: this.pageSize() };
      this.data.salesOrders();
      untracked(() => void this.load(query));
    });
    this.api.get<Record<string, { orders: number }>>('/tags/usage').then((u) => this.tagUsage.set(u), () => undefined);
  }

  setSearch(text: string): void {
    this.search.set(text);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.searchQuery.set(text), 300);
  }

  private async load(query: SalesOrderPageQuery): Promise<void> {
    const seq = ++this.requestSeq;
    this.loading.set(true);
    try {
      const res = await this.orders.page(query);
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
    return this.userByEmail().get(email) ?? (email || '—');
  }

  customerName(o: SalesOrder): string {
    const c = this.customerById().get(o.customerId);
    return c ? c.companyName || c.name : o.customerId;
  }

  money(n: number): string {
    return formatVnd(n);
  }

  clearAll(): void {
    this.statuses.set([]);
    this.tags.set([]);
    this.period.set(NO_PERIOD);
    this.reps.set([]);
    this.createdBy.set([]);
    this.value.set({ min: null, max: null });
    this.lateOnly.set(false);
  }

  /** Every matching order (not only this page), in the list's order. */
  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      const all = (await this.orders.page({ ...this.filters(), page: 1, pageSize: 5000 })).rows;
      await downloadWorkbook(exportFileName('Đơn hàng bán'), [{
        name: 'Đơn hàng bán',
        columns: [
          { header: 'Mã đơn', width: 14 },
          { header: 'Ngày đặt', width: 12 },
          { header: 'Mã KH', width: 13 },
          { header: 'Khách hàng', width: 30 },
          { header: 'Người nhận', width: 22 },
          { header: 'Số mặt hàng', width: 12 },
          { header: 'Tiền hàng', width: 15, numFmt: '#,##0' },
          { header: 'Chiết khấu đơn', width: 15, numFmt: '#,##0' },
          { header: 'Thuế GTGT', width: 14, numFmt: '#,##0' },
          { header: 'Tổng thanh toán', width: 16, numFmt: '#,##0' },
          { header: 'Khách đã nhận', width: 16, numFmt: '#,##0' },
          { header: 'Ngày cần giao', width: 13 },
          { header: 'Trạng thái', width: 16 },
          { header: 'Nhân viên bán', width: 20 },
          { header: 'Nguồn đơn', width: 14 },
          { header: 'Thẻ', width: 20 },
          { header: 'Diễn giải', width: 30 },
        ],
        rows: all.map((o) => {
          const c = this.customerById().get(o.customerId);
          return [
            o.code, formatDay(o.orderDate), c?.code ?? '', this.customerName(o), o.recipientName ?? '', o.lines.length,
            o.totalGoods, o.discountAmount, o.vatAmount ?? 0, o.totalOrder, o.receivedValue,
            o.neededByDate ? formatDay(o.neededByDate) : '', SALES_ORDER_STATUS_LABEL[o.status], this.userName(o.salesRep),
            o.source ?? '', o.tagIds.map((t) => this.tagById().get(t) ?? t).join(', '), o.description ?? '',
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
