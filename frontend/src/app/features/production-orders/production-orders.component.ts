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
import { ColumnSort } from '../../shared/column-sort';
import { PERIOD_PRESETS, formatDay, isoDay, rangeLabel } from '../../shared/period';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { PRODUCTION_ORDER_STATUS_LABEL, productionOrderStatusClass } from '../../shared/status-labels';
import { ProductionOrderPage, ProductionOrderPageQuery, SalesOrderService } from '../sales-orders/sales-order.service';
import { canStart, isLate } from './production-order.rules';
import { errorText } from '../../core/api/api.service';
import { AllowedLinkDirective } from '../../shared/allowed-link.directive';
import { ToastService } from '../../core/services/toast.service';

/** 'open' = Chờ xử lý (Nháp + Đang sản xuất): what the screen opens on; the finished and cancelled ones are a tab away. */
type StatusTab = 'open' | 'all' | ProductionOrderStatus;
const OPEN_STATUSES: ProductionOrderStatus[] = ['NHAP', 'DANG_SAN_XUAT'];
const STATUSES = Object.keys(PRODUCTION_ORDER_STATUS_LABEL) as ProductionOrderStatus[];
/** ?tt= in the address: the status in lower-case words (nhap, dang-san-xuat…). */
const statusParam = (s: ProductionOrderStatus) => s.toLowerCase().replace(/_/g, '-');

/** Column key → the server's ProductionOrderPageQuery.sort value. */
const SORT_KEY: Partial<Record<keyof ProductionOrder | 'customer' | 'needed' | 'product', string>> = {
  code: 'code', createdDate: 'createdDate', productId: 'product', quantity: 'quantity',
  sourceOrderId: 'sourceOrder', customer: 'customer', needed: 'needed', startDate: 'startDate', completeDate: 'completeDate', status: 'status',
};

const EMPTY_PAGE: ProductionOrderPage = { rows: [], total: 0, page: 1, pageSize: 20, statusCounts: {}, productCounts: {}, late: 0, waitingOrders: 0 };

interface ActiveChip {
  label: string;
  clear: () => void;
}

// Lệnh sản xuất (Pha 1.1): mọi lệnh, lấy theo trang từ máy chủ — tìm kiếm, lọc, sắp xếp, số đếm tab và tổng tính trên
// toàn bộ, không chỉ trang đang xem.
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
  protected readonly toast = inject(ToastService);
  readonly data = inject(DataStore);
  private readonly orders = inject(SalesOrderService);

  readonly today = isoDay(new Date());
  readonly search = signal('');
  private readonly searchQuery = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;
  readonly statusTab = signal<StatusTab>(this.query.get('tt') === 'tat-ca' ? 'all' : STATUSES.find((s) => statusParam(s) === this.query.get('tt')) ?? 'open');
  readonly productIds = signal<string[]>((this.query.get('tp') ?? '').split(',').filter(Boolean));
  readonly period = signal<PeriodValue>(NO_PERIOD);
  readonly lateOnly = signal(false);
  readonly headerSort = signal<ColumnSort | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly exporting = signal(false);
  /** A save the server refused (or that could not reach it). */
  readonly loading = signal(false);
  readonly canStart = canStart;

  private readonly result = signal<ProductionOrderPage>(EMPTY_PAGE);
  private requestSeq = 0;

  readonly rows = computed(() => this.result().rows);
  readonly total = computed(() => this.result().total);
  readonly totals = computed(() => ({ late: this.result().late, waitingOrders: this.result().waitingOrders }));

  private readonly productById = computed(() => new Map(this.data.products().map((p) => [p.id, p])));
  // Đơn bán của các lệnh trên trang: đọc để cho bấm vào mã đơn (lệnh cũ không nạp sẵn đơn gốc — Pha 1.1).
  private readonly ensureOrders = effect(() => {
    const ids = this.rows().map((x) => x.sourceOrderId);
    untracked(() => void this.orders.ensureMany(ids));
  });
  private readonly orderById = computed(() => new Map(this.data.salesOrders().map((o) => [o.id, o])));

  late(x: ProductionOrder): boolean {
    return isLate(x, x.sourceOrder, this.today);
  }

  private readonly filters = computed<ProductionOrderPageQuery>(() => ({
    q: this.searchQuery().trim() || undefined,
    status: this.statusTab() === 'all' ? [] : this.statusTab() === 'open' ? OPEN_STATUSES : [this.statusTab() as ProductionOrderStatus],
    productIds: this.productIds(),
    from: this.period().range.from ?? undefined,
    to: this.period().range.to ?? undefined,
    late: this.lateOnly() || undefined,
    // Opened with the most recently created first (the "Trễ hẹn" toggle brings the late ones up). A click on a header overrides it.
    sort: this.headerSort() ? SORT_KEY[this.headerSort()!.key as keyof typeof SORT_KEY] : 'code',
    dir: this.headerSort() ? this.headerSort()!.dir : 'desc',
  }));

  readonly statusTabs = computed<DivideItem<StatusTab>[]>(() => {
    const counts = this.result().statusCounts;
    const all = STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
    const open = OPEN_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
    return [
      { value: 'open' as StatusTab, label: 'Chờ xử lý', count: open },
      { value: 'all' as StatusTab, label: 'Tất cả', count: all },
      ...STATUSES.map((s) => ({ value: s as StatusTab, label: PRODUCTION_ORDER_STATUS_LABEL[s], count: counts[s] ?? 0 })),
    ];
  });

  /** Thành phẩm filter: products with a matching lệnh (plus any already selected), "mã · tên", searchable. */
  readonly productOptions = computed<FilterOption[]>(() => {
    const counts = this.result().productCounts;
    const ids = new Set([...Object.keys(counts), ...this.productIds()]);
    return [...ids]
      .map((id) => {
        const p = this.productById().get(id);
        return { value: id, label: p ? `${p.code} · ${p.name}` : id, count: counts[id] ?? 0 };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'vi', { numeric: true }));
  });

  readonly chips = computed<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];
    const p = this.period();
    if (p.preset !== null) {
      const label = p.preset === 'custom' ? rangeLabel(p.range) : PERIOD_PRESETS.find((x) => x.value === p.preset)?.label;
      chips.push({ label: `Kỳ: ${label}`, clear: () => this.period.set(NO_PERIOD) });
    }
    for (const id of this.productIds()) {
      const prod = this.productById().get(id);
      chips.push({ label: prod ? `${prod.code} · ${prod.name}` : id, clear: () => this.productIds.update((v) => v.filter((x) => x !== id)) });
    }
    if (this.lateOnly()) chips.push({ label: 'Trễ hạn giao', clear: () => this.lateOnly.set(false) });
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
    { key: 'quantity', label: 'Số lượng', align: 'right', format: (r) => this.qtyText(r) },
    {
      key: 'sourceOrderId', sortByText: true, label: 'Đơn bán', format: (r) => r.sourceOrder?.code ?? '—',
      // Plain text for someone who may not open the đơn (it was not loaded for them).
      link: (r) => (this.orderById().has(r.sourceOrderId) ? ['/don-hang', r.sourceOrderId] : null),
    },
    { key: 'customer', label: 'Khách hàng', format: (r) => r.sourceOrder?.customerName ?? '—' },
    {
      key: 'needed', label: 'Cần giao', mono: true,
      format: (r) => (r.sourceOrder?.neededByDate ? formatDay(r.sourceOrder.neededByDate) + (this.late(r) ? ' · trễ' : '') : '—'),
      tone: (r) => (this.late(r) ? -1 : 0),
    },
    { key: 'startDate', label: 'Bắt đầu', format: (r) => (r.startDate ? formatDay(r.startDate) : '—'), mono: true },
    { key: 'completeDate', label: 'Hoàn tất', format: (r) => (r.completeDate ? formatDay(r.completeDate) : '—'), mono: true },
    { key: 'status', sortByText: true, label: 'Trạng thái', format: (r) => PRODUCTION_ORDER_STATUS_LABEL[r.status], badge: (r) => productionOrderStatusClass(r.status) },
  ];

  constructor() {
    // Về trang 1 khi bộ lọc đổi.
    effect(() => {
      this.filters();
      untracked(() => this.page.set(1));
    });
    // Hỏi máy chủ mỗi khi bộ lọc, trang, hay danh sách lệnh trong bộ nhớ đổi (một thao tác ở nơi khác).
    effect(() => {
      const query = { ...this.filters(), page: this.page(), pageSize: this.pageSize() };
      this.data.productionOrders();
      untracked(() => void this.load(query));
    });
    syncSliceToUrl(() => {
      const s = this.statusTab();
      const p = this.productIds();
      return { tt: s === 'open' ? null : s === 'all' ? 'tat-ca' : statusParam(s), tp: p.length ? p.join(',') : null };
    });
  }

  setSearch(text: string): void {
    this.search.set(text);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.searchQuery.set(text), 300);
  }

  private async load(query: ProductionOrderPageQuery): Promise<void> {
    const seq = ++this.requestSeq;
    this.loading.set(true);
    try {
      const res = await this.orders.productionPage(query);
      if (seq !== this.requestSeq) return; // a newer request answered first
      this.result.set(res);
    } catch (e) {
      if (seq === this.requestSeq) this.toast.error(errorText(e));
    } finally {
      if (seq === this.requestSeq) this.loading.set(false);
    }
  }

  async start(x: ProductionOrder): Promise<void> {
    let v;
    try {
      v = await this.orders.startProduction(x.id);
    } catch (e) {
      this.toast.error(errorText(e));
      return;
    }
    this.toast.success(`${x.code} đang sản xuất${v.length ? ` — đã xuất vật tư (${v.map((p) => p.code).join(', ')})` : ' — chưa có định mức nên không xuất vật tư'}.`);
  }

  clearAll(): void {
    this.search.set('');
    this.searchQuery.set('');
    this.productIds.set([]);
    this.period.set(NO_PERIOD);
    this.lateOnly.set(false);
  }

  /** Every matching lệnh (not only this page), in the list's order. */
  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      const rows = (await this.orders.productionPage({ ...this.filters(), page: 1, pageSize: 5000 })).rows.map((x) => {
        const p = this.productById().get(x.productId);
        return [
          x.code, formatDay(x.createdDate), p?.code ?? '', p?.name ?? '', p?.baseUnit ?? '', x.quantity, x.producedQuantity ?? '',
          x.sourceOrder?.code ?? '', x.sourceOrder?.customerName ?? '', x.sourceOrder?.neededByDate ? formatDay(x.sourceOrder.neededByDate) : '',
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
    } catch (e) {
      this.toast.error(errorText(e));
    } finally {
      this.exporting.set(false);
    }
  }
}
