import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';
import { AppUser } from '../../../core/models/domain.models';
import { DataTableColumn, DataTableComponent } from '../../../shared/data-table/data-table.component';
import { FilterMultiSelectComponent, FilterOption } from '../../../shared/filter-multi-select/filter-multi-select.component';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { ColumnFilters, applyColumnFilters } from '../../../shared/column-filter';
import { ColumnSort, sortByColumn } from '../../../shared/column-sort';
import { foldVi } from '../../../shared/format.util';
import { tagClass } from '../../../shared/tag-class';
import { downloadWorkbook, exportFileName } from '../../../shared/excel.util';
import { UserService } from './user.service';
import { UserDialogComponent } from './user-dialog/user-dialog.component';
import { PasswordDialogComponent } from './password-dialog/password-dialog.component';
import { AllowedLinkDirective } from '../../../shared/allowed-link.directive';
import { errorText } from '../../../core/api/api.service';

export const USER_STATUS_LABEL = { ACTIVE: 'Đang hoạt động', DISABLED: 'Đã khoá' } as const;
const IDLE_DAYS = 30;

/** dd/mm/yyyy hh:mm, local time. */
export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : iso.replace('T', ' '));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, AllowedLinkDirective, DataTableComponent, FilterMultiSelectComponent, PaginationComponent, NavIconComponent,
    UserDialogComponent, PasswordDialogComponent,
  ],
  templateUrl: './users.component.html',
})
export class UsersComponent {
  readonly data = inject(MockDataService);
  readonly svc = inject(UserService);
  private readonly userDialog = viewChild.required<UserDialogComponent>('userDialog');
  private readonly passwordDialog = viewChild.required<PasswordDialogComponent>('passwordDialog');

  readonly search = signal('');
  readonly roles = signal<string[]>([]);
  readonly status = signal<'all' | 'ACTIVE' | 'DISABLED'>('all');
  readonly online = signal(false);
  readonly idle = signal(false);
  readonly columnFilters = signal<ColumnFilters>({});
  // Clicking a column header sorts; again reverses; a third click goes back to the default order.
  readonly headerSort = signal<ColumnSort | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly notice = signal('');
  readonly error = signal('');
  readonly exporting = signal(false);
  readonly lockTarget = signal<AppUser | null>(null);
  readonly lockReason = signal('');

  private readonly roleById = computed(() => new Map(this.data.roles().map((r) => [r.id, r])));
  private readonly idleSince = new Date(Date.now() - IDLE_DAYS * 86_400_000).toISOString();

  readonly roleOptions = computed<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const u of this.data.users()) counts.set(u.roleId, (counts.get(u.roleId) ?? 0) + 1);
    return this.data.roles().map((r) => ({ value: r.id, label: r.name, count: counts.get(r.id) ?? 0 }));
  });

  /** Active but unused for 30+ days (a new account that hasn't logged in yet is not "idle"). */
  isIdle(u: AppUser): boolean {
    if (u.status !== 'ACTIVE') return false;
    const since = u.lastLoginAt ?? u.createdAt;
    return !!since && since < this.idleSince;
  }

  readonly users = computed(() => {
    const q = foldVi(this.search().trim());
    const rows = this.data.users().filter((u) => {
      if (q && !foldVi(`${u.name} ${u.email} ${u.phone ?? ''}`).includes(q)) return false;
      if (this.roles().length && !this.roles().includes(u.roleId)) return false;
      if (this.status() !== 'all' && u.status !== this.status()) return false;
      if (this.online() && !u.openSessions) return false;
      if (this.idle() && !this.isIdle(u)) return false;
      return true;
    });
    // Active first, then by role order, then name (as an org chart reads).
    const order = new Map(this.data.roles().map((r, i) => [r.id, i]));
    rows.sort((a, b) =>
      (a.status === b.status ? 0 : a.status === 'ACTIVE' ? -1 : 1) ||
      (order.get(a.roleId) ?? 99) - (order.get(b.roleId) ?? 99) || a.name.localeCompare(b.name, 'vi'));
    return sortByColumn(applyColumnFilters(rows, this.columns, this.columnFilters()), this.columns, this.headerSort());
  });

  readonly paged = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.users().slice(start, start + this.pageSize());
  });

  readonly summary = computed(() => {
    const all = this.data.users();
    return {
      active: all.filter((u) => u.status === 'ACTIVE').length,
      locked: all.filter((u) => u.status === 'DISABLED').length,
      sessions: all.reduce((s, u) => s + u.openSessions, 0),
      idle: all.filter((u) => this.isIdle(u)).length,
      mustChange: all.filter((u) => u.mustChangePassword && u.status === 'ACTIVE').length,
    };
  });

  readonly columns: DataTableColumn<AppUser>[] = [
    { key: 'name', label: 'Họ tên', link: (r) => ['/thiet-lap/nguoi-dung', r.id], format: (r) => r.name + (this.svc.isMe(r) ? ' (bạn)' : '') },
    { key: 'email', label: 'Email', copy: true, mono: true },
    { key: 'roleId', sortByText: true, label: 'Chức vụ', format: (r) => this.roleById().get(r.roleId)?.name ?? r.roleId },
    { key: 'phone', label: 'Điện thoại', format: (r) => r.phone || '—', mono: true },
    {
      key: 'lastLoginAt', label: 'Đăng nhập gần nhất',
      format: (r) => (r.lastLoginAt ? formatDateTime(r.lastLoginAt) : 'Chưa đăng nhập') + (this.isIdle(r) ? ' · lâu không dùng' : ''),
      mono: true,
    },
    { key: 'openSessions', label: 'Phiên mở', align: 'right', format: (r) => (r.openSessions ? `${r.openSessions} phiên` : '—'), filterValue: (r) => r.openSessions },
    {
      key: 'status', label: 'Trạng thái',
      format: (r) => USER_STATUS_LABEL[r.status] + (r.status === 'ACTIVE' && r.mustChangePassword ? ' · chờ đổi mật khẩu' : ''),
      badge: (r) => tagClass('user-status', r.status), filterValue: (r) => USER_STATUS_LABEL[r.status],
    },
  ];

  constructor() {
    effect(() => {
      this.users();
      untracked(() => this.page.set(1));
    });
  }

  openCreate(): void {
    this.userDialog().open();
  }

  openEdit(u: AppUser): void {
    this.userDialog().open(u);
  }

  openPassword(u: AppUser): void {
    this.passwordDialog().open(u);
  }

  onSaved(e: { message: string }): void {
    this.error.set('');
    this.notice.set(e.message);
  }

  canLock(u: AppUser): boolean {
    return u.status === 'ACTIVE' && !this.svc.isMe(u) && !this.svc.isLastAdmin(u);
  }

  askLock(u: AppUser): void {
    this.lockTarget.set(u);
    this.lockReason.set('');
  }

  async doLock(): Promise<void> {
    const u = this.lockTarget()!;
    try {
      await this.svc.lock(u.id, this.lockReason());
      this.notice.set(`Đã khoá ${u.name} — mọi phiên đã đăng xuất; chứng từ do người này lập vẫn giữ nguyên.`);
    } catch (e) {
      this.error.set(errorText(e));
    }
    this.lockTarget.set(null);
  }

  async unlock(u: AppUser): Promise<void> {
    try {
      await this.svc.unlock(u.id);
    } catch (e) {
      this.error.set(errorText(e));
      return;
    }
    this.notice.set(`Đã mở khoá ${u.name}.`);
  }

  clearAll(): void {
    this.search.set('');
    this.roles.set([]);
    this.status.set('all');
    this.online.set(false);
    this.idle.set(false);
    this.columnFilters.set({});
  }

  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      await downloadWorkbook(exportFileName('Người dùng'), [{
        name: 'Người dùng',
        columns: [
          { header: 'Họ tên', width: 24 }, { header: 'Email', width: 30 }, { header: 'Chức vụ', width: 20 }, { header: 'Điện thoại', width: 13 },
          { header: 'Đăng nhập gần nhất', width: 18 }, { header: 'Phiên đang mở', width: 13 }, { header: 'Trạng thái', width: 15 },
          { header: 'Đổi mật khẩu gần nhất', width: 18 },
        ],
        rows: this.users().map((u) => [
          u.name, u.email, this.roleById().get(u.roleId)?.name ?? '', u.phone ?? '', u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '',
          u.openSessions, USER_STATUS_LABEL[u.status], u.passwordUpdatedAt ? formatDateTime(u.passwordUpdatedAt) : '',
        ]),
      }]);
    } finally {
      this.exporting.set(false);
    }
  }
}
