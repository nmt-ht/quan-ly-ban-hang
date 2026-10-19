import { Injectable, computed, signal } from '@angular/core';

export interface SessionUser {
  name: string;
  email: string;
  roleName: string;
}

const STORAGE_KEY = 'nt_session';

// Mock, client-only auth for the frontend skeleton. Replace with real calls
// to POST /auth/login on the NestJS backend (see docs/backend-plan.md).
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<SessionUser | null>(this.restore());
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  login(email: string, password: string): boolean {
    // Demo credential only — real auth happens against the backend.
    if (email.trim().toLowerCase() === 'demo@ninhtrang.local' && password === 'demo1234') {
      const user: SessionUser = { name: 'Quản trị hệ thống', email, roleName: 'CEO' };
      this._user.set(user);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      return true;
    }
    return false;
  }

  logout(): void {
    this._user.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  private restore(): SessionUser | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SessionUser) : null;
    } catch {
      return null;
    }
  }
}
