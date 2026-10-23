import { Prisma } from '@prisma/client';

export type AuditValue = string | number | boolean | null | AuditValue[];

/** One changed field of an edit, as the Lịch sử tab shows it: "Giá lẻ: 120.000 → 135.000". */
export interface AuditChange {
  field: string;
  label: string;
  from: AuditValue;
  to: AuditValue;
}

/** Decimal → number, Date → YYYY-MM-DD (or ISO when it has a time), "" → null, arrays of primitives sorted. */
export function normalize(value: unknown): AuditValue {
  if (value === undefined || value === null || value === '') return null;
  if (Prisma.Decimal.isDecimal(value)) return (value as Prisma.Decimal).toNumber();
  if (value instanceof Date) {
    const iso = value.toISOString();
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso;
  }
  if (Array.isArray(value)) {
    const items = value.map(normalize);
    return items.every((x) => typeof x !== 'object') ? [...items].sort((a, b) => String(a).localeCompare(String(b))) : items;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return value as string | number | boolean;
}

/**
 * The fields of `labels` whose value differs between `before` and `after`. Only listed fields are
 * compared, so bookkeeping columns (updatedAt, password hashes, images) never reach the log.
 */
export function diff(before: object | null | undefined, after: object, labels: Record<string, string>): AuditChange[] {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const changes: AuditChange[] = [];
  for (const [field, label] of Object.entries(labels)) {
    if (!(field in a)) continue;
    const from = normalize(b[field]);
    const to = normalize(a[field]);
    if (JSON.stringify(from) !== JSON.stringify(to)) changes.push({ field, label, from, to });
  }
  return changes;
}

/** "1.250.000 ₫" for summaries. */
export const vnd = (n: unknown): string => `${Math.round(Number(n)).toLocaleString('vi-VN')} ₫`;
