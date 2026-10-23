import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { DataStore } from '../../core/services/data-store.service';
import { Vehicle } from '../../core/models/domain.models';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { ColumnFilters, applyColumnFilters } from '../../shared/column-filter';
import { ColumnSort, sortByColumn } from '../../shared/column-sort';
import { foldVi, formatVnd } from '../../shared/format.util';
import { formatDay, isoDay } from '../../shared/period';
import { tagClass } from '../../shared/tag-class';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { costTotal } from '../delivery-trips/delivery-trip.rules';
import { VEHICLE_STATUSES, VEHICLE_STATUS_LABEL, VEHICLE_TYPES, VEHICLE_TYPE_LABEL, currentTripOf, expiryState } from './vehicle.rules';
import { VehicleDialogComponent } from './vehicle-dialog/vehicle-dialog.component';
import { AllowedLinkDirective } from '../../shared/allowed-link.directive';

@Component({
  selector: 'app-vehicles',
  standalone: true,
  imports: [CommonModule, RouterLink, AllowedLinkDirective, DataTableComponent, PaginationComponent, NavIconComponent, VehicleDialogComponent],
  templateUrl: './vehicles.component.html',
})
export class VehiclesComponent {
  readonly data = inject(DataStore);
  private readonly router = inject(Router);
  private readonly dialog = viewChild.required<VehicleDialogComponent>('dialog');

  readonly search = signal('');
  readonly status = signal('all');
  readonly type = signal('all');
  readonly papersDue = signal(false);
  readonly columnFilters = signal<ColumnFilters>({});
  // Clicking a column header sorts; again reverses; a third click goes back to the default order.
  readonly headerSort = signal<ColumnSort | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly notice = signal('');
  readonly exporting = signal(false);
  readonly statuses = VEHICLE_STATUSES;
  readonly types = VEHICLE_TYPES;
  readonly today = isoDay(new Date());

  /** Per vehicle: current trip, trip count, delivered value and running costs (cancelled trips excluded). */
  readonly stats = computed(() => {
    const trips = this.data.deliveryTrips();
    const map = new Map<string, { current?: string; trips: number; delivered: number; cost: number }>();
    for (const v of this.data.vehicles()) {
      const mine = trips.filter((t) => t.vehicleId === v.id && t.status !== 'HUY');
      map.set(v.id, {
        current: currentTripOf(v, trips)?.code,
        trips: mine.length,
        delivered: mine.reduce((s, t) => s + t.receivedValue, 0),
        cost: mine.reduce((s, t) => s + costTotal(t.costs), 0),
      });
    }
    return map;
  });

  private paperLevel(v: Vehicle): 'expired' | 'soon' | 'ok' {
    const levels = [expiryState(v.registrationExpiry, this.today).level, expiryState(v.insuranceExpiry, this.today).level];
    return levels.includes('expired') ? 'expired' : levels.includes('soon') ? 'soon' : 'ok';
  }

  readonly paperAlerts = computed(() => {
    const active = this.data.vehicles().filter((v) => v.status !== 'NGUNG_DUNG');
    return {
      expired: active.filter((v) => this.paperLevel(v) === 'expired').length,
      soon: active.filter((v) => this.paperLevel(v) === 'soon').length,
    };
  });

  readonly vehicles = computed(() => {
    const q = foldVi(this.search().trim());
    const rows = this.data.vehicles().filter((v) => {
      if (q && !foldVi(`${v.plateNumber} ${v.code} ${v.name ?? ''} ${v.usualDriver ?? ''}`).includes(q)) return false;
      if (this.status() !== 'all' && v.status !== this.status()) return false;
      if (this.type() !== 'all' && v.type !== this.type()) return false;
      if (this.papersDue() && this.paperLevel(v) === 'ok') return false;
      return true;
    });
    rows.sort((a, b) => a.code.localeCompare(b.code));
    return sortByColumn(applyColumnFilters(rows, this.columns, this.columnFilters()), this.columns, this.headerSort());
  });

  readonly paged = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.vehicles().slice(start, start + this.pageSize());
  });

  private expiryText(date: string | undefined): string {
    if (!date) return '—';
    const e = expiryState(date, this.today);
    return e.level === 'ok' ? formatDay(date) : `${formatDay(date)} · ${e.label.toLowerCase()}`;
  }

  readonly columns: DataTableColumn<Vehicle>[] = [
    { key: 'plateNumber', label: 'Biển số', copy: true, link: (r) => ['/xe', r.id] },
    { key: 'code', label: 'Mã xe', mono: true },
    { key: 'name', label: 'Tên gọi', format: (r) => r.name || '—' },
    { key: 'type', sortByText: true, label: 'Loại', format: (r) => VEHICLE_TYPE_LABEL[r.type] },
    { key: 'loadCapacity', label: 'Tải trọng', align: 'right', format: (r) => (r.loadCapacity ? `${r.loadCapacity.toLocaleString('vi-VN')} kg` : '—'), filterValue: (r) => r.loadCapacity ?? 0 },
    { key: 'usualDriver', label: 'Tài xế thường chạy', format: (r) => r.usualDriver || '—' },
    { key: 'registrationExpiry', label: 'Hạn đăng kiểm', format: (r) => this.expiryText(r.registrationExpiry), mono: true },
    { key: 'insuranceExpiry', label: 'Hạn bảo hiểm', format: (r) => this.expiryText(r.insuranceExpiry), mono: true },
    { key: 'trips', label: 'Số chuyến', align: 'right', format: (r) => String(this.stats().get(r.id)?.trips ?? 0), filterValue: (r) => this.stats().get(r.id)?.trips ?? 0 },
    { key: 'cost', label: 'Chi phí chuyến', align: 'right', format: (r) => formatVnd(this.stats().get(r.id)?.cost ?? 0), filterValue: (r) => this.stats().get(r.id)?.cost ?? 0 },
    {
      key: 'status', label: 'Tình trạng',
      format: (r) => VEHICLE_STATUS_LABEL[r.status] + (this.stats().get(r.id)?.current ? ` · ${this.stats().get(r.id)!.current}` : ''),
      badge: (r) => tagClass('vehicle-status', r.status),
      filterValue: (r) => VEHICLE_STATUS_LABEL[r.status],
    },
  ];

  constructor() {
    effect(() => {
      this.vehicles();
      untracked(() => this.page.set(1));
    });
  }

  openCreate(): void {
    this.dialog().open();
  }

  openEdit(v: Vehicle): void {
    this.dialog().open(v);
  }

  onSaved(e: { vehicle?: Vehicle; message: string }): void {
    this.notice.set(e.message);
  }

  clearAll(): void {
    this.search.set('');
    this.status.set('all');
    this.type.set('all');
    this.papersDue.set(false);
    this.columnFilters.set({});
  }

  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      await downloadWorkbook(exportFileName('Danh mục xe'), [{
        name: 'Danh mục xe',
        columns: [
          { header: 'Mã xe', width: 12 }, { header: 'Biển số', width: 13 }, { header: 'Tên gọi', width: 18 }, { header: 'Loại', width: 14 },
          { header: 'Tải trọng (kg)', width: 12 }, { header: 'Tài xế thường chạy', width: 20 }, { header: 'Điện thoại', width: 13 },
          { header: 'Hạn đăng kiểm', width: 13 }, { header: 'Hạn bảo hiểm', width: 13 }, { header: 'Tình trạng', width: 12 },
          { header: 'Số chuyến', width: 10 }, { header: 'Giá trị đã giao', width: 15, numFmt: '#,##0' }, { header: 'Chi phí chuyến', width: 15, numFmt: '#,##0' },
          { header: 'Ghi chú', width: 30 },
        ],
        rows: this.vehicles().map((v) => {
          const s = this.stats().get(v.id);
          return [
            v.code, v.plateNumber, v.name ?? '', VEHICLE_TYPE_LABEL[v.type], v.loadCapacity ?? '', v.usualDriver ?? '', v.driverPhone ?? '',
            v.registrationExpiry ? formatDay(v.registrationExpiry) : '', v.insuranceExpiry ? formatDay(v.insuranceExpiry) : '',
            VEHICLE_STATUS_LABEL[v.status], s?.trips ?? 0, s?.delivered ?? 0, s?.cost ?? 0, v.note ?? '',
          ];
        }),
      }]);
    } finally {
      this.exporting.set(false);
    }
  }
}
