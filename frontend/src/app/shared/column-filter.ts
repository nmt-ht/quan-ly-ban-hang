// Per-column filtering for app-data-table. Applied by the page *before* pagination so a
// filter always searches every row, not just the visible page.
import type { DataTableColumn } from './data-table/data-table.component';
import { foldVi } from './format.util';

export type ColumnFilterKind = 'text' | 'number' | 'select';
export type ColumnFilters = Record<string, string>;

export function columnFilterKind<T>(col: DataTableColumn<T>): ColumnFilterKind | null {
  if (col.filter === false) return null;
  return col.filter ?? (col.badge ? 'select' : col.align === 'right' ? 'number' : 'text');
}

function cellText<T extends Record<string, any>>(col: DataTableColumn<T>, row: T): string {
  return col.format ? col.format(row) : String(row[col.key] ?? '');
}

function cellNumber<T extends Record<string, any>>(col: DataTableColumn<T>, row: T): number | null {
  const raw = col.filterValue ? col.filterValue(row) : row[col.key];
  if (raw === null || raw === undefined || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// "1.250.000" / "0,5" / "1250000" -> number
function parseNum(s: string): number {
  const t = s.trim().replace(/\s/g, '');
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'));
  return Number(t.replace(',', '.'));
}

// Supports: 15 · =15 · >10 · >=10 · <5 · <=5 · 10-20 · 10..20
export function numberPredicate(expr: string): ((n: number | null) => boolean) | null {
  const e = expr.trim();
  if (!e) return () => true;
  const range = /^(-?[\d.,]+)\s*(?:-|\.\.|–)\s*(-?[\d.,]+)$/.exec(e);
  if (range) {
    const a = parseNum(range[1]);
    const b = parseNum(range[2]);
    if (Number.isNaN(a) || Number.isNaN(b)) return null;
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    return (n) => n !== null && n >= lo && n <= hi;
  }
  const op = /^(>=|<=|>|<|=)?\s*(-?[\d.,]+)$/.exec(e);
  if (!op) return null;
  const v = parseNum(op[2]);
  if (Number.isNaN(v)) return null;
  switch (op[1]) {
    case '>': return (n) => n !== null && n > v;
    case '>=': return (n) => n !== null && n >= v;
    case '<': return (n) => n !== null && n < v;
    case '<=': return (n) => n !== null && n <= v;
    default: return (n) => n !== null && n === v;
  }
}

export function isActiveFilters(filters: ColumnFilters): boolean {
  return Object.values(filters).some((v) => v.trim() !== '');
}

export function applyColumnFilters<T extends Record<string, any>>(
  rows: T[],
  columns: DataTableColumn<T>[],
  filters: ColumnFilters,
): T[] {
  const tests: ((row: T) => boolean)[] = [];
  for (const col of columns) {
    const value = (filters[col.key] ?? '').trim();
    const kind = columnFilterKind(col);
    if (!value || !kind) continue;
    if (kind === 'number') {
      const pred = numberPredicate(value);
      if (pred) tests.push((r) => pred(cellNumber(col, r)));
      // An unparseable expression is flagged in the input and otherwise ignored.
    } else if (kind === 'select') {
      tests.push((r) => cellText(col, r) === value);
    } else {
      const q = foldVi(value);
      tests.push((r) => foldVi(cellText(col, r)).includes(q));
    }
  }
  return tests.length ? rows.filter((r) => tests.every((t) => t(r))) : rows;
}

// Distinct display values for a select-type column, in first-seen order.
export function selectOptions<T extends Record<string, any>>(rows: T[], col: DataTableColumn<T>): string[] {
  return [...new Set(rows.map((r) => cellText(col, r)).filter(Boolean))];
}
