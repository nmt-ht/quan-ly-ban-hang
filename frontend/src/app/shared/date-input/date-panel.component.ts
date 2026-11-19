/* Hallmark · component: date panel · genre: modern-minimal · design-system: design.md */
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { isoDay } from '../period';
import { WEEKDAYS, addDays, addMonths, monthGrid } from './date-utils';

/**
 * Lịch chọn ngày bằng tiếng Việt (tháng, thứ Hai đầu tuần), do DateInputDirective mở bên dưới ô nhập. Con trỏ bàn phím vẫn ở ô
 * nhập: phím mũi tên dời ngày đang trỏ (`active`), Enter chọn ngày đó (ô nhập trỏ tới ô ngày bằng aria-activedescendant).
 */
@Component({
  selector: 'app-date-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NavIconComponent],
  template: `
    <div class="head">
      <button type="button" class="nav" tabindex="-1" aria-label="Tháng trước" (mousedown)="$event.preventDefault()" (click)="shift(-1)"><app-nav-icon name="chevron-left" /></button>
      <span class="title" aria-live="polite">Tháng {{ month() }} năm {{ year() }}</span>
      <button type="button" class="nav" tabindex="-1" aria-label="Tháng sau" (mousedown)="$event.preventDefault()" (click)="shift(1)"><app-nav-icon name="chevron-right" /></button>
    </div>
    <div class="grid" role="grid" aria-label="Chọn ngày">
      @for (w of weekdays; track w) { <span class="wd" role="columnheader">{{ w }}</span> }
      @for (c of cells(); track c.iso) {
        <button
          type="button" class="day" role="gridcell" tabindex="-1" [id]="cellId(c.iso)"
          [class.out]="!c.inMonth" [class.today]="c.iso === today" [class.sel]="c.iso === selected()" [class.active]="c.iso === active()"
          [attr.aria-selected]="c.iso === selected()" [attr.aria-current]="c.iso === today ? 'date' : null" [disabled]="blocked(c.iso)"
          (mousedown)="$event.preventDefault()" (click)="pick.emit(c.iso)"
        >{{ c.day }}</button>
      }
    </div>
    <div class="foot">
      <button type="button" class="link-btn" tabindex="-1" [disabled]="blocked(today)" (mousedown)="$event.preventDefault()" (click)="pick.emit(today)">Hôm nay</button>
      <button type="button" class="link-btn" tabindex="-1" (mousedown)="$event.preventDefault()" (click)="pick.emit('')">Xoá</button>
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
    .day.active { outline: 2px solid var(--color-accent); outline-offset: -2px; }
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
  /** Tiền tố id của các ô ngày (để ô nhập trỏ tới bằng aria-activedescendant). */
  readonly idPrefix = input('date-panel');
  readonly pick = output<string>();

  readonly today = isoDay(new Date());
  readonly weekdays = WEEKDAYS;
  /** Ngày đang trỏ bằng bàn phím. */
  readonly active = signal(this.today);
  /** Tháng đang xem, tính bằng số tháng từ năm 0 (năm × 12 + tháng − 1). */
  private readonly view = signal(monthIndex(this.today));
  readonly year = computed(() => Math.floor(this.view() / 12));
  readonly month = computed(() => (this.view() % 12) + 1);
  readonly cells = computed(() => monthGrid(this.year(), this.month()));

  cellId(iso: string): string { return `${this.idPrefix()}-${iso}`; }

  /** Trỏ tới ngày `iso` và hiện tháng của nó. */
  focusDay(iso: string): void {
    this.active.set(iso);
    this.view.set(monthIndex(iso));
  }

  shift(n: number): void { this.view.update((v) => v + n); }

  /** Phím mũi tên / PageUp / PageDown: dời ngày đang trỏ. */
  moveDays(n: number): void { this.focusDay(addDays(this.active(), n)); }
  moveMonths(n: number): void { this.focusDay(addMonths(this.active(), n)); }

  blocked(iso: string): boolean {
    return (!!this.min() && iso < this.min()) || (!!this.max() && iso > this.max());
  }
}

const monthIndex = (iso: string): number => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
