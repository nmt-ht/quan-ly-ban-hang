import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MockDataService } from '../../../core/services/mock-data.service';
import { Role } from '../../../core/models/domain.models';

@Component({
  selector: 'app-roles-permissions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './roles-permissions.component.html',
})
export class RolesPermissionsComponent {
  readonly selectedRole;

  constructor(readonly data: MockDataService) {
    this.selectedRole = signal<Role>(this.data.roles()[0]);
  }

  select(role: Role): void {
    this.selectedRole.set(role);
  }

  // Demo simplification: CEO (first role, isSystem) is granted every permission;
  // other roles show an even split across modules to illustrate the matrix.
  hasPermission(index: number): boolean {
    const role = this.selectedRole();
    if (role.isSystem) return true;
    return index % 2 === 0;
  }
}
