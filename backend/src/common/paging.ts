// Shared pieces of the list-by-page endpoints (Pha 1.1): query parsing, the "?recentDays / ?ids" window, sort and slice.
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { fromDay, vnDay } from './text.js';

export const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const toArray = (value: unknown): string[] | undefined =>
  value === undefined || value === '' ? undefined : Array.isArray(value) ? value.map(String) : typeof value === 'string' ? value.split(',') : undefined;

/** "a,b" → ['a', 'b'] (at most 500), for `?ids=` / `?codes=`. */
export const listParam = (v?: string): string[] | undefined => (v ? v.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 500) : undefined);

/** `?recentDays=90` → the first day of the window, or undefined for "everything". */
export function windowStart(recentDays?: string): Date | undefined {
  const days = Number(recentDays);
  if (!Number.isInteger(days) || days <= 0) return undefined;
  return fromDay(vnDay(new Date(Date.now() - days * 86_400_000)))!;
}

/** Query string → validated DTO; lists may come as "a,b" or repeated keys. */
export async function parsePageQuery<T extends object>(cls: new () => T, raw: Record<string, unknown>, listKeys: string[]): Promise<T> {
  const plain = { ...raw };
  for (const k of listKeys) plain[k] = toArray(raw[k]);
  const q = plainToInstance(cls, plain);
  if ((await validate(q, { whitelist: true })).length) throw new BadRequestException('Tham số lọc không hợp lệ');
  return q;
}

/** Sort by one key (numbers as numbers, text the Vietnamese way, numbers inside codes in order), ties by mã. */
export function sortRows<R extends { code: string }>(rows: R[], key: (r: R) => string | number, dir: 'asc' | 'desc'): R[] {
  const d = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'vi', { numeric: true });
    return c * d || b.code.localeCompare(a.code);
  });
}

/** One page of already sorted rows; a page past the end shows the last one. */
export function slicePage<R>(sorted: R[], page = 1, pageSize = 20) {
  const p = Math.max(1, Math.min(page, Math.max(1, Math.ceil(sorted.length / pageSize))));
  return { rows: sorted.slice((p - 1) * pageSize, p * pageSize), total: sorted.length, page: p, pageSize };
}
