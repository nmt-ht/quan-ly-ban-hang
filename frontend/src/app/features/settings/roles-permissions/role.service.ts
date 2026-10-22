import { Injectable, inject } from '@angular/core';
import { ALL_PERMISSION_CODES } from '../../../core/data/permission-catalog';
import { Role } from '../../../core/models/domain.models';
import { MockDataService } from '../../../core/services/mock-data.service';
import { foldVi } from '../../../shared/format.util';
import { roleNameTaken } from './role.rules';

export interface RoleDraft {
  name: string;
  description: string;
}

// All writes for Thiết lập › Chức vụ & phân quyền. Against the mock store today; maps to the
// backend position endpoints later. Chức vụ hệ thống (CEO) is read-only; roles are switched off
// (Ngừng dùng), never deleted, so accounts and history keep their meaning.
@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly data = inject(MockDataService);

  find(id: string): Role {
    const r = this.data.roles().find((x) => x.id === id);
    if (!r) throw new Error('Không tìm thấy chức vụ.');
    return r;
  }

  private check(d: RoleDraft, id: string | null): RoleDraft {
    const name = d.name.trim();
    if (!name) throw new Error('Nhập tên chức vụ.');
    if (name.length > 60) throw new Error('Tên chức vụ tối đa 60 ký tự.');
    if (roleNameTaken(this.data.roles(), id, name, foldVi)) throw new Error(`Đã có chức vụ "${name}".`);
    return { name, description: d.description.trim() };
  }

  private patch(id: string, change: (r: Role) => Role): void {
    this.data.roles.update((list) => list.map((r) => (r.id === id ? change(r) : r)));
  }

  create(d: RoleDraft, copyFromId?: string): Role {
    const clean = this.check(d, null);
    const permissions = copyFromId ? [...this.find(copyFromId).permissions] : [];
    const role: Role = {
      id: 'role-' + crypto.randomUUID().slice(0, 8), ...clean, isSystem: false, userCount: 0,
      permissions, permissionCount: permissions.length, totalPermissionCount: ALL_PERMISSION_CODES.length, isActive: true,
    };
    this.data.roles.update((list) => [...list, role]);
    return role;
  }

  update(id: string, d: RoleDraft): void {
    if (this.find(id).isSystem) throw new Error('Chức vụ hệ thống không sửa được.');
    const clean = this.check(d, id);
    this.patch(id, (r) => ({ ...r, ...clean }));
  }

  setPermissions(id: string, codes: Iterable<string>): void {
    if (this.find(id).isSystem) throw new Error('Chức vụ hệ thống không sửa được quyền.');
    const known = new Set(ALL_PERMISSION_CODES);
    const permissions = [...new Set(codes)].filter((c) => known.has(c));
    this.patch(id, (r) => ({ ...r, permissions, permissionCount: permissions.length }));
  }

  setActive(id: string, isActive: boolean): void {
    if (this.find(id).isSystem) throw new Error('Chức vụ hệ thống luôn đang dùng.');
    this.patch(id, (r) => ({ ...r, isActive }));
  }
}
