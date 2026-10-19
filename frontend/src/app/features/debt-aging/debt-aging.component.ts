import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatCardComponent } from '../../shared/stat-card/stat-card.component';
import { DebtRow, DebtService, sumBuckets } from '../../core/services/debt.service';
import { formatVnd } from '../../shared/format.util';

@Component({
  selector: 'app-debt-aging',
  standalone: true,
  imports: [CommonModule, StatCardComponent],
  templateUrl: './debt-aging.component.html',
})
export class DebtAgingComponent {
  readonly mode = signal<'PHAI_TRA' | 'PHAI_THU'>('PHAI_TRA');
  readonly query = signal('');

  readonly rows = computed<DebtRow[]>(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.mode() === 'PHAI_TRA' ? this.debt.payables() : this.debt.receivables();
    return all
      .filter((r) => r.aging.total > 0)
      .filter((r) => !q || `${r.code} ${r.name}`.toLowerCase().includes(q))
      .sort((a, b) => b.overdue - a.overdue);
  });
  readonly totals = computed(() => sumBuckets(this.rows()));

  readonly formatVnd = formatVnd;

  constructor(private readonly debt: DebtService) {}
}
