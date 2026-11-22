import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { DataStore } from '../../core/services/data-store.service';
import { DeliveryTrip, DeliveryTripStatus } from '../../core/models/domain.models';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { FilterMultiSelectComponent, FilterOption } from '../../shared/filter-multi-select/filter-multi-select.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { PeriodFilterComponent, PeriodValue, NO_PERIOD } from '../../shared/period-filter/period-filter.component';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { ColumnSort } from '../../shared/column-sort';
import { formatVnd } from '../../shared/format.util';
import { PERIOD_PRESETS, formatDay, rangeLabel } from '../../shared/period';
import { DELIVERY_TRIP_STATUS_LABEL, deliveryTripStatusClass } from '../../shared/status-labels';
import { tagClass } from '../../shared/tag-class';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { costTotal } from './delivery-trip.rules';
import { DeliveryTripPage, DeliveryTripPageQuery, DeliveryTripService } from './delivery-trip.service';
import { TripHeaderDialogComponent } from './trip-header-dialog/trip-header-dialog.component';
import { AllowedLinkDirective } from '../../shared/allowed-link.directive';
import { SalesOrderService } from '../sales-orders/sales-order.service';
import { errorText } from '../../core/api/api.service';
import { ToastService } from '../../core/services/toast.service';

interface ActiveChip {
  label: string;
  clear: () => void;
}

const HIRED = 'hired';

/** Column key → the server's DeliveryTripPageQuery.sort value. */
const SORT_KEY: Record<string, string> = {
  code: 'code', date: 'date', driverName: 'driverName', plateNumber: 'plateNumber', status: 'status',
  orderIds: 'orderIds', totalValue: 'totalValue', receivedValue: 'receivedValue', cost: 'cost',
};

const EMPTY_PAGE: DeliveryTripPage = { rows: [], total: 0, page: 1, pageSize: 20, statusCounts: {}, driverCounts: {}, totals: { value: 0, received: 0, cost: 0, pending: 0 } };

// Chuyến giao hàng (Pha 1.1): mọi chuyến, lấy theo trang từ máy chủ — tìm kiếm, lọc, sắp xếp, số đếm và tổng tính trên
// toàn bộ, không chỉ trang đang xem.
@Component({
  selector: 'app-delivery-trips',
  standalone: true,
  imports: [
    CommonModule, RouterLink, AllowedLinkDirective, DataTableComponent, FilterMultiSelectComponent, PaginationComponent, PeriodFilterComponent,
    NavIconComponent, TripHeaderDialogComponent,
  ],
  templateUrl: './delivery-trips.component.html',
})
export class DeliveryTripsComponent {
  protected readonly toast = inject(ToastService);
  readonly data = inject(DataStore);
  private readonly tripsSvc = inject(DeliveryTripService);
  private readonly salesOrders = inject(SalesOrderService);
  private readonly router = inject(Router);
  private readonly headerDialog = viewChild.required<TripHeaderDialogComponent>('headerDialog');

  readonly search = signal('');
  private readonly searchQuery = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  readonly statuses = signal<string[]>([]);
  readonly period = signal<PeriodValue>(NO_PERIOD);
  readonly drivers = signal<string[]>([]);
  readonly vehicle = signal('all');
  readonly headerSort = signal<ColumnSort | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly exporting = signal(false);
  readonly loading = signal(false);

  private readonly result = signal<DeliveryTripPage>(EMPTY_PAGE);
  private requestSeq = 0;

  readonly trips = computed(() => this.result().rows);
  readonly total = computed(() => this.result().total);
  readonly totals = computed(() => this.result().totals);

  private readonly filters = computed<DeliveryTripPageQuery>(() => ({
    q: this.searchQuery().trim() || undefined,
    status: this.statuses(),
    drivers: this.drivers(),
    vehicle: this.vehicle() === 'all' ? undefined : this.vehicle(),
    from: this.period().range.from ?? undefined,
    to: this.period().range.to ?? undefined,
    // default: mới tạo nhất (mã chuyến are issued in creation order)
    sort: this.headerSort() ? SORT_KEY[this.headerSort()!.key] : 'code',
    dir: this.headerSort() ? this.headerSort()!.dir : 'desc',
  }));

  readonly driverOptions = computed<FilterOption[]>(() => {
    const counts = this.result().driverCounts;
    return Object.entries(counts)
      .sort((a, b) => a[0].localeCompare(b[0], 'vi'))
      .map(([value, count]) => ({ value, label: value, count }));
  });

  readonly statusOptions = computed<FilterOption[]>(() => {
    const counts = this.result().statusCounts;
    return (Object.keys(DELIVERY_TRIP_STATUS_LABEL) as DeliveryTripStatus[]).map((s) => ({
      value: s, label: DELIVERY_TRIP_STATUS_LABEL[s], count: counts[s] ?? 0, dotClass: tagClass('delivery-trip', s),
    }));
  });

  readonly chips = computed<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];
    for (const s of this.statuses()) {
      chips.push({ label: DELIVERY_TRIP_STATUS_LABEL[s as DeliveryTripStatus], clear: () => this.statuses.update((v) => v.filter((x) => x !== s)) });
    }
    const p = this.period();
    if (p.preset !== null) {
      const label = p.preset === 'custom' ? rangeLabel(p.range) : PERIOD_PRESETS.find((x) => x.value === p.preset)?.label;
      chips.push({ label: `Kỳ: ${label}`, clear: () => this.period.set(NO_PERIOD) });
    }
    for (const d of this.drivers()) chips.push({ label: `Tài xế: ${d}`, clear: () => this.drivers.update((v) => v.filter((x) => x !== d)) });
    if (this.vehicle() !== 'all') {
      const label = this.vehicle() === HIRED ? 'Xe thuê ngoài' : this.data.vehicles().find((v) => v.id === this.vehicle())?.plateNumber ?? '';
      chips.push({ label: `Xe: ${label}`, clear: () => this.vehicle.set('all') });
    }
    return chips;
  });

  readonly columns: DataTableColumn<DeliveryTrip>[] = [
    { key: 'code', label: 'Mã chuyến', copy: true, link: (r) => ['/giao-hang', r.id] },
    { key: 'date', label: 'Ngày', format: (r) => formatDay(r.date), mono: true },
    { key: 'driverName', label: 'Tài xế', format: (r) => r.driverName || '—' },
    { key: 'plateNumber', label: 'Biển số', format: (r) => (r.plateNumber ? r.plateNumber + (r.vehicleId ? '' : ' · thuê') : '—'), mono: true },
    { key: 'status', sortByText: true, label: 'Trạng thái', format: (r) => DELIVERY_TRIP_STATUS_LABEL[r.status], badge: (r) => deliveryTripStatusClass(r.status) },
    { key: 'orderIds', label: 'Đơn', align: 'right', format: (r) => `${r.confirmedCount}/${r.orderIds.length}` },
    { key: 'totalValue', label: 'Giá trị', align: 'right', format: (r) => formatVnd(r.totalValue) },
    { key: 'receivedValue', label: 'Khách nhận', align: 'right', format: (r) => (r.receivedValue ? formatVnd(r.receivedValue) : '—') },
    { key: 'cost', label: 'Chi phí', align: 'right', format: (r) => (costTotal(r.costs) ? formatVnd(costTotal(r.costs)) : '—') },
  ];

  constructor() {
    // Về trang 1 khi bộ lọc đổi.
    effect(() => {
      this.filters();
      untracked(() => this.page.set(1));
    });
    // Hỏi máy chủ mỗi khi bộ lọc, trang, hay danh sách chuyến trong bộ nhớ đổi (một thao tác ở nơi khác).
    effect(() => {
      const query = { ...this.filters(), page: this.page(), pageSize: this.pageSize() };
      this.data.deliveryTrips();
      untracked(() => void this.load(query));
    });
  }

  setSearch(text: string): void {
    this.search.set(text);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.searchQuery.set(text), 300);
  }

  private async load(query: DeliveryTripPageQuery): Promise<void> {
    const seq = ++this.requestSeq;
    this.loading.set(true);
    try {
      const res = await this.tripsSvc.page(query);
      if (seq !== this.requestSeq) return; // a newer request answered first
      this.result.set(res);
    } catch (e) {
      if (seq === this.requestSeq) this.toast.error(errorText(e));
    } finally {
      if (seq === this.requestSeq) this.loading.set(false);
    }
  }

  money(n: number): string {
    return formatVnd(n);
  }

  openCreate(): void {
    this.headerDialog().open();
  }

  onCreated(t: DeliveryTrip | string): void {
    if (typeof t !== 'string') {
      this.router.navigate(['/giao-hang', t.id], { state: { notice: `Đã tạo chuyến ${t.code}. Xếp các đơn Chờ giao hàng lên chuyến rồi xuất kho một lượt.` } });
    }
  }

  clearAll(): void {
    this.search.set('');
    this.searchQuery.set('');
    this.statuses.set([]);
    this.period.set(NO_PERIOD);
    this.drivers.set([]);
    this.vehicle.set('all');
  }

  /** Every matching chuyến (not only this page), in the list's order. */
  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      const rows = (await this.tripsSvc.page({ ...this.filters(), page: 1, pageSize: 5000 })).rows;
      // Mã đơn trên chuyến: đọc các đơn chưa nạp để cột "Mã đơn" không chỉ còn id.
      await this.salesOrders.ensureMany([...new Set(rows.flatMap((t) => t.orderIds))]);
      const orderById = new Map(this.data.salesOrders().map((o) => [o.id, o]));
      await downloadWorkbook(exportFileName('Chuyến giao hàng'), [{
        name: 'Chuyến giao hàng',
        columns: [
          { header: 'Mã chuyến', width: 13 },
          { header: 'Ngày', width: 12 },
          { header: 'Tài xế', width: 20 },
          { header: 'Điện thoại', width: 13 },
          { header: 'Biển số', width: 13 },
          { header: 'Xe', width: 12 },
          { header: 'Trạng thái', width: 15 },
          { header: 'Số đơn', width: 8 },
          { header: 'Đã chốt', width: 8 },
          { header: 'Giá trị', width: 15, numFmt: '#,##0' },
          { header: 'Khách nhận', width: 15, numFmt: '#,##0' },
          { header: 'Tiền dầu', width: 12, numFmt: '#,##0' },
          { header: 'Cầu đường', width: 12, numFmt: '#,##0' },
          { header: 'Chi phí khác', width: 12, numFmt: '#,##0' },
          { header: 'Mã đơn', width: 40 },
        ],
        rows: rows.map((t) => [
          t.code, formatDay(t.date), t.driverName ?? '', t.driverPhone ?? '', t.plateNumber ?? '', t.vehicleId ? 'Xe công ty' : 'Thuê ngoài',
          DELIVERY_TRIP_STATUS_LABEL[t.status], t.orderIds.length, t.confirmedCount, t.totalValue, t.receivedValue,
          t.costs?.fuel ?? 0, t.costs?.toll ?? 0, t.costs?.other ?? 0,
          t.orderIds.map((id) => orderById.get(id)?.code ?? id).join(', '),
        ]),
      }]);
    } catch (e) {
      this.toast.error(errorText(e));
    } finally {
      this.exporting.set(false);
    }
  }
}
