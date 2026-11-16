/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService, FixedAssetInput } from '../../core/services/accounting.service';
import { AuthService } from '../../core/services/auth.service';
import { errorText } from '../../core/api/api.service';
import { FixedAssetView } from '../../core/models/domain.models';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { formatVnd } from '../../shared/format.util';
import { MoneyInputDirective } from '../../shared/money-input.directive';
import { MonthPickerComponent } from '../../shared/month-picker/month-picker.component';
import { formatDay, isoDay } from '../../shared/period';
import { DateInputDirective } from '../../shared/date-input/date-input.directive';

const newForm = (): FixedAssetInput => ({ name: '', cost: 0, usageStartDate: isoDay(new Date()), usefulLifeMonths: 12, expenseAccount: '642' });

/** /ke-toan/tai-san — tài sản cố định + trích khấu hao. */
@Component({
  selector: 'app-accounting-fixed-assets',
  standalone: true,
  imports: [DateInputDirective, FormsModule, NavIconComponent, DataTableComponent, MoneyInputDirective, MonthPickerComponent],
  template: `
    <div class="page-header">
      <div>
        <h1>Tài sản cố định</h1>
        <p class="subtitle">Khấu hao đường thẳng (nguyên giá ÷ số tháng). Trích khấu hao: Nợ chi phí / Có 214.</p>
      </div>
      @if (canManage) {
        <div class="toolbar">
          <button type="button" class="btn btn-primary" (click)="showForm.set(!showForm())"><app-nav-icon [name]="showForm() ? 'x' : 'plus'" />{{ showForm() ? 'Đóng' : 'Thêm tài sản' }}</button>
        </div>
      }
    </div>
    @if (notice()) {
      <div class="notice" role="status">
        <span>{{ notice() }}</span>
        <button type="button" class="notice-x" aria-label="Đóng thông báo" (click)="notice.set('')"><app-nav-icon name="x" /></button>
      </div>
    }
    @if (failure()) { <div class="notice is-error" role="alert"><span>{{ failure() }}</span></div> }

    @if (showForm() && canManage) {
      <section class="card section-block" aria-labelledby="ts-form">
        <h2 id="ts-form" class="form-section-title">Thêm tài sản cố định</h2>
        <div class="form-grid-3">
          <div class="field span-2">
            <label for="ts-name">Tên tài sản <span class="required-mark">*</span></label>
            <input id="ts-name" type="text" maxlength="200" [(ngModel)]="form.name" />
          </div>
          <div class="field">
            <label for="ts-cost">Nguyên giá <span class="required-mark">*</span></label>
            <input id="ts-cost" type="text" appMoney class="num money-field" placeholder="0" [(ngModel)]="form.cost" />
          </div>
          <div class="field">
            <label for="ts-start">Ngày đưa vào dùng</label>
            <input id="ts-start" appDate [(ngModel)]="form.usageStartDate" />
          </div>
          <div class="field">
            <label for="ts-months">Số tháng khấu hao</label>
            <input id="ts-months" type="number" min="1" class="num" [(ngModel)]="form.usefulLifeMonths" />
          </div>
          <div class="field">
            <label for="ts-acc">TK chi phí khấu hao</label>
            <input id="ts-acc" type="text" class="num" maxlength="6" placeholder="642" [(ngModel)]="form.expenseAccount" />
          </div>
        </div>
        <div class="toolbar">
          <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="save()">Lưu</button>
          <button type="button" class="btn" (click)="showForm.set(false)">Bỏ qua</button>
        </div>
      </section>
    }

    @if (canDepreciate) {
      <div class="filters-bar">
        <label class="filter-label" for="ts-period">Trích khấu hao kỳ</label>
        <app-month-picker inputId="ts-period" ariaLabel="Kỳ khấu hao" [(value)]="period" />
        <button type="button" class="btn" [disabled]="depreciating()" (click)="depreciate()">Trích khấu hao</button>
      </div>
    }

    @if (assets().length) {
      <dl class="list-totals">
        <div><dt>Tài sản</dt><dd class="num">{{ assets().length }}</dd></div>
        <div><dt>Tổng nguyên giá</dt><dd class="num">{{ money(totalCost()) }}</dd></div>
        <div><dt>Đã hao mòn</dt><dd class="num">{{ money(totalAccumulated()) }}</dd></div>
        <div><dt>Giá trị còn lại</dt><dd class="num">{{ money(totalRemaining()) }}</dd></div>
      </dl>
    }

    <app-data-table [columns]="columns" [rows]="assets()" emptyTitle="Chưa có tài sản cố định" emptyHint="Thêm tài sản để trích khấu hao hằng tháng." />
  `,
  styles: [`.money-field { text-align: right; } .filter-label { font-size: var(--text-sm); color: var(--color-muted); }`],
})
export class AccountingFixedAssetsComponent {
  private readonly svc = inject(AccountingService);
  private readonly auth = inject(AuthService);
  readonly canManage = this.auth.can('accounting.manage_account');
  readonly canDepreciate = this.auth.can('accounting.manual');
  readonly assets = signal<FixedAssetView[]>([]);
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly depreciating = signal(false);
  readonly notice = signal('');
  readonly failure = signal('');
  readonly money = formatVnd;
  period = isoDay(new Date()).slice(0, 7);
  form: FixedAssetInput = newForm();

  readonly columns: DataTableColumn<FixedAssetView>[] = [
    { key: 'code', label: 'Mã', copy: true },
    { key: 'name', label: 'Tên tài sản' },
    { key: 'cost', label: 'Nguyên giá', align: 'right', format: (a) => formatVnd(a.cost) },
    { key: 'usageStartDate', label: 'Bắt đầu', format: (a) => formatDay(a.usageStartDate), mono: true },
    { key: 'usefulLifeMonths', label: 'Số tháng', align: 'right', format: (a) => String(a.usefulLifeMonths) },
    { key: 'monthly', label: 'KH / tháng', align: 'right', format: (a) => formatVnd(a.monthly) },
    { key: 'accumulated', label: 'Đã hao mòn', align: 'right', format: (a) => formatVnd(a.accumulated) },
    { key: 'remaining', label: 'Còn lại', align: 'right', format: (a) => formatVnd(a.remaining) },
  ];

  constructor() { this.load(); }

  totalCost(): number { return this.assets().reduce((s, a) => s + a.cost, 0); }
  totalAccumulated(): number { return this.assets().reduce((s, a) => s + a.accumulated, 0); }
  totalRemaining(): number { return this.assets().reduce((s, a) => s + a.remaining, 0); }

  async load() {
    try { this.assets.set(await this.svc.fixedAssets()); } catch (e) { this.failure.set(errorText(e)); }
  }

  async save() {
    this.failure.set(''); this.notice.set(''); this.saving.set(true);
    try {
      await this.svc.createAsset({ ...this.form, cost: Number(this.form.cost), usefulLifeMonths: Number(this.form.usefulLifeMonths) });
      this.notice.set('Đã thêm tài sản.'); this.showForm.set(false);
      this.form = newForm();
      await this.load();
    } catch (e) { this.failure.set(errorText(e)); }
    finally { this.saving.set(false); }
  }

  async depreciate() {
    this.failure.set(''); this.notice.set(''); this.depreciating.set(true);
    try {
      const r = await this.svc.depreciate(this.period);
      this.notice.set(r.total > 0 ? `Đã trích khấu hao ${r.count} tài sản: ${formatVnd(r.total)}.` : 'Không có tài sản nào để trích (đã trích kỳ này hoặc hết khấu hao).');
      await this.load();
    } catch (e) { this.failure.set(errorText(e)); }
    finally { this.depreciating.set(false); }
  }
}
