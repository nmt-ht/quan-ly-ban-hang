import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MockDataService } from '../../core/services/mock-data.service';
import { DataTableComponent, DataTableColumn } from '../../shared/data-table/data-table.component';
import { StatCardComponent } from '../../shared/stat-card/stat-card.component';
import { CashVoucher } from '../../core/models/domain.models';
import { formatVnd, formatVndSigned } from '../../shared/format.util';

@Component({
  selector: 'app-cash-vouchers',
  standalone: true,
  imports: [CommonModule, DataTableComponent, StatCardComponent],
  templateUrl: './cash-vouchers.component.html',
})
export class CashVouchersComponent {
  readonly formatVnd = formatVnd;

  readonly totalThu = computed(() => this.data.cashVouchers().filter((v) => v.kind === 'THU').reduce((s, v) => s + v.amount, 0));
  readonly totalChi = computed(() => this.data.cashVouchers().filter((v) => v.kind === 'CHI').reduce((s, v) => s + v.amount, 0));
  readonly totalBalance = computed(() => this.data.cashAccounts().reduce((s, a) => s + a.balance, 0));

  readonly columns: DataTableColumn<CashVoucher>[] = [
    { key: 'code', label: 'Số phiếu' },
    { key: 'date', label: 'Ngày' },
    { key: 'category', label: 'Loại' },
    { key: 'partnerId', label: 'Đối tượng', format: (r) => this.partnerName(r) },
    { key: 'accountId', label: 'Tài khoản', format: (r) => this.data.cashAccounts().find((a) => a.id === r.accountId)?.name ?? '' },
    { key: 'amount', label: 'Số tiền', align: 'right', format: (r) => formatVndSigned(r.kind === 'THU' ? r.amount : -r.amount) },
    { key: 'description', label: 'Diễn giải' },
  ];

  constructor(readonly data: MockDataService) {}

  private partnerName(v: CashVoucher): string {
    if (v.partnerType === 'KHACH_HANG') return this.data.customers().find((c) => c.id === v.partnerId)?.name ?? '';
    if (v.partnerType === 'NHA_CUNG_CAP') return this.data.suppliers().find((s) => s.id === v.partnerId)?.name ?? '';
    return '—';
  }
}
