import { Injectable, inject } from '@angular/core';
import { DataStore } from '../../core/services/data-store.service';
import { Vehicle, VehicleStatus } from '../../core/models/domain.models';
import { ApiService, upsertById } from '../../core/api/api.service';

export type VehicleDraft = Omit<Vehicle, 'id' | 'code' | 'createdAt' | 'updatedAt'>;

/** Biển số so khớp không phân biệt dấu chấm, gạch, khoảng trắng, hoa thường. */
export const plateKey = (p: string) => p.replace(/[\s.\-]/g, '').toUpperCase();

// All writes for Danh mục xe go through the API.
@Injectable({ providedIn: 'root' })
export class VehicleService {
  private readonly api = inject(ApiService);

  constructor(private readonly data: DataStore) {}

  duplicatePlate(plate: string, selfId: string | null): Vehicle | undefined {
    const k = plateKey(plate);
    return k ? this.data.vehicles().find((v) => v.id !== selfId && plateKey(v.plateNumber) === k) : undefined;
  }

  async create(d: VehicleDraft): Promise<Vehicle> {
    return this.keep(await this.api.post<Vehicle>('/vehicles', this.clean(d)));
  }

  async update(id: string, d: VehicleDraft): Promise<void> {
    this.keep(await this.api.put<Vehicle>(`/vehicles/${id}`, this.clean(d)));
  }

  /** Bảo trì / Ngừng dùng là đổi tình trạng, không xoá: lịch sử chuyến và chi phí vẫn giữ. */
  async setStatus(id: string, status: VehicleStatus): Promise<void> {
    this.keep(await this.api.patch<Vehicle>(`/vehicles/${id}/status`, { status }));
  }

  private keep(v: Vehicle): Vehicle {
    this.data.vehicles.update((list) => upsertById(list, v, true));
    return v;
  }

  private clean(d: VehicleDraft): VehicleDraft {
    const user = d.driverUserId ? this.data.users().find((u) => u.id === d.driverUserId) : undefined;
    return {
      ...d,
      plateNumber: d.plateNumber.trim().toUpperCase(),
      name: d.name?.trim() || undefined,
      // Gắn nhân viên thì tên tài xế là tên nhân viên; không thì tên gõ tay (người lái thuê ngoài).
      driverUserId: user?.id,
      usualDriver: user?.name ?? (d.usualDriver?.trim() || undefined),
      driverPhone: d.driverPhone?.trim() || undefined,
      note: d.note?.trim() || undefined,
      loadCapacity: d.loadCapacity || undefined,
      registrationExpiry: d.registrationExpiry || undefined,
      insuranceExpiry: d.insuranceExpiry || undefined,
    };
  }
}
