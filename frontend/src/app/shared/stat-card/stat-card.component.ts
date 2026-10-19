import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="stat-card">
      <div class="stat-label">{{ label }}</div>
      <div class="stat-value" [class.negative]="negative">{{ value }}</div>
      <div class="stat-sub" *ngIf="sub">{{ sub }}</div>
    </div>
  `,
  styles: [`
    .stat-card {
      background: var(--nt-surface);
      border: 1px solid var(--nt-border);
      border-radius: 12px;
      padding: 16px;
    }
    .stat-label { font-size: 12px; color: var(--nt-muted); margin-bottom: 6px; }
    .stat-value { font-size: 20px; font-weight: 700; }
    .stat-value.negative { color: var(--nt-danger); }
    .stat-sub { font-size: 12px; color: var(--nt-muted); margin-top: 4px; }
  `],
})
export class StatCardComponent {
  @Input() label = '';
  @Input() value = '';
  @Input() sub = '';
  @Input() negative = false;
}
