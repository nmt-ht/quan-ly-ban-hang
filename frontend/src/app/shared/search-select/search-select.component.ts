import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, input, model, signal, viewChild,
} from '@angular/core';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { foldVi } from '../format.util';

/** One choice: `code` shows in mono before the label; `hint` muted after it; `search` adds words to match on. */
export interface SearchOption {
  value: string;
  label: string;
  code?: string;
  hint?: string;
  search?: string;
}

/** Rows drawn at once: typing narrows a long list (1 000 khách) instead of scrolling it. */
const SHOWN = 80;
/** Height of the list (px, = 18 rem) and of the search row above it — used to decide where the panel opens. */
const LIST_MAX = 288;
const SEARCH_H = 48;

// Searchable select for lists that grow (khách hàng, nhà cung cấp, người dùng…): a trigger that reads like a select,
// a panel with a search box (mã, tên, số điện thoại — không cần dấu) and the matching options. Same look and keys as
// app-product-picker; the panel is position:fixed so a scrolling table never clips it.
@Component({
  selector: 'app-search-select',
  standalone: true,
  imports: [NavIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      #trigger
      type="button"
      class="pp-trigger"
      role="combobox"
      aria-haspopup="listbox"
      [attr.id]="inputId() || null"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="ariaLabel() || null"
      [attr.aria-invalid]="invalid() ? 'true' : null"
      [disabled]="disabled()"
      (click)="toggle()"
      (keydown)="onTriggerKey($event)"
    >
      @if (selected(); as o) {
        @if (o.code) { <span class="pp-code num">{{ o.code }}</span> }
        <span class="pp-name">{{ o.label }}</span>
      } @else {
        <span class="pp-placeholder">{{ placeholder() }}</span>
      }
      @if (!disabled()) {
        <app-nav-icon class="pp-chevron" name="chevrons-updown" />
      }
    </button>

    @if (open()) {
      <div class="pp-panel" [class.is-up]="pos().up" [style.top.px]="pos().up ? null : pos().top" [style.bottom.px]="pos().up ? pos().bottom : null"
        [style.left.px]="pos().left" [style.width.px]="pos().width" [style.--pp-list-max]="pos().listMax + 'px'">
        <div class="pp-search">
          <app-nav-icon name="search" />
          <input
            #search
            type="text"
            [placeholder]="searchPlaceholder()"
            [attr.aria-label]="searchPlaceholder()"
            [value]="query()"
            (input)="query.set($any($event.target).value); active.set(0)"
            (keydown)="onSearchKey($event)"
            role="combobox"
            [attr.aria-controls]="listId"
            [attr.aria-activedescendant]="listId + '-' + active()"
          />
        </div>
        <ul class="pp-list" [id]="listId" role="listbox">
          @for (o of visible(); track o.value; let i = $index) {
            <li
              [id]="listId + '-' + i"
              role="option"
              class="pp-option"
              [class.is-active]="i === active()"
              [class.is-empty-choice]="o.value === '' "
              [attr.aria-selected]="o.value === value()"
              (mousedown)="$event.preventDefault()"
              (click)="choose(o)"
              (mouseenter)="active.set(i)"
            >
              @if (o.code) { <span class="pp-code num">{{ o.code }}</span> }
              <span class="pp-name">{{ o.label }}</span>
              @if (o.hint) { <span class="pp-stock num">{{ o.hint }}</span> }
            </li>
          } @empty {
            <li class="pp-empty">{{ emptyText() }}</li>
          }
          @if (more() > 0) {
            <li class="pp-empty">Còn {{ more().toLocaleString('vi-VN') }} kết quả — gõ thêm để thu hẹp</li>
          }
        </ul>
      </div>
    }
  `,
  styleUrls: ['../product-picker/product-picker.component.scss', './search-select.component.scss'],
})
export class SearchSelectComponent {
  readonly options = input.required<SearchOption[]>();
  readonly placeholder = input('— Chọn —');
  /** A first row that clears the choice (e.g. "— Chưa chọn —", "Tất cả nhà cung cấp"); none when empty. */
  readonly emptyLabel = input('');
  /** The value that row stands for ('' by default; list filters use 'all'). */
  readonly emptyValue = input('');
  readonly searchPlaceholder = input('Tìm theo mã, tên hoặc số điện thoại (không cần dấu)…');
  readonly emptyText = input('Không tìm thấy kết quả phù hợp');
  readonly ariaLabel = input('');
  /** id of the trigger, for a <label for>. */
  readonly inputId = input('');
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly value = model<string>('');

  private static seq = 0;
  readonly listId = `ss-list-${++SearchSelectComponent.seq}`;

  readonly open = signal(false);
  readonly query = signal('');
  readonly active = signal(0);
  readonly pos = signal({ top: 0, bottom: 0, left: 0, width: 0, up: false, listMax: LIST_MAX });
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly search = viewChild<ElementRef<HTMLInputElement>>('search');

  /** Every option folded once (accent-free, lower case), so filtering 1 000 rows per key stays instant. */
  private readonly index = computed(() => this.options().map((o) => ({ o, text: foldVi(`${o.code ?? ''} ${o.label} ${o.hint ?? ''} ${o.search ?? ''}`) })));

  readonly selected = computed(() =>
    this.value() === this.emptyValue() && this.emptyLabel() ? { value: this.emptyValue(), label: this.emptyLabel() } as SearchOption
      : this.options().find((o) => o.value === this.value()));

  private readonly matches = computed(() => {
    const words = foldVi(this.query().trim()).split(/\s+/).filter(Boolean);
    const all = this.index();
    // Every word must appear somewhere (mã, tên, số điện thoại…), in any order.
    return words.length ? all.filter((x) => words.every((w) => x.text.includes(w))).map((x) => x.o) : all.map((x) => x.o);
  });

  readonly visible = computed<SearchOption[]>(() => {
    const head: SearchOption[] = this.emptyLabel() && !this.query().trim() ? [{ value: this.emptyValue(), label: this.emptyLabel() }] : [];
    return [...head, ...this.matches().slice(0, SHOWN)];
  });

  readonly more = computed(() => Math.max(0, this.matches().length - SHOWN));

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  toggle(): void {
    this.open() ? this.close(false) : this.show();
  }

  show(): void {
    const r = this.trigger().nativeElement.getBoundingClientRect();
    const width = Math.max(r.width, 320);
    const left = Math.min(r.left, window.innerWidth - width - 8);
    // Opens below the field; when the room below is short and there is more above, it opens upward. The list shrinks to
    // the room it has, so the panel never runs off the screen.
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < LIST_MAX + SEARCH_H && above > below;
    const listMax = Math.max(120, Math.min(LIST_MAX, (up ? above : below) - SEARCH_H));
    this.pos.set({
      top: r.bottom + 4, bottom: window.innerHeight - r.top + 4, left: Math.max(8, left), width: Math.min(width, window.innerWidth - 16), up, listMax,
    });
    this.query.set('');
    this.active.set(Math.max(0, this.visible().findIndex((o) => o.value === this.value())));
    this.open.set(true);
    setTimeout(() => {
      this.search()?.nativeElement.focus();
      this.scrollActive();
    });
  }

  close(focusTrigger = true): void {
    this.open.set(false);
    if (focusTrigger) this.trigger().nativeElement.focus();
  }

  choose(o: SearchOption): void {
    this.value.set(o.value);
    this.close();
  }

  onTriggerKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!this.open()) this.show();
    }
  }

  onSearchKey(e: KeyboardEvent): void {
    const n = this.visible().length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.active.set(Math.min(n - 1, this.active() + 1));
      this.scrollActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.active.set(Math.max(0, this.active() - 1));
      this.scrollActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = this.visible()[this.active()];
      if (o) this.choose(o);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
    } else if (e.key === 'Tab') {
      this.close(false);
    }
  }

  private scrollActive(): void {
    setTimeout(() => this.host.nativeElement.querySelector('.pp-option.is-active')?.scrollIntoView({ block: 'nearest' }));
  }

  @HostListener('document:mousedown', ['$event'])
  onDocMouseDown(e: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.close(false);
  }

  // A fixed panel would drift away from its field on scroll; close it instead.
  @HostListener('window:scroll')
  @HostListener('window:resize')
  onViewportChange(): void {
    if (this.open()) this.close(false);
  }
}
