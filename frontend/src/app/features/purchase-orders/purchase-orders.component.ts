import { Component, computed, effect, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../core/services/mock-data.service';
import { PurchaseOrder, PurchaseOrderStatus } from '../../core/models/domain.models';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { FilterMultiSelectComponent, FilterOption } from '../../shared/filter-multi-select/filter-multi-select.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { PeriodFilterComponent, PeriodValue, NO_PERIOD } from '../../shared/period-filter/period-filter.component';
import { NumberRange, RangeFilterComponent } from '../../shared/range-filter/range-filter.component';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { ColumnFilters, applyColumnFilters } from '../../shared/column-filter';
import { ColumnSort, sortByColumn } from '../../shared/column-sort';
import { foldVi, formatVnd } from '../../shared/format.util';
import { PERIOD_PRESETS, formatDay, inRange, rangeLabel } from '../../shared/period';
import { PURCHASE_ORDER_STATUS_LABEL, purchaseOrderStatusClass } from '../../shared/status-labels';
import { tagClass } from '../../shared/tag-class';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { canEdit, receivedPercent } from './purchase-order.rules';
import { AllowedLinkDirective } from '../../shared/allowed-link.directive';

interface ActiveChip {
  label: string;
  clear: () => void;
}

const ALL = 'all';

@Component({
  selector: 'app-purchase-orders',
  standalone: true,
  imports: [
    CommonModule, RouterLink, AllowedLinkDirective, DataTableComponent, FilterMultiSelectComponent, PaginationComponent,
    PeriodFilterComponent, RangeFilterComponent, NavIconComponent,
  ],
  templateUrl: './purchase-orders.component.html',
})
export class PurchaseOrdersComponent {
  readonly search = signal('');
  readonly statuses = signal<string[]>([]);
  readonly supplierId = signal(ALL);
  readonly period = signal<PeriodValue>(NO_PERIOD);
  readonly createdBy = signal<string[]>([]);
  readonly value = signal<NumberRange>({ min: null, max: null });
  readonly columnFilters = signal<ColumnFilters>({});
  // Clicking a column header sorts; again reverses; a third click goes back to the default order.
  readonly headerSort = signal<ColumnSort | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly exporting = signal(false);

  private readonly supplierById = computed(() => new Map(this.data.suppliers().map((s) => [s.id, s])));
  private readonly productById = computed(() => new Map(this.data.products().map((p) => [p.id, p])));
  private readonly userByEmail = computed(() => new Map(this.data.users().map((u) => [u.email, u.name])));

  // Người lập options: every user as "Tên — Chức vụ" (as in production).
  readonly creatorOptions = computed<FilterOption[]>(() => {
    const roleName = new Map(this.data.roles().map((r) => [r.id, r.name]));
    return this.data.users().map((u) => ({ value: u.email, label: `${u.name} — ${roleName.get(u.roleId) ?? ''}` }));
  });

  // Every filter except Trạng thái — feeds the result and the per-status counts.
  private readonly matchedExceptStatus = computed(() => {
    const q = foldVi(this.search().trim());
    const sup = this.supplierId();
    const range = this.period().range;
    const by = this.createdBy();
    const { min, max } = this.value();
    return this.data.purchaseOrders().filter((o) => {
      if (q && !this.searchText(o).includes(q)) return false;
      if (sup !== ALL && o.supplierId !== sup) return false;
      if (!inRange(o.date, range)) return false;
      if (by.length && !by.includes(o.createdBy)) return false;
      if (min !== null && o.totalValue < min) return false;
      if (max !== null && o.totalValue > max) return false;
      return true;
    });
  });

  readonly statusOptions = computed<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const o of this.matchedExceptStatus()) counts.set(o.status, (counts.get(o.status) ?? 0) + 1);
    return (Object.keys(PURCHASE_ORDER_STATUS_LABEL) as PurchaseOrderStatus[]).map((s) => ({
      value: s,
      label: PURCHASE_ORDER_STATUS_LABEL[s],
      count: counts.get(s) ?? 0,
      dotClass: tagClass('purchase-order', s),
    }));
  });

  readonly orders = computed(() => {
    const st = this.statuses();
    const rows = this.matchedExceptStatus().filter((o) => !st.length || st.includes(o.status));
    // Newest first, then by code.
    const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date) || b.code.localeCompare(a.code));
    return sortByColumn(applyColumnFilters(sorted, this.columns, this.columnFilters()), this.columns, this.headerSort());
  });

  readonly pagedOrders = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.orders().slice(start, start + this.pageSize());
  });

  readonly totals = computed(() => {
    const rows = this.orders().filter((o) => o.status !== 'HUY');
    return {
      value: rows.reduce((s, o) => s + o.totalValue, 0),
      received: rows.reduce((s, o) => s + o.receivedValue, 0),
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
    for (const col of this.columns) {
      const v = (this.columnFilters()[col.key] ?? '').trim();
      if (v) chips.push({ label: `${col.label}: ${v}`, clear: () => this.columnFilters.update((f) => ({ ...f, [col.key]: '' })) });
    }
    return chips;
  });

  readonly columns: DataTableColumn<PurchaseOrder>[] = [
    { key: 'code', label: 'Mã đơn', copy: true, link: (r) => ['/mua-hang', r.id] },
    { key: 'date', label: 'Ngày đặt', format: (r) => formatDay(r.date), mono: true },
    { key: 'supplierId', sortByText: true, label: 'Nhà cung cấp', format: (r) => this.supplierById().get(r.supplierId)?.name ?? r.supplierId },
    { key: 'lines', label: 'Mặt hàng', align: 'right', format: (r) => String(r.lines.length), filterValue: (r) => r.lines.length },
    { key: 'totalValue', label: 'Giá trị đơn', align: 'right', format: (r) => formatVnd(r.totalValue), filterValue: (r) => r.totalValue },
    {
      key: 'receivedValue',
      label: 'Đã nhận',
      align: 'right',
      format: (r) => (r.receivedValue ? `${formatVnd(r.receivedValue)} · ${receivedPercent(r)}%` : '—'),
      filterValue: (r) => r.receivedValue,
    },
    {
      key: 'status', sortByText: true,
      label: 'Trạng thái',
      format: (r) => PURCHASE_ORDER_STATUS_LABEL[r.status],
      badge: (r) => purchaseOrderStatusClass(r.status),
    },
    { key: 'createdBy', sortByText: true, label: 'Người lập', format: (r) => this.userName(r.createdBy) },
  ];

  readonly canEdit = canEdit;

  constructor(readonly data: MockDataService) {
    effect(() => {
      this.orders();
      untracked(() => this.page.set(1));
    });
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
    this.columnFilters.set({});
  }

  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      await downloadWorkbook(exportFileName('Đơn nhập hàng'), [{
        name: 'Đơn nhập hàng',
        columns: [
          { header: 'Mã đơn', width: 14 },
          { header: 'Ngày đặt', width: 12 },
          { header: 'Mã NCC', width: 14 },
          { header: 'Nhà cung cấp', width: 34 },
          { header: 'Số mặt hàng', width: 12 },
          { header: 'Giá trị đơn', width: 16, numFmt: '#,##0' },
          { header: 'Đã nhận', width: 16, numFmt: '#,##0' },
          { header: 'Còn lại', width: 16, numFmt: '#,##0' },
          { header: 'Trạng thái', width: 16 },
          { header: 'Người lập', width: 22 },
          { header: 'Ghi chú', width: 30 },
        ],
        rows: this.orders().map((o) => {
          const s = this.supplierById().get(o.supplierId);
          return [
            o.code, formatDay(o.date), s?.code ?? '', s?.name ?? o.supplierId, o.lines.length,
            o.totalValue, o.receivedValue, Math.max(0, o.totalValue - o.receivedValue),
            PURCHASE_ORDER_STATUS_LABEL[o.status], this.userName(o.createdBy), o.note ?? '',
          ];
        }),
      }]);
    } finally {
      this.exporting.set(false);
    }
  }

  private searchText(o: PurchaseOrder): string {
    const s = this.supplierById().get(o.supplierId);
    const items = o.lines.map((l) => {
      const p = this.productById().get(l.productId);
      return `${p?.code ?? ''} ${p?.name ?? ''} ${p?.crossRefCode ?? ''}`;
    });
    return foldVi([o.code, s?.code ?? '', s?.name ?? '', o.note ?? '', ...items].join(' '));
  }
}
