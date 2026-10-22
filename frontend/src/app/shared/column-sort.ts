import type { DataTableColumn } from './data-table/data-table.component';

export type SortDir = 'asc' | 'desc';
export interface ColumnSort {
  key: string;
  dir: SortDir;
}

type SortValue = number | string | null;

// Raw field first (ISO dates and numbers sort right); a missing field or a non-primitive (boolean,
// array) falls back to the shown text. `sortByText` asks for the text straight away.
function valueOf<T extends Record<string, any>>(col: DataTableColumn<T>, row: T): SortValue {
  const raw = col.sortValue ? col.sortValue(row) : col.filterValue ? col.filterValue(row) : col.sortByText ? undefined : row[col.key];
  if (raw === null || raw === '') return null;
  if (typeof raw === 'number' || typeof raw === 'string') return raw;
  const text = col.format ? col.format(row) : '';
  return text && text !== '—' ? text : null;
}

/** Sort rows by one column. Empty values always go last, whatever the direction. */
export function sortByColumn<T extends Record<string, any>>(rows: T[], columns: DataTableColumn<T>[], sort: ColumnSort | null): T[] {
  const col = sort ? columns.find((c) => c.key === sort.key) : undefined;
  if (!sort || !col) return rows;
  const sign = sort.dir === 'asc' ? 1 : -1;
  return rows
    .map((row) => ({ row, v: valueOf(col, row) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null) return a.v === b.v ? 0 : a.v === null ? 1 : -1;
      if (typeof a.v === 'number' && typeof b.v === 'number') return (a.v - b.v) * sign;
      return String(a.v).localeCompare(String(b.v), 'vi', { numeric: true }) * sign;
    })
    .map((x) => x.row);
}
