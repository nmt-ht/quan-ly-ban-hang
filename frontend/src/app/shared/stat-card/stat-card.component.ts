import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  template: `
    <div class="stat-card">
      <div class="stat-label">{{ label }}</div>
      <div class="stat-value" [class.negative]="negative">{{ value }}</div>
      @if (sub) {
        <div class="stat-sub">{{ sub }}</div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .stat-card {
      height: 100%;
      background: var(--color-surface);
      border: var(--rule-hair) solid var(--color-rule);
      border-radius: var(--radius-card);
      padding: var(--space-xs) var(--space-sm);
      transition: border-color var(--dur-short) var(--ease-out);
    }
    .stat-label {
      font-size: var(--text-xs);
      font-weight: 500;
      color: var(--color-muted);
      margin-bottom: var(--space-3xs);
    }
    .stat-value {
      font-family: var(--font-mono);
      font-size: var(--text-lg);
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
      color: var(--color-ink);
      overflow-wrap: anywhere;
    }
    .stat-value.negative { color: var(--color-danger); }
    .stat-sub { font-size: var(--text-xs); color: var(--color-muted); margin-top: var(--space-3xs); }
    /* Inside a card: a flat well, not a second bordered card. */
    :host-context(.card) .stat-card {
      background: var(--color-paper-2);
      border-color: transparent;
    }
    :host-context(.mini-link:hover) .stat-card { border-color: var(--color-accent); }
    :host-context(.mini-link:focus-visible) .stat-card { border-color: var(--color-focus); }
  `],
})
export class StatCardComponent {
  @Input() label = '';
  @Input() value = '';
  @Input() sub = '';
  @Input() negative = false;
}
