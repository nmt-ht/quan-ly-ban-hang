import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { ConfirmService } from './confirm.service';

/** Draws ConfirmService's pending question as a modal alertdialog. Esc or a click on the backdrop answers "no". */
@Component({
  selector: 'app-confirm-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg class="cf-dialog" aria-labelledby="cf-title" aria-describedby="cf-msg" role="alertdialog"
      (cancel)="$event.preventDefault(); svc.answer(false)" (click)="onBackdrop($event)">
      @if (svc.current(); as c) {
        <div class="cf-body">
          <h2 id="cf-title">{{ c.title }}</h2>
          @if (c.message) { <p id="cf-msg">{{ c.message }}</p> }
        </div>
        <footer class="cf-foot">
          <button type="button" class="btn" [attr.autofocus]="c.tone === 'danger' ? '' : null" (click)="svc.answer(false)">{{ c.cancelLabel || 'Không' }}</button>
          <button type="button" class="btn" [class.btn-danger]="c.tone === 'danger'" [class.btn-primary]="c.tone !== 'danger'" [attr.autofocus]="c.tone === 'danger' ? null : ''" (click)="svc.answer(true)">{{ c.confirmLabel || 'Đồng ý' }}</button>
        </footer>
      }
    </dialog>
  `,
  styles: `
    .cf-dialog {
      width: min(28rem, calc(100vw - 2 * var(--space-sm)));
      padding: 0;
      border: var(--rule-hair) solid var(--color-rule);
      border-radius: var(--radius-card);
      background: var(--color-surface);
      color: var(--color-ink);
      box-shadow: 0 16px 48px var(--color-shadow);
    }
    .cf-dialog::backdrop { background: var(--color-shadow); }
    .cf-body { padding: var(--space-md) var(--space-md) var(--space-sm); }
    .cf-body h2 { margin: 0; font-size: var(--text-md); font-weight: 600; line-height: 1.35; overflow-wrap: anywhere; }
    .cf-body p { margin: var(--space-2xs) 0 0; color: var(--color-ink-2); font-size: var(--text-sm); line-height: 1.5; overflow-wrap: anywhere; }
    .cf-foot { display: flex; justify-content: flex-end; gap: var(--space-2xs); padding: var(--space-xs) var(--space-md) var(--space-sm); }
  `,
})
export class ConfirmHostComponent {
  protected readonly svc = inject(ConfirmService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    effect(() => {
      const el = this.dlg().nativeElement;
      if (this.svc.current()) {
        if (!el.open) el.showModal();
        queueMicrotask(() => el.querySelector<HTMLElement>('[autofocus]')?.focus());
      } else if (el.open) {
        el.close();
      }
    });
  }

  onBackdrop(e: MouseEvent): void {
    if (e.target === this.dlg().nativeElement) this.svc.answer(false);
  }
}
