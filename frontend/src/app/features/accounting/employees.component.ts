import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService, EmployeeInput } from '../../core/services/accounting.service';
import { EmployeeView, PayrollCenterKey } from '../../core/models/domain.models';
import { formatVnd } from '../../shared/format.util';

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
  imports: [FormsModule],
  template: `
    <div class="page-header">
      <div><h1>Nhân viên</h1><p class="subtitle">Lương cơ bản, phụ cấp, lương đóng bảo hiểm và người phụ thuộc. Bộ phận quyết định tài khoản chi phí lương.</p></div>
      <button type="button" class="btn btn-primary" (click)="openForm()">{{ showForm() ? 'Đóng' : '+ Thêm nhân viên' }}</button>
    </div>
    @if (notice()) { <div class="notice" role="status">{{ notice() }}</div> }
    @if (failure()) { <div class="notice is-error" role="alert">{{ failure() }}</div> }

    @if (showForm()) {
      <div class="card section-block" style="padding:16px; margin-bottom:12px">
        <h3 class="form-section-title">{{ editingId() ? 'Sửa nhân viên' : 'Thêm nhân viên' }}</h3>
        <div class="toolbar" style="gap:12px; flex-wrap:wrap; align-items:flex-end">
          <label>Họ tên<br><input type="text" [(ngModel)]="form.name" style="min-width:200px"></label>
          <label>Bộ phận<br>
            <select [(ngModel)]="form.center">
              @for (c of centers; track c.key) { <option [value]="c.key">{{ c.label }}</option> }
            </select>
          </label>
          <label>Lương cơ bản<br><input type="number" min="0" [(ngModel)]="form.baseSalary" style="width:140px; text-align:right"></label>
          <label>Phụ cấp<br><input type="number" min="0" [(ngModel)]="form.allowance" style="width:120px; text-align:right"></label>
          <label>Lương đóng BH<br><input type="number" min="0" [(ngModel)]="form.insuranceSalary" placeholder="= lương CB" style="width:140px; text-align:right"></label>
          <label>Người phụ thuộc<br><input type="number" min="0" [(ngModel)]="form.dependents" style="width:90px"></label>
          <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="save()">Lưu</button>
        </div>
      </div>
    }

    <div class="card" style="overflow-x:auto">
      <table style="width:100%; border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left">Mã</th><th style="text-align:left">Họ tên</th><th style="text-align:left">Bộ phận</th>
          <th style="text-align:right">Lương cơ bản</th><th style="text-align:right">Phụ cấp</th><th style="text-align:right">Lương đóng BH</th>
          <th style="text-align:right">Phụ thuộc</th><th style="text-align:left">Trạng thái</th><th></th>
        </tr></thead>
        <tbody>
          @for (e of items(); track e.id) {
            <tr [style.opacity]="e.isActive ? 1 : 0.55">
              <td>{{ e.code }}</td><td>{{ e.name }}</td><td>{{ centerLabel(e.center) }}</td>
              <td style="text-align:right">{{ money(e.baseSalary) }}</td>
              <td style="text-align:right">{{ money(e.allowance) }}</td>
              <td style="text-align:right">{{ money(e.insuranceSalary ?? e.baseSalary) }}</td>
              <td style="text-align:right">{{ e.dependents }}</td>
              <td>{{ e.isActive ? 'Đang làm việc' : 'Đã nghỉ' }}</td>
              <td style="text-align:right; white-space:nowrap">
                <button type="button" class="btn btn-sm" (click)="edit(e)">Sửa</button>
                <button type="button" class="btn btn-sm" (click)="toggle(e)">{{ e.isActive ? 'Cho nghỉ' : 'Kích hoạt' }}</button>
              </td>
            </tr>
          } @empty { <tr><td colspan="9" style="text-align:center; padding:16px">Chưa có nhân viên.</td></tr> }
        </tbody>
      </table>
    </div>
  `,
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

  constructor() { this.load(); }

  centerLabel(c: PayrollCenterKey) { return CENTER_LABEL[c]; }

  async load() {
    try { this.items.set(await this.svc.employees()); } catch (e) { this.failure.set(e instanceof Error ? e.message : 'Lỗi tải'); }
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
    } catch (e) { this.failure.set(e instanceof Error ? e.message : 'Không lưu được.'); }
    finally { this.saving.set(false); }
  }

  async toggle(e: EmployeeView) {
    this.failure.set('');
    try { await this.svc.updateEmployee(e.id, { isActive: !e.isActive }); await this.load(); }
    catch (err) { this.failure.set(err instanceof Error ? err.message : 'Không cập nhật được.'); }
  }
}
