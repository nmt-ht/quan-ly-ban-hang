/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService, PrepaidItemInput } from '../../core/services/accounting.service';
import { AuthService } from '../../core/services/auth.service';
import { errorText } from '../../core/api/api.service';
import { PrepaidItemView } from '../../core/models/domain.models';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { formatVnd } from '../../shared/format.util';
import { MoneyInputDirective } from '../../shared/money-input.directive';
import { MonthPickerComponent } from '../../shared/month-picker/month-picker.component';
import { formatDay, isoDay } from '../../shared/period';
import { DateInputDirective } from '../../shared/date-input/date-input.directive';
import { newestFirst } from '../../shared/column-sort';
import { ToastService } from '../../core/services/toast.service';

function blankForm(): PrepaidItemInput {
  return { name: '', cost: 0, startDate: isoDay(new Date()), allocationMonths: 12, expenseAccount: '642', fundingAccount: '153' };
}

/** /ke-toan/cong-cu-dung-cu — công cụ dụng cụ & chi phí trả trước (TK 242), phân bổ theo tháng. */
@Component({
  selector: 'app-accounting-prepaid-items',
  standalone: true,
  imports: [DateInputDirective, FormsModule, NavIconComponent, DataTableComponent, MoneyInputDirective, MonthPickerComponent],
  template: `
    <div class="page-header">
      <div>
        <h1>Công cụ dụng cụ</h1>
        <p class="subtitle">Ghi nhận vào TK 242 rồi phân bổ đều theo tháng: Nợ chi phí / Có 242.</p>
      </div>
      @if (canManage && !showForm()) {
        <div class="toolbar">
          <button type="button" class="btn btn-primary" (click)="showForm.set(!showForm())"><app-nav-icon name="plus" />Thêm CCDC</button>
        </div>
      }
    </div>

    @if (showForm() && canManage) {
      <section class="card section-block" aria-labelledby="cc-form">
        <h2 id="cc-form" class="form-section-title">Thêm công cụ dụng cụ</h2>
        <div class="form-grid-3">
          <div class="field span-2">
            <label for="cc-name">Tên <span class="required-mark">*</span></label>
            <input id="cc-name" type="text" maxlength="200" [(ngModel)]="form.name" />
          </div>
          <div class="field">
            <label for="cc-cost">Giá trị <span class="required-mark">*</span></label>
            <input id="cc-cost" type="text" appMoney class="num money-field" placeholder="0" [(ngModel)]="form.cost" />
          </div>
          <div class="field">
            <label for="cc-start">Bắt đầu phân bổ</label>
            <input id="cc-start" appDate [(ngModel)]="form.startDate" />
          </div>
          <div class="field">
            <label for="cc-months">Số tháng</label>
            <input id="cc-months" type="number" min="1" class="num" [(ngModel)]="form.allocationMonths" />
          </div>
          <div class="field">
            <label for="cc-exp">TK chi phí</label>
            <input id="cc-exp" type="text" class="num" maxlength="6" [(ngModel)]="form.expenseAccount" />
          </div>
          <div class="field">
            <label for="cc-fund">TK đối ứng</label>
            <select id="cc-fund" [(ngModel)]="form.fundingAccount">
              <option value="153">153 — Công cụ, dụng cụ</option>
              <option value="111">111 — Tiền mặt</option>
              <option value="112">112 — Tiền gửi NH</option>
              <option value="331">331 — Phải trả người bán</option>
            </select>
          </div>
        </div>
      </section>

      <div class="form-actions-bar">
        <span class="hint" role="status">Điền thông tin rồi bấm Lưu</span>
        <div class="form-actions">
          <button type="button" class="btn" (click)="showForm.set(false)">Huỷ</button>
          <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="save()"><app-nav-icon name="check" />Lưu công cụ dụng cụ</button>
        </div>
      </div>
    } @else {

    @if (canAllocate) {
      <div class="filters-bar">
        <label class="filter-label" for="cc-period">Phân bổ kỳ</label>
        <app-month-picker inputId="cc-period" ariaLabel="Kỳ phân bổ" [(value)]="period" />
        <button type="button" class="btn" [disabled]="allocating()" (click)="allocate()">Phân bổ</button>
      </div>
    }

    @if (items().length) {
      <dl class="list-totals">
        <div><dt>Khoản</dt><dd class="num">{{ items().length }}</dd></div>
        <div><dt>Tổng giá trị</dt><dd class="num">{{ money(totalCost()) }}</dd></div>
        <div><dt>Còn phải phân bổ</dt><dd class="num" [class.text-warning]="totalRemaining() > 0">{{ money(totalRemaining()) }}</dd></div>
      </dl>
    }

    <app-data-table [columns]="columns" [rows]="items()" emptyTitle="Chưa có công cụ dụng cụ" emptyHint="Thêm công cụ dụng cụ để phân bổ chi phí hằng tháng." />
    }
  `,
  styles: [`.money-field { text-align: right; } .filter-label { font-size: var(--text-sm); color: var(--color-muted); }`],
})
export class AccountingPrepaidItemsComponent {
  protected readonly toast = inject(ToastService);
  private readonly svc = inject(AccountingService);
  private readonly auth = inject(AuthService);
  readonly canManage = this.auth.can('accounting.manage_account');
  readonly canAllocate = this.auth.can('accounting.manual');
  readonly items = signal<PrepaidItemView[]>([]);
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly allocating = signal(false);
  readonly money = formatVnd;
  period = isoDay(new Date()).slice(0, 7);
  form: PrepaidItemInput = blankForm();

  readonly columns: DataTableColumn<PrepaidItemView>[] = [
    { key: 'code', label: 'Mã', copy: true },
    { key: 'name', label: 'Tên' },
    { key: 'cost', label: 'Giá trị', align: 'right', format: (i) => formatVnd(i.cost) },
    { key: 'startDate', label: 'Bắt đầu', format: (i) => formatDay(i.startDate), mono: true },
    { key: 'allocationMonths', label: 'Số tháng', align: 'right', format: (i) => String(i.allocationMonths) },
    { key: 'monthly', label: 'PB / tháng', align: 'right', format: (i) => formatVnd(i.monthly) },
    { key: 'allocated', label: 'Đã phân bổ', align: 'right', format: (i) => formatVnd(i.allocated) },
    { key: 'remaining', label: 'Còn lại', align: 'right', format: (i) => formatVnd(i.remaining) },
    { key: 'status', label: 'Trạng thái', format: (i) => (i.status === 'HET_PHAN_BO' ? 'Đã phân bổ hết' : 'Đang phân bổ'), badge: (i) => (i.status === 'HET_PHAN_BO' ? 'badge-muted' : 'badge-success') },
  ];

  constructor() { this.load(); }

  totalCost(): number { return this.items().reduce((s, i) => s + i.cost, 0); }
  totalRemaining(): number { return this.items().reduce((s, i) => s + i.remaining, 0); }

  async load() {
    try { this.items.set((await this.svc.prepaidItems()).sort(newestFirst)); } catch (e) { this.toast.error(errorText(e)); }
  }

  async save() {
    this.toast.clear(); this.saving.set(true);
    try {
      await this.svc.createPrepaid({ ...this.form, cost: Number(this.form.cost), allocationMonths: Number(this.form.allocationMonths) });
      this.toast.success('Đã thêm công cụ dụng cụ.'); this.showForm.set(false); this.form = blankForm();
      await this.load();
    } catch (e) { this.toast.error(errorText(e)); }
    finally { this.saving.set(false); }
  }

  async allocate() {
    this.toast.clear(); this.allocating.set(true);
    try {
      const r = await this.svc.allocatePrepaid(this.period);
      this.toast.success(r.total > 0 ? `Đã phân bổ ${r.count} khoản: ${formatVnd(r.total)}.` : 'Không có khoản nào để phân bổ (đã phân bổ kỳ này, chưa tới ngày bắt đầu, hoặc đã hết).');
      await this.load();
    } catch (e) { this.toast.error(errorText(e)); }
    finally { this.allocating.set(false); }
  }
}
