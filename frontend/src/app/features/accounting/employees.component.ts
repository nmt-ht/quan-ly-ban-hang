/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService, EmployeeInput } from '../../core/services/accounting.service';
import { errorText } from '../../core/api/api.service';
import { EmployeeView, PayrollCenterKey } from '../../core/models/domain.models';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { formatVnd } from '../../shared/format.util';
import { MoneyInputDirective } from '../../shared/money-input.directive';

export const CENTER_LABEL: Record<PayrollCenterKey, string> = {
  QUAN_LY: 'Quản lý (642)', BAN_HANG: 'Bán hàng (641)', SAN_XUAT: 'Sản xuất trực tiếp (154)',
};

function blank(): EmployeeInput & { insuranceSalary: number | null } {
  return { name: '', center: 'QUAN_LY', baseSalary: 0, allowance: 0, insuranceSalary: null, dependents: 0 };
}

/** /ke-toan/nhan-vien — danh sách nhân viên hưởng lương. */
@Component({
  selector: 'app-accounting-employees',
  standalone: true,
  imports: [FormsModule, NavIconComponent, DataTableComponent, MoneyInputDirective],
  template: `
    <div class="page-header">
      <div>
        <h1>Nhân viên</h1>
        <p class="subtitle">Lương cơ bản, phụ cấp, lương đóng bảo hiểm và người phụ thuộc. Bộ phận quyết định tài khoản chi phí lương.</p>
      </div>
      <div class="toolbar">
        <button type="button" class="btn btn-primary" (click)="openForm()"><app-nav-icon [name]="showForm() ? 'x' : 'plus'" />{{ showForm() ? 'Đóng' : 'Thêm nhân viên' }}</button>
      </div>
    </div>
    @if (notice()) {
      <div class="notice" role="status">
        <span>{{ notice() }}</span>
        <button type="button" class="notice-x" aria-label="Đóng thông báo" (click)="notice.set('')"><app-nav-icon name="x" /></button>
      </div>
    }
    @if (failure()) { <div class="notice is-error" role="alert"><span>{{ failure() }}</span></div> }

    @if (showForm()) {
      <section class="card section-block" aria-labelledby="nv-form">
        <h2 id="nv-form" class="form-section-title">{{ editingId() ? 'Sửa nhân viên' : 'Thêm nhân viên' }}</h2>
        <div class="form-grid-3">
          <div class="field span-2">
            <label for="nv-name">Họ tên <span class="required-mark">*</span></label>
            <input id="nv-name" type="text" maxlength="120" [(ngModel)]="form.name" />
          </div>
          <div class="field">
            <label for="nv-center">Bộ phận</label>
            <select id="nv-center" [(ngModel)]="form.center">
              @for (c of centers; track c.key) { <option [value]="c.key">{{ c.label }}</option> }
            </select>
          </div>
          <div class="field">
            <label for="nv-base">Lương cơ bản</label>
            <input id="nv-base" type="text" appMoney class="num money-field" placeholder="0" [(ngModel)]="form.baseSalary" />
          </div>
          <div class="field">
            <label for="nv-allow">Phụ cấp</label>
            <input id="nv-allow" type="text" appMoney class="num money-field" placeholder="0" [(ngModel)]="form.allowance" />
          </div>
          <div class="field">
            <label for="nv-ins">Lương đóng bảo hiểm</label>
            <input id="nv-ins" type="text" appMoney class="num money-field" placeholder="Bằng lương cơ bản" [(ngModel)]="form.insuranceSalary" />
            <span class="hint">Để trống thì tính theo lương cơ bản.</span>
          </div>
          <div class="field">
            <label for="nv-dep">Người phụ thuộc</label>
            <input id="nv-dep" type="number" min="0" class="num" [(ngModel)]="form.dependents" />
          </div>
        </div>
        <div class="toolbar">
          <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="save()">Lưu</button>
          <button type="button" class="btn" (click)="showForm.set(false)">Bỏ qua</button>
        </div>
      </section>
    }

    <app-data-table [columns]="columns" [rows]="items()" [actions]="rowActions()" emptyTitle="Chưa có nhân viên" emptyHint="Thêm nhân viên để tính lương." />

    <ng-template #rowActionsTpl let-e>
      <span class="row-actions">
        <button type="button" class="icon-action" [attr.aria-label]="'Sửa ' + e.name" title="Sửa" (click)="edit(e)"><app-nav-icon name="pencil" /></button>
        <button type="button" class="btn row-act-btn" (click)="toggle(e)">{{ e.isActive ? 'Cho nghỉ' : 'Kích hoạt' }}</button>
      </span>
    </ng-template>
  `,
  styles: [`.money-field { text-align: right; }`],
})
export class AccountingEmployeesComponent {
  private readonly svc = inject(AccountingService);
  readonly items = signal<EmployeeView[]>([]);
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly notice = signal('');
  readonly failure = signal('');
  readonly money = formatVnd;
  readonly centers = (Object.keys(CENTER_LABEL) as PayrollCenterKey[]).map((key) => ({ key, label: CENTER_LABEL[key] }));
  form = blank();
  private readonly rowActionsRef = viewChild<TemplateRef<{ $implicit: EmployeeView }>>('rowActionsTpl');
  readonly rowActions = computed(() => this.rowActionsRef());

  readonly columns: DataTableColumn<EmployeeView>[] = [
    { key: 'code', label: 'Mã', copy: true },
    { key: 'name', label: 'Họ tên' },
    { key: 'center', label: 'Bộ phận', format: (e) => CENTER_LABEL[e.center] },
    { key: 'baseSalary', label: 'Lương cơ bản', align: 'right', format: (e) => formatVnd(e.baseSalary) },
    { key: 'allowance', label: 'Phụ cấp', align: 'right', format: (e) => formatVnd(e.allowance) },
    { key: 'insuranceSalary', label: 'Lương đóng BH', align: 'right', format: (e) => formatVnd(e.insuranceSalary ?? e.baseSalary) },
    { key: 'dependents', label: 'Phụ thuộc', align: 'right', format: (e) => String(e.dependents) },
    { key: 'status', label: 'Trạng thái', format: (e) => (e.isActive ? 'Đang làm việc' : 'Đã nghỉ'), badge: (e) => (e.isActive ? 'badge-success' : 'badge-muted') },
  ];

  constructor() { this.load(); }

  async load() {
    try { this.items.set(await this.svc.employees()); } catch (e) { this.failure.set(errorText(e)); }
  }

  openForm() {
    if (this.showForm()) { this.showForm.set(false); return; }
    this.editingId.set(null); this.form = blank(); this.showForm.set(true);
  }

  edit(e: EmployeeView) {
    this.editingId.set(e.id);
    this.form = { name: e.name, center: e.center, baseSalary: e.baseSalary, allowance: e.allowance, insuranceSalary: e.insuranceSalary ?? null, dependents: e.dependents };
    this.showForm.set(true);
  }

  async save() {
    this.failure.set(''); this.notice.set(''); this.saving.set(true);
    const dto: EmployeeInput = {
      name: this.form.name, center: this.form.center, baseSalary: Number(this.form.baseSalary) || 0,
      allowance: Number(this.form.allowance) || 0, dependents: Number(this.form.dependents) || 0,
      insuranceSalary: this.form.insuranceSalary ? Number(this.form.insuranceSalary) : null,
    };
    try {
      const id = this.editingId();
      if (id) await this.svc.updateEmployee(id, dto); else await this.svc.createEmployee(dto);
      this.notice.set(id ? 'Đã cập nhật nhân viên.' : 'Đã thêm nhân viên.');
      this.showForm.set(false);
      await this.load();
    } catch (e) { this.failure.set(errorText(e)); }
    finally { this.saving.set(false); }
  }

  async toggle(e: EmployeeView) {
    this.failure.set('');
    try { await this.svc.updateEmployee(e.id, { isActive: !e.isActive }); await this.load(); }
    catch (err) { this.failure.set(errorText(err)); }
  }
}
