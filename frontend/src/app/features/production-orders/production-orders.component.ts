import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DataStore } from '../../core/services/data-store.service';
import { ProductionOrder, ProductionOrderStatus } from '../../core/models/domain.models';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { FilterMultiSelectComponent, FilterOption } from '../../shared/filter-multi-select/filter-multi-select.component';
import { DivideItem, ListTabsComponent, syncSliceToUrl } from '../../shared/list-divide/list-divide';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { PeriodFilterComponent, PeriodValue, NO_PERIOD } from '../../shared/period-filter/period-filter.component';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { ColumnFilters, applyColumnFilters } from '../../shared/column-filter';
import { ColumnSort, sortByColumn } from '../../shared/column-sort';
import { foldVi } from '../../shared/format.util';
import { PERIOD_PRESETS, formatDay, inRange, isoDay, rangeLabel } from '../../shared/period';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { PRODUCTION_ORDER_STATUS_LABEL, productionOrderStatusClass } from '../../shared/status-labels';
import { SalesOrderService } from '../sales-orders/sales-order.service';
import { canStart, isLate } from './production-order.rules';
import { errorText } from '../../core/api/api.service';
import { AllowedLinkDirective } from '../../shared/allowed-link.directive';

type StatusTab = 'all' | ProductionOrderStatus;
const STATUSES = Object.keys(PRODUCTION_ORDER_STATUS_LABEL) as ProductionOrderStatus[];
/** ?tt= in the address: the status in lower-case words (nhap, dang-san-xuat…). */
const statusParam = (s: ProductionOrderStatus) => s.toLowerCase().replace(/_/g, '-');

interface ActiveChip {
  label: string;
  clear: () => void;
}

@Component({
  selector: 'app-production-orders',
  standalone: true,
  imports: [
    CommonModule, RouterLink, AllowedLinkDirective, DataTableComponent, PaginationComponent, PeriodFilterComponent, NavIconComponent,
    FilterMultiSelectComponent, ListTabsComponent,
  ],
  templateUrl: './production-orders.component.html',
})
export class ProductionOrdersComponent {
  readonly data = inject(DataStore);
  private readonly orders = inject(SalesOrderService);

  readonly today = isoDay(new Date());
  readonly search = signal('');
  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;
  /**
   * Divided by Trạng thái (tabs, lifecycle order, ?tt=). Thành phẩm is NOT a rail: it grows to hundreds of items, so it is
   * a searchable multi-select with counts in the filter bar (?tp=id,id), and the table keeps the full width.
   */
  readonly statusTab = signal<StatusTab>(STATUSES.find((s) => statusParam(s) === this.query.get('tt')) ?? 'all');
  readonly productIds = signal<string[]>((this.query.get('tp') ?? '').split(',').filter(Boolean));
  readonly period = signal<PeriodValue>(NO_PERIOD);
  readonly lateOnly = signal(false);
  readonly columnFilters = signal<ColumnFilters>({});
  // Clicking a column header sorts; again reverses; a third click goes back to the default order.
  readonly headerSort = signal<ColumnSort | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly exporting = signal(false);
  readonly notice = signal('');
  /** A save the server refused (or that could not reach it). */
  readonly failure = signal('');
  readonly canStart = canStart;

  private readonly productById = computed(() => new Map(this.data.products().map((p) => [p.id, p])));
  private readonly orderById = computed(() => new Map(this.data.salesOrders().map((o) => [o.id, o])));
  private readonly customerName = computed(() => new Map(this.data.customers().map((c) => [c.id, c.name])));

  late(x: ProductionOrder): boolean {
    return isLate(x, this.orderById().get(x.sourceOrderId), this.today);
  }

  // Every filter except Trạng thái and Thành phẩm — the tab and rail counts are taken from it.
  private readonly matchedBase = computed(() => {
    const q = foldVi(this.search().trim());
    return this.data.productionOrders().filter((x) => {
      if (q && !this.searchText(x).includes(q)) return false;
      if (!inRange(x.createdDate, this.period().range)) return false;
      if (this.lateOnly() && !this.late(x)) return false;
      return true;
    });
  });

  private ofProduct(x: ProductionOrder): boolean {
    const ids = this.productIds();
    return !ids.length || ids.includes(x.productId);
  }

  private ofTab(x: ProductionOrder): boolean {
    return this.statusTab() === 'all' || x.status === this.statusTab();
  }

  readonly statusTabs = computed<DivideItem<StatusTab>[]>(() => {
    const rows = this.matchedBase().filter((x) => this.ofProduct(x));
    return [
      { value: 'all', label: 'Tất cả', count: rows.length },
      ...STATUSES.map((s) => ({ value: s, label: PRODUCTION_ORDER_STATUS_LABEL[s], count: rows.filter((x) => x.status === s).length })),
    ];
  });

  /** Thành phẩm filter: every product that has ever had a lệnh, "mã · tên" (searchable), with its count under the open tab. */
  readonly productOptions = computed<FilterOption[]>(() => {
    const rows = this.matchedBase().filter((x) => this.ofTab(x));
    const ids = new Set(this.data.productionOrders().map((x) => x.productId));
    return [...ids]
      .map((id) => {
        const p = this.productById().get(id);
        return { value: id, label: p ? `${p.code} · ${p.name}` : id, count: rows.filter((x) => x.productId === id).length };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'vi', { numeric: true }));
  });

  readonly rows = computed(() => {
    const rows = this.matchedBase()
      .filter((x) => this.ofProduct(x) && this.ofTab(x))
      .sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true })); // default: Mã tăng dần
    return sortByColumn(applyColumnFilters(rows, this.columns, this.columnFilters()), this.columns, this.headerSort());
  });

  readonly paged = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.rows().slice(start, start + this.pageSize());
  });

  readonly totals = computed(() => {
    const all = this.data.productionOrders();
    return {
      late: all.filter((x) => this.late(x)).length,
      waitingOrders: this.data.salesOrders().filter((o) => o.status === 'CHO_SAN_XUAT').length,
    };
  });

  readonly chips = computed<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];
    const p = this.period();
    if (p.preset !== null) {
      const label = p.preset === 'custom' ? rangeLabel(p.range) : PERIOD_PRESETS.find((x) => x.value === p.preset)?.label;
      chips.push({ label: `Kỳ: ${label}`, clear: () => this.period.set(NO_PERIOD) });
    }
    for (const id of this.productIds()) {
      const p = this.productById().get(id);
      chips.push({ label: p ? `${p.code} · ${p.name}` : id, clear: () => this.productIds.update((v) => v.filter((x) => x !== id)) });
    }
    if (this.lateOnly()) chips.push({ label: 'Trễ hạn giao', clear: () => this.lateOnly.set(false) });
    for (const col of this.columns) {
      const v = (this.columnFilters()[col.key] ?? '').trim();
      if (v) chips.push({ label: `${col.label}: ${v}`, clear: () => this.columnFilters.update((f) => ({ ...f, [col.key]: '' })) });
    }
    return chips;
  });

  private productText(x: ProductionOrder): string {
    const p = this.productById().get(x.productId);
    return p ? `${p.code} · ${p.name}` : x.productId;
  }

  private qtyText(x: ProductionOrder): string {
    const unit = this.productById().get(x.productId)?.baseUnit ?? '';
    const made = x.status === 'HOAN_TAT' && x.producedQuantity !== undefined && x.producedQuantity !== x.quantity
      ? ` (thực ${x.producedQuantity.toLocaleString('vi-VN')})` : '';
    return `${x.quantity.toLocaleString('vi-VN')} ${unit}${made}`;
  }

  readonly columns: DataTableColumn<ProductionOrder>[] = [
    { key: 'code', label: 'Mã lệnh', copy: true, link: (r) => ['/san-xuat', r.id] },
    { key: 'createdDate', label: 'Ngày lập', format: (r) => formatDay(r.createdDate), mono: true },
    { key: 'productId', sortByText: true, label: 'Thành phẩm', format: (r) => this.productText(r) },
    { key: 'quantity', label: 'Số lượng', align: 'right', format: (r) => this.qtyText(r), filterValue: (r) => r.quantity },
    {
      key: 'sourceOrderId', sortByText: true, label: 'Đơn bán', format: (r) => this.orderById().get(r.sourceOrderId)?.code ?? '—',
      link: (r) => ['/don-hang', r.sourceOrderId],
    },
    { key: 'customer', label: 'Khách hàng', format: (r) => this.customerName().get(this.orderById().get(r.sourceOrderId)?.customerId ?? '') ?? '—' },
    {
      key: 'needed', sortValue: (r) => this.orderById().get(r.sourceOrderId)?.neededByDate, label: 'Cần giao', mono: true,
      format: (r) => { const d = this.orderById().get(r.sourceOrderId)?.neededByDate; return d ? formatDay(d) + (this.late(r) ? ' · trễ' : '') : '—'; },
      tone: (r) => (this.late(r) ? -1 : 0),
    },
    { key: 'startDate', label: 'Bắt đầu', format: (r) => (r.startDate ? formatDay(r.startDate) : '—'), mono: true },
    { key: 'completeDate', label: 'Hoàn tất', format: (r) => (r.completeDate ? formatDay(r.completeDate) : '—'), mono: true },
    { key: 'status', sortByText: true, label: 'Trạng thái', format: (r) => PRODUCTION_ORDER_STATUS_LABEL[r.status], badge: (r) => productionOrderStatusClass(r.status) },
  ];

  constructor() {
    effect(() => {
      this.rows();
      untracked(() => this.page.set(1));
    });
    syncSliceToUrl(() => {
      const s = this.statusTab();
      const p = this.productIds();
      return { tt: s === 'all' ? null : statusParam(s), tp: p.length ? p.join(',') : null };
    });
  }

  async start(x: ProductionOrder): Promise<void> {
    this.failure.set('');
    let v;
    try {
      v = await this.orders.startProduction(x.id);
    } catch (e) {
      this.failure.set(errorText(e));
      return;
    }
    this.notice.set(`${x.code} đang sản xuất${v.length ? ` — đã xuất vật tư (${v.map((p) => p.code).join(', ')})` : ' — chưa có định mức nên không xuất vật tư'}.`);
  }

  clearAll(): void {
    this.search.set('');
    this.productIds.set([]);
    this.period.set(NO_PERIOD);
    this.lateOnly.set(false);
    this.columnFilters.set({});
  }

  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      const rows = this.rows().map((x) => {
        const p = this.productById().get(x.productId);
        const o = this.orderById().get(x.sourceOrderId);
        return [
          x.code, formatDay(x.createdDate), p?.code ?? '', p?.name ?? '', p?.baseUnit ?? '', x.quantity, x.producedQuantity ?? '',
          o?.code ?? '', this.customerName().get(o?.customerId ?? '') ?? '', o?.neededByDate ? formatDay(o.neededByDate) : '',
          x.startDate ? formatDay(x.startDate) : '', x.completeDate ? formatDay(x.completeDate) : '', PRODUCTION_ORDER_STATUS_LABEL[x.status], x.cancelReason ?? '',
        ];
      });
      await downloadWorkbook(exportFileName('Lệnh sản xuất'), [{
        name: 'Lệnh sản xuất',
        columns: [
          { header: 'Mã lệnh', width: 12 }, { header: 'Ngày lập', width: 12 }, { header: 'Mã TP', width: 12 }, { header: 'Thành phẩm', width: 32 },
          { header: 'ĐVT', width: 8 }, { header: 'SL lệnh', width: 10 }, { header: 'SL thực nhập', width: 12 }, { header: 'Đơn bán', width: 12 },
          { header: 'Khách hàng', width: 28 }, { header: 'Cần giao', width: 12 }, { header: 'Bắt đầu', width: 12 }, { header: 'Hoàn tất', width: 12 },
          { header: 'Trạng thái', width: 14 }, { header: 'Lý do huỷ', width: 24 },
        ],
        rows,
      }]);
    } finally {
      this.exporting.set(false);
    }
  }

  private searchText(x: ProductionOrder): string {
    const o = this.orderById().get(x.sourceOrderId);
    return foldVi([x.code, this.productText(x), o?.code ?? '', this.customerName().get(o?.customerId ?? '') ?? ''].join(' '));
  }
}
