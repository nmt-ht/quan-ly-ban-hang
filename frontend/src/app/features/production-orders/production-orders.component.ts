import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../core/services/mock-data.service';
import { DataTableComponent, DataTableColumn } from '../../shared/data-table/data-table.component';
import { ProductionOrder } from '../../core/models/domain.models';
import { PRODUCTION_ORDER_STATUS_LABEL, productionOrderStatusClass } from '../../shared/status-labels';

@Component({
  selector: 'app-production-orders',
  standalone: true,
  imports: [CommonModule, RouterLink, DataTableComponent],
  templateUrl: './production-orders.component.html',
})
export class ProductionOrdersComponent {
  readonly columns: DataTableColumn<ProductionOrder>[] = [
    { key: 'code', label: 'Mã lệnh' },
    { key: 'productId', label: 'Thành phẩm', format: (r) => this.data.products().find((p) => p.id === r.productId)?.name ?? r.productId },
    { key: 'sourceOrderId', label: 'Đơn bán', format: (r) => this.data.salesOrders().find((o) => o.id === r.sourceOrderId)?.code ?? r.sourceOrderId },
    { key: 'quantity', label: 'Số lượng', align: 'right' },
    { key: 'status', label: 'Trạng thái', format: (r) => PRODUCTION_ORDER_STATUS_LABEL[r.status], badge: (r) => productionOrderStatusClass(r.status) },
    { key: 'createdDate', label: 'Ngày tạo' },
  ];

  constructor(readonly data: MockDataService) {}
}
