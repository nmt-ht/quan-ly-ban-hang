import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, input, model, signal, viewChild,
} from '@angular/core';
import { Product } from '../../core/models/domain.models';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { foldVi } from '../format.util';

const TYPE_TAG: Record<Product['type'], string> = { VAT_TU: 'VT', THANH_PHAM: 'SP', DICH_VU: 'DV' };

// Searchable product combobox (as in production's "Chọn hàng hoá"): type tag, code, name and
// current stock per option. The list is position:fixed so it is not clipped inside a
// horizontally scrolling table.
/** Height of the list (px, = 18 rem) and of the search row above it — used to decide where the panel opens. */
const LIST_MAX = 288;
const SEARCH_H = 48;

@Component({
  selector: 'app-product-picker',
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
      [attr.aria-expanded]="open()"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-invalid]="invalid() ? 'true' : null"
      [disabled]="disabled()"
      (click)="toggle()"
      (keydown)="onTriggerKey($event)"
    >
      @if (selected(); as p) {
        <span class="pp-code num">{{ p.code }}</span>
        <span class="pp-name">{{ p.name }}</span>
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
            placeholder="Tìm mã, mã đối chiếu hoặc tên hàng (không cần dấu)..."
            aria-label="Tìm hàng hoá"
            [value]="query()"
            (input)="query.set($any($event.target).value); active.set(0)"
            (keydown)="onSearchKey($event)"
            role="combobox"
            aria-controls="pp-list"
            [attr.aria-activedescendant]="'pp-opt-' + active()"
          />
        </div>
        <ul class="pp-list" id="pp-list" role="listbox">
          @for (p of visible(); track p.id; let i = $index) {
            <li
              [id]="'pp-opt-' + i"
              role="option"
              class="pp-option"
              [class.is-active]="i === active()"
              [attr.aria-selected]="p.id === value()"
              (mousedown)="$event.preventDefault()"
              (click)="choose(p)"
              (mouseenter)="active.set(i)"
            >
              <span class="pp-tag">{{ tag(p) }}</span>
              <span class="pp-code num">{{ p.code }}</span>
              <span class="pp-name">{{ p.name }}</span>
              <span class="pp-stock num">{{ stockText(p) }}</span>
            </li>
          } @empty {
            <li class="pp-empty">Không tìm thấy hàng hoá phù hợp</li>
          }
        </ul>
      </div>
    }
  `,
  styleUrl: './product-picker.component.scss',
})
export class ProductPickerComponent {
  readonly products = input.required<Product[]>();
  readonly stock = input<Map<string, number>>(new Map());
  readonly placeholder = input('Chọn hàng hoá');
  readonly ariaLabel = input('Hàng hoá');
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly value = model<string>('');

  readonly open = signal(false);
  readonly query = signal('');
  readonly active = signal(0);
  readonly pos = signal({ top: 0, bottom: 0, left: 0, width: 0, up: false, listMax: LIST_MAX });
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly search = viewChild<ElementRef<HTMLInputElement>>('search');

  readonly selected = computed(() => this.products().find((p) => p.id === this.value()));
  readonly visible = computed(() => {
    const q = foldVi(this.query().trim());
    const list = q
      ? this.products().filter((p) => foldVi(`${p.code} ${p.crossRefCode ?? ''} ${p.name}`).includes(q))
      : this.products();
    return list.slice(0, 80);
  });

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  tag(p: Product): string {
    return TYPE_TAG[p.type];
  }

  stockText(p: Product): string {
    if (p.type === 'DICH_VU') return '';
    return `${(this.stock().get(p.id) ?? 0).toLocaleString('vi-VN')} ${p.baseUnit.toLowerCase()}`;
  }

  toggle(): void {
    this.open() ? this.close(false) : this.show();
  }

  show(): void {
    const r = this.trigger().nativeElement.getBoundingClientRect();
    const width = Math.max(r.width, 360);
    const left = Math.min(r.left, window.innerWidth - width - 8);
    // Opens below the field; when the room below is short (a row near the bottom, the sticky Lưu bar) and there is more
    // above, it opens upward. The list shrinks to the room it has, so the panel never runs off the screen.
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < LIST_MAX + SEARCH_H && above > below;
    const listMax = Math.max(120, Math.min(LIST_MAX, (up ? above : below) - SEARCH_H));
    this.pos.set({
      top: r.bottom + 4, bottom: window.innerHeight - r.top + 4, left: Math.max(8, left), width: Math.min(width, window.innerWidth - 16), up, listMax,
    });
    this.query.set('');
    this.active.set(Math.max(0, this.products().findIndex((p) => p.id === this.value())));
    this.open.set(true);
    setTimeout(() => this.search()?.nativeElement.focus());
  }

  close(focusTrigger = true): void {
    this.open.set(false);
    if (focusTrigger) this.trigger().nativeElement.focus();
  }

  choose(p: Product): void {
    this.value.set(p.id);
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
      const p = this.visible()[this.active()];
      if (p) this.choose(p);
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
