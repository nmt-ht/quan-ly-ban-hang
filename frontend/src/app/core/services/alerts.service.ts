import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ApiService, errorText } from '../api/api.service';
import { AuthService } from './auth.service';

/** One thing that is wrong right now (GET /alerts — backend reports/alerts.ts holds the rules). */
export interface Alert {
  key: string;
  /** bad = Nghiêm trọng (damage done / overdue) · warn = Theo dõi (about to happen). */
  level: 'bad' | 'warn';
  area: 'sell' | 'stock' | 'purchase' | 'debt' | 'cash';
  title: string;
  detail: string;
  to: string;
  query?: Record<string, string | number | boolean>;
  cta: string;
  /** Changes with the size of the problem; "đã đọc" holds only while it stays the same. */
  sig: string;
}

const EVERY = 5 * 60_000; // re-read every 5 minutes while the app is open
const AT_MOST = 60_000; // a navigation or refocus re-reads at most once a minute
const KEY = 'nt.alerts.seen.';

/**
 * Thông báo for the topbar bell and Tổng quan › Cần xử lý — one list, so the two never disagree. Read on sign-in, every
 * 5 minutes, and on navigation / refocus when a minute has passed. "Đã đọc" is per alert, per user, per browser:
 * opening one (or its ✓) marks it read; "Đã đọc tất cả" marks the rest. A read alert stays listed under Tất cả until
 * it is fixed, and turns unread again when it grows (its sig changes).
 */
@Injectable({ providedIn: 'root' })
export class AlertsService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  private readonly all = signal<Alert[]>([]);
  readonly loaded = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  /** When the list on screen was read (null before the first answer). */
  readonly updatedAt = signal<Date | null>(null);
  private readonly read = signal<ReadonlySet<string>>(new Set());
  private last = 0;
  private seq = 0;

  /** Only what this user can open (the server already filters by permission; this keeps a stale list honest). */
  readonly items = computed(() => this.all().filter((a) => this.auth.canVisit(a.to)));
  readonly unread = computed(() => this.items().filter((a) => !this.read().has(a.sig)));
  readonly unreadBad = computed(() => this.unread().some((a) => a.level === 'bad'));

  constructor() {
    const userId = computed(() => this.auth.user()?.userId ?? null);
    effect(() => {
      const id = userId();
      untracked(() => {
        this.seq++;
        this.all.set([]);
        this.updatedAt.set(null);
        this.loaded.set(false);
        this.error.set('');
        this.last = 0;
        this.read.set(id ? stored(id) : new Set());
        if (id) void this.refresh(true);
      });
    });

    const timer = setInterval(() => void this.refresh(true), EVERY);
    const onFocus = () => void this.refresh();
    window.addEventListener('focus', onFocus);
    const nav = inject(Router).events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => void this.refresh());
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      nav.unsubscribe();
    });
  }

  /** Read GET /alerts again — unless it was read less than a minute ago (`force` skips that). */
  async refresh(force = false): Promise<void> {
    if (!this.auth.user() || (!force && Date.now() - this.last < AT_MOST)) return;
    this.last = Date.now();
    const mine = ++this.seq;
    this.loading.set(true);
    try {
      const list = await this.api.get<Alert[]>('/alerts');
      if (mine !== this.seq) return;
      this.all.set(list);
      this.updatedAt.set(new Date());
      this.error.set('');
      this.loaded.set(true);
    } catch (e) {
      if (mine === this.seq) this.error.set(errorText(e));
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }

  isRead(a: Alert): boolean {
    return this.read().has(a.sig);
  }

  /** One alert read (opened, or its ✓). */
  markRead(a: Alert): void {
    this.save(new Set([...this.read(), a.sig]));
  }

  /** "Đã đọc tất cả": every alert listed now. */
  markAllRead(): void {
    this.save(new Set([...this.read(), ...this.items().map((a) => a.sig)]));
  }

  /** Keeps only marks of alerts still listed, so the stored set never grows past the list. */
  private save(marks: Set<string>): void {
    const id = this.auth.user()?.userId;
    if (!id) return;
    const live = new Set(this.all().map((a) => a.sig));
    const next = this.loaded() ? new Set([...marks].filter((s) => live.has(s))) : marks;
    this.read.set(next);
    try {
      localStorage.setItem(KEY + id, JSON.stringify([...next]));
    } catch {
      /* storage blocked: the marks last for this session */
    }
  }
}

function stored(userId: string): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY + userId) ?? '[]');
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}
