import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../core/services/mock-data.service';
import { DataTableComponent, DataTableColumn } from '../../shared/data-table/data-table.component';
import { Customer } from '../../core/models/domain.models';

const TYPE_LABEL: Record<Customer['type'], string> = { LE: 'Lẻ', SI: 'Sỉ', DROPSHIP: 'Dropship' };

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, RouterLink, DataTableComponent],
  templateUrl: './customers.component.html',
})
export class CustomersComponent {
  readonly columns: DataTableColumn<Customer>[] = [
    { key: 'code', label: 'Mã / Tên', format: (r) => `${r.code} — ${r.name}` },
    { key: 'type', label: 'Loại', format: (r) => TYPE_LABEL[r.type] },
    { key: 'phone', label: 'Liên hệ' },
    { key: 'companyTaxCode', label: 'Mã số thuế' },
    { key: 'orderCount', label: 'Đơn hàng', align: 'right' },
    { key: 'isActive', label: 'Trạng thái', format: (r) => (r.isActive ? 'Đang theo dõi' : 'Ngừng theo dõi') },
  ];

  constructor(readonly data: MockDataService) {}
}
