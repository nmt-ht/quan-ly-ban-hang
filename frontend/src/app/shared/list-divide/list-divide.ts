import { Component, computed, effect, inject, input, model, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { foldVi } from '../format.util';

/** A rail longer than this gets its own search box. */
const RAIL_SEARCH_FROM = 12;

/**
 * Keeps the open tab / rail entry in the address (`null` = the default, left out), so Back, a refresh or a shared
 * link land on the same slice. Call from a constructor or field initialiser.
 */
export function syncSliceToUrl(params: () => Record<string, string | null>): void {
  const router = inject(Router);
  const route = inject(ActivatedRoute);
  effect(() => {
    const queryParams = params();
    untracked(() => void router.navigate([], { relativeTo: route, queryParams, queryParamsHandling: 'merge', replaceUrl: true }));
  });
}

/** One slice of a list: a tab or a rail entry, with how many rows it holds under the other filters. */
export interface DivideItem<T extends string = string> {
  value: T;
  label: string;
  count: number;
  /** Quieter (e.g. "Chưa phân nhóm", a slice the user cannot pick into). */
  muted?: boolean;
}

/**
 * List pages divide their rows before filtering them (design.md › List pages): the fixed axis as these tabs above
 * the list, the user-made or physical axis as `app-list-rail` beside it. Put both inside `.list-divided`
 * (styles.scss), which also lays out the rail + list split and folds it under 52 rem.
 */
@Component({
  selector: 'app-list-tabs',
  standalone: true,
  template: `
    <div class="ld-tabs" role="group" [attr.aria-label]="label()">
      @for (t of items(); track t.value) {
        <button type="button" [attr.aria-pressed]="value() === t.value" (click)="value.set(t.value)">
          {{ t.label }}<span class="ld-count num">{{ t.count }}</span>
        </button>
      }
    </div>
  `,
})
export class ListTabsComponent<T extends string = string> {
  readonly label = input.required<string>();
  readonly items = input.required<DivideItem<T>[]>();
  readonly value = model.required<T>();
}

@Component({
  selector: 'app-list-rail',
  standalone: true,
  template: `
    <nav class="ld-rail" [attr.aria-label]="title()">
      <h2 class="ld-rail-title">{{ title() }}</h2>
      @if (searchable()) {
        <input type="search" class="ld-rail-search" [placeholder]="'Tìm ' + title().toLowerCase() + '…'" [attr.aria-label]="'Tìm ' + title().toLowerCase()"
          [value]="query()" (input)="query.set($any($event.target).value)" />
      }
      <ul>
        @for (c of visible(); track c.value) {
          <li>
            <button type="button" class="ld-cat" [class.is-muted]="c.muted || !c.count" [attr.aria-pressed]="value() === c.value"
              (click)="value.set(c.value)" [title]="c.label">
              <span class="ld-cat-name">{{ c.label }}</span><span class="ld-count num">{{ c.count }}</span>
            </button>
          </li>
        }
        @if (searchable() && query() && visible().length <= 1) { <li class="ld-none">Không có {{ title().toLowerCase() }} nào khớp.</li> }
      </ul>
      <!-- e.g. a link to where the entries are managed -->
      <ng-content />
    </nav>
  `,
})
export class ListRailComponent<T extends string = string> {
  readonly title = input.required<string>();
  /** First entry is the "all" one (e.g. Tất cả kho); empty entries stay listed so the rail never jumps. */
  readonly items = input.required<DivideItem<T>[]>();
  readonly value = model.required<T>();

  /** A long rail (more than 12 entries) can be searched; "Tất cả" and the open entry always stay in view. */
  readonly searchable = computed(() => this.items().length > RAIL_SEARCH_FROM);
  readonly query = signal('');
  readonly visible = computed(() => {
    const q = foldVi(this.query().trim());
    if (!q || !this.searchable()) return this.items();
    return this.items().filter((c, i) => i === 0 || c.value === this.value() || foldVi(c.label).includes(q));
  });
}
