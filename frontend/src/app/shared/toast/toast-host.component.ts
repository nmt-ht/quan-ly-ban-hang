import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';

/** Every toast of the app, stacked at the top right under the topbar. ToastService.success() / error() put them here. */
@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [NavIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-stack" aria-live="polite">
      @for (t of toasts.toasts(); track t.id) {
        <div
          class="toast"
          [class.is-error]="t.kind === 'error'"
          [attr.role]="t.kind === 'error' ? 'alert' : 'status'"
          (mouseenter)="toasts.pause(t.id)"
          (mouseleave)="toasts.resume(t.id)"
          (focusin)="toasts.pause(t.id)"
          (focusout)="toasts.resume(t.id)"
        >
          <span class="toast-text">{{ t.text }}</span>
          <button type="button" class="notice-x" aria-label="Đóng thông báo" (click)="toasts.dismiss(t.id)"><app-nav-icon name="x" /></button>
        </div>
      }
    </div>
  `,
  styles: `
    .toast-stack {
      position: fixed;
      top: calc(var(--topbar-h) + var(--space-xs));
      right: var(--space-md);
      z-index: 65;
      display: flex;
      flex-direction: column;
      gap: var(--space-2xs);
      width: min(26rem, calc(100vw - 2 * var(--space-sm)));
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-xs);
      padding: var(--space-xs) var(--space-2xs) var(--space-xs) var(--space-sm);
      border: var(--rule-hair) solid var(--color-success);
      border-left-width: 4px;
      border-radius: var(--radius-card);
      background: var(--color-success-tint);
      color: var(--color-success);
      font-size: var(--text-sm);
      font-weight: 500;
      line-height: 1.45;
      box-shadow: var(--shadow-pop);
      pointer-events: auto;
      animation: toast-in var(--dur-short) var(--ease-out);
    }

    .toast.is-error {
      border-color: var(--color-danger);
      background: var(--color-danger-tint);
      color: var(--color-danger);
    }

    .toast-text {
      min-width: 0;
      padding-top: var(--space-3xs);
      overflow-wrap: anywhere;
    }

    @keyframes toast-in {
      from { opacity: 0; transform: translateY(calc(var(--space-2xs) * -1)); }
      to { opacity: 1; transform: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      .toast { animation: none; }
    }

    @media (max-width: 40rem) {
      .toast-stack { right: var(--space-sm); }
    }

    @media (forced-colors: active) {
      .toast { border-color: CanvasText; }
    }
  `,
})
export class ToastHostComponent {
  readonly toasts = inject(ToastService);
}
