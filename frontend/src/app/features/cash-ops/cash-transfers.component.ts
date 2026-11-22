/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorText } from '../../core/api/api.service';
import { AuthService } from '../../core/services/auth.service';
import { DataStore } from '../../core/services/data-store.service';
import { CashTransferView } from '../../core/models/cash-ops.models';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { formatVnd } from '../../shared/format.util';
import { MoneyInputDirective } from '../../shared/money-input.directive';
import { formatDay, isoDay } from '../../shared/period';
import { CashOpsService } from './cash-ops.service';
import { DateInputDirective } from '../../shared/date-input/date-input.directive';
import { newestFirst } from '../../shared/column-sort';
import { ToastService } from '../../core/services/toast.service';

/**
 * /thu-chi/chuyen-tien — chuyển tiền nội bộ: nộp tiền mặt vào ngân hàng, rút tiền, chuyển giữa các tài khoản ngân hàng.
 * Lập hai phiếu (chi ở quỹ đi, thu ở quỹ đến) qua TK 113 tiền đang chuyển; không phải thu nhập hay chi phí.
 */
@Component({
  selector: 'app-cash-transfers',
  standalone: true,
  imports: [DateInputDirective, FormsModule, NavIconComponent, DataTableComponent, MoneyInputDirective],
  template: `
    <div class="page-header">
      <div>
        <h1>Chuyển tiền nội bộ</h1>
        <p class="subtitle">Nộp tiền mặt vào ngân hàng, rút tiền, chuyển giữa các tài khoản. Số dư hai quỹ đổi chỗ; không tính vào thu, chi của kỳ.</p>
      </div>
      @if (canCreate() && !creating()) {
        <div class="toolbar">
          <button type="button" class="btn btn-primary" (click)="start()"><app-nav-icon name="plus" />Lập chuyển tiền</button>
        </div>
      }
    </div>
        
    @if (creating()) {
      <section class="card section-block" aria-labelledby="ct-new">
        <h2 id="ct-new" class="form-section-title">Chuyển tiền mới</h2>
        <div class="form-grid">
          <div class="field">
            <label for="ct-from">Chuyển từ <span class="required-mark">*</span></label>
            <select id="ct-from" [ngModel]="fromId()" (ngModelChange)="fromId.set($event)">
              <option value="">— Chọn —</option>
              @for (a of accounts(); track a.id) { <option [value]="a.id">{{ a.name }} (còn {{ money(a.balance) }})</option> }
            </select>
          </div>
          <div class="field">
            <label for="ct-to">Chuyển đến <span class="required-mark">*</span></label>
            <select id="ct-to" [ngModel]="toId()" (ngModelChange)="toId.set($event)">
              <option value="">— Chọn —</option>
              @for (a of accounts(); track a.id) { <option [value]="a.id">{{ a.name }} (còn {{ money(a.balance) }})</option> }
            </select>
          </div>
          <div class="field">
            <label for="ct-date">Ngày <span class="required-mark">*</span></label>
            <input id="ct-date" appDate [max]="today" [ngModel]="date()" (ngModelChange)="date.set($event)" />
          </div>
          <div class="field">
            <label for="ct-amount">Số tiền <span class="required-mark">*</span></label>
            <input id="ct-amount" type="text" appMoney class="num amount-input" placeholder="0" [ngModel]="amount()" (ngModelChange)="amount.set($event)" />
          </div>
        </div>
        <div class="field">
          <label for="ct-desc">Diễn giải</label>
          <input id="ct-desc" type="text" maxlength="500" placeholder="VD: Nộp tiền bán hàng vào ngân hàng" [ngModel]="description()" (ngModelChange)="description.set($event)" />
        </div>
      </section>

      <div class="form-actions-bar">
        <span class="hint" [class.text-danger]="attempted() && issue()" role="status">{{ attempted() && issue() ? issue() : 'Điền thông tin rồi bấm Lưu' }}</span>
        <div class="form-actions">
          <button type="button" class="btn" (click)="creating.set(false)">Huỷ</button>
          <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="save()"><app-nav-icon name="check" />Lưu chuyển tiền</button>
        </div>
      </div>
    } @else {
    <div class="filters-bar">
      <button type="button" class="filter-toggle" [attr.aria-pressed]="showCancelled()" (click)="showCancelled.set(!showCancelled())">Hiện chuyển tiền đã huỷ</button>
    </div>

    @if (rows().length) {
      <dl class="list-totals">
        <div><dt>Số lần chuyển</dt><dd class="num">{{ live().length }}</dd></div>
        <div><dt>Tổng số tiền đã chuyển</dt><dd class="num">{{ money(total()) }}</dd></div>
      </dl>
    }

    <app-data-table
      [columns]="columns" [rows]="visible()" [actions]="rowActions()" emptyTitle="Chưa có chuyển tiền nội bộ"
      [emptyHint]="rows().length ? 'Không có chuyển tiền nào khớp bộ lọc.' : 'Lập chuyển tiền đầu tiên để nộp, rút hoặc chuyển tiền giữa các quỹ.'" />
    }

    <ng-template #rowActionsTpl let-t>
      @if (!t.isCancelled && canCancel()) {
        <button type="button" class="btn row-act-btn btn-danger-ghost" (click)="askCancel(t)">Huỷ</button>
      }
    </ng-template>
  `,
  styles: [`.amount-input { text-align: right; }`],
})
export class CashTransfersComponent {
  protected readonly toast = inject(ToastService);
  private readonly dialogs = inject(ConfirmService);
  private readonly svc = inject(CashOpsService);
  private readonly auth = inject(AuthService);
  private readonly store = inject(DataStore);
  readonly money = formatVnd;
  readonly today = isoDay(new Date());
  private readonly rowActionsRef = viewChild<TemplateRef<{ $implicit: CashTransferView }>>('rowActionsTpl');
  readonly rowActions = computed(() => this.rowActionsRef());

  readonly columns: DataTableColumn<CashTransferView>[] = [
    { key: 'code', label: 'Số chứng từ', copy: true },
    { key: 'date', label: 'Ngày', format: (t) => formatDay(t.date), mono: true },
    { key: 'fromAccountName', label: 'Từ' },
    { key: 'toAccountName', label: 'Đến' },
    { key: 'amount', label: 'Số tiền', align: 'right', format: (t) => formatVnd(t.amount) },
    { key: 'description', label: 'Diễn giải', format: (t) => t.description ?? '' },
    { key: 'vouchers', label: 'Phiếu', format: (t) => `${t.outVoucherCode}, ${t.inVoucherCode}`, mono: true },
    { key: 'status', label: 'Trạng thái', format: (t) => (t.isCancelled ? 'Đã huỷ' : 'Đã chuyển'), badge: (t) => (t.isCancelled ? 'badge-muted' : 'badge-success') },
  ];

  readonly rows = signal<CashTransferView[]>([]);
  readonly busy = signal(false);
  readonly creating = signal(false);
  readonly attempted = signal(false);
  readonly showCancelled = signal(false);
  readonly accounts = computed(() => this.store.cashAccounts().filter((a) => a.isActive !== false));
  readonly canCreate = computed(() => this.auth.can('voucher.create_receipt') && this.auth.can('voucher.create_payment'));
  readonly canCancel = computed(() => this.auth.can('voucher.cancel'));
  readonly live = computed(() => this.rows().filter((t) => !t.isCancelled));
  readonly total = computed(() => this.live().reduce((s, t) => s + t.amount, 0));
  readonly visible = computed(() => (this.showCancelled() ? this.rows() : this.live()));

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
    try { this.rows.set((await this.svc.transfers()).sort(newestFirst)); } catch (e) { this.toast.error(errorText(e)); }
  }

  start() {
    this.fromId.set(''); this.toId.set(''); this.date.set(isoDay(new Date())); this.amount.set(null); this.description.set('');
    this.attempted.set(false);
    this.creating.set(true);
  }

  async save() {
    if (this.busy()) return;
    this.attempted.set(true);
    if (this.issue()) return;
    this.busy.set(true);
    try {
      const t = await this.svc.createTransfer({
        fromAccountId: this.fromId(), toAccountId: this.toId(), date: this.date(), amount: Math.round(this.amount() ?? 0), description: this.description().trim() || undefined,
      });
      this.creating.set(false);
      this.toast.success(`Đã chuyển ${formatVnd(t.amount)} từ ${t.fromAccountName} sang ${t.toAccountName} (${t.code}).`);
      await this.load();
    } catch (e) {
      this.toast.error(errorText(e));
    } finally {
      this.busy.set(false);
    }
  }

  async askCancel(t: CashTransferView) {
    const done = await this.dialogs.form({
      title: `Huỷ chuyển tiền ${t.code}?`,
      message: 'Hai phiếu thu, chi của chuyển tiền cùng huỷ; số dư hai quỹ trở lại như trước. Bị chặn nếu quỹ nhận đã tiêu mất tiền.',
      confirmLabel: 'Huỷ chuyển tiền', cancelLabel: 'Không huỷ', tone: 'danger',
      fields: [{ key: 'reason', label: 'Lý do huỷ', type: 'textarea', placeholder: 'Không bắt buộc', maxLength: 300 }],
      run: (v) => this.svc.cancelTransfer(t.id, v['reason'] || undefined),
    });
    if (!done) return;
    this.toast.success(`Đã huỷ ${t.code}; số dư hai quỹ trở lại như trước.`);
    await this.load();
  }
}
