import { effect, inject, signal, untracked } from '@angular/core';
import { ApiService, errorText } from './api.service';

/**
 * Reads `path()` from the API whenever it changes (null = nothing to read). The last answer stays
 * shown while the next one loads, and an older answer never replaces a newer one. Call it where
 * inject() works (a field initializer or constructor).
 */
export function apiQuery<T>(path: () => string | null, initial: T) {
  const api = inject(ApiService);
  const value = signal<T>(initial);
  const loading = signal(false);
  const error = signal('');
  let seq = 0;

  async function read(p: string): Promise<void> {
    const mine = ++seq;
    loading.set(true);
    try {
      const v = await api.get<T>(p);
      if (mine !== seq) return;
      value.set(v);
      error.set('');
    } catch (e) {
      if (mine === seq) error.set(errorText(e));
    } finally {
      if (mine === seq) loading.set(false);
    }
  }

  effect(() => {
    const p = path();
    untracked(() => (p ? void read(p) : value.set(initial)));
  });

  return {
    value: value.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    /** Read the current path again. */
    reload: () => {
      const p = untracked(path);
      return p ? read(p) : Promise.resolve();
    },
  };
}

/** `?a=1&b=2` from the defined values (empty string when none). */
export function queryString(params: Record<string, string | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? '?' + s : '';
}
