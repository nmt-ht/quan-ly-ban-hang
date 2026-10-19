import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../core/services/mock-data.service';
import { DataTableComponent, DataTableColumn } from '../../shared/data-table/data-table.component';
import { SalesOrder } from '../../core/models/domain.models';
import { formatVnd } from '../../shared/format.util';
import { SALES_ORDER_STATUS_LABEL, salesOrderStatusClass } from '../../shared/status-labels';

@Component({
  selector: 'app-sales-orders',
  standalone: true,
  imports: [CommonModule, RouterLink, DataTableComponent],
  templateUrl: './sales-orders.component.html',
})
export class SalesOrdersComponent {
  readonly columns: DataTableColumn<SalesOrder>[] = [
    { key: 'code', label: 'Mã đơn' },
    { key: 'customerId', label: 'Khách hàng', format: (r) => this.data.customers().find((c) => c.id === r.customerId)?.name ?? r.customerId },
    { key: 'orderDate', label: 'Ngày đặt' },
    { key: 'status', label: 'Trạng thái', format: (r) => SALES_ORDER_STATUS_LABEL[r.status], badge: (r) => salesOrderStatusClass(r.status) },
    { key: 'receivedValue', label: 'Khách nhận', align: 'right', format: (r) => (r.receivedValue ? formatVnd(r.receivedValue) : '—') },
    { key: 'totalOrder', label: 'Tổng đơn', align: 'right', format: (r) => formatVnd(r.totalOrder) },
  ];

  constructor(readonly data: MockDataService) {}
}
