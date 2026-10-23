import { Component, EventEmitter, Input, Output, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CopyButtonComponent } from '../copy-button/copy-button.component';
import { FrozenColsDirective, identityColumns } from '../frozen-cols.directive';
import { amountTone } from '../format.util';
import { ColumnFilterKind, ColumnFilters, columnFilterKind, isActiveFilters, numberPredicate, selectOptions } from '../column-filter';

export interface DataTableColumn<T> {
  key: string;
  label: string;
  format?: (row: T) => string;
  align?: 'left' | 'right' | 'center';
  mono?: boolean;
  // Render the cell as a .badge with this extra class (e.g. a status or type colour).
  badge?: (row: T) => string;
  // Show a copy-to-clipboard button after the value (codes, tax numbers).
  copy?: boolean;
  // Column filter: default is select for badge columns, number for right-aligned, text otherwise.
  filter?: ColumnFilterKind | false;
  // Raw value for number filters when the displayed text is formatted (money, "—").
  filterValue?: (row: T) => number | string | null;
  // Thumbnail column: image URL for the row, or undefined for the placeholder.
  image?: (row: T) => string | undefined;
  // Render the value as a router link (e.g. a code that opens the detail page).
  link?: (row: T) => string | unknown[] | null; // null → plain text for this row
  // Query params for that link (e.g. ?partnerId= on the same page).
  linkQuery?: (row: T) => Record<string, string>;
  // Colour the cell by sign (format.util › amountTone): return the signed amount; `flow` = also green when positive.
  tone?: (row: T) => number | null | undefined;
  // Render coloured chips (e.g. thẻ đánh dấu) instead of text; filtering still uses `format`.
  chips?: (row: T) => { label: string; style: Record<string, string> }[];
  toneFlow?: boolean;
  // Header click sorts by this column (the page applies it; see shared/column-sort.ts).
  sortable?: boolean;
  // Value to sort by when it differs from the raw field or filterValue (e.g. a name instead of an id).
  sortValue?: (row: T) => number | string | null | undefined;
  // Sort by the text the cell shows (a name or label) rather than the raw id / enum code.
  sortByText?: boolean;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, RouterLink, CopyButtonComponent, FrozenColsDirective],
  template: `
    <div class="table-wrap card" *ngIf="rows.length || (filterable && hasFilters()); else empty">
      <table [appFrozenCols]="frozen" [class.fz-thumb]="columns[0]?.key === 'image'">
        <thead>
          <tr>
            <th *ngFor="let col of columns" scope="col" [style.textAlign]="col.align || 'left'" [attr.aria-sort]="isSortable(col) ? ariaSort(col) : null">
              <button *ngIf="isSortable(col); else plainLabel" type="button" class="th-sort" (click)="toggleSort(col)">
                {{ col.label }}<span class="sort-ind" [attr.data-dir]="dirOf(col)" aria-hidden="true"></span>
              </button>
              <ng-template #plainLabel>{{ col.label }}</ng-template>
            </th>
            <th *ngIf="actions" scope="col" class="actions-cell">
              <span class="visually-hidden">{{ actionsLabel }}</span>
            </th>
          </tr>
          <tr *ngIf="filterable" class="filter-row">
            <th *ngFor="let col of columns" scope="col">
              <ng-container [ngSwitch]="kind(col)">
                <select
                  *ngSwitchCase="'select'"
                  [value]="filters[col.key] || ''"
                  (change)="setFilter(col.key, $any($event.target).value)"
                  [attr.aria-label]="'Lọc cột ' + col.label"
                  [class.is-set]="!!filters[col.key]"
                >
                  <option value="">Tất cả</option>
                  <option *ngFor="let o of optionsFor(col)" [value]="o">{{ o }}</option>
                </select>
                <input
                  *ngSwitchCase="'number'"
                  type="text"
                  inputmode="decimal"
                  placeholder="vd >100"
                  [value]="filters[col.key] || ''"
                  (input)="setFilter(col.key, $any($event.target).value)"
                  [attr.aria-label]="'Lọc cột ' + col.label + ' (>, <, =, khoảng a-b)'"
                  [attr.aria-invalid]="invalidNumber(col.key) ? 'true' : null"
                  [title]="invalidNumber(col.key) ? 'Biểu thức không hợp lệ — dùng 100, >100, <=5, 10-20' : 'Ví dụ: 100 · >100 · <=5 · 10-20'"
                  [class.is-set]="!!filters[col.key]"
                  class="num-filter"
                />
                <input
                  *ngSwitchCase="'text'"
                  type="text"
                  placeholder="Lọc…"
                  [value]="filters[col.key] || ''"
                  (input)="setFilter(col.key, $any($event.target).value)"
                  [attr.aria-label]="'Lọc cột ' + col.label"
                  [class.is-set]="!!filters[col.key]"
                />
              </ng-container>
            </th>
            <th *ngIf="actions" class="actions-cell">
              <button *ngIf="hasFilters()" type="button" class="clear-col-filters" (click)="clearFilters()">Xoá lọc</button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let row of rows">
            <td
              *ngFor="let col of columns"
              [style.textAlign]="col.align || 'left'"
              [class.num]="col.align === 'right'"
              [class.code]="isCode(col)"
              [ngClass]="col.tone ? toneClass(col, row) : ''"
            >
              <ng-container *ngIf="col.image; else textCell">
                <img *ngIf="col.image(row) as src; else noImg" class="thumb" [src]="src" alt="" loading="lazy" />
                <ng-template #noImg><span class="thumb thumb-empty" aria-hidden="true"></span></ng-template>
              </ng-container>
              <ng-template #textCell>
                <span *ngIf="col.chips" class="dt-chips">
                  <span *ngFor="let c of col.chips(row)" class="badge tag" [ngStyle]="c.style">{{ c.label }}</span>
                  <span *ngIf="!col.chips(row).length" class="dt-none">—</span>
                </span>
                <span *ngIf="col.badge && !col.chips; else plain" class="badge" [ngClass]="col.badge(row)">{{ cellText(col, row) }}</span>
                <ng-template #plain>
                  <ng-container *ngIf="!col.chips">
                  <a *ngIf="col.link?.(row); else text" class="code-link" [routerLink]="col.link!(row)" [queryParams]="col.linkQuery?.(row)">{{ cellText(col, row) }}</a>
                  <ng-template #text>{{ cellText(col, row) }}</ng-template>
                  </ng-container>
                </ng-template>
              </ng-template>
              <app-copy-button *ngIf="col.copy" class="cell-copy" [text]="cellText(col, row)" [label]="col.label.toLowerCase()" />
            </td>
            <td *ngIf="actions" class="actions-cell">
              <ng-container *ngTemplateOutlet="actions; context: { $implicit: row }" />
            </td>
          </tr>
          <tr *ngIf="!rows.length" class="no-match">
            <td [attr.colspan]="columns.length + (actions ? 1 : 0)">
              Không có dòng nào khớp bộ lọc cột.
              <button type="button" class="link-btn" (click)="clearFilters()">Xoá lọc cột</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <ng-template #empty>
      <div class="card empty-state">
        <h3>{{ emptyTitle }}</h3>
        <p *ngIf="emptyHint">{{ emptyHint }}</p>
        <ng-container *ngIf="emptyAction" [ngTemplateOutlet]="emptyAction" />
      </div>
    </ng-template>
  `,
  styles: [`
    .table-wrap { padding: 0; overflow-x: auto; }
    th, td { white-space: nowrap; }
    th:first-child, td:first-child { padding-left: var(--space-sm); }
    th:last-child, td:last-child { padding-right: var(--space-sm); }
    td.code {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-ink-2);
    }
    /* Row actions stay reachable when the table scrolls sideways. */
    .actions-cell {
      position: sticky;
      right: 0;
      width: 1%;
      text-align: right;
      background: var(--color-surface);
      box-shadow: inset 1px 0 0 var(--color-rule);
    }
    th.actions-cell { background: var(--color-paper-2); }
    /* …and follows the row's stripe (styles.scss) and hover fill. */
    tbody tr:nth-child(even of :not(.no-match)) td.actions-cell { background: var(--color-row-alt); }
    @media (hover: hover) { tbody tr:hover td.actions-cell { background: var(--color-paper-2); } }
    /* Copy button appears on row hover / focus so the column stays quiet. */
    .dt-chips { display: inline-flex; flex-wrap: wrap; gap: 4px; white-space: normal; }
    .dt-none { color: var(--color-muted); }
    .cell-copy { margin-left: var(--space-3xs); opacity: 0; transition: opacity var(--dur-short) var(--ease-out); }
    tr:hover .cell-copy, .cell-copy:focus-within { opacity: 1; }
    @media (hover: none) { .cell-copy { opacity: 1; } }

    /* Filter row under the header */
    .filter-row th {
      height: auto;
      padding-top: var(--space-3xs);
      padding-bottom: var(--space-2xs);
      font-weight: 400;
      background: var(--color-paper-2);
    }
    .filter-row input,
    .filter-row select {
      width: 100%;
      min-width: 5.5rem;
      height: 1.875rem;
      padding: 0 var(--space-2xs);
      border: var(--rule-hair) solid var(--color-rule);
      border-radius: var(--radius-control);
      background: var(--color-surface);
      color: var(--color-ink);
      font-size: var(--text-xs);
      font-weight: 400;
    }
    .filter-row input::placeholder { color: var(--color-muted); }
    .filter-row input:focus-visible,
    .filter-row select:focus-visible { outline-offset: 0; border-color: var(--color-focus); }
    .filter-row .is-set { border-color: var(--color-ink-2); }
    .filter-row [aria-invalid='true'] { border-color: var(--color-danger); }
    .filter-row .num-filter { text-align: right; font-family: var(--font-mono); }
    .clear-col-filters {
      border: none;
      background: none;
      padding: 0 var(--space-3xs);
      color: var(--color-accent);
      font-size: var(--text-xs);
      font-weight: 500;
      white-space: nowrap;
      cursor: pointer;
    }
    /* Sortable header: a real button, triangle drawn in CSS (no glyphs). */
    .th-sort {
      display: inline-flex;
      align-items: center;
      gap: var(--space-3xs);
      padding: 0;
      border: none;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .sort-ind {
      width: 0;
      height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-top: 5px solid currentColor;
      opacity: 0.3;
    }
    .sort-ind[data-dir='asc'] { border-top: 0; border-bottom: 5px solid currentColor; opacity: 1; }
    .sort-ind[data-dir='desc'] { opacity: 1; }
    @media (hover: hover) { .th-sort:hover .sort-ind { opacity: 0.7; } .th-sort:hover .sort-ind[data-dir] { opacity: 1; } }
    .thumb {
      display: block;
      width: 2rem;
      height: 2rem;
      border-radius: 4px;
      object-fit: cover;
      background: var(--color-paper-2);
    }
    .thumb-empty { border: var(--rule-hair) dashed var(--color-rule-strong); background: var(--color-paper); }
    .no-match td {
      padding: var(--space-md) var(--space-sm);
      color: var(--color-muted);
      text-align: left;
      white-space: normal;
    }
  `],
})
export class DataTableComponent<T extends Record<string, any> = any> {
  @Input() columns: DataTableColumn<T>[] = [];
  @Input() rows: T[] = [];
  @Input() emptyTitle = 'Chưa có dữ liệu';
  @Input() emptyHint = '';
  // Optional call to action under the empty message (e.g. "Lập đơn nhập").
  @Input() emptyAction?: TemplateRef<unknown> | null;
  // Optional per-row actions column; the template receives the row as $implicit.
  @Input() actions?: TemplateRef<{ $implicit: T }>;
  @Input() actionsLabel = 'Thao tác';

  // Per-column filters. The page applies them (see shared/column-filter.ts) before paginating.
  @Input() filterable = false;
  @Input() filters: ColumnFilters = {};
  @Output() filtersChange = new EventEmitter<ColumnFilters>();
  // Rows used to build select-filter options (all rows, not just the current page).
  @Input() optionRows?: T[];

  // Header sorting (optional): the page owns the state and sorts before paginating.
  @Input() sortBy: string | null = null;
  @Input() sortDir: 'asc' | 'desc' = 'asc';
  // Every column is sortable unless it says `sortable: false` or is chips / image / filter: false.
  @Input() sortableColumns = false;
  @Output() sortChange = new EventEmitter<{ key: string; dir: 'asc' | 'desc' } | null>();

  /** Mã / Tên (and the thumbnail before them) stay in view when the list scrolls sideways. */
  get frozen(): number {
    return identityColumns(this.columns.map((c) => c.key));
  }

  isSortable(col: DataTableColumn<T>): boolean {
    return col.sortable ?? (this.sortableColumns && !col.chips && !col.image && col.filter !== false);
  }

  dirOf(col: DataTableColumn<T>): 'asc' | 'desc' | 'none' {
    return this.sortBy === col.key ? this.sortDir : 'none';
  }

  ariaSort(col: DataTableColumn<T>): 'ascending' | 'descending' | 'none' {
    const d = this.dirOf(col);
    return d === 'asc' ? 'ascending' : d === 'desc' ? 'descending' : 'none';
  }

  // Click cycle: first direction (numbers: high → low, text: A → Z) → reverse → off.
  toggleSort(col: DataTableColumn<T>): void {
    const first = col.align === 'right' ? 'desc' : 'asc';
    if (this.sortBy !== col.key) this.sortChange.emit({ key: col.key, dir: first });
    else if (this.sortDir === first) this.sortChange.emit({ key: col.key, dir: first === 'asc' ? 'desc' : 'asc' });
    else this.sortChange.emit(null);
  }

  cellText(col: DataTableColumn<T>, row: T): string {
    return col.format ? col.format(row) : (row[col.key] ?? '—');
  }

  // Identifiers (order codes, tax codes, plates) read better in mono.
  toneClass(col: DataTableColumn<T>, row: T): string {
    return amountTone(col.tone?.(row), col.toneFlow !== false);
  }

  isCode(col: DataTableColumn<T>): boolean {
    return col.mono ?? CODE_KEYS.has(col.key);
  }

  kind(col: DataTableColumn<T>) {
    return columnFilterKind(col);
  }

  optionsFor(col: DataTableColumn<T>): string[] {
    return selectOptions(this.optionRows ?? this.rows, col);
  }

  hasFilters(): boolean {
    return isActiveFilters(this.filters);
  }

  invalidNumber(key: string): boolean {
    const v = this.filters[key];
    return !!v && v.trim() !== '' && numberPredicate(v) === null;
  }

  setFilter(key: string, value: string): void {
    this.filtersChange.emit({ ...this.filters, [key]: value });
  }

  clearFilters(): void {
    this.filtersChange.emit({});
  }
}

const CODE_KEYS = new Set(['code', 'taxCode', 'plateNumber', 'sourceOrderId']);
