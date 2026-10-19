import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';

// Page numbers with gaps: 1 … 4 5 6 … 12
function pageWindow(current: number, last: number): (number | null)[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const pages = new Set([1, last, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [NavIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (total() > 0) {
      <nav class="pager" aria-label="Phân trang">
        <p class="pager-range">
          <span class="num">{{ from() }}–{{ to() }}</span> / <span class="num">{{ total() }}</span> {{ unit() }}
        </p>

        <div class="pager-pages">
          <button type="button" class="pager-btn" aria-label="Trang trước" [disabled]="page() <= 1" (click)="go(page() - 1)">
            <app-nav-icon name="chevron-left" />
          </button>
          @for (p of pages(); track $index) {
            @if (p === null) {
              <span class="pager-gap" aria-hidden="true">…</span>
            } @else {
              <button
                type="button"
                class="pager-btn num"
                [attr.aria-current]="p === page() ? 'page' : null"
                [attr.aria-label]="'Trang ' + p"
                (click)="go(p)"
              >
                {{ p }}
              </button>
            }
          }
          <button type="button" class="pager-btn" aria-label="Trang sau" [disabled]="page() >= lastPage()" (click)="go(page() + 1)">
            <app-nav-icon name="chevron-right" />
          </button>
        </div>

        <label class="pager-size">
          <select [value]="'' + pageSize()" (change)="setSize($any($event.target).value)" aria-label="Số dòng mỗi trang">
            @for (s of pageSizeOptions(); track s) {
              <option [value]="'' + s">{{ s }} / trang</option>
            }
          </select>
        </label>
      </nav>
    }
  `,
  styles: [`
    .pager {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-xs);
      margin-top: var(--space-sm);
      font-size: var(--text-sm);
      --icon-size: 16px;
    }
    .pager-range { margin: 0; color: var(--color-muted); }
    .pager-range .num { color: var(--color-ink); }
    .pager-pages { display: flex; align-items: center; gap: var(--space-3xs); }
    .pager-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: var(--control-h);
      height: var(--control-h);
      padding: 0 var(--space-2xs);
      border: var(--rule-hair) solid transparent;
      border-radius: var(--radius-control);
      background: none;
      color: var(--color-ink-2);
      font-size: var(--text-sm);
      cursor: pointer;
    }
    @media (hover: hover) {
      .pager-btn:hover:not(:disabled) { background: var(--color-paper-2); color: var(--color-ink); }
    }
    .pager-btn:active:not(:disabled) { background: var(--color-paper-3); }
    .pager-btn[aria-current='page'] {
      border-color: var(--color-ink);
      background: var(--color-ink);
      color: var(--color-surface);
    }
    .pager-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .pager-gap { min-width: 1.5rem; text-align: center; color: var(--color-muted); }
    .pager-size select {
      min-height: var(--control-h);
      padding: 0 var(--space-2xs);
      border: var(--rule-hair) solid var(--color-rule-strong);
      border-radius: var(--radius-control);
      background: var(--color-surface);
      color: var(--color-ink);
      font-size: var(--text-sm);
    }
    @media (max-width: 560px) {
      .pager { justify-content: center; }
      .pager-range { width: 100%; text-align: center; }
    }
  `],
})
export class PaginationComponent {
  readonly total = input.required<number>();
  readonly unit = input('dòng');
  readonly pageSizeOptions = input([20, 50, 100]);
  readonly page = model(1);
  readonly pageSize = model(20);

  readonly lastPage = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  readonly from = computed(() => (this.page() - 1) * this.pageSize() + 1);
  readonly to = computed(() => Math.min(this.total(), this.page() * this.pageSize()));
  readonly pages = computed(() => pageWindow(this.page(), this.lastPage()));

  go(p: number): void {
    this.page.set(Math.min(Math.max(1, p), this.lastPage()));
  }

  setSize(value: string): void {
    this.pageSize.set(Number(value));
    this.page.set(1);
  }
}
