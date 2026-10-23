import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DataStore } from '../../core/services/data-store.service';
import { SalesOrder, SalesOrderStatus } from '../../core/models/domain.models';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { FilterMultiSelectComponent, FilterOption } from '../../shared/filter-multi-select/filter-multi-select.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { PeriodFilterComponent, PeriodValue, NO_PERIOD } from '../../shared/period-filter/period-filter.component';
import { NumberRange, RangeFilterComponent } from '../../shared/range-filter/range-filter.component';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { ColumnFilters, applyColumnFilters } from '../../shared/column-filter';
import { ColumnSort, sortByColumn } from '../../shared/column-sort';
import { foldVi, formatVnd } from '../../shared/format.util';
import { PERIOD_PRESETS, formatDay, inRange, isoDay, rangeLabel } from '../../shared/period';
import { SALES_ORDER_STATUS_LABEL, salesOrderStatusClass } from '../../shared/status-labels';
import { tagClass } from '../../shared/tag-class';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { tagStyle } from '../../shared/tag-colors';
import { canEdit, deliveredPercent, lineRemaining } from './sales-order.rules';
import { AllowedLinkDirective } from '../../shared/allowed-link.directive';

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

// Links from Trang chủ / Lệnh sản xuất use production's English status keys.
const STATUS_ALIASES: Record<string, SalesOrderStatus> = { PENDING: 'CHO_SAN_XUAT', SHIPPING: 'DANG_GIAO' };

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

  readonly search = signal('');
  readonly statuses = signal<string[]>([]);
  readonly tags = signal<string[]>([]);
  readonly period = signal<PeriodValue>(NO_PERIOD);
  readonly reps = signal<string[]>([]);
  readonly createdBy = signal<string[]>([]);
  readonly value = signal<NumberRange>({ min: null, max: null });
  readonly lateOnly = signal(false);
  readonly sort = signal<SalesSort>('newest');
  // Clicking a column header overrides the "Sắp xếp" select; picking from the select clears it.
  readonly headerSort = signal<ColumnSort | null>(null);
  readonly columnFilters = signal<ColumnFilters>({});
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly exporting = signal(false);
  readonly sorts = SORTS;
  readonly today = isoDay(new Date());

  private readonly customerById = computed(() => new Map(this.data.customers().map((c) => [c.id, c])));
  private readonly productById = computed(() => new Map(this.data.products().map((p) => [p.id, p])));
  private readonly userByEmail = computed(() => new Map(this.data.users().map((u) => [u.email, u.name])));
  private readonly tagById = computed(() => new Map(this.data.tags().map((t) => [t.id, t.name])));

  readonly userOptions = computed<FilterOption[]>(() => {
    const roleName = new Map(this.data.roles().map((r) => [r.id, r.name]));
    return this.data.users().map((u) => ({ value: u.email, label: `${u.name} — ${roleName.get(u.roleId) ?? ''}` }));
  });

  readonly tagOptions = computed<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const o of this.data.salesOrders()) for (const t of o.tagIds) counts.set(t, (counts.get(t) ?? 0) + 1);
    return this.data.tags().map((t) => ({ value: t.id, label: t.name, count: counts.get(t.id) ?? 0 }));
  });

  /** Chưa giao xong mà đã quá ngày cần giao. */
  isLate(o: SalesOrder): boolean {
    return !!o.neededByDate && o.neededByDate.slice(0, 10) < this.today && !o.closedDate &&
      o.status !== 'HUY' && o.status !== 'HOAN_THANH' && o.status !== 'TRA_TOAN_BO' && o.lines.some((l) => lineRemaining(l) > 0);
  }

  private readonly matchedExceptStatus = computed(() => {
    const q = foldVi(this.search().trim());
    const range = this.period().range;
    const tags = this.tags();
    const reps = this.reps();
    const by = this.createdBy();
    const { min, max } = this.value();
    const late = this.lateOnly();
    return this.data.salesOrders().filter((o) => {
      if (q && !this.searchText(o).includes(q)) return false;
      if (!inRange(o.orderDate, range)) return false;
      if (tags.length && !o.tagIds.some((t) => tags.includes(t))) return false;
      if (reps.length && !reps.includes(o.salesRep)) return false;
      if (by.length && !by.includes(o.createdBy)) return false;
      if (min !== null && o.totalOrder < min) return false;
      if (max !== null && o.totalOrder > max) return false;
      if (late && !this.isLate(o)) return false;
      return true;
    });
  });

  readonly statusOptions = computed<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const o of this.matchedExceptStatus()) counts.set(o.status, (counts.get(o.status) ?? 0) + 1);
    return (Object.keys(SALES_ORDER_STATUS_LABEL) as SalesOrderStatus[]).map((s) => ({
      value: s, label: SALES_ORDER_STATUS_LABEL[s], count: counts.get(s) ?? 0, dotClass: tagClass('sales-order', s),
    }));
  });

  readonly orders = computed(() => {
    const st = this.statuses();
    const rows = this.matchedExceptStatus().filter((o) => !st.length || st.includes(o.status));
    const s = this.sort();
    const hs = this.headerSort();
    const sorted = hs ? sortByColumn(rows, this.columns, hs) : [...rows].sort((a, b) =>
      s === 'oldest' ? a.orderDate.localeCompare(b.orderDate) || a.code.localeCompare(b.code)
        : s === 'value' ? b.totalOrder - a.totalOrder
          : s === 'code' ? a.code.localeCompare(b.code)
            : b.orderDate.localeCompare(a.orderDate) || b.code.localeCompare(a.code),
    );
    return applyColumnFilters(sorted, this.columns, this.columnFilters());
  });

  readonly pagedOrders = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.orders().slice(start, start + this.pageSize());
  });

  readonly totals = computed(() => {
    const rows = this.orders().filter((o) => o.status !== 'HUY');
    const value = rows.reduce((s, o) => s + o.totalOrder, 0);
    const received = rows.reduce((s, o) => s + o.receivedValue, 0);
    // Phần đã kết thúc (khách không lấy) không còn là "chờ giao".
    const pending = rows.filter((o) => !o.closedDate).reduce((s, o) => s + Math.max(0, o.totalOrder - o.receivedValue), 0);
    return { value, received, pending, late: this.orders().filter((o) => this.isLate(o)).length };
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
    for (const col of this.columns) {
      const v = (this.columnFilters()[col.key] ?? '').trim();
      if (v) chips.push({ label: `${col.label}: ${v}`, clear: () => this.columnFilters.update((f) => ({ ...f, [col.key]: '' })) });
    }
    return chips;
  });

  readonly columns: DataTableColumn<SalesOrder>[] = [
    { key: 'code', label: 'Mã đơn', sortable: true, copy: true, link: (r) => ['/don-hang', r.id] },
    { key: 'orderDate', label: 'Ngày đặt', sortable: true, format: (r) => formatDay(r.orderDate), mono: true },
    { key: 'customerId', label: 'Khách hàng', sortable: true, sortValue: (r) => this.customerName(r), format: (r) => this.customerName(r) },
    { key: 'lines', label: 'Mặt hàng', sortable: true, align: 'right', format: (r) => String(r.lines.length), filterValue: (r) => r.lines.length },
    { key: 'totalOrder', label: 'Giá trị đơn', sortable: true, align: 'right', format: (r) => formatVnd(r.totalOrder), filterValue: (r) => r.totalOrder },
    {
      key: 'receivedValue', label: 'Khách đã nhận', sortable: true, align: 'right',
      format: (r) => (r.receivedValue ? `${formatVnd(r.receivedValue)} · ${deliveredPercent(r)}%` : '—'),
      filterValue: (r) => r.receivedValue,
    },
    {
      key: 'neededByDate', label: 'Cần giao', sortable: true, sortValue: (r) => r.neededByDate,
      format: (r) => (r.neededByDate ? formatDay(r.neededByDate) + (this.isLate(r) ? ' · trễ' : '') : '—'), mono: true,
    },
    { key: 'status', label: 'Trạng thái', sortable: true, sortValue: (r) => SALES_ORDER_STATUS_LABEL[r.status], format: (r) => SALES_ORDER_STATUS_LABEL[r.status], badge: (r) => salesOrderStatusClass(r.status) },
    { key: 'salesRep', label: 'Nhân viên bán', sortable: true, sortValue: (r) => this.userName(r.salesRep), format: (r) => this.userName(r.salesRep) },
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
    effect(() => {
      this.orders();
      untracked(() => this.page.set(1));
    });
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
    this.columnFilters.set({});
  }

  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
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
        rows: this.orders().map((o) => {
          const c = this.customerById().get(o.customerId);
          return [
            o.code, formatDay(o.orderDate), c?.code ?? '', this.customerName(o), o.recipientName ?? '', o.lines.length,
            o.totalGoods, o.discountAmount, o.vatAmount ?? 0, o.totalOrder, o.receivedValue,
            o.neededByDate ? formatDay(o.neededByDate) : '', SALES_ORDER_STATUS_LABEL[o.status], this.userName(o.salesRep),
            o.source ?? '', o.tagIds.map((t) => this.tagById().get(t) ?? t).join(', '), o.description ?? '',
          ];
        }),
      }]);
    } finally {
      this.exporting.set(false);
    }
  }

  private searchText(o: SalesOrder): string {
    const c = this.customerById().get(o.customerId);
    const items = o.lines.map((l) => {
      const p = this.productById().get(l.productId);
      return `${p?.code ?? ''} ${p?.name ?? ''} ${p?.crossRefCode ?? ''}`;
    });
    return foldVi([o.code, c?.code ?? '', c?.name ?? '', c?.companyName ?? '', c?.phone ?? '', o.recipientName ?? '',
      o.recipientPhone ?? '', o.description ?? '', o.source ?? '', ...items].join(' '));
  }
}
