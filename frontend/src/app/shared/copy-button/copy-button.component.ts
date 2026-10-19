import { ChangeDetectionStrategy, Component, OnDestroy, input, signal } from '@angular/core';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';

// Small icon button that copies `text`; the icon turns into a check for a moment (silent success).
@Component({
  selector: 'app-copy-button',
  standalone: true,
  imports: [NavIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="copy-btn"
      [class.is-done]="copied()"
      [attr.aria-label]="copied() ? 'Đã chép ' + text() : 'Chép ' + (label() || text())"
      [title]="copied() ? 'Đã chép' : 'Chép ' + (label() || 'mã')"
      (click)="copy($event)"
    >
      <app-nav-icon [name]="copied() ? 'check' : 'copy'" />
    </button>
    <span class="visually-hidden" aria-live="polite">{{ copied() ? 'Đã chép ' + text() : '' }}</span>
  `,
  styles: [`
    :host { display: inline-flex; vertical-align: middle; }
    .copy-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      padding: 0;
      border: none;
      border-radius: var(--radius-control);
      background: none;
      color: var(--color-muted);
      cursor: pointer;
      --icon-size: 14px;
    }
    @media (hover: hover) {
      .copy-btn:hover { background: var(--color-paper-2); color: var(--color-ink); }
    }
    .copy-btn:active { background: var(--color-paper-3); }
    .copy-btn.is-done { color: var(--color-success); }
  `],
})
export class CopyButtonComponent implements OnDestroy {
  readonly text = input.required<string>();
  readonly label = input('');
  readonly copied = signal(false);
  private timer?: ReturnType<typeof setTimeout>;

  async copy(event: Event): Promise<void> {
    event.stopPropagation();
    event.preventDefault();
    try {
      await navigator.clipboard.writeText(this.text());
    } catch {
      // Clipboard API blocked (http / old browser): fall back to a hidden textarea.
      const ta = document.createElement('textarea');
      ta.value = this.text();
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    this.copied.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.copied.set(false), 1500);
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }
}
