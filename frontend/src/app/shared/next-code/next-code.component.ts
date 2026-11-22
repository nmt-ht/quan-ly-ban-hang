import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { NextCodeService } from './next-code.service';

/**
 * The "Số chứng từ" of a form: the saved number when there is one, else the number the save will probably take, marked "dự kiến"
 * (it is final only when saved). `<app-next-code prefix="DN" [code]="order()?.code" />`
 */
@Component({
  selector: 'app-next-code',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (code(); as c) { {{ c }} }
    @else if (next(); as n) { {{ n }} <span class="nc-note" title="Số được cấp khi lưu; nếu người khác lưu trước thì số này nhảy lên">dự kiến</span> }
    @else { Tự sinh khi lưu }
  `,
  styles: `.nc-note { margin-left: var(--space-3xs); color: var(--color-muted); font-family: var(--font-body, inherit); font-size: var(--text-xs); font-weight: 400; }`,
})
export class NextCodeComponent {
  private readonly svc = inject(NextCodeService);
  /** DN, DH, BG, PT… */
  readonly prefix = input.required<string>();
  /** The saved number, when the document exists. */
  readonly code = input<string | null | undefined>(null);
  readonly next = signal<string | null>(null);

  constructor() {
    effect(() => {
      const p = this.prefix();
      if (this.code()) return;
      untracked(() => void this.svc.peek(p).then((c) => this.next.set(c)));
    });
  }
}
