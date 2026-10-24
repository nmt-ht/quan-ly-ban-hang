import { Component, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataStore } from '../../../core/services/data-store.service';
import { DebtEntry, DebtService } from '../../../core/services/debt.service';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { CopyButtonComponent } from '../../../shared/copy-button/copy-button.component';
import { NO_PERIOD, PeriodFilterComponent, PeriodValue } from '../../../shared/period-filter/period-filter.component';
import { amountTone, formatVnd, formatVndSigned } from '../../../shared/format.util';
import { formatDay, inRange, rangeLabel } from '../../../shared/period';
import { downloadWorkbook, exportFileName } from '../../../shared/excel.util';
import { PrintDocumentComponent } from '../../../shared/print/print-document.component';
import { AllowedLinkDirective } from '../../../shared/allowed-link.directive';
import { FormsModule } from '@angular/forms';
import { CashAccount } from '../../../core/models/domain.models';
import { AuthService } from '../../../core/services/auth.service';
import { VietQrComponent, qrReady } from '../../../shared/vietqr/vietqr.component';
import { bankNameOf } from '../../../shared/vietqr/vietqr';
import { vndInWords } from '../../../shared/vnd-words';
import { CHANNEL_LABEL, debtTransferNote, openCharges } from '../reminder.rules';
import { ReminderService } from '../reminder.service';
import { RemindDialogComponent } from '../remind-dialog/remind-dialog.component';

export type DebtSide = 'PHAI_TRA' | 'PHAI_THU';

interface Partner {
  id: string;
  code: string;
  name: string;
  taxCode?: string;
  creditDays: number;
}

/** Words and links that differ between công nợ phải trả (NCC) and phải thu (khách hàng). */
const SIDE = {
  PHAI_TRA: {
    listTitle: 'Công nợ phải trả', listPath: '/cong-no/nha-cung-cap', partner: 'nhà cung cấp', detailPath: '/nha-cung-cap',
    voucherPath: '/thu-chi/lap/chi', voucherLabel: 'Lập phiếu chi', partnerParam: 'supplierId', settledLabel: 'Đã trả đủ',
    prepaidNote: 'Đang trả trước cho nhà cung cấp',
    hint: 'Phát sinh tăng khi nhập kho hàng của đơn nhập; giảm khi lập phiếu chi trả nhà cung cấp.',
    empty: 'Công nợ phải trả phát sinh khi nhập kho hàng từ nhà cung cấp này.',
    partyA: 'Bên mua (Bên A)', partyB: 'Bên bán (Bên B)', owes: 'Bên A còn phải trả Bên B', prepaid: 'Bên A đã trả trước cho Bên B',
  },
  PHAI_THU: {
    listTitle: 'Công nợ phải thu', listPath: '/cong-no/khach-hang', partner: 'khách hàng', detailPath: '/khach-hang',
    voucherPath: '/thu-chi/lap/thu', voucherLabel: 'Lập phiếu thu', partnerParam: 'customerId', settledLabel: 'Đã thu đủ',
    prepaidNote: 'Khách đang trả trước',
    hint: 'Phát sinh tăng khi khách thực nhận hàng của đơn bán; giảm khi lập phiếu thu tiền khách.',
    empty: 'Công nợ phải thu ghi khi khách thực nhận hàng của đơn bán.',
    partyA: 'Bên bán (Bên A)', partyB: 'Bên mua (Bên B)', owes: 'Bên B còn phải trả Bên A', prepaid: 'Bên B đã trả trước cho Bên A',
  },
} as const;

// Sổ chi tiết công nợ của một đối tác (…/cong-no/<nha-cung-cap|khach-hang>?partnerId=…), plus the
// printable Biên bản đối chiếu công nợ.
@Component({
  selector: 'app-debt-ledger',
  standalone: true,
  imports: [
    RouterLink, FormsModule, AllowedLinkDirective, NavIconComponent, CopyButtonComponent, PeriodFilterComponent, PrintDocumentComponent, VietQrComponent,
    RemindDialogComponent,
  ],
  templateUrl: './debt-ledger.component.html',
  styleUrl: './debt-ledger.component.scss',
})
export class DebtLedgerComponent {
  readonly partnerId = input.required<string>();
  readonly side = input.required<DebtSide>();

  private readonly data = inject(DataStore);
  private readonly debt = inject(DebtService);

  readonly money = formatVnd;
  readonly signed = formatVndSigned;
  readonly tone = amountTone;
  readonly day = formatDay;
  readonly period = signal<PeriodValue>(NO_PERIOD);
  readonly openOnly = signal(false);
  readonly exporting = signal(false);
  readonly today = new Date().toISOString().slice(0, 10);

  readonly t = computed(() => SIDE[this.side()]);

  readonly partner = computed<Partner | undefined>(() => {
    const id = this.partnerId();
    if (this.side() === 'PHAI_TRA') {
      const s = this.data.suppliers().find((x) => x.id === id);
      return s && { id: s.id, code: s.code, name: s.name, taxCode: s.taxCode, creditDays: s.creditDays };
    }
    const c = this.data.customers().find((x) => x.id === id);
    return c && { id: c.id, code: c.code, name: c.companyName || c.name, taxCode: c.companyTaxCode || c.personalTaxCode, creditDays: c.creditDays };
  });

  readonly row = computed(() =>
    (this.side() === 'PHAI_TRA' ? this.debt.payables() : this.debt.receivables()).find((r) => r.partnerId === this.partnerId()),
  );
  readonly company = computed(() => this.data.companyInfo());

  readonly ledgerUrl = computed(() => `${this.t().listPath}?partnerId=${this.partnerId()}`);
  readonly voucherQuery = computed(() => ({ [this.t().partnerParam]: this.partnerId(), back: this.ledgerUrl() }));

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
    if (e.remaining <= 0) return this.t().settledLabel;
    if ((e.overdueDays ?? 0) > 0) return `Quá hạn ${e.overdueDays} ngày`;
    if (e.overdueDays === 0) return 'Đến hạn hôm nay';
    return `Còn ${-(e.overdueDays ?? 0)} ngày`;
  }

  print(): void {
    this.printMode.set('doi-chieu');
    setTimeout(() => window.print());
  }

  // ---------- Thông báo công nợ, VietQR, nhắc nợ (Pha 2, chỉ phải thu) ----------
  private readonly auth = inject(AuthService);
  readonly reminders = inject(ReminderService);
  private readonly remindDialog = viewChild(RemindDialogComponent);
  readonly isReceivable = computed(() => this.side() === 'PHAI_THU');
  /** Which printout window.print() shows: biên bản đối chiếu, or thông báo công nợ gửi khách. */
  readonly printMode = signal<'doi-chieu' | 'thong-bao'>('doi-chieu');
  readonly notice = signal('');
  readonly channelLabel = CHANNEL_LABEL;
  readonly words = vndInWords;
  readonly bankName = bankNameOf;

  readonly qrAccounts = computed(() => this.data.cashAccounts().filter(qrReady).sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault)));
  readonly accountId = signal('');
  readonly account = computed<CashAccount | null>(() => this.qrAccounts().find((a) => a.id === this.accountId()) ?? this.qrAccounts()[0] ?? null);
  readonly openItems = computed(() => (this.row() ? openCharges(this.row()!) : []));
  readonly amountDue = computed(() => Math.max(0, this.row()?.balance ?? 0));
  readonly transferNote = computed(() => debtTransferNote(this.partner()?.code ?? ''));
  readonly history = computed(() => this.reminders.all().filter((r) => r.customerId === this.partnerId()));
  readonly canRemind = computed(() => this.auth.can('debt.remind'));

  constructor() {
    effect(() => {
      if (this.isReceivable() && this.auth.can('debt.view')) void this.reminders.load().catch(() => undefined);
    });
  }

  printNotice(): void {
    this.printMode.set('thong-bao');
    setTimeout(() => window.print());
  }

  remind(): void {
    const c = this.data.customers().find((x) => x.id === this.partnerId());
    const r = this.row();
    if (c && r) this.remindDialog()?.open(c, r);
  }

  async exportExcel(): Promise<void> {
    const p = this.partner();
    if (!p) return;
    this.exporting.set(true);
    try {
      const rows = this.inPeriod();
      await downloadWorkbook(exportFileName(`Sổ công nợ ${p.code}`), [{
        name: `Sổ công nợ ${p.code}`,
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
