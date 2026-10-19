import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MockDataService } from '../../../core/services/mock-data.service';
import { DataTableComponent, DataTableColumn } from '../../../shared/data-table/data-table.component';
import { Tag } from '../../../core/models/domain.models';

@Component({
  selector: 'app-tags',
  standalone: true,
  imports: [CommonModule, DataTableComponent],
  templateUrl: './tags.component.html',
})
export class TagsComponent {
  readonly columns: DataTableColumn<Tag>[] = [
    { key: 'name', label: 'Thẻ' },
    { key: 'sortOrder', label: 'Thứ tự', align: 'right' },
    { key: 'orderCount', label: 'Đơn hàng', align: 'right' },
    { key: 'customerCount', label: 'Khách hàng', align: 'right' },
    { key: 'isActive', label: 'Trạng thái', format: (r) => (r.isActive ? 'Đang dùng' : 'Ngừng dùng') },
  ];

  constructor(readonly data: MockDataService) {}
}
