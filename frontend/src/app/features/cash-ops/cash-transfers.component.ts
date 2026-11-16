import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorText } from '../../core/api/api.service';
import { AuthService } from '../../core/services/auth.service';
import { DataStore } from '../../core/services/data-store.service';
import { CashTransferView } from '../../core/models/cash-ops.models';
import { formatVnd } from '../../shared/format.util';
import { formatDay, isoDay } from '../../shared/period';
import { CashOpsService } from './cash-ops.service';

/**
 * /thu-chi/chuyen-tien — chuyển tiền nội bộ: nộp tiền mặt vào ngân hàng, rút tiền, chuyển giữa các tài khoản ngân hàng.
 * Lập hai phiếu (chi ở quỹ đi, thu ở quỹ đến) qua TK 113 tiền đang chuyển; không phải thu nhập hay chi phí.
 */
@Component({
  selector: 'app-cash-transfers',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Chuyển tiền nội bộ</h1>
        <p class="subtitle">Nộp tiền mặt vào ngân hàng, rút tiền, chuyển giữa các tài khoản. Số dư hai quỹ đổi chỗ; không tính vào thu, chi của kỳ.</p>
      </div>
      @if (canCreate() && !creating()) { <button type="button" class="btn btn-primary" (click)="start()">Lập chuyển tiền</button> }
    </div>
    @if (failure()) { <div class="notice is-error" role="alert">{{ failure() }}</div> }
    @if (notice()) { <div class="notice" role="status">{{ notice() }}</div> }

    @if (creating()) {
      <div class="card" style="margin-bottom:16px">
        <div class="toolbar" style="flex-wrap:wrap; gap:8px">
          <label>Chuyển từ <span class="required-mark">*</span>
            <select [ngModel]="fromId()" (ngModelChange)="fromId.set($event)">
              <option value="">— Chọn —</option>
              @for (a of accounts(); track a.id) { <option [value]="a.id">{{ a.name }} (còn {{ money(a.balance) }})</option> }
            </select>
          </label>
          <label>Chuyển đến <span class="required-mark">*</span>
            <select [ngModel]="toId()" (ngModelChange)="toId.set($event)">
              <option value="">— Chọn —</option>
              @for (a of accounts(); track a.id) { <option [value]="a.id">{{ a.name }} (còn {{ money(a.balance) }})</option> }
            </select>
          </label>
          <label>Ngày <span class="required-mark">*</span> <input type="date" [ngModel]="date()" (ngModelChange)="date.set($event)"></label>
          <label>Số tiền <span class="required-mark">*</span> <input type="number" min="0" step="1" [ngModel]="amount()" (ngModelChange)="amount.set($event)" style="width:150px; text-align:right"></label>
        </div>
        <label style="display:block; margin:8px 0">Diễn giải
          <input type="text" maxlength="500" placeholder="VD: Nộp tiền bán hàng vào ngân hàng" [ngModel]="description()" (ngModelChange)="description.set($event)" style="width:100%">
        </label>
        @if (issue()) { <p class="text-danger" role="alert" style="margin:0 0 8px">{{ issue() }}</p> }
        <div class="toolbar">
          <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="save()">Lưu chuyển tiền</button>
          <button type="button" class="btn" (click)="creating.set(false)">Bỏ qua</button>
        </div>
      </div>
    }

    <div class="card" style="overflow-x:auto">
      <table style="width:100%; border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left">Số chứng từ</th><th style="text-align:left">Ngày</th><th style="text-align:left">Từ</th><th style="text-align:left">Đến</th>
          <th style="text-align:right">Số tiền</th><th style="text-align:left">Diễn giải</th><th style="text-align:left">Phiếu</th><th style="text-align:left">Trạng thái</th><th></th>
        </tr></thead>
        <tbody>
          @for (t of rows(); track t.id) {
            <tr [style.opacity]="t.isCancelled ? 0.55 : 1">
              <td>{{ t.code }}</td><td>{{ formatDay(t.date) }}</td><td>{{ t.fromAccountName }}</td><td>{{ t.toAccountName }}</td>
              <td style="text-align:right">{{ money(t.amount) }}</td><td>{{ t.description }}</td>
              <td>{{ t.outVoucherCode }}, {{ t.inVoucherCode }}</td>
              <td>@if (t.isCancelled) { <span class="badge badge-muted" [title]="t.cancelReason || ''">Đã huỷ</span> } @else { <span class="badge badge-success">Đã chuyển</span> }</td>
              <td>
                @if (!t.isCancelled && canCancel()) {
                  @if (cancelling() === t.id) {
                    <input type="text" placeholder="Lý do huỷ" maxlength="300" [ngModel]="reason()" (ngModelChange)="reason.set($event)" style="width:150px" aria-label="Lý do huỷ">
                    <button type="button" class="btn btn-sm btn-danger-ghost" [disabled]="busy()" (click)="cancel(t)">Xác nhận huỷ</button>
                    <button type="button" class="btn btn-sm" (click)="cancelling.set(null)">Bỏ qua</button>
                  } @else {
                    <button type="button" class="btn btn-sm btn-danger-ghost" (click)="cancelling.set(t.id); reason.set('')">Huỷ</button>
                  }
                }
              </td>
            </tr>
          } @empty {
            <tr><td colspan="9" style="text-align:center; padding:16px">Chưa có chuyển tiền nội bộ nào.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class CashTransfersComponent {
  private readonly svc = inject(CashOpsService);
  private readonly auth = inject(AuthService);
  private readonly store = inject(DataStore);
  readonly money = formatVnd;
  readonly formatDay = formatDay;

  readonly rows = signal<CashTransferView[]>([]);
  readonly failure = signal('');
  readonly notice = signal('');
  readonly busy = signal(false);
  readonly creating = signal(false);
  readonly cancelling = signal<string | null>(null);
  readonly reason = signal('');
  readonly accounts = computed(() => this.store.cashAccounts().filter((a) => a.isActive !== false));
  readonly canCreate = computed(() => this.auth.can('voucher.create_receipt') && this.auth.can('voucher.create_payment'));
  readonly canCancel = computed(() => this.auth.can('voucher.cancel'));

  readonly fromId = signal('');
  readonly toId = signal('');
  readonly date = signal(isoDay(new Date()));
  readonly amount = signal<number | null>(null);
  readonly description = signal('');

  readonly issue = computed(() => {
    if (!this.fromId() || !this.toId()) return 'Chọn tài khoản chuyển đi và tài khoản nhận.';
    if (this.fromId() === this.toId()) return 'Chọn hai tài khoản tiền khác nhau.';
    if (!this.date()) return 'Chọn ngày.';
    if (this.date() > isoDay(new Date())) return 'Ngày chuyển tiền không được sau hôm nay.';
    if (!(this.amount() && this.amount()! > 0)) return 'Nhập số tiền lớn hơn 0.';
    return '';
  });

  constructor() { this.load(); }

  async load() {
    try { this.rows.set(await this.svc.transfers()); } catch (e) { this.failure.set(errorText(e)); }
  }

  start() {
    this.fromId.set(''); this.toId.set(''); this.date.set(isoDay(new Date())); this.amount.set(null); this.description.set('');
    this.failure.set('');
    this.creating.set(true);
  }

  async save() {
    if (this.busy()) return;
    if (this.issue()) { this.failure.set(this.issue()); return; }
    this.busy.set(true);
    this.failure.set('');
    try {
      const t = await this.svc.createTransfer({
        fromAccountId: this.fromId(), toAccountId: this.toId(), date: this.date(), amount: Math.round(this.amount() ?? 0), description: this.description().trim() || undefined,
      });
      this.creating.set(false);
      this.notice.set(`Đã chuyển ${formatVnd(t.amount)} từ ${t.fromAccountName} sang ${t.toAccountName} (${t.code}).`);
      await this.load();
    } catch (e) {
      this.failure.set(errorText(e));
    } finally {
      this.busy.set(false);
    }
  }

  async cancel(t: CashTransferView) {
    this.busy.set(true);
    this.failure.set('');
    try {
      await this.svc.cancelTransfer(t.id, this.reason().trim() || undefined);
      this.cancelling.set(null);
      this.notice.set(`Đã huỷ ${t.code}; số dư hai quỹ trở lại như trước.`);
      await this.load();
    } catch (e) {
      this.failure.set(errorText(e));
    } finally {
      this.busy.set(false);
    }
  }
}
