import { Component, ElementRef, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { PAPER_LABEL, Paper, PrintService } from './print.service';

// "In" button with the paper beside it: one click prints on the paper last used for this kind of document,
// the arrow opens the choice (A4 · A5 · K80). A document that has only one paper gets a plain button.
//   <app-print-menu kind="sales-order" [papers]="['A4', 'A5', 'K80']" />
//   <app-print-menu kind="trip-delivery" label="Phiếu giao hàng" (prepare)="printMode.set('giao')" (done)="printMode.set(null)" />
@Component({
  selector: 'app-print-menu',
  standalone: true,
  imports: [NavIconComponent],
  template: `
    <div class="pm" [class.pm-down]="down()">
      <button type="button" class="btn pm-main" [disabled]="disabled() || busy()" (click)="run(paper())"
        [attr.aria-label]="label() + (choice() ? ' — khổ ' + paper() : '')">
        <app-nav-icon name="printer" />{{ label() }}
        @if (choice()) { <span class="pm-paper num">{{ paper() }}</span> }
      </button>
      @if (choice()) {
        <button type="button" class="btn pm-caret" [disabled]="disabled() || busy()" aria-haspopup="menu" [attr.aria-expanded]="open()"
          [attr.aria-label]="'Chọn khổ giấy cho ' + label()" (click)="open.set(!open())">
          <app-nav-icon name="chevron-down" />
        </button>
        @if (open()) {
          <div class="wv-menu-panel pm-panel" role="menu" [attr.aria-label]="'Khổ giấy — ' + label()">
            @for (p of papers(); track p) {
              <button type="button" role="menuitemradio" [attr.aria-checked]="p === paper()" (click)="pick(p)">
                <strong class="num">{{ text[p].name }}</strong><span>{{ text[p].hint }}</span>
              </button>
            }
          </div>
        }
      }
    </div>
  `,
  styles: `
    :host { display: inline-flex; }
    .pm { position: relative; display: inline-flex; }
    .pm-main { white-space: nowrap; }
    .pm:has(.pm-caret) .pm-main { border-start-end-radius: 0; border-end-end-radius: 0; }
    .pm-caret { margin-inline-start: -1px; padding-inline: 6px; border-start-start-radius: 0; border-end-start-radius: 0; }
    .pm-paper {
      padding: 0 5px;
      border: var(--rule-hair) solid var(--color-rule);
      border-radius: var(--radius-control);
      color: var(--color-muted);
      font-size: var(--text-xs);
      line-height: 1.5;
    }
    /* Print buttons live in the sticky action bar at the bottom: the menu opens upward unless [down]. */
    .pm-panel { top: auto; bottom: calc(100% + 4px); min-width: 15rem; }
    .pm-down .pm-panel { top: calc(100% + 4px); bottom: auto; }
    .pm-panel button {
      display: grid;
      grid-template-columns: 2.75rem 1fr;
      align-items: baseline;
      gap: 8px;
      padding: 8px 10px;
      border: 0;
      border-radius: var(--radius-control);
      background: none;
      color: var(--color-ink);
      font: inherit;
      font-size: var(--text-sm);
      text-align: left;
      cursor: pointer;
    }
    .pm-panel button span { color: var(--color-muted); font-size: var(--text-xs); }
    .pm-panel button[aria-checked='true'] { background: var(--color-paper-2); }
    .pm-panel button[aria-checked='true'] strong { color: var(--color-accent); }
    .pm-panel button:focus-visible { outline: 2px solid var(--color-focus); outline-offset: -2px; }
    @media (hover: hover) { .pm-panel button:hover { background: var(--color-paper-2); } }
  `,
})
export class PrintMenuComponent {
  private readonly printer = inject(PrintService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Which document this prints — the paper is remembered per kind. */
  readonly kind = input.required<string>();
  readonly papers = input<readonly Paper[]>(['A4', 'A5', 'K80']);
  readonly label = input('In');
  readonly disabled = input(false);
  /** Open the menu below the button (a button in a page header, not in the bottom action bar). */
  readonly down = input(false);
  /** Before printing: show the document to print (screens that print one of several). */
  readonly prepare = output<void>();
  readonly done = output<void>();

  readonly text = PAPER_LABEL;
  readonly open = signal(false);
  readonly busy = signal(false);
  private readonly chosen = signal<Paper | null>(null);
  readonly choice = computed(() => this.papers().length > 1);
  readonly paper = computed(() => this.chosen() ?? this.printer.remembered(this.kind(), this.papers()));

  pick(p: Paper): void {
    this.chosen.set(p);
    this.open.set(false);
    this.run(p);
  }

  async run(p: Paper): Promise<void> {
    this.open.set(false);
    this.busy.set(true);
    try {
      await this.printer.print(this.kind(), p, () => this.prepare.emit(), () => this.done.emit());
    } finally {
      this.busy.set(false);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(false);
  }
}
