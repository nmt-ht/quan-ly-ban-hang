import { Component, ElementRef, computed, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MockDataService } from '../../../core/services/mock-data.service';
import { DeliveryTrip } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { isoDay } from '../../../shared/period';
import { PHONE_PATTERN } from '../../customers/customer.rules';
import { ACTIVE_TRIP } from '../delivery-trip.rules';
import { VEHICLE_TYPE_LABEL } from '../../vehicles/vehicle.rules';
import { DeliveryTripService, TripHeader } from '../delivery-trip.service';
import { errorText } from '../../../core/api/api.service';

const HIRED = '';

// "Tạo chuyến giao hàng" (and "Sửa thông tin chuyến"): ngày, xe của công ty hoặc xe thuê ngoài
// (gõ biển số), tài xế, điện thoại, ghi chú.
@Component({
  selector: 'app-trip-header-dialog',
  standalone: true,
  imports: [FormsModule, NavIconComponent],
  templateUrl: './trip-header-dialog.component.html',
  styleUrls: ['../../purchase-orders/receive-goods-dialog/receive-goods-dialog.component.scss', './trip-header-dialog.component.scss'],
})
export class TripHeaderDialogComponent {
  readonly saved = output<DeliveryTrip | string>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly editing = signal<DeliveryTrip | null>(null);
  readonly date = signal(isoDay(new Date()));
  readonly vehicleId = signal(HIRED);
  readonly plate = signal('');
  readonly driver = signal('');
  readonly phone = signal('');
  readonly note = signal('');
  readonly attempted = signal(false);
  /** Why the server refused the save (shown in the footer). */
  readonly error = signal('');

  constructor(
    readonly data: MockDataService,
    private readonly trips: DeliveryTripService,
  ) {}

  /** Each vehicle with what it is doing now ("đang ở chuyến CH…", "bảo trì"). */
  readonly vehicles = computed(() => {
    const active = this.data.deliveryTrips().filter((t) => ACTIVE_TRIP.includes(t.status) && t.vehicleId && t.id !== this.editing()?.id);
    return this.data.vehicles().map((v) => {
      const t = active.find((x) => x.vehicleId === v.id);
      const busy = t ? (t.status === 'DA_XUAT_KHO' ? `đang đi chuyến ${t.code}` : `đang ở chuyến ${t.code}`) : '';
      return { ...v, busy, typeLabel: v.name || VEHICLE_TYPE_LABEL[v.type], maintenance: v.status !== 'DANG_DUNG' };
    });
  });

  readonly vehicle = computed(() => this.vehicles().find((v) => v.id === this.vehicleId()));

  /** Tài xế gợi ý: tài xế thường chạy của các xe + tài xế đã từng chạy chuyến. */
  readonly driverSuggestions = computed(() => {
    const names = new Set<string>();
    for (const v of this.data.vehicles()) if (v.usualDriver) names.add(v.usualDriver);
    for (const t of this.data.deliveryTrips()) if (t.driverName) names.add(t.driverName);
    return [...names].sort((a, b) => a.localeCompare(b, 'vi'));
  });

  open(trip?: DeliveryTrip): void {
    this.editing.set(trip ?? null);
    this.date.set(trip?.date.slice(0, 10) ?? isoDay(new Date()));
    this.vehicleId.set(trip?.vehicleId ?? HIRED);
    this.plate.set(trip && !trip.vehicleId ? (trip.plateNumber ?? '') : '');
    this.driver.set(trip?.driverName ?? '');
    this.phone.set(trip?.driverPhone ?? '');
    this.note.set(trip?.note ?? '');
    this.attempted.set(false);
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  setVehicle(id: string): void {
    const prev = this.vehicle();
    this.vehicleId.set(id);
    const v = this.vehicle();
    // Tài xế thường chạy (và điện thoại) của xe, trừ khi người dùng đã gõ khác.
    if (v?.usualDriver && (!this.driver().trim() || this.driver() === prev?.usualDriver)) this.driver.set(v.usualDriver);
    if (v?.driverPhone && (!this.phone().trim() || this.phone() === prev?.driverPhone)) this.phone.set(v.driverPhone);
  }

  readonly issues = computed(() => {
    const out: string[] = [];
    if (!this.date()) out.push('Chọn ngày chuyến');
    if (this.vehicle()?.maintenance) out.push('Xe đang bảo trì / ngừng dùng — chọn xe khác');
    if (this.phone() && !PHONE_PATTERN.test(this.phone())) out.push('Số điện thoại tài xế không hợp lệ');
    return out;
  });

  async confirm(): Promise<void> {
    this.attempted.set(true);
    if (this.issues().length) return;
    this.error.set('');
    const h: TripHeader = {
      date: this.date(),
      vehicleId: this.vehicleId() || undefined,
      plateNumber: this.vehicleId() ? undefined : this.plate(),
      driverName: this.driver(),
      driverPhone: this.phone(),
      note: this.note(),
    };
    const t = this.editing();
    try {
      if (t) {
        await this.trips.updateHeader(t.id, h);
        this.close();
        this.saved.emit('Đã lưu thông tin chuyến.');
      } else {
        const created = await this.trips.create(h);
        this.close();
        this.saved.emit(created);
      }
    } catch (e) {
      this.error.set(errorText(e));
    }
  }
}
