import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MockDataService } from '../../core/services/mock-data.service';
import { DataTableComponent, DataTableColumn } from '../../shared/data-table/data-table.component';
import { DeliveryTrip } from '../../core/models/domain.models';
import { formatVnd } from '../../shared/format.util';
import { DELIVERY_TRIP_STATUS_LABEL } from '../../shared/status-labels';

@Component({
  selector: 'app-delivery-trips',
  standalone: true,
  imports: [CommonModule, DataTableComponent],
  templateUrl: './delivery-trips.component.html',
})
export class DeliveryTripsComponent {
  readonly columns: DataTableColumn<DeliveryTrip>[] = [
    { key: 'code', label: 'Mã chuyến' },
    { key: 'date', label: 'Ngày' },
    { key: 'driverName', label: 'Tài xế' },
    { key: 'plateNumber', label: 'Biển số' },
    { key: 'status', label: 'Trạng thái', format: (r) => DELIVERY_TRIP_STATUS_LABEL[r.status] },
    { key: 'orderIds', label: 'Đơn', format: (r) => `${r.confirmedCount}/${r.orderIds.length}` },
    { key: 'totalValue', label: 'Giá trị', align: 'right', format: (r) => formatVnd(r.totalValue) },
    { key: 'receivedValue', label: 'Khách nhận', align: 'right', format: (r) => (r.receivedValue ? formatVnd(r.receivedValue) : '—') },
  ];

  constructor(readonly data: MockDataService) {}
}
