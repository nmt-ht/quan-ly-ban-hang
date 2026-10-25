import { WritableSignal } from '@angular/core';
import { ApiService, upsertById } from './api.service';

/** "?a=1&b=x,y" from the set fields of a list query; arrays as comma lists, false / empty left out. */
export function pageQuery(q: object): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length) || v === false) continue;
    parts.push(`${k}=${encodeURIComponent(Array.isArray(v) ? v.join(',') : String(v))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

/**
 * Chứng từ the app did not load at sign-in (older than the window, Pha 1.1), read into their DataStore list when a screen
 * needs them. Each id, mã or query is asked once: one the server does not return (gone, or not this user's) is not asked
 * again. Failures leave the screen with what it has.
 */
export function onDemand<T extends { id: string; code: string }>(api: ApiService, list: WritableSignal<T[]>, path: string) {
  const asked = new Set<string>();
  const merge = (rows: T[]) => {
    if (rows.length) list.update((have) => rows.reduce((acc, r) => upsertById(acc, r, true), have));
  };
  return {
    /** By id or mã — one request for those not loaded yet. */
    async byIds(ids: string[], codes: string[] = []): Promise<void> {
      const have = list();
      const missingIds = [...new Set(ids.filter(Boolean))].filter((id) => !asked.has(id) && !have.some((x) => x.id === id));
      const missingCodes = [...new Set(codes.filter(Boolean))].filter((c) => !asked.has(c) && !have.some((x) => x.code === c));
      if (!missingIds.length && !missingCodes.length) return;
      for (const k of [...missingIds, ...missingCodes]) asked.add(k);
      try {
        merge(await api.get<T[]>(`${path}${pageQuery({ ids: missingIds, codes: missingCodes })}`));
      } catch {
        /* the screen shows what it has */
      }
    },
    /** Every row matching a filter of the list endpoint (the phiếu of one đơn…). */
    async where(filter: Record<string, string | undefined>): Promise<void> {
      const qs = pageQuery(filter);
      if (!qs || asked.has(qs)) return;
      asked.add(qs);
      try {
        merge(await api.get<T[]>(`${path}${qs}`));
      } catch {
        /* the screen shows what it has */
      }
    },
  };
}
