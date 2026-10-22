import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MockDataService } from './mock-data.service';
import { permissionsForUrl } from '../auth/route-access';
import { API_BASE, USE_API } from '../api/api.config';
import { NAV_GROUPS } from '../../layout/nav-items';

export interface SessionUser {
  userId: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  /** From the API (USE_API.auth); the demo mode reads them from the role in MockDataService. */
  permissions?: string[];
}

/** What the login screen needs to tell the user. */
export type LoginResult = 'ok' | 'invalid' | 'offline' | 'error';

// Shape of POST /auth/login and GET /auth/me (backend src/auth/auth.service.ts › AuthUser).
interface ApiUser {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  mustChangePassword: boolean;
}

const STORAGE_KEY = 'nt_session';
const TOKEN_KEY = 'nt_token';

// Demo mode only: shared password of the demo accounts (Thiết lập › Người dùng). Never shown on screen.
const DEMO_PASSWORD = 'demo1234';
// Older builds signed in as demo@…; it is the admin account under another name.
const EMAIL_ALIAS: Record<string, string> = { 'demo@ninhtrang.local': 'admin@ninhtrang.local' };

const fromApi = (u: ApiUser): SessionUser => ({
  userId: u.id, name: u.name, email: u.email, roleId: u.roleId, roleName: u.roleName, permissions: u.permissions,
});

// Sign-in: POST /auth/login on the NestJS backend, or the in-browser demo accounts when USE_API.auth is off.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly data = inject(MockDataService);
  private readonly http = inject(HttpClient);
  private readonly _token = signal<string | null>(this.read(TOKEN_KEY));
  private readonly _user = signal<SessionUser | null>(this.restore());
  readonly user = this._user.asReadonly();
  readonly token = this._token.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  /** Codes granted by the signed-in user's role. Demo mode follows edits in Chức vụ & phân quyền at once. */
  readonly permissions = computed<ReadonlySet<string>>(() => {
    const u = this._user();
    if (!u) return new Set();
    if (USE_API.auth) return new Set(u.permissions ?? []);
    const role = this.data.roles().find((r) => r.id === u.roleId && r.isActive);
    return new Set(role?.permissions ?? []);
  });

  async login(email: string, password: string): Promise<LoginResult> {
    if (!USE_API.auth) return this.demoLogin(email, password) ? 'ok' : 'invalid';
    try {
      const res = await firstValueFrom(
        this.http.post<{ accessToken: string; user: ApiUser }>(`${API_BASE}/auth/login`, { email: email.trim(), password }),
      );
      this.setSession(fromApi(res.user), res.accessToken);
      return 'ok';
    } catch (e) {
      return loginFailure(e);
    }
  }

  /**
   * Re-reads role and permissions from GET /auth/me (they may have changed since sign-in).
   * An expired token ends the session through the interceptor; a network error keeps it.
   */
  async refresh(): Promise<void> {
    if (!USE_API.auth || !this._token()) return;
    try {
      const me = await firstValueFrom(this.http.get<ApiUser>(`${API_BASE}/auth/me`));
      this.setSession(fromApi(me), this._token()!);
    } catch {
      /* offline or 401 (handled by authInterceptor): nothing more to do here */
    }
  }

  logout(): void {
    this._user.set(null);
    this._token.set(null);
    this.remove(STORAGE_KEY);
    this.remove(TOKEN_KEY);
  }

  /** True when the user holds at least one of the codes. */
  can(codes: string | readonly string[]): boolean {
    const granted = this.permissions();
    return (typeof codes === 'string' ? [codes] : codes).some((c) => granted.has(c));
  }

  canVisit(url: string): boolean {
    const need = permissionsForUrl(url);
    return !need || this.can(need);
  }

  /** First sidebar page the user may open — where login and refused routes land. */
  homeUrl(): string {
    for (const group of NAV_GROUPS) {
      const link = group.links.find((l) => this.canVisit(l.path));
      if (link) return link.path;
    }
    return '/thiet-lap/mau-hien-thi';
  }

  private demoLogin(email: string, password: string): boolean {
    const key = email.trim().toLowerCase();
    const wanted = EMAIL_ALIAS[key] ?? key;
    const account = this.data.users().find((u) => u.email.toLowerCase() === wanted && u.status === 'ACTIVE');
    if (!account || password !== DEMO_PASSWORD) return false;
    const role = this.data.roles().find((r) => r.id === account.roleId);
    this.setSession({ userId: account.id, name: account.name, email: account.email, roleId: account.roleId, roleName: role?.name ?? '' }, null);
    return true;
  }

  private setSession(user: SessionUser, token: string | null): void {
    this._user.set(user);
    this._token.set(token);
    this.write(STORAGE_KEY, JSON.stringify(user));
    if (token) this.write(TOKEN_KEY, token);
    else this.remove(TOKEN_KEY);
  }

  private restore(): SessionUser | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const user = raw ? (JSON.parse(raw) as Partial<SessionUser>) : null;
      // Sessions saved before roles were applied carry no roleId; an API session needs its token.
      if (!user?.userId || !user.roleId) return null;
      if (USE_API.auth && (!this._token() || !user.permissions)) return null;
      return user as SessionUser;
    } catch {
      return null;
    }
  }

  // Storage can throw (private mode, blocked site data): the session then lasts until the tab closes.
  private read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* see read() */
    }
  }

  private remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* see read() */
    }
  }
}

// 400 comes from validation (e.g. a password shorter than 6), 401 from a wrong password or locked
// account. When the backend is down the dev proxy answers 5xx without our JSON body; status 0 = no network.
function loginFailure(e: unknown): LoginResult {
  if (!(e instanceof HttpErrorResponse)) return 'error';
  if (e.status === 400 || e.status === 401) return 'invalid';
  const fromApi = e.error && typeof e.error === 'object' && 'statusCode' in e.error;
  if (e.status === 0 || (e.status >= 500 && !fromApi)) return 'offline';
  return 'error';
}
