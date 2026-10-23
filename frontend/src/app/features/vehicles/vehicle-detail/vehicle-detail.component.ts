import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { NgClass } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { DataStore } from '../../../core/services/data-store.service';
import { Vehicle, VehicleStatus } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { CopyButtonComponent } from '../../../shared/copy-button/copy-button.component';
import { formatVnd } from '../../../shared/format.util';
import { formatDay, isoDay } from '../../../shared/period';
import { DELIVERY_TRIP_STATUS_LABEL, deliveryTripStatusClass } from '../../../shared/status-labels';
import { tagClass } from '../../../shared/tag-class';
import { costTotal } from '../../delivery-trips/delivery-trip.rules';
import { VEHICLE_STATUS_LABEL, VEHICLE_TYPE_LABEL, currentTripOf, expiryState } from '../vehicle.rules';
import { VehicleService } from '../vehicle.service';
import { VehicleDialogComponent } from '../vehicle-dialog/vehicle-dialog.component';
import { AllowedLinkDirective } from '../../../shared/allowed-link.directive';
import { errorText } from '../../../core/api/api.service';
import { AuditHistoryComponent } from '../../../shared/audit/audit-history.component';
import { FrozenColsDirective } from '../../../shared/frozen-cols.directive';

@Component({
  selector: 'app-vehicle-detail',
  standalone: true,
  imports: [FrozenColsDirective, NgClass, RouterLink, AllowedLinkDirective, NavIconComponent, CopyButtonComponent, VehicleDialogComponent, AuditHistoryComponent],
  templateUrl: './vehicle-detail.component.html',
  styleUrl: '../../suppliers/supplier-detail/supplier-detail.component.scss',
})
export class VehicleDetailComponent {
  readonly data = inject(DataStore);
  private readonly svc = inject(VehicleService);
  private readonly dialog = viewChild.required<VehicleDialogComponent>('dialog');

  readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: '' });
  readonly vehicle = computed(() => this.data.vehicles().find((v) => v.id === this.id()));
  readonly today = isoDay(new Date());
  readonly notice = signal('');
  /** A save the server refused (or that could not reach it). */
  readonly failure = signal('');

  readonly money = formatVnd;
  readonly day = formatDay;
  readonly typeLabel = VEHICLE_TYPE_LABEL;
  readonly statusLabel = VEHICLE_STATUS_LABEL;
  readonly statusClass = (s: VehicleStatus) => tagClass('vehicle-status', s);
  readonly tripLabel = DELIVERY_TRIP_STATUS_LABEL;
  readonly tripClass = deliveryTripStatusClass;
  readonly costOf = costTotal;

  readonly current = computed(() => (this.vehicle() ? currentTripOf(this.vehicle()!, this.data.deliveryTrips()) : undefined));
  readonly reg = computed(() => expiryState(this.vehicle()?.registrationExpiry, this.today));
  readonly ins = computed(() => expiryState(this.vehicle()?.insuranceExpiry, this.today));

  readonly trips = computed(() =>
    this.data.deliveryTrips()
      .filter((t) => t.vehicleId === this.id())
      .sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true })), // Mã tăng dần, as every coded grid
  );

  readonly totals = computed(() => {
    const rows = this.trips().filter((t) => t.status !== 'HUY');
    const sum = (f: (t: (typeof rows)[number]) => number) => rows.reduce((s, t) => s + f(t), 0);
    const cost = sum((t) => costTotal(t.costs));
    return {
      trips: rows.length,
      delivered: sum((t) => t.receivedValue),
      fuel: sum((t) => t.costs?.fuel ?? 0),
      toll: sum((t) => t.costs?.toll ?? 0),
      other: sum((t) => t.costs?.other ?? 0),
      cost,
      perTrip: rows.length ? Math.round(cost / rows.length) : 0,
    };
  });

  edit(): void {
    this.dialog().open(this.vehicle());
  }

  onSaved(e: { message: string }): void {
    this.notice.set(e.message);
  }

  async setStatus(status: VehicleStatus): Promise<void> {
    const v = this.vehicle() as Vehicle;
    this.failure.set('');
    try {
      await this.svc.setStatus(v.id, status);
    } catch (e) {
      this.failure.set(errorText(e));
      return;
    }
    this.notice.set(`Xe ${v.plateNumber}: ${VEHICLE_STATUS_LABEL[status].toLowerCase()}${status === 'DANG_DUNG' ? '' : ' — không chọn được khi tạo chuyến mới'}.`);
  }
}
