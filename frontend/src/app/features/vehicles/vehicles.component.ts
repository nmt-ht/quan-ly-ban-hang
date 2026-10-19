import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MockDataService } from '../../core/services/mock-data.service';
import { DataTableComponent, DataTableColumn } from '../../shared/data-table/data-table.component';
import { Vehicle } from '../../core/models/domain.models';

@Component({
  selector: 'app-vehicles',
  standalone: true,
  imports: [CommonModule, DataTableComponent],
  templateUrl: './vehicles.component.html',
})
export class VehiclesComponent {
  readonly columns: DataTableColumn<Vehicle>[] = [
    { key: 'plateNumber', label: 'Xe', format: (r) => `${r.plateNumber} — ${r.code}` },
    { key: 'type', label: 'Loại' },
    { key: 'loadCapacity', label: 'Tải trọng', align: 'right' },
    { key: 'usualDriver', label: 'Tài xế thường chạy' },
    { key: 'currentTripCode', label: 'Tình trạng', format: (r) => (r.currentTripCode ? `Đang dùng — ${r.currentTripCode}` : 'Rảnh') },
  ];

  constructor(readonly data: MockDataService) {}
}
