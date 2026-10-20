import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, model, signal } from '@angular/core';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { DateRange, PERIOD_GROUPS, PERIOD_PRESETS, PeriodPreset, presetRange } from '../period';

export interface PeriodValue {
  preset: PeriodPreset | 'custom' | null; // null = no period filter
  range: DateRange;
}

export const NO_PERIOD: PeriodValue = { preset: null, range: { from: null, to: null } };

// "Chọn kỳ" (as in production): a grouped preset menu that fills the two date fields shown
// inline next to it; editing a date by hand makes the period custom.
@Component({
  selector: 'app-period-filter',
  standalone: true,
  imports: [NavIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="period-anchor">
      <button
        type="button"
        class="fp-trigger"
        [class.has-value]="isPreset()"
        aria-haspopup="menu"
        [attr.aria-expanded]="open()"
        (click)="open.set(!open())"
      >
        <app-nav-icon name="calendar" />
        <span>{{ presetLabel() }}</span>
        <app-nav-icon name="chevron-down" />
      </button>

      @if (open()) {
        <div class="fp-panel period-menu" role="menu" aria-label="Chọn kỳ">
          @for (g of groups; track g.label) {
            <p class="period-group-label" role="presentation">{{ g.label }}</p>
            @for (p of g.presets; track p.value) {
              <button
                type="button"
                role="menuitemradio"
                class="period-option"
                [attr.aria-checked]="value().preset === p.value"
                (click)="pickPreset(p.value)"
              >
                {{ p.label }}
                @if (value().preset === p.value) { <app-nav-icon name="check" /> }
              </button>
            }
          }
          <button type="button" role="menuitem" class="period-option period-all" (click)="clear()">
            Toàn bộ (bỏ lọc ngày)
          </button>
        </div>
      }
    </div>

    <input
      type="date"
      class="period-date"
      aria-label="Từ ngày"
      [value]="value().range.from ?? ''"
      [max]="value().range.to ?? ''"
      (change)="setDate('from', $any($event.target).value)"
    />
    <span class="period-arrow" aria-hidden="true">→</span>
    <input
      type="date"
      class="period-date"
      aria-label="Đến ngày"
      [value]="value().range.to ?? ''"
      [min]="value().range.from ?? ''"
      (change)="setDate('to', $any($event.target).value)"
    />
  `,
  styles: [`
    :host { display: inline-flex; align-items: center; gap: var(--space-2xs); flex-wrap: wrap; }
    .period-anchor { position: relative; display: inline-flex; }
  `],
})
export class PeriodFilterComponent {
  readonly value = model<PeriodValue>(NO_PERIOD);
  readonly groups = PERIOD_GROUPS;
  readonly open = signal(false);

  readonly isPreset = computed(() => this.value().preset !== null && this.value().preset !== 'custom');
  readonly presetLabel = computed(() =>
    this.isPreset() ? (PERIOD_PRESETS.find((p) => p.value === this.value().preset)?.label ?? 'Chọn kỳ') : 'Chọn kỳ',
  );

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  pickPreset(p: PeriodPreset): void {
    this.value.set({ preset: p, range: presetRange(p) });
    this.open.set(false);
  }

  setDate(which: 'from' | 'to', v: string): void {
    const range = { ...this.value().range, [which]: v || null };
    this.value.set(range.from || range.to ? { preset: 'custom', range } : NO_PERIOD);
  }

  clear(): void {
    this.value.set(NO_PERIOD);
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.querySelector('.period-anchor')!.contains(e.target as Node)) this.open.set(false);
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.host.nativeElement.querySelector<HTMLButtonElement>('.fp-trigger')?.focus();
  }
}
