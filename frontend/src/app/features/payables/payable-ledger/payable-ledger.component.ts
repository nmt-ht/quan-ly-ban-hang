import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';
import { DebtEntry, DebtService } from '../../../core/services/debt.service';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { CopyButtonComponent } from '../../../shared/copy-button/copy-button.component';
import { NO_PERIOD, PeriodFilterComponent, PeriodValue } from '../../../shared/period-filter/period-filter.component';
import { formatVnd } from '../../../shared/format.util';
import { formatDay, inRange, rangeLabel } from '../../../shared/period';
import { downloadWorkbook, todayStamp } from '../../../shared/excel.util';

// Sổ chi tiết công nợ phải trả của một nhà cung cấp (/cong-no/nha-cung-cap?partnerId=…).
@Component({
  selector: 'app-payable-ledger',
  standalone: true,
  imports: [RouterLink, NavIconComponent, CopyButtonComponent, PeriodFilterComponent],
  templateUrl: './payable-ledger.component.html',
  styleUrl: './payable-ledger.component.scss',
})
export class PayableLedgerComponent {
  readonly partnerId = input.required<string>();

  private readonly data = inject(MockDataService);
  private readonly debt = inject(DebtService);

  readonly money = formatVnd;
  readonly day = formatDay;
  readonly period = signal<PeriodValue>(NO_PERIOD);
  readonly openOnly = signal(false);
  readonly exporting = signal(false);
  readonly today = new Date().toISOString().slice(0, 10);

  readonly supplier = computed(() => this.data.suppliers().find((s) => s.id === this.partnerId()));
  readonly row = computed(() => this.debt.payables().find((r) => r.partnerId === this.partnerId()));
  readonly company = computed(() => this.data.companyInfo());

  private readonly all = computed(() => this.row()?.entries ?? []);
  private readonly from = computed(() => this.period().range.from);

  /** Số dư đầu kỳ: everything before the period. */
  readonly opening = computed(() => {
    const from = this.from();
    return from ? this.all().filter((e) => e.date < from).reduce((s, e) => s + e.amount, 0) : 0;
  });

  readonly inPeriod = computed(() => this.all().filter((e) => inRange(e.date, this.period().range)));

  readonly entries = computed<DebtEntry[]>(() => {
    const list = this.openOnly() ? this.inPeriod().filter((e) => e.remaining > 0) : this.inPeriod();
    return [...list].reverse(); // newest first on screen
  });

  readonly periodTotals = computed(() => {
    const rows = this.inPeriod();
    const increase = rows.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
    const decrease = rows.filter((e) => e.amount < 0).reduce((s, e) => s - e.amount, 0);
    return { increase, decrease, closing: this.opening() + increase - decrease };
  });

  readonly periodLabel = computed(() => rangeLabel(this.period().range));
  readonly hasPeriod = computed(() => this.period().preset !== null);

  /** Biên bản đối chiếu prints oldest first, with opening/closing balances. */
  readonly printRows = computed(() => this.inPeriod());

  statusOf(e: DebtEntry): string {
    if (e.kind === 'THANH_TOAN') return e.remaining > 0 ? `${formatVnd(e.remaining)} chưa dùng` : 'Đã đối trừ hết';
    if (e.remaining <= 0) return 'Đã trả đủ';
    if ((e.overdueDays ?? 0) > 0) return `Quá hạn ${e.overdueDays} ngày`;
    if (e.overdueDays === 0) return 'Đến hạn hôm nay';
    return `Còn ${-(e.overdueDays ?? 0)} ngày`;
  }

  print(): void {
    window.print();
  }

  async exportExcel(): Promise<void> {
    const s = this.supplier();
    if (!s) return;
    this.exporting.set(true);
    try {
      const rows = this.inPeriod();
      await downloadWorkbook(`so-cong-no-${s.code}-${todayStamp()}.xlsx`, [{
        name: `Sổ công nợ ${s.code}`,
        columns: [
          { header: 'Ngày', width: 12 },
          { header: 'Loại', width: 16 },
          { header: 'Chứng từ', width: 14 },
          { header: 'Diễn giải', width: 44 },
          { header: 'Phát sinh tăng', width: 16, numFmt: '#,##0' },
          { header: 'Phát sinh giảm', width: 16, numFmt: '#,##0' },
          { header: 'Đã đối trừ', width: 16, numFmt: '#,##0' },
          { header: 'Còn lại', width: 16, numFmt: '#,##0' },
          { header: 'Hạn thanh toán', width: 14 },
          { header: 'Số dư', width: 16, numFmt: '#,##0' },
        ],
        rows: [
          ['', '', '', 'Số dư đầu kỳ', '', '', '', '', '', this.opening()],
          ...rows.map((e) => [
            formatDay(e.date), e.typeLabel, e.ref, e.description,
            e.amount > 0 ? e.amount : '', e.amount < 0 ? -e.amount : '', e.settled, e.remaining,
            e.dueDate ? formatDay(e.dueDate) : '', e.balance,
          ]),
          ['', '', '', 'Cộng phát sinh trong kỳ', this.periodTotals().increase, this.periodTotals().decrease, '', '', '', ''],
          ['', '', '', 'Số dư cuối kỳ', '', '', '', '', '', this.periodTotals().closing],
        ],
      }]);
    } finally {
      this.exporting.set(false);
    }
  }

}
