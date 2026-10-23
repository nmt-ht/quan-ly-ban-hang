import { Component, ElementRef, computed, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataStore } from '../../../core/services/data-store.service';
import { Vehicle, VehicleStatus, VehicleType } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { PHONE_PATTERN } from '../../customers/customer.rules';
import { VEHICLE_STATUSES, VEHICLE_TYPES } from '../vehicle.rules';
import { VehicleService } from '../vehicle.service';
import { errorText } from '../../../core/api/api.service';

// "Thêm xe" / "Sửa xe <biển số>" — same fields as production.
@Component({
  selector: 'app-vehicle-dialog',
  standalone: true,
  imports: [FormsModule, NavIconComponent],
  templateUrl: './vehicle-dialog.component.html',
  styleUrls: [
    '../../purchase-orders/receive-goods-dialog/receive-goods-dialog.component.scss',
    '../../delivery-trips/trip-header-dialog/trip-header-dialog.component.scss',
    './vehicle-dialog.component.scss',
  ],
})
export class VehicleDialogComponent {
  readonly saved = output<{ vehicle?: Vehicle; message: string }>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly types = VEHICLE_TYPES;
  readonly statuses = VEHICLE_STATUSES;

  readonly editing = signal<Vehicle | null>(null);
  readonly plate = signal('');
  readonly name = signal('');
  readonly type = signal<VehicleType>('XE_TAI');
  readonly capacity = signal<number | null>(null);
  readonly status = signal<VehicleStatus>('DANG_DUNG');
  readonly regExpiry = signal('');
  readonly insExpiry = signal('');
  readonly driverUserId = signal('');
  readonly driverName = signal('');
  readonly driverPhone = signal('');
  readonly note = signal('');
  readonly attempted = signal(false);

  constructor(
    readonly data: DataStore,
    private readonly svc: VehicleService,
  ) {}

  readonly userOptions = computed(() => {
    const roles = new Map(this.data.roles().map((r) => [r.id, r.name]));
    return this.data.users()
      .filter((u) => u.status === 'ACTIVE' || u.id === this.driverUserId())
      .map((u) => ({ id: u.id, label: `${u.name} — ${roles.get(u.roleId) ?? ''}` }));
  });

  readonly duplicate = computed(() => this.svc.duplicatePlate(this.plate(), this.editing()?.id ?? null));

  open(v?: Vehicle): void {
    this.editing.set(v ?? null);
    this.plate.set(v?.plateNumber ?? '');
    this.name.set(v?.name ?? '');
    this.type.set(v?.type ?? 'XE_TAI');
    this.capacity.set(v?.loadCapacity ?? null);
    this.status.set(v?.status ?? 'DANG_DUNG');
    this.regExpiry.set(v?.registrationExpiry ?? '');
    this.insExpiry.set(v?.insuranceExpiry ?? '');
    this.driverUserId.set(v?.driverUserId ?? '');
    this.driverName.set(v?.driverUserId ? '' : (v?.usualDriver ?? ''));
    this.driverPhone.set(v?.driverPhone ?? '');
    this.note.set(v?.note ?? '');
    this.attempted.set(false);
    this.dialog().nativeElement.showModal();
    setTimeout(() => document.getElementById('vd-plate')?.focus());
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  readonly issues = computed(() => {
    const out: string[] = [];
    if (!this.plate().trim()) out.push('Nhập biển số');
    else if (this.duplicate()) out.push(`Biển số đã có: ${this.duplicate()!.code}`);
    if ((this.capacity() ?? 0) < 0) out.push('Tải trọng không được âm');
    if (this.driverPhone() && !PHONE_PATTERN.test(this.driverPhone())) out.push('Số điện thoại không hợp lệ');
    return out;
  });

  async confirm(): Promise<void> {
    this.attempted.set(true);
    if (this.issues().length) return;
    const draft = {
      plateNumber: this.plate(),
      name: this.name(),
      type: this.type(),
      loadCapacity: this.capacity() ?? undefined,
      status: this.status(),
      registrationExpiry: this.regExpiry(),
      insuranceExpiry: this.insExpiry(),
      driverUserId: this.driverUserId() || undefined,
      usualDriver: this.driverName(),
      driverPhone: this.driverPhone(),
      note: this.note(),
    };
    const v = this.editing();
    this.error.set('');
    try {
      if (v) {
        await this.svc.update(v.id, draft);
        this.close();
        this.saved.emit({ message: `Đã lưu xe ${draft.plateNumber.trim().toUpperCase()}.` });
      } else {
        const created = await this.svc.create(draft);
        this.close();
        this.saved.emit({ vehicle: created, message: `Đã thêm xe ${created.plateNumber} (${created.code}).` });
      }
    } catch (e) {
      this.error.set(errorText(e));
    }
  }

  /** Why the server refused the save (shown in the footer). */
  readonly error = signal('');
}
