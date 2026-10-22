import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, input, model, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { MoneyInputDirective } from '../money-input.directive';

export interface NumberRange {
  min: number | null;
  max: number | null;
}

const vnd = (n: number) => n.toLocaleString('vi-VN') + '₫';

// "Giá trị đơn" (as in production): Từ → Đến in a popover, applied as you type.
@Component({
  selector: 'app-range-filter',
  standalone: true,
  imports: [NavIconComponent, ReactiveFormsModule, MoneyInputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="fp-trigger"
      [class.has-value]="active()"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open()"
      (click)="toggle()"
    >
      <span>{{ active() ? summary() : label() }}</span>
      <app-nav-icon name="chevron-down" />
    </button>

    @if (open()) {
      <div class="fp-panel range-panel" role="dialog" [attr.aria-label]="label()">
        <p class="range-title">{{ label() }}</p>
        <div class="range-inputs">
          <input type="text" appMoney [formControl]="minCtrl" placeholder="Từ" aria-label="Từ" />
          <span class="period-arrow" aria-hidden="true">→</span>
          <input type="text" appMoney [formControl]="maxCtrl" placeholder="Đến" aria-label="Đến" />
        </div>
        <p class="range-unit">Đơn vị: ₫</p>
      </div>
    }
  `,
  styles: [`:host { position: relative; display: inline-flex; }`],
})
export class RangeFilterComponent {
  readonly label = input('Giá trị');
  readonly value = model<NumberRange>({ min: null, max: null });
  readonly open = signal(false);
  readonly minCtrl = new FormControl<number | null>(null);
  readonly maxCtrl = new FormControl<number | null>(null);

  readonly active = computed(() => this.value().min !== null || this.value().max !== null);
  readonly summary = computed(() => {
    const { min, max } = this.value();
    if (min !== null && max !== null) return `${vnd(min)} – ${vnd(max)}`;
    if (min !== null) return `≥ ${vnd(min)}`;
    return `≤ ${vnd(max!)}`;
  });

  constructor(private readonly host: ElementRef<HTMLElement>) {
    this.minCtrl.valueChanges.subscribe((min) => this.value.update((v) => ({ ...v, min })));
    this.maxCtrl.valueChanges.subscribe((max) => this.value.update((v) => ({ ...v, max })));
  }

  toggle(): void {
    if (!this.open()) {
      this.minCtrl.setValue(this.value().min, { emitEvent: false });
      this.maxCtrl.setValue(this.value().max, { emitEvent: false });
      setTimeout(() => this.host.nativeElement.querySelector<HTMLInputElement>('.range-inputs input')?.focus());
    }
    this.open.update((v) => !v);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.host.nativeElement.querySelector<HTMLButtonElement>('.fp-trigger')?.focus();
  }
}
