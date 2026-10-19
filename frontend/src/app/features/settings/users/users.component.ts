import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MockDataService } from '../../../core/services/mock-data.service';
import { DataTableComponent, DataTableColumn } from '../../../shared/data-table/data-table.component';
import { AppUser } from '../../../core/models/domain.models';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, DataTableComponent],
  templateUrl: './users.component.html',
})
export class UsersComponent {
  readonly columns: DataTableColumn<AppUser>[] = [
    { key: 'name', label: 'Họ tên / Email', format: (r) => `${r.name} — ${r.email}` },
    { key: 'roleId', label: 'Chức vụ', format: (r) => this.data.roles().find((role) => role.id === r.roleId)?.name ?? '' },
    { key: 'lastLoginAt', label: 'Đăng nhập gần nhất' },
    { key: 'status', label: 'Trạng thái', format: (r) => (r.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khoá') },
  ];

  constructor(readonly data: MockDataService) {}
}
