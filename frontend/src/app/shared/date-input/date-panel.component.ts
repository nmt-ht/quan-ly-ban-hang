/* Hallmark · component: date panel · genre: modern-minimal · design-system: design.md */
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { WEEKDAYS, monthGrid } from './date-utils';

/** Lịch chọn ngày bằng tiếng Việt (tháng, thứ Hai đầu tuần), do DateInputDirective mở bên dưới ô nhập. */
@Component({
  selector: 'app-date-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NavIconComponent],
  template: `
    <div class="head">
      <button type="button" class="nav" aria-label="Tháng trước" (mousedown)="$event.preventDefault()" (click)="shift(-1)"><app-nav-icon name="chevron-left" /></button>
      <span class="title" aria-live="polite">Tháng {{ month() }} năm {{ year() }}</span>
      <button type="button" class="nav" aria-label="Tháng sau" (mousedown)="$event.preventDefault()" (click)="shift(1)"><app-nav-icon name="chevron-right" /></button>
    </div>
    <div class="grid" role="grid" aria-label="Chọn ngày">
      @for (w of weekdays; track w) { <span class="wd" role="columnheader">{{ w }}</span> }
      @for (c of cells(); track c.iso) {
        <button
          type="button" class="day" role="gridcell" [class.out]="!c.inMonth" [class.today]="c.iso === today" [class.sel]="c.iso === selected()"
          [attr.aria-selected]="c.iso === selected()" [attr.aria-current]="c.iso === today ? 'date' : null" [disabled]="blocked(c.iso)"
          (mousedown)="$event.preventDefault()" (click)="pick.emit(c.iso)"
        >{{ c.day }}</button>
      }
    </div>
    <div class="foot">
      <button type="button" class="link-btn" [disabled]="blocked(today)" (mousedown)="$event.preventDefault()" (click)="pick.emit(today)">Hôm nay</button>
      <button type="button" class="link-btn" (mousedown)="$event.preventDefault()" (click)="pick.emit('')">Xoá</button>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 17.5rem;
      padding: var(--space-xs);
      border: var(--rule-hair) solid var(--color-rule);
      border-radius: var(--radius-card);
      background: var(--color-surface);
      box-shadow: var(--shadow-pop);
      color: var(--color-ink);
      font-size: var(--text-sm);
    }
    .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2xs); }
    .title { font-weight: 600; }
    .nav {
      display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border: none;
      border-radius: var(--radius-control); background: none; color: var(--color-muted); cursor: pointer; --icon-size: 16px;
    }
    .nav:hover { background: var(--color-paper-2); color: var(--color-ink); }
    .grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; }
    .wd { padding: var(--space-3xs) 0; text-align: center; font-size: var(--text-xs); font-weight: 600; color: var(--color-muted); }
    .day {
      height: 2.125rem; border: var(--rule-hair) solid transparent; border-radius: var(--radius-control); background: none;
      color: var(--color-ink); font: inherit; font-variant-numeric: tabular-nums; cursor: pointer;
    }
    .day:hover:not(:disabled) { background: var(--color-paper-2); }
    .day.out { color: var(--color-muted); }
    .day.today { border-color: var(--color-rule-strong); }
    .day.sel, .day.sel:hover { background: var(--color-accent); color: var(--color-accent-ink); font-weight: 600; }
    .day:disabled { opacity: 0.4; cursor: not-allowed; }
    .foot { display: flex; justify-content: space-between; margin-top: var(--space-2xs); padding-top: var(--space-2xs); border-top: var(--rule-hair) solid var(--color-rule); }
  `],
})
export class DatePanelComponent {
  /** Ngày đang chọn, "YYYY-MM-DD" (rỗng = chưa chọn). */
  readonly selected = input('');
  readonly min = input('');
  readonly max = input('');
  /** Tháng đang xem khi mở (mặc định: tháng của ngày đang chọn, không thì tháng này). */
  readonly pick = output<string>();

  readonly today = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; })();
  readonly weekdays = WEEKDAYS;
  private readonly offset = signal(0);
  private readonly base = computed(() => {
    const m = /^(\d{4})-(\d{2})/.exec(this.selected() || this.today)!;
    return { y: Number(m[1]), m: Number(m[2]) };
  });
  readonly year = computed(() => Math.floor((this.base().y * 12 + this.base().m - 1 + this.offset()) / 12));
  readonly month = computed(() => ((this.base().y * 12 + this.base().m - 1 + this.offset()) % 12) + 1);
  readonly cells = computed(() => monthGrid(this.year(), this.month()));

  shift(n: number) { this.offset.update((o) => o + n); }

  blocked(iso: string): boolean {
    return (!!this.min() && iso < this.min()) || (!!this.max() && iso > this.max());
  }
}
