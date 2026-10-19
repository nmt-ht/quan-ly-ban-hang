import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MockDataService } from '../../core/services/mock-data.service';
import { DataTableComponent, DataTableColumn } from '../../shared/data-table/data-table.component';
import { WarehouseVoucher } from '../../core/models/domain.models';

@Component({
  selector: 'app-warehouse-vouchers',
  standalone: true,
  imports: [CommonModule, DataTableComponent],
  templateUrl: './warehouse-vouchers.component.html',
})
export class WarehouseVouchersComponent {
  readonly menuOpen = signal(false);
  readonly voucherTypes = [
    { key: 'NHAP', label: 'Phiếu nhập kho' },
    { key: 'XUAT', label: 'Phiếu xuất kho' },
    { key: 'CHUYEN', label: 'Phiếu chuyển kho' },
    { key: 'KIEM_KE', label: 'Phiếu kiểm kê' },
  ];

  readonly columns: DataTableColumn<WarehouseVoucher>[] = [
    { key: 'code', label: 'Số phiếu' },
    { key: 'date', label: 'Ngày' },
    { key: 'type', label: 'Loại' },
    { key: 'reason', label: 'Lý do' },
    { key: 'createdBy', label: 'Người lập' },
  ];

  constructor(readonly data: MockDataService) {}
}
