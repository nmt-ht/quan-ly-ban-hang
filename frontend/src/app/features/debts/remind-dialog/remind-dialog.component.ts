import { Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataStore } from '../../../core/services/data-store.service';
import { AuthService } from '../../../core/services/auth.service';
import { DebtRow } from '../../../core/services/debt.service';
import { CashAccount, Customer } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { MoneyInputDirective } from '../../../shared/money-input.directive';
import { VietQrComponent } from '../../../shared/vietqr/vietqr.component';
import { formatVnd } from '../../../shared/format.util';
import { formatDay, isoDay } from '../../../shared/period';
import { errorText } from '../../../core/api/api.service';
import { CHANNEL_LABEL, ReminderChannel, debtTransferNote, maxOverdueDays, phoneDigits, reminderMessage } from '../reminder.rules';
import { ReminderService } from '../reminder.service';

// Nhắc nợ một khách (Pha 2): tin soạn sẵn (sửa được) → sao chép / mở Zalo / gọi / email, rồi ghi nhận lần nhắc với
// kênh, ghi chú và hẹn trả. Gửi tự động qua SMS / Zalo OA chưa nối — người dùng gửi bằng app của mình.
@Component({
  selector: 'app-remind-dialog',
  standalone: true,
  imports: [FormsModule, NavIconComponent, MoneyInputDirective, VietQrComponent],
  templateUrl: './remind-dialog.component.html',
  styleUrls: ['../../products/product-import-dialog/product-import-dialog.component.scss', './remind-dialog.component.scss'],
})
export class RemindDialogComponent {
  readonly account = input<CashAccount | null>(null);
  readonly recorded = output<string>();

  private readonly data = inject(DataStore);
  private readonly auth = inject(AuthService);
  private readonly reminders = inject(ReminderService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly money = formatVnd;
  readonly day = formatDay;
  readonly channels = Object.keys(CHANNEL_LABEL) as ReminderChannel[];
  readonly channelLabel = CHANNEL_LABEL;
  readonly today = isoDay(new Date());
  readonly canRecord = computed(() => this.auth.can('debt.remind'));

  readonly customer = signal<Customer | null>(null);
  readonly row = signal<DebtRow | null>(null);
  readonly message = signal('');
  readonly copied = signal(false);
  readonly channel = signal<ReminderChannel>('ZALO');
  readonly note = signal('');
  readonly promisedDate = signal('');
  readonly promisedAmount = signal<number | null>(null);
  readonly saving = signal(false);
  readonly error = signal('');

  readonly phone = computed(() => phoneDigits(this.customer()?.phone));
  readonly email = computed(() => this.customer()?.email ?? '');
  readonly history = computed(() => {
    const c = this.customer();
    return c ? this.reminders.all().filter((r) => r.customerId === c.id).slice(0, 5) : [];
  });
  readonly lateDays = computed(() => (this.row() ? maxOverdueDays(this.row()!) : 0));
  readonly transferNote = computed(() => debtTransferNote(this.customer()?.code ?? ''));
  readonly smsHref = computed(() => `sms:${this.phone()}?body=${encodeURIComponent(this.message())}`);
  readonly mailto = computed(() =>
    `mailto:${this.email()}?subject=${encodeURIComponent(`Thông báo công nợ — ${this.data.companyInfo().name}`)}&body=${encodeURIComponent(this.message())}`);

  open(customer: Customer, row: DebtRow): void {
    this.customer.set(customer);
    this.row.set(row);
    this.message.set(reminderMessage({
      companyName: this.data.companyInfo().name, customerName: customer.companyName || customer.name, customerCode: customer.code,
      row, today: this.today, account: this.account(),
    }));
    this.copied.set(false);
    this.channel.set(this.phone() ? 'ZALO' : this.email() ? 'EMAIL' : 'GOI_DIEN');
    this.note.set('');
    this.promisedDate.set('');
    this.promisedAmount.set(null);
    this.error.set('');
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.message());
      this.copied.set(true);
    } catch {
      this.error.set('Trình duyệt không cho sao chép — bôi đen nội dung rồi Ctrl+C.');
    }
  }

  async record(): Promise<void> {
    const c = this.customer();
    if (!c || this.saving()) return;
    if (this.promisedDate() && this.promisedDate() < this.today) {
      this.error.set('Ngày hẹn trả đã qua.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      await this.reminders.record({
        customerId: c.id, channel: this.channel(), note: this.note().trim() || undefined,
        promisedDate: this.promisedDate() || undefined, promisedAmount: this.promisedAmount() || undefined,
      });
      this.recorded.emit(`Đã ghi nhận nhắc nợ ${c.code} · ${c.companyName || c.name} qua ${CHANNEL_LABEL[this.channel()]}`
        + (this.promisedDate() ? ` — hẹn trả ${formatDay(this.promisedDate())}.` : '.'));
      this.close();
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.saving.set(false);
    }
  }
}
