import { Injectable, inject } from '@angular/core';
import { DataStore } from '../../../core/services/data-store.service';
import { AuthService } from '../../../core/services/auth.service';
import { AppUser, Role } from '../../../core/models/domain.models';
import { ApiService, upsertById } from '../../../core/api/api.service';

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

// All writes for Thiết lập › Người dùng go through the API, where the password is sent once
// and stored hashed — never kept in the frontend store.
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = inject(ApiService);

  constructor(
    private readonly data: DataStore,
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
    return this.keep(await this.api.post<AppUser>('/users', { ...this.clean(d), password }));
  }

  async update(id: string, d: UserDraft): Promise<void> {
    const u = this.find(id);
    if (d.roleId !== u.roleId && this.isLastAdmin(u)) throw new Error('Đây là tài khoản CEO cuối cùng — không đổi chức vụ được.');
    this.keep(await this.api.put<AppUser>(`/users/${id}`, this.clean(d)));
  }

  /** Khoá: không xoá tài khoản (chứng từ vẫn đứng tên), đăng xuất mọi phiên, không đăng nhập được nữa. */
  async lock(id: string, reason: string): Promise<void> {
    const u = this.find(id);
    if (this.isMe(u)) throw new Error('Không tự khoá tài khoản của mình.');
    if (this.isLastAdmin(u)) throw new Error('Đây là tài khoản CEO cuối cùng — không khoá được.');
    this.keep(await this.api.post<AppUser>(`/users/${id}/lock`, { reason }));
  }

  async unlock(id: string): Promise<void> {
    this.keep(await this.api.post<AppUser>(`/users/${id}/unlock`));
  }

  /** Đặt lại mật khẩu: mọi phiên bị đăng xuất; tuỳ chọn bắt đổi ở lần đăng nhập tới. */
  async resetPassword(id: string, password: string, mustChange: boolean): Promise<void> {
    const issue = passwordIssue(password);
    if (issue) throw new Error(issue);
    this.keep(await this.api.post<AppUser>(`/users/${id}/reset-password`, { password, mustChange }));
  }

  async endSessions(id: string): Promise<void> {
    this.keep(await this.api.post<AppUser>(`/users/${id}/end-sessions`));
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
}
