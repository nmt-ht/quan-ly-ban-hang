import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../core/services/mock-data.service';
import { DataTableComponent, DataTableColumn } from '../../shared/data-table/data-table.component';
import { StatCardComponent } from '../../shared/stat-card/stat-card.component';
import { DebtRow, DebtService } from '../../core/services/debt.service';
import { formatVnd } from '../../shared/format.util';

@Component({
  selector: 'app-receivables',
  standalone: true,
  imports: [CommonModule, RouterLink, DataTableComponent, StatCardComponent],
  templateUrl: './receivables.component.html',
})
export class ReceivablesComponent {
  readonly rows = computed<DebtRow[]>(() => this.debt.receivables());
  readonly totalBalance = computed(() => this.debt.receivableTotal());
  readonly totalOverdue = computed(() => this.debt.receivableOverdue());

  readonly columns: DataTableColumn<DebtRow>[] = [
    { key: 'code', label: 'Mã / Tên', format: (r) => `${r.code} — ${r.name}` },
    { key: 'creditLabel', label: 'Được nợ' },
    { key: 'items', label: 'Số khoản', align: 'right', format: (r) => String(r.items.length) },
    { key: 'prepaid', label: 'Trả trước', align: 'right', format: (r) => (r.prepaid ? formatVnd(r.prepaid) : '—') },
    { key: 'overdue', label: 'Quá hạn', align: 'right', format: (r) => (r.overdue ? formatVnd(r.overdue) : '—') },
    { key: 'balance', label: 'Số dư', align: 'right', format: (r) => formatVnd(r.balance) },
  ];

  readonly formatVnd = formatVnd;

  constructor(readonly data: MockDataService, private readonly debt: DebtService) {}
}
