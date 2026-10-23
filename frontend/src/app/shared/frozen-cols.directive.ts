import { DestroyRef, Directive, ElementRef, afterNextRender, effect, inject, input, numberAttribute } from '@angular/core';

/** Keys of the columns that name a row (Mã, Tên…) — list and report grids freeze the leading run of these. */
const IDENTITY_KEYS = new Set(['image', 'code', 'name', 'plateNumber']);

/** How many leading columns to freeze: the run of identity columns at the start, at most 3. */
export function identityColumns(keys: readonly string[]): number {
  let n = 0;
  while (n < keys.length && n < 3 && IDENTITY_KEYS.has(keys[n])) n++;
  return n;
}

/**
 * `<table [appFrozenCols]="2">`: the first N columns stay put while the table scrolls sideways (styles.scss ›
 * frozen columns). The CSS needs each column's left edge, so this measures the header cells and keeps
 * `--fz-1` / `--fz-2` current as widths change, and marks the table `data-scrolled` once it has moved.
 */
@Directive({ selector: 'table[appFrozenCols]', standalone: true })
export class FrozenColsDirective {
  readonly appFrozenCols = input(0, { transform: numberAttribute });

  private readonly table = inject<ElementRef<HTMLTableElement>>(ElementRef).nativeElement;
  private readonly sizes = new ResizeObserver(() => this.measure());
  private readonly cells = new MutationObserver(() => this.watch());
  private scroller: HTMLElement | null = null;
  private readonly onScroll = () => this.table.toggleAttribute('data-scrolled', (this.scroller?.scrollLeft ?? 0) > 0);

  constructor() {
    effect(() => {
      const n = this.appFrozenCols();
      if (n > 0) this.table.dataset['freeze'] = String(n);
      else delete this.table.dataset['freeze'];
      this.watch();
    });
    afterNextRender(() => {
      this.scroller = scrollParent(this.table);
      this.scroller?.addEventListener('scroll', this.onScroll, { passive: true });
      if (this.table.tHead) this.cells.observe(this.table.tHead, { childList: true, subtree: true });
      this.watch();
    });
    inject(DestroyRef).onDestroy(() => {
      this.sizes.disconnect();
      this.cells.disconnect();
      this.scroller?.removeEventListener('scroll', this.onScroll);
    });
  }

  private head(): HTMLTableCellElement[] {
    return Array.from(this.table.tHead?.rows[0]?.cells ?? []).slice(0, this.appFrozenCols());
  }

  /** Header cells are re-rendered when the columns change: observe the current ones. */
  private watch(): void {
    this.sizes.disconnect();
    for (const c of this.head()) this.sizes.observe(c);
    this.measure();
  }

  private measure(): void {
    // Sum the widths, not offsetLeft: a stuck cell's offset already includes the old --fz, so it would keep it.
    let left = 0;
    this.head().forEach((c, i) => {
      if (i > 0) this.table.style.setProperty(`--fz-${i}`, `${left}px`);
      left += c.getBoundingClientRect().width;
    });
  }
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const x = getComputedStyle(p).overflowX;
    if (x === 'auto' || x === 'scroll') return p;
  }
  return null;
}
