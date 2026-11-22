import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ErrorNoticeService } from '../../core/services/error-notice.service';
import { CopyButtonComponent } from '../../shared/copy-button/copy-button.component';
import { NavIconComponent } from '../nav-icon/nav-icon.component';

/** The notice for a fault nothing on the page caught: what happened, what to do, and the code to quote to IT. */
@Component({
  selector: 'app-error-banner',
  standalone: true,
  imports: [CopyButtonComponent, NavIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (notice.current(); as n) {
      <div class="eb" role="alert" aria-live="assertive">
        <div class="eb-body">
          <strong class="eb-title">{{ n.title }}</strong>
          <p class="eb-text">{{ n.message }}</p>
          @if (n.code) {
            <p class="eb-code">
              Mã lỗi: <span class="mono">{{ n.code }}</span>
              <app-copy-button [text]="n.code" label="mã lỗi" />
            </p>
          }
        </div>
        <div class="eb-actions">
          @if (n.reload) {
            <button type="button" class="btn" (click)="reload()">Tải lại trang</button>
          }
          <button type="button" class="notice-x" aria-label="Đóng thông báo lỗi" (click)="notice.dismiss()"><app-nav-icon name="x" /></button>
        </div>
      </div>
    }
  `,
  styles: `
    .eb {
      position: fixed;
      left: 50%;
      bottom: var(--space-md);
      z-index: 70;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-sm);
      width: min(42rem, calc(100vw - 2 * var(--space-sm)));
      padding: var(--space-xs) var(--space-sm);
      border: var(--rule-hair) solid var(--color-danger);
      border-left-width: 4px;
      border-radius: var(--radius-card);
      background: var(--color-danger-tint);
      color: var(--color-ink);
      box-shadow: var(--shadow-pop);
      transform: translateX(-50%);
    }

    .eb-body {
      min-width: 0;
    }

    .eb-title {
      color: var(--color-danger);
      font-size: var(--text-sm);
    }

    .eb-text,
    .eb-code {
      margin: var(--space-3xs) 0 0;
      font-size: var(--text-sm);
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .eb-code {
      display: flex;
      align-items: center;
      gap: var(--space-3xs);
      color: var(--color-ink-2);
    }

    .eb-actions {
      display: flex;
      flex: none;
      align-items: center;
      gap: var(--space-2xs);
    }
  `,
})
export class ErrorBannerComponent {
  readonly notice = inject(ErrorNoticeService);

  reload(): void {
    location.reload();
  }
}
