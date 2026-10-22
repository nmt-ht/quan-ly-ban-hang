import { Injectable, inject } from '@angular/core';
import { MockDataService } from '../../core/services/mock-data.service';
import { Vehicle, VehicleStatus } from '../../core/models/domain.models';
import { nextCode } from '../purchase-orders/purchase-order.rules';
import { ApiService, upsertById } from '../../core/api/api.service';
import { CATALOG_FROM_API } from '../../core/api/api.config';

export type VehicleDraft = Omit<Vehicle, 'id' | 'code' | 'createdAt' | 'updatedAt'>;

/** Biển số so khớp không phân biệt dấu chấm, gạch, khoảng trắng, hoa thường. */
export const plateKey = (p: string) => p.replace(/[\s.\-]/g, '').toUpperCase();

// All writes for Danh mục xe: the API (CATALOG_FROM_API) or, in demo mode, the in-browser store.
@Injectable({ providedIn: 'root' })
export class VehicleService {
  private readonly api = inject(ApiService);

  constructor(private readonly data: MockDataService) {}

  duplicatePlate(plate: string, selfId: string | null): Vehicle | undefined {
    const k = plateKey(plate);
    return k ? this.data.vehicles().find((v) => v.id !== selfId && plateKey(v.plateNumber) === k) : undefined;
  }

  async create(d: VehicleDraft): Promise<Vehicle> {
    if (CATALOG_FROM_API) return this.keep(await this.api.post<Vehicle>('/vehicles', this.clean(d)));
    const now = new Date().toISOString();
    const v: Vehicle = {
      ...this.clean(d),
      id: crypto.randomUUID(),
      code: nextCode(this.data.vehicles().map((x) => x.code), 'XE'),
      createdAt: now,
      updatedAt: now,
    };
    this.data.vehicles.update((list) => [...list, v]);
    return v;
  }

  async update(id: string, d: VehicleDraft): Promise<void> {
    if (CATALOG_FROM_API) {
      this.keep(await this.api.put<Vehicle>(`/vehicles/${id}`, this.clean(d)));
      return;
    }
    this.patch(id, this.clean(d));
  }

  /** Bảo trì / Ngừng dùng là đổi tình trạng, không xoá: lịch sử chuyến và chi phí vẫn giữ. */
  async setStatus(id: string, status: VehicleStatus): Promise<void> {
    if (CATALOG_FROM_API) {
      this.keep(await this.api.patch<Vehicle>(`/vehicles/${id}/status`, { status }));
      return;
    }
    this.patch(id, { status });
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

  private patch(id: string, changes: Partial<Vehicle>): void {
    if (!this.data.vehicles().some((v) => v.id === id)) throw new Error(`Không tìm thấy xe ${id}`);
    const updatedAt = new Date().toISOString();
    this.data.vehicles.update((list) => list.map((v) => (v.id === id ? { ...v, ...changes, updatedAt } : v)));
  }
}
