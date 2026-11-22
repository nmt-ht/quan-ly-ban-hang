import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'info' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
  /** How long it stays, in ms; the clock stops while the pointer or focus is on it. */
  duration: number;
  /** Set while it is paused (pointer or focus on it). */
  paused: boolean;
}

/** A saved action says so and goes away on its own; an error stays longer, because it asks the person to do something. */
export const TOAST_MS: Record<ToastKind, number> = { success: 5000, info: 5000, error: 10000 };
const MAX_VISIBLE = 4;
/** The same words twice within this time are one toast (a double click, a retry). */
const DUPLICATE_MS = 1500;

/**
 * The one way the app tells the person what just happened: `toast.success('Đã lưu …')`, `toast.error(errorText(e))`.
 * It replaces the notice strips pages used to keep at their top: the message appears at the top right, fades after 5 s (10 s for an
 * error), can be closed, and waits while the pointer or the keyboard focus is on it. Drawn once by <app-toast-host> in the app root.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;
  private readonly timers = new Map<number, { handle: ReturnType<typeof setTimeout>; left: number; startedAt: number }>();
  private readonly recent = new Map<string, number>();

  /** A page opened by navigation that carries a message (`router.navigate(…, { state: { notice } })`): shows it once. */
  fromNavigation(): void {
    const n = (history.state as { notice?: unknown } | null)?.notice;
    if (typeof n !== 'string') return;
    this.success(n);
    history.replaceState({ ...(history.state as object), notice: undefined }, ''); // a reload or Back must not show it again
  }

  success(text: string | null | undefined): void { this.show('success', text); }
  info(text: string | null | undefined): void { this.show('info', text); }
  error(text: string | null | undefined): void { this.show('error', text); }

  show(kind: ToastKind, text: string | null | undefined): void {
    const t = (text ?? '').trim();
    if (!t) return; // `notice.set('')` used to clear a strip; there is nothing to clear now
    const key = `${kind}|${t}`;
    const now = Date.now();
    if (now - (this.recent.get(key) ?? 0) < DUPLICATE_MS) return;
    this.recent.set(key, now);
    const toast: Toast = { id: this.nextId++, kind, text: t, duration: TOAST_MS[kind], paused: false };
    this.toasts.update((list) => {
      const next = [...list, toast];
      while (next.length > MAX_VISIBLE) this.drop(next.shift()!.id);
      return next;
    });
    this.arm(toast.id, toast.duration);
  }

  dismiss(id: number): void {
    this.drop(id);
    this.toasts.update((list) => list.filter((x) => x.id !== id));
  }

  clear(): void {
    for (const t of this.toasts()) this.drop(t.id);
    this.toasts.set([]);
  }

  /** The pointer or focus is on a toast: stop its clock, keeping what is left. */
  pause(id: number): void {
    const timer = this.timers.get(id);
    if (!timer) return;
    clearTimeout(timer.handle);
    timer.left = Math.max(1000, timer.left - (Date.now() - timer.startedAt));
    this.setPaused(id, true);
  }

  /** It left: start the clock again, with at least a second to read the rest. */
  resume(id: number): void {
    const timer = this.timers.get(id);
    if (!timer) return;
    this.setPaused(id, false);
    this.arm(id, timer.left);
  }

  private arm(id: number, ms: number): void {
    const handle = setTimeout(() => this.dismiss(id), ms);
    this.timers.set(id, { handle, left: ms, startedAt: Date.now() });
  }

  private drop(id: number): void {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer.handle);
    this.timers.delete(id);
  }

  private setPaused(id: number, paused: boolean): void {
    this.toasts.update((list) => list.map((x) => (x.id === id ? { ...x, paused } : x)));
  }
}
