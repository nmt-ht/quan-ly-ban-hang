import { Component, computed, input, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { IMPORT_ACTION_LABEL, ImportAction, ImportResult } from './import.types';

type Filter = 'all' | ImportAction;

const PAGE = 200;

// Xem trước một lần nhập Excel: tổng số theo kết quả và bảng từng dòng (lỗi đỏ, cập nhật kèm các trường đổi).
@Component({
  selector: 'app-import-preview',
  standalone: true,
  imports: [NgClass],
  template: `
    @let r = result();
    <div class="ip-summary" role="status">
      @for (f of filters; track f.value) {
        @let n = count(f.value);
        @if (f.value === 'all' || n) {
          <button type="button" class="ip-chip" [ngClass]="'ip-' + f.value" [attr.aria-pressed]="filter() === f.value" (click)="filter.set(f.value)">
            {{ f.label }} <strong class="num">{{ n }}</strong>
          </button>
        }
      }
    </div>
    <div class="ip-scroll">
      <table class="ip-table">
        <thead>
          <tr>
            <th scope="col" class="ip-row">Dòng</th>
            <th scope="col">Kết quả</th>
            <th scope="col">Mã</th>
            <th scope="col">Tên</th>
            <th scope="col">Chi tiết</th>
          </tr>
        </thead>
        <tbody>
          @for (x of shown(); track $index) {
            <tr [class.ip-bad]="x.action === 'error'">
              <td class="num ip-row">{{ x.row > 0 ? x.row : '—' }}</td>
              <td><span class="ip-badge" [ngClass]="'ip-' + x.action">{{ label[x.action] }}</span></td>
              <td class="num">{{ x.action === 'create' && r.dryRun ? '' : (x.code || '') }}</td>
              <td>{{ x.name || '' }}</td>
              <td class="ip-detail">
                @if (x.errors.length) { {{ x.errors.join('; ') }} }
                @else if (x.changes?.length) { Đổi: {{ x.changes!.join(', ') }} }
                @else if (x.action === 'create' && r.dryRun) { Mã cấp khi nhập }
              </td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="ip-empty">Không có dòng nào.</td></tr>
          }
        </tbody>
      </table>
    </div>
    @if (filtered().length > shown().length) {
      <p class="ip-more">Đang hiện {{ shown().length }} / {{ filtered().length }} dòng.</p>
    }
  `,
  styles: `
    :host { display: block; }
    .ip-summary { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: var(--space-xs); }
    .ip-chip {
      display: inline-flex; align-items: center; gap: 6px; min-height: 1.875rem; padding: 0 var(--space-xs);
      border: var(--rule-hair) solid var(--color-rule); border-radius: var(--radius-control); background: var(--color-surface);
      color: var(--color-ink-2); font-size: var(--text-xs); cursor: pointer;
    }
    .ip-chip[aria-pressed='true'] { border-color: var(--color-ink); color: var(--color-ink); }
    .ip-chip.ip-error strong { color: var(--color-danger); }
    .ip-scroll { max-height: 22rem; overflow: auto; border: var(--rule-hair) solid var(--color-rule); border-radius: var(--radius-control); }
    .ip-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
    .ip-table th { position: sticky; top: 0; background: var(--color-paper-2); text-align: left; font-weight: 600; }
    .ip-table th, .ip-table td { padding: 4px var(--space-xs); border-bottom: var(--rule-hair) solid var(--color-rule); vertical-align: top; }
    .ip-row { width: 3.5rem; }
    .ip-detail { color: var(--color-ink-2); }
    .ip-bad .ip-detail { color: var(--color-danger); }
    .ip-badge { display: inline-block; padding: 0 6px; border-radius: var(--radius-control); font-size: var(--text-xs); white-space: nowrap; }
    .ip-badge.ip-create { background: var(--color-success-tint); color: var(--color-success); }
    .ip-badge.ip-update { background: var(--color-info-tint); color: var(--color-info); }
    .ip-badge.ip-unchanged { background: var(--color-paper-2); color: var(--color-muted); }
    .ip-badge.ip-error { background: var(--color-danger-tint); color: var(--color-danger); }
    .ip-empty, .ip-more { color: var(--color-muted); font-size: var(--text-xs); }
  `,
})
export class ImportPreviewComponent {
  readonly result = input.required<ImportResult>();
  readonly filter = signal<Filter>('all');
  readonly label = IMPORT_ACTION_LABEL;
  readonly filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'Tất cả' },
    { value: 'error', label: 'Lỗi' },
    { value: 'create', label: 'Thêm mới' },
    { value: 'update', label: 'Cập nhật' },
    { value: 'unchanged', label: 'Không đổi' },
  ];

  readonly filtered = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.result().rows : this.result().rows.filter((r) => r.action === f);
  });
  readonly shown = computed(() => this.filtered().slice(0, PAGE));

  count(f: Filter): number {
    return f === 'all' ? this.result().rows.length : this.result().rows.filter((r) => r.action === f).length;
  }
}
