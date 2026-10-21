import { Injectable } from '@angular/core';
import { MockDataService } from '../../../core/services/mock-data.service';
import { AuthService } from '../../../core/services/auth.service';
import { AppUser } from '../../../core/models/domain.models';

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

// All writes for Thiết lập › Người dùng. Against the mock store today; maps to the backend later,
// where the password is sent once and stored hashed — never kept in the frontend store.
@Injectable({ providedIn: 'root' })
export class UserService {
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

  create(d: UserDraft, password: string): AppUser {
    const issue = passwordIssue(password);
    if (issue) throw new Error(issue);
    if (this.duplicateEmail(d.email, null)) throw new Error('Email đã được dùng');
    const now = new Date().toISOString();
    const u: AppUser = {
      ...this.clean(d), id: crypto.randomUUID(), status: 'ACTIVE', openSessions: 0, createdAt: now, updatedAt: now,
      passwordUpdatedAt: now, mustChangePassword: true,
    };
    this.data.users.update((list) => [...list, u]);
    this.syncRoleCounts();
    return u;
  }

  update(id: string, d: UserDraft): void {
    const u = this.find(id);
    if (d.roleId !== u.roleId && this.isLastAdmin(u)) throw new Error('Đây là tài khoản CEO cuối cùng — không đổi chức vụ được.');
    this.patch(id, this.clean(d));
    this.syncRoleCounts();
  }

  /** Khoá: không xoá tài khoản (chứng từ vẫn đứng tên), đăng xuất mọi phiên, không đăng nhập được nữa. */
  lock(id: string, reason: string): void {
    const u = this.find(id);
    if (this.isMe(u)) throw new Error('Không tự khoá tài khoản của mình.');
    if (this.isLastAdmin(u)) throw new Error('Đây là tài khoản CEO cuối cùng — không khoá được.');
    this.patch(id, { status: 'DISABLED', openSessions: 0, lockedAt: new Date().toISOString(), lockedReason: reason.trim() || undefined });
  }

  unlock(id: string): void {
    this.patch(id, { status: 'ACTIVE', lockedAt: undefined, lockedReason: undefined });
  }

  /** Đặt lại mật khẩu: mọi phiên bị đăng xuất; tuỳ chọn bắt đổi ở lần đăng nhập tới. */
  resetPassword(id: string, password: string, mustChange: boolean): void {
    const issue = passwordIssue(password);
    if (issue) throw new Error(issue);
    this.patch(id, { passwordUpdatedAt: new Date().toISOString(), mustChangePassword: mustChange, openSessions: 0 });
  }

  endSessions(id: string): void {
    this.patch(id, { openSessions: 0 });
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
