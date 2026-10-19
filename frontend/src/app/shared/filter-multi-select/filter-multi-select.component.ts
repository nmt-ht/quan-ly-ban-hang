import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, input, model, signal, viewChild,
} from '@angular/core';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { foldVi } from '../format.util';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
  dotClass?: string; // colour dot before the label (e.g. a type class)
}

// Checkbox dropdown for list-page filter bars (Tính chất, Nhóm hàng, ...).
@Component({
  selector: 'app-filter-multi-select',
  standalone: true,
  imports: [NavIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="ms-trigger"
      [class.has-value]="selected().length > 0"
      aria-haspopup="true"
      [attr.aria-expanded]="open()"
      (click)="toggle()"
    >
      <span class="ms-trigger-label">{{ label() }}</span>
      @if (selected().length > 0) {
        <span class="ms-badge num">{{ selected().length }}</span>
      }
      <app-nav-icon class="ms-chevron" name="chevrons-updown" />
    </button>

    @if (open()) {
      <div class="ms-panel" [class.align-end]="alignEnd()" role="group" [attr.aria-label]="label()">
        @if (searchable()) {
          <div class="ms-search">
            <app-nav-icon class="ms-search-icon" name="search" />
            <input
              #searchInput
              type="text"
              [placeholder]="searchPlaceholder()"
              [value]="query()"
              (input)="query.set($any($event.target).value)"
              [attr.aria-label]="searchPlaceholder()"
            />
          </div>
        }
        <div class="ms-options">
          @for (o of visibleOptions(); track o.value) {
            <label class="ms-option">
              <input type="checkbox" [checked]="isSelected(o.value)" (change)="toggleValue(o.value)" />
              @if (o.dotClass) {
                <span class="type-dot" [class]="'type-dot ' + o.dotClass" aria-hidden="true"></span>
              }
              <span class="ms-option-label">{{ o.label }}</span>
              @if (o.count !== undefined) {
                <span class="ms-option-count num">{{ o.count }}</span>
              }
            </label>
          } @empty {
            <p class="ms-empty">Không tìm thấy {{ label().toLowerCase() }} phù hợp</p>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    :host { position: relative; display: inline-flex; }
    .ms-trigger {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2xs);
      min-height: var(--control-h);
      padding: 0 var(--space-2xs) 0 var(--space-xs);
      border: var(--rule-hair) solid var(--color-rule-strong);
      border-radius: var(--radius-control);
      background: var(--color-surface);
      color: var(--color-muted);
      font-size: var(--text-sm);
      white-space: nowrap;
      cursor: pointer;
      transition: border-color var(--dur-short) var(--ease-out);
      --icon-size: 16px;
    }
    @media (hover: hover) {
      .ms-trigger:hover { border-color: var(--color-ink-2); }
    }
    .ms-trigger[aria-expanded='true'] { border-color: var(--color-ink-2); background: var(--color-paper-2); }
    .ms-trigger.has-value { color: var(--color-ink); }
    .ms-trigger:focus-visible { outline-offset: 0; border-color: var(--color-focus); }
    .ms-badge {
      min-width: 1.25rem;
      padding: 0 var(--space-3xs);
      border-radius: var(--radius-control);
      background: var(--color-ink);
      color: var(--color-surface);
      font-size: var(--text-2xs);
      line-height: 1.25rem;
      text-align: center;
    }
    .ms-chevron { color: var(--color-muted); }

    .ms-panel {
      position: absolute;
      top: calc(100% + var(--space-3xs));
      left: 0;
      z-index: 25;
      width: max(100%, 15rem);
      max-width: min(20rem, calc(100vw - 2 * var(--space-sm)));
      background: var(--color-surface);
      border: var(--rule-hair) solid var(--color-rule);
      border-radius: var(--radius-card);
      box-shadow: 0 8px 24px var(--color-shadow);
      overflow: hidden;
    }
    .ms-panel.align-end { left: auto; right: 0; }
    .ms-search {
      display: flex;
      align-items: center;
      gap: var(--space-2xs);
      padding: 0 var(--space-xs);
      border-bottom: var(--rule-hair) solid var(--color-rule);
      color: var(--color-muted);
      --icon-size: 16px;
    }
    .ms-search input {
      flex: 1;
      min-width: 0;
      min-height: 2.5rem;
      border: none;
      background: none;
      color: var(--color-ink);
      font-size: var(--text-sm);
    }
    .ms-search input::placeholder { color: var(--color-muted); }
    .ms-search input:focus-visible { outline: none; }
    .ms-search:focus-within { box-shadow: inset 0 -2px 0 var(--color-focus); }
    .ms-options {
      max-height: 20rem;
      overflow-y: auto;
      padding: var(--space-3xs);
      scrollbar-width: thin;
    }
    .ms-option {
      display: flex;
      align-items: center;
      gap: var(--space-2xs);
      min-height: 2.25rem;
      padding: 0 var(--space-2xs);
      border-radius: var(--radius-control);
      font-size: var(--text-sm);
      color: var(--color-ink);
      cursor: pointer;
    }
    @media (hover: hover) {
      .ms-option:hover { background: var(--color-paper-2); }
    }
    .ms-option:focus-within { background: var(--color-paper-2); }
    .ms-option input { margin: 0; width: 1rem; height: 1rem; flex-shrink: 0; }
    .ms-option-label { flex: 1; min-width: 0; overflow-wrap: anywhere; }
    .ms-option-count { color: var(--color-muted); font-size: var(--text-xs); }
    .ms-empty { margin: 0; padding: var(--space-xs); color: var(--color-muted); font-size: var(--text-sm); }
  `],
})
export class FilterMultiSelectComponent {
  readonly label = input.required<string>();
  readonly options = input.required<FilterOption[]>();
  readonly searchable = input(false);
  readonly searchPlaceholder = input('Tìm...');
  readonly selected = model<string[]>([]);

  readonly open = signal(false);
  readonly query = signal('');
  readonly alignEnd = signal(false);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly visibleOptions = computed(() => {
    const q = foldVi(this.query().trim());
    return q ? this.options().filter((o) => foldVi(o.label).includes(q)) : this.options();
  });

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  toggle(): void {
    this.open.update((v) => !v);
    if (this.open()) {
      this.query.set('');
      // Flip to right-aligned when a left-aligned panel would run off-screen.
      const host = this.host.nativeElement.getBoundingClientRect();
      this.alignEnd.set(host.left + 240 > window.innerWidth - 16);
      setTimeout(() => this.searchInput()?.nativeElement.focus());
    }
  }

  isSelected(value: string): boolean {
    return this.selected().includes(value);
  }

  toggleValue(value: string): void {
    this.selected.update((cur) => (cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]));
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.host.nativeElement.querySelector<HTMLButtonElement>('.ms-trigger')?.focus();
  }
}
