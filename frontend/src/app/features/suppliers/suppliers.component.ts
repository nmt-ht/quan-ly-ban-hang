import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MockDataService } from '../../core/services/mock-data.service';
import { DataTableComponent, DataTableColumn } from '../../shared/data-table/data-table.component';
import { Supplier } from '../../core/models/domain.models';

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [CommonModule, DataTableComponent],
  templateUrl: './suppliers.component.html',
})
export class SuppliersComponent {
  readonly columns: DataTableColumn<Supplier>[] = [
    { key: 'code', label: 'Mã / Tên', format: (r) => `${r.code} — ${r.name}` },
    { key: 'contactPhone', label: 'Liên hệ' },
    { key: 'taxCode', label: 'Mã số thuế' },
    { key: 'address', label: 'Địa chỉ' },
    { key: 'productCount', label: 'Mặt hàng', align: 'right' },
    { key: 'purchaseOrderCount', label: 'Đơn nhập', align: 'right' },
    { key: 'isActive', label: 'Trạng thái', format: (r) => (r.isActive ? 'Còn hợp tác' : 'Ngừng hợp tác') },
  ];

  constructor(readonly data: MockDataService) {}
}
