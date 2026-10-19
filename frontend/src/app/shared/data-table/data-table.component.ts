import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DataTableColumn<T> {
  key: string;
  label: string;
  format?: (row: T) => string;
  align?: 'left' | 'right' | 'center';
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="table-wrap card" *ngIf="rows.length; else empty">
      <table>
        <thead>
          <tr>
            <th *ngFor="let col of columns" [style.textAlign]="col.align || 'left'">{{ col.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let row of rows">
            <td *ngFor="let col of columns" [style.textAlign]="col.align || 'left'">
              {{ col.format ? col.format(row) : (row[col.key] ?? '—') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <ng-template #empty>
      <div class="card empty-state">
        <div class="empty-icon">▢</div>
        <h3>{{ emptyTitle }}</h3>
        <p>{{ emptyHint }}</p>
      </div>
    </ng-template>
  `,
  styles: [`
    .table-wrap { padding: 0; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 12px 16px; text-align: left; white-space: nowrap; }
    th {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--nt-muted);
      border-bottom: 1px solid var(--nt-border);
    }
    tbody tr:not(:last-child) td { border-bottom: 1px solid var(--nt-border); }
  `],
})
export class DataTableComponent<T extends Record<string, any> = any> {
  @Input() columns: DataTableColumn<T>[] = [];
  @Input() rows: T[] = [];
  @Input() emptyTitle = 'Chưa có dữ liệu';
  @Input() emptyHint = '';
}
