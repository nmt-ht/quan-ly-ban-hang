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
import { ColumnFilters, applyColumnFilters } from '../../shared/column-filter';
import { ColumnSort, sortByColumn } from '../../shared/column-sort';
import { foldVi, formatVnd } from '../../shared/format.util';
import { PERIOD_PRESETS, formatDay, inRange, rangeLabel } from '../../shared/period';
import { DELIVERY_TRIP_STATUS_LABEL, deliveryTripStatusClass } from '../../shared/status-labels';
import { tagClass } from '../../shared/tag-class';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { costTotal } from './delivery-trip.rules';
import { TripHeaderDialogComponent } from './trip-header-dialog/trip-header-dialog.component';
import { AllowedLinkDirective } from '../../shared/allowed-link.directive';

interface ActiveChip {
  label: string;
  clear: () => void;
}

const HIRED = 'hired';

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
  readonly data = inject(DataStore);
  private readonly router = inject(Router);
  private readonly headerDialog = viewChild.required<TripHeaderDialogComponent>('headerDialog');

  readonly search = signal('');
  readonly statuses = signal<string[]>([]);
  readonly period = signal<PeriodValue>(NO_PERIOD);
  readonly drivers = signal<string[]>([]);
  readonly vehicle = signal('all');
  readonly columnFilters = signal<ColumnFilters>({});
  // Clicking a column header sorts; again reverses; a third click goes back to the default order.
  readonly headerSort = signal<ColumnSort | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly exporting = signal(false);

  private readonly orderById = computed(() => new Map(this.data.salesOrders().map((o) => [o.id, o])));
  private readonly customerById = computed(() => new Map(this.data.customers().map((c) => [c.id, c])));

  readonly driverOptions = computed<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const t of this.data.deliveryTrips()) {
      const d = t.driverName || '(Chưa có tài xế)';
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => a[0].localeCompare(b[0], 'vi')).map(([value, count]) => ({ value, label: value, count }));
  });

  private readonly matchedExceptStatus = computed(() => {
    const q = foldVi(this.search().trim());
    const range = this.period().range;
    const drivers = this.drivers();
    const veh = this.vehicle();
    return this.data.deliveryTrips().filter((t) => {
      if (q && !this.searchText(t).includes(q)) return false;
      if (!inRange(t.date, range)) return false;
      if (drivers.length && !drivers.includes(t.driverName || '(Chưa có tài xế)')) return false;
      if (veh === HIRED && t.vehicleId) return false;
      if (veh !== 'all' && veh !== HIRED && t.vehicleId !== veh) return false;
      return true;
    });
  });

  readonly statusOptions = computed<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const t of this.matchedExceptStatus()) counts.set(t.status, (counts.get(t.status) ?? 0) + 1);
    return (Object.keys(DELIVERY_TRIP_STATUS_LABEL) as DeliveryTripStatus[]).map((s) => ({
      value: s, label: DELIVERY_TRIP_STATUS_LABEL[s], count: counts.get(s) ?? 0, dotClass: tagClass('delivery-trip', s),
    }));
  });

  readonly trips = computed(() => {
    const st = this.statuses();
    const rows = this.matchedExceptStatus()
      .filter((t) => !st.length || st.includes(t.status))
      .sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true })); // default: Mã tăng dần
    return sortByColumn(applyColumnFilters(rows, this.columns, this.columnFilters()), this.columns, this.headerSort());
  });

  readonly pagedTrips = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.trips().slice(start, start + this.pageSize());
  });

  readonly totals = computed(() => {
    const rows = this.trips().filter((t) => t.status !== 'HUY');
    return {
      value: rows.reduce((s, t) => s + t.totalValue, 0),
      received: rows.reduce((s, t) => s + t.receivedValue, 0),
      cost: rows.reduce((s, t) => s + costTotal(t.costs), 0),
      pending: rows.filter((t) => t.status === 'DA_XUAT_KHO').reduce((s, t) => s + (t.orderIds.length - t.confirmedCount), 0),
    };
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
    for (const col of this.columns) {
      const v = (this.columnFilters()[col.key] ?? '').trim();
      if (v) chips.push({ label: `${col.label}: ${v}`, clear: () => this.columnFilters.update((f) => ({ ...f, [col.key]: '' })) });
    }
    return chips;
  });

  readonly columns: DataTableColumn<DeliveryTrip>[] = [
    { key: 'code', label: 'Mã chuyến', copy: true, link: (r) => ['/giao-hang', r.id] },
    { key: 'date', label: 'Ngày', format: (r) => formatDay(r.date), mono: true },
    { key: 'driverName', label: 'Tài xế', format: (r) => r.driverName || '—' },
    { key: 'plateNumber', label: 'Biển số', format: (r) => (r.plateNumber ? r.plateNumber + (r.vehicleId ? '' : ' · thuê') : '—'), mono: true },
    { key: 'status', sortByText: true, label: 'Trạng thái', format: (r) => DELIVERY_TRIP_STATUS_LABEL[r.status], badge: (r) => deliveryTripStatusClass(r.status) },
    { key: 'orderIds', label: 'Đơn', align: 'right', format: (r) => `${r.confirmedCount}/${r.orderIds.length}`, filterValue: (r) => r.orderIds.length },
    { key: 'totalValue', label: 'Giá trị', align: 'right', format: (r) => formatVnd(r.totalValue), filterValue: (r) => r.totalValue },
    { key: 'receivedValue', label: 'Khách nhận', align: 'right', format: (r) => (r.receivedValue ? formatVnd(r.receivedValue) : '—'), filterValue: (r) => r.receivedValue },
    { key: 'cost', label: 'Chi phí', align: 'right', format: (r) => (costTotal(r.costs) ? formatVnd(costTotal(r.costs)) : '—'), filterValue: (r) => costTotal(r.costs) },
  ];

  constructor() {
    effect(() => {
      this.trips();
      untracked(() => this.page.set(1));
    });
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
    this.statuses.set([]);
    this.period.set(NO_PERIOD);
    this.drivers.set([]);
    this.vehicle.set('all');
    this.columnFilters.set({});
  }

  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
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
        rows: this.trips().map((t) => [
          t.code, formatDay(t.date), t.driverName ?? '', t.driverPhone ?? '', t.plateNumber ?? '', t.vehicleId ? 'Xe công ty' : 'Thuê ngoài',
          DELIVERY_TRIP_STATUS_LABEL[t.status], t.orderIds.length, t.confirmedCount, t.totalValue, t.receivedValue,
          t.costs?.fuel ?? 0, t.costs?.toll ?? 0, t.costs?.other ?? 0,
          t.orderIds.map((id) => this.orderById().get(id)?.code ?? id).join(', '),
        ]),
      }]);
    } finally {
      this.exporting.set(false);
    }
  }

  private searchText(t: DeliveryTrip): string {
    const orders = t.orderIds.map((id) => {
      const o = this.orderById().get(id);
      const c = o ? this.customerById().get(o.customerId) : undefined;
      return `${o?.code ?? ''} ${c?.name ?? ''} ${c?.companyName ?? ''}`;
    });
    return foldVi([t.code, t.driverName ?? '', t.driverPhone ?? '', t.plateNumber ?? '', t.note ?? '', ...orders].join(' '));
  }
}
