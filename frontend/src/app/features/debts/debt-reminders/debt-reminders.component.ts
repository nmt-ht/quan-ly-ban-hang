import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DataStore } from '../../../core/services/data-store.service';
import { AuthService } from '../../../core/services/auth.service';
import { DebtRow, DebtService } from '../../../core/services/debt.service';
import { CashAccount, Customer } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { foldVi, formatVnd } from '../../../shared/format.util';
import { formatDay, isoDay } from '../../../shared/period';
import { qrReady } from '../../../shared/vietqr/vietqr.component';
import { bankNameOf } from '../../../shared/vietqr/vietqr';
import { errorText } from '../../../core/api/api.service';
import { CHANNEL_LABEL, DebtReminder, maxOverdueDays } from '../reminder.rules';
import { ReminderService } from '../reminder.service';
import { RemindDialogComponent } from '../remind-dialog/remind-dialog.component';

type Show = 'qua-han' | 'sap-den-han' | 'tat-ca';

interface Row {
  customer: Customer;
  debt: DebtRow;
  lateDays: number;
  last?: DebtReminder;
  /** Hẹn trả đã qua mà vẫn còn nợ. */
  brokenPromise: boolean;
}

const SOON_DAYS = 7;

// /cong-no/nhac-no (Pha 2): khách còn nợ cần nhắc — quá hạn trước, lâu nhất trước — với lần nhắc gần nhất và hẹn trả.
@Component({
  selector: 'app-debt-reminders',
  standalone: true,
  imports: [FormsModule, RouterLink, NavIconComponent, RemindDialogComponent],
  templateUrl: './debt-reminders.component.html',
  styleUrl: './debt-reminders.component.scss',
})
export class DebtRemindersComponent {
  private readonly data = inject(DataStore);
  private readonly debt = inject(DebtService);
  private readonly auth = inject(AuthService);
  readonly reminders = inject(ReminderService);
  private readonly dialog = viewChild.required(RemindDialogComponent);

  readonly money = formatVnd;
  readonly day = formatDay;
  readonly channelLabel = CHANNEL_LABEL;
  readonly today = isoDay(new Date());
  readonly show = signal<Show>('qua-han');
  readonly search = signal('');
  readonly notice = signal('');
  readonly error = signal('');
  readonly canRemind = computed(() => this.auth.can('debt.remind'));

  /** Tài khoản in mã VietQR trong tin nhắc: tài khoản ngân hàng có mã BIN, ưu tiên tài khoản mặc định. */
  readonly qrAccounts = computed(() => this.data.cashAccounts().filter(qrReady).sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault)));
  readonly accountId = signal('');
  readonly account = computed<CashAccount | null>(() => {
    const list = this.qrAccounts();
    return list.find((a) => a.id === this.accountId()) ?? list[0] ?? null;
  });
  readonly bankName = bankNameOf;

  constructor() {
    this.reminders.load().catch((e) => this.error.set(errorText(e)));
  }

  private readonly customerById = computed(() => new Map(this.data.customers().map((c) => [c.id, c])));

  readonly all = computed<Row[]>(() => {
    const latest = new Map<string, DebtReminder>();
    for (const r of this.reminders.all()) if (!latest.has(r.customerId)) latest.set(r.customerId, r);
    return this.debt.receivables()
      .filter((d) => d.balance > 0)
      .flatMap((d) => {
        const customer = this.customerById().get(d.partnerId);
        if (!customer) return [];
        const last = latest.get(d.partnerId);
        return [{
          customer, debt: d, lateDays: maxOverdueDays(d), last,
          brokenPromise: !!last?.promisedDate && last.promisedDate < this.today,
        }];
      });
  });

  private readonly soon = computed(() => {
    const d = new Date(this.today + 'T00:00:00');
    d.setDate(d.getDate() + SOON_DAYS);
    return isoDay(d);
  });

  readonly rows = computed(() => {
    const q = foldVi(this.search().trim());
    const s = this.show();
    return this.all()
      .filter((r) => s === 'tat-ca' || (s === 'qua-han' ? r.debt.overdue > 0 : r.debt.overdue === 0 && !!r.debt.nextDue && r.debt.nextDue <= this.soon()))
      .filter((r) => !q || foldVi(`${r.customer.code} ${r.customer.name} ${r.customer.companyName ?? ''} ${r.customer.phone ?? ''}`).includes(q))
      .sort((a, b) => b.lateDays - a.lateDays || b.debt.overdue - a.debt.overdue || b.debt.balance - a.debt.balance);
  });

  readonly counts = computed(() => ({
    late: this.all().filter((r) => r.debt.overdue > 0).length,
    soon: this.all().filter((r) => r.debt.overdue === 0 && !!r.debt.nextDue && r.debt.nextDue <= this.soon()).length,
    all: this.all().length,
  }));

  readonly totals = computed(() => ({
    balance: this.rows().reduce((s, r) => s + r.debt.balance, 0),
    overdue: this.rows().reduce((s, r) => s + r.debt.overdue, 0),
    broken: this.rows().filter((r) => r.brokenPromise).length,
  }));

  remind(r: Row): void {
    this.dialog().open(r.customer, r.debt);
  }

  daysSince(iso: string): number {
    return Math.round((Date.parse(this.today) - Date.parse(iso.slice(0, 10))) / 86_400_000);
  }
}
