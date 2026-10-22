import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../core/services/mock-data.service';
import { ProductionOrder, ProductionOrderStatus } from '../../core/models/domain.models';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { FilterMultiSelectComponent, FilterOption } from '../../shared/filter-multi-select/filter-multi-select.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { PeriodFilterComponent, PeriodValue, NO_PERIOD } from '../../shared/period-filter/period-filter.component';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { ColumnFilters, applyColumnFilters } from '../../shared/column-filter';
import { foldVi } from '../../shared/format.util';
import { PERIOD_PRESETS, formatDay, inRange, isoDay, rangeLabel } from '../../shared/period';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { PRODUCTION_ORDER_STATUS_LABEL, productionOrderStatusClass } from '../../shared/status-labels';
import { SalesOrderService } from '../sales-orders/sales-order.service';
import { canStart, isLate } from './production-order.rules';

interface ActiveChip {
  label: string;
  clear: () => void;
}

@Component({
  selector: 'app-production-orders',
  standalone: true,
  imports: [CommonModule, RouterLink, DataTableComponent, FilterMultiSelectComponent, PaginationComponent, PeriodFilterComponent, NavIconComponent],
  templateUrl: './production-orders.component.html',
})
export class ProductionOrdersComponent {
  readonly data = inject(MockDataService);
  private readonly orders = inject(SalesOrderService);

  readonly today = isoDay(new Date());
  readonly search = signal('');
  readonly statuses = signal<string[]>([]);
  readonly period = signal<PeriodValue>(NO_PERIOD);
  readonly lateOnly = signal(false);
  readonly columnFilters = signal<ColumnFilters>({});
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly exporting = signal(false);
  readonly notice = signal('');
  readonly canStart = canStart;

  private readonly productById = computed(() => new Map(this.data.products().map((p) => [p.id, p])));
  private readonly orderById = computed(() => new Map(this.data.salesOrders().map((o) => [o.id, o])));
  private readonly customerName = computed(() => new Map(this.data.customers().map((c) => [c.id, c.name])));

  late(x: ProductionOrder): boolean {
    return isLate(x, this.orderById().get(x.sourceOrderId), this.today);
  }

  private readonly matchedExceptStatus = computed(() => {
    const q = foldVi(this.search().trim());
    return this.data.productionOrders().filter((x) => {
      if (q && !this.searchText(x).includes(q)) return false;
      if (!inRange(x.createdDate, this.period().range)) return false;
      if (this.lateOnly() && !this.late(x)) return false;
      return true;
    });
  });

  readonly statusOptions = computed<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const x of this.matchedExceptStatus()) counts.set(x.status, (counts.get(x.status) ?? 0) + 1);
    return (Object.keys(PRODUCTION_ORDER_STATUS_LABEL) as ProductionOrderStatus[]).map((s) => ({
      value: s, label: PRODUCTION_ORDER_STATUS_LABEL[s], count: counts.get(s) ?? 0, dotClass: productionOrderStatusClass(s),
    }));
  });

  readonly rows = computed(() => {
    const st = this.statuses();
    const rows = this.matchedExceptStatus()
      .filter((x) => !st.length || st.includes(x.status))
      .sort((a, b) => b.createdDate.localeCompare(a.createdDate) || b.code.localeCompare(a.code));
    return applyColumnFilters(rows, this.columns, this.columnFilters());
  });

  readonly paged = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.rows().slice(start, start + this.pageSize());
  });

  readonly totals = computed(() => {
    const all = this.data.productionOrders();
    return {
      draft: all.filter((x) => x.status === 'NHAP').length,
      running: all.filter((x) => x.status === 'DANG_SAN_XUAT').length,
      late: all.filter((x) => this.late(x)).length,
      waitingOrders: this.data.salesOrders().filter((o) => o.status === 'CHO_SAN_XUAT').length,
    };
  });

  readonly chips = computed<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];
    for (const s of this.statuses()) chips.push({ label: PRODUCTION_ORDER_STATUS_LABEL[s as ProductionOrderStatus], clear: () => this.statuses.update((v) => v.filter((x) => x !== s)) });
    const p = this.period();
    if (p.preset !== null) {
      const label = p.preset === 'custom' ? rangeLabel(p.range) : PERIOD_PRESETS.find((x) => x.value === p.preset)?.label;
      chips.push({ label: `Kỳ: ${label}`, clear: () => this.period.set(NO_PERIOD) });
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
    { key: 'productId', label: 'Thành phẩm', format: (r) => this.productText(r) },
    { key: 'quantity', label: 'Số lượng', align: 'right', format: (r) => this.qtyText(r), filterValue: (r) => r.quantity },
    {
      key: 'sourceOrderId', label: 'Đơn bán', format: (r) => this.orderById().get(r.sourceOrderId)?.code ?? '—',
      link: (r) => ['/don-hang', r.sourceOrderId],
    },
    { key: 'customer', label: 'Khách hàng', format: (r) => this.customerName().get(this.orderById().get(r.sourceOrderId)?.customerId ?? '') ?? '—' },
    {
      key: 'needed', label: 'Cần giao', mono: true,
      format: (r) => { const d = this.orderById().get(r.sourceOrderId)?.neededByDate; return d ? formatDay(d) + (this.late(r) ? ' · trễ' : '') : '—'; },
      tone: (r) => (this.late(r) ? -1 : 0),
    },
    { key: 'startDate', label: 'Bắt đầu', format: (r) => (r.startDate ? formatDay(r.startDate) : '—'), mono: true },
    { key: 'completeDate', label: 'Hoàn tất', format: (r) => (r.completeDate ? formatDay(r.completeDate) : '—'), mono: true },
    { key: 'status', label: 'Trạng thái', format: (r) => PRODUCTION_ORDER_STATUS_LABEL[r.status], badge: (r) => productionOrderStatusClass(r.status) },
  ];

  constructor() {
    effect(() => {
      this.rows();
      untracked(() => this.page.set(1));
    });
  }

  start(x: ProductionOrder): void {
    const v = this.orders.startProduction(x.id);
    this.notice.set(`${x.code} đang sản xuất${v.length ? ` — đã xuất vật tư (${v.map((p) => p.code).join(', ')})` : ' — chưa có định mức nên không xuất vật tư'}.`);
  }

  clearAll(): void {
    this.search.set('');
    this.statuses.set([]);
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
