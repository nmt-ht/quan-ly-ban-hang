import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MockDataService } from '../../core/services/mock-data.service';
import { DataTableComponent, DataTableColumn } from '../../shared/data-table/data-table.component';
import { PurchaseOrder } from '../../core/models/domain.models';
import { formatVnd } from '../../shared/format.util';
import { PURCHASE_ORDER_STATUS_LABEL, purchaseOrderStatusClass } from '../../shared/status-labels';

@Component({
  selector: 'app-purchase-orders',
  standalone: true,
  imports: [CommonModule, DataTableComponent],
  templateUrl: './purchase-orders.component.html',
})
export class PurchaseOrdersComponent {
  readonly columns: DataTableColumn<PurchaseOrder>[] = [
    { key: 'code', label: 'Mã đơn' },
    { key: 'supplierId', label: 'Nhà cung cấp', format: (r) => this.data.suppliers().find((s) => s.id === r.supplierId)?.name ?? r.supplierId },
    { key: 'date', label: 'Ngày' },
    { key: 'status', label: 'Trạng thái', format: (r) => PURCHASE_ORDER_STATUS_LABEL[r.status], badge: (r) => purchaseOrderStatusClass(r.status) },
    { key: 'totalValue', label: 'Giá trị', align: 'right', format: (r) => formatVnd(r.totalValue) },
    { key: 'receivedValue', label: 'Đã nhận', align: 'right', format: (r) => (r.receivedValue ? formatVnd(r.receivedValue) : '—') },
  ];

  constructor(readonly data: MockDataService) {}
}
