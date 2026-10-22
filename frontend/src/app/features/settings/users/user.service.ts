import { Injectable, inject } from '@angular/core';
import { MockDataService } from '../../../core/services/mock-data.service';
import { AuthService } from '../../../core/services/auth.service';
import { AppUser, Role } from '../../../core/models/domain.models';
import { ApiService, upsertById } from '../../../core/api/api.service';
import { CATALOG_FROM_API } from '../../../core/api/api.config';

export interface UserDraft {
  name: string;
  email: string;
  roleId: string;
  phone?: string;
  note?: string;
}

export const SYSTEM_ROLE = 'role-ceo';
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mật khẩu: từ 8 ký tự, có cả chữ và số (production's rule). Empty string = OK. */
export function passwordIssue(pw: string): string {
  if (pw.length < 8) return 'Mật khẩu từ 8 ký tự';
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'Mật khẩu phải có cả chữ và số';
  return '';
}

/** Random temporary password (no look-alike characters), always letters + digits. */
export function generatePassword(length = 10): string {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = letters + digits;
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  const chars = [...bytes].map((b) => all[b % all.length]);
  chars[0] = letters[bytes[0] % letters.length];
  chars[length - 1] = digits[bytes[length - 1] % digits.length];
  return chars.join('');
}

// All writes for Thiết lập › Người dùng: the API (CATALOG_FROM_API), where the password is sent once
// and stored hashed — never kept in the frontend store; or, in demo mode, the in-browser store.
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = inject(ApiService);

  constructor(
    private readonly data: MockDataService,
    private readonly auth: AuthService,
  ) {}

  get myEmail(): string {
    return this.auth.user()?.email ?? '';
  }

  isMe(u: AppUser): boolean {
    return u.email.toLowerCase() === this.myEmail.toLowerCase();
  }

  duplicateEmail(email: string, selfId: string | null): AppUser | undefined {
    const e = email.trim().toLowerCase();
    return e ? this.data.users().find((u) => u.id !== selfId && u.email.toLowerCase() === e) : undefined;
  }

  /** The last active account holding the system role (CEO) must stay active and keep the role. */
  isLastAdmin(u: AppUser): boolean {
    return u.roleId === SYSTEM_ROLE && u.status === 'ACTIVE' &&
      !this.data.users().some((x) => x.id !== u.id && x.roleId === SYSTEM_ROLE && x.status === 'ACTIVE');
  }

  async create(d: UserDraft, password: string): Promise<AppUser> {
    const issue = passwordIssue(password);
    if (issue) throw new Error(issue);
    if (this.duplicateEmail(d.email, null)) throw new Error('Email đã được dùng');
    if (CATALOG_FROM_API) return this.keep(await this.api.post<AppUser>('/users', { ...this.clean(d), password }));
    const now = new Date().toISOString();
    const u: AppUser = {
      ...this.clean(d), id: crypto.randomUUID(), status: 'ACTIVE', openSessions: 0, createdAt: now, updatedAt: now,
      passwordUpdatedAt: now, mustChangePassword: true,
    };
    this.data.users.update((list) => [...list, u]);
    this.syncRoleCounts();
    return u;
  }

  async update(id: string, d: UserDraft): Promise<void> {
    const u = this.find(id);
    if (d.roleId !== u.roleId && this.isLastAdmin(u)) throw new Error('Đây là tài khoản CEO cuối cùng — không đổi chức vụ được.');
    if (CATALOG_FROM_API) {
      this.keep(await this.api.put<AppUser>(`/users/${id}`, this.clean(d)));
      return;
    }
    this.patch(id, this.clean(d));
    this.syncRoleCounts();
  }

  /** Khoá: không xoá tài khoản (chứng từ vẫn đứng tên), đăng xuất mọi phiên, không đăng nhập được nữa. */
  async lock(id: string, reason: string): Promise<void> {
    const u = this.find(id);
    if (this.isMe(u)) throw new Error('Không tự khoá tài khoản của mình.');
    if (this.isLastAdmin(u)) throw new Error('Đây là tài khoản CEO cuối cùng — không khoá được.');
    if (CATALOG_FROM_API) {
      this.keep(await this.api.post<AppUser>(`/users/${id}/lock`, { reason }));
      return;
    }
    this.patch(id, { status: 'DISABLED', openSessions: 0, lockedAt: new Date().toISOString(), lockedReason: reason.trim() || undefined });
  }

  async unlock(id: string): Promise<void> {
    if (CATALOG_FROM_API) {
      this.keep(await this.api.post<AppUser>(`/users/${id}/unlock`));
      return;
    }
    this.patch(id, { status: 'ACTIVE', lockedAt: undefined, lockedReason: undefined });
  }

  /** Đặt lại mật khẩu: mọi phiên bị đăng xuất; tuỳ chọn bắt đổi ở lần đăng nhập tới. */
  async resetPassword(id: string, password: string, mustChange: boolean): Promise<void> {
    const issue = passwordIssue(password);
    if (issue) throw new Error(issue);
    if (CATALOG_FROM_API) {
      this.keep(await this.api.post<AppUser>(`/users/${id}/reset-password`, { password, mustChange }));
      return;
    }
    this.patch(id, { passwordUpdatedAt: new Date().toISOString(), mustChangePassword: mustChange, openSessions: 0 });
  }

  async endSessions(id: string): Promise<void> {
    if (CATALOG_FROM_API) {
      this.keep(await this.api.post<AppUser>(`/users/${id}/end-sessions`));
      return;
    }
    this.patch(id, { openSessions: 0 });
  }

  /** The saved account replaces the local copy; role user counts come fresh from the server. */
  private keep(u: AppUser): AppUser {
    this.data.users.update((list) => upsertById(list, u, true));
    if (this.data.roles().length) void this.api.get<Role[]>('/roles').then((roles) => this.data.roles.set(roles)).catch(() => undefined);
    return u;
  }

  private clean(d: UserDraft): UserDraft {
    return {
      name: d.name.trim(),
      email: d.email.trim().toLowerCase(),
      roleId: d.roleId,
      phone: d.phone?.trim() || undefined,
      note: d.note?.trim() || undefined,
    };
  }

  private find(id: string): AppUser {
    const u = this.data.users().find((x) => x.id === id);
    if (!u) throw new Error(`Không tìm thấy người dùng ${id}`);
    return u;
  }

  private patch(id: string, changes: Partial<AppUser>): void {
    this.find(id);
    const updatedAt = new Date().toISOString();
    this.data.users.update((list) => list.map((u) => (u.id === id ? { ...u, ...changes, updatedAt } : u)));
  }

  /** Chức vụ › Người dùng count follows the accounts (locked ones included, as production counts them). */
  private syncRoleCounts(): void {
    const counts = new Map<string, number>();
    for (const u of this.data.users()) counts.set(u.roleId, (counts.get(u.roleId) ?? 0) + 1);
    this.data.roles.update((list) => list.map((r) => ({ ...r, userCount: counts.get(r.id) ?? 0 })));
  }
}
