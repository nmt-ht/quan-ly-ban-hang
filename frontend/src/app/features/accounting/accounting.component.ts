/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DateInputDirective } from '../../shared/date-input/date-input.directive';
import { AccountingService } from '../../core/services/accounting.service';
import { AuthService } from '../../core/services/auth.service';
import { errorText } from '../../core/api/api.service';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { formatDay } from '../../shared/period';
import { ToastService } from '../../core/services/toast.service';

/** Đường tắt tới sổ sách và báo cáo, nhóm theo việc người làm kế toán cần. */
const GROUPS = [
  { title: 'Sổ sách', links: [
    { label: 'Sổ nhật ký chung', to: '/ke-toan/so-nhat-ky' },
    { label: 'Sổ chi tiết tài khoản', to: '/ke-toan/so-chi-tiet' },
    { label: 'Tổng hợp công nợ', to: '/ke-toan/tong-hop-cong-no' },
    { label: 'Bảng cân đối số phát sinh', to: '/ke-toan/can-doi-phat-sinh' },
  ] },
  { title: 'Báo cáo và thuế', links: [
    { label: 'Bảng cân đối kế toán', to: '/ke-toan/can-doi-ke-toan' },
    { label: 'Kết quả hoạt động kinh doanh', to: '/ke-toan/ket-qua-kinh-doanh' },
    { label: 'Lưu chuyển tiền tệ', to: '/ke-toan/luu-chuyen-tien-te' },
    { label: 'Thuế GTGT', to: '/ke-toan/thue-gtgt' },
    { label: 'Thuế TNDN', to: '/ke-toan/thue-tndn' },
  ] },
  { title: 'Thiết lập sổ', links: [
    { label: 'Hệ thống tài khoản', to: '/ke-toan/tai-khoan' },
    { label: 'Số dư đầu kỳ', to: '/ke-toan/so-du-dau-ky' },
    { label: 'Nhập bút toán', to: '/ke-toan/but-toan' },
    { label: 'Kết chuyển cuối kỳ', to: '/ke-toan/ket-chuyen' },
  ] },
];

/** /ke-toan — tổng quan kế toán + bật/tắt ngày ghi sổ. */
@Component({
  selector: 'app-accounting',
  standalone: true,
  imports: [FormsModule, RouterLink, NavIconComponent, DateInputDirective],
  template: `
    <div class="page-header">
      <div>
        <h1>Kế toán</h1>
        <p class="subtitle">Sổ cái kép theo Thông tư 133. Bút toán được sinh tự động từ giao hàng, thu/chi.</p>
      </div>
    </div>

        
    <section class="card section-block" aria-labelledby="kt-state">
      <h2 id="kt-state" class="form-section-title">Trạng thái ghi sổ</h2>
      @if (loaded()) {
        @if (startDate()) {
          <p>Đang ghi sổ từ ngày <b class="num">{{ formatDay(startDate()!) }}</b>. Chứng từ từ ngày này trở đi tự sinh bút toán.</p>
        } @else {
          <p>Sổ cái <b>chưa bật</b>. Đặt ngày bắt đầu ghi sổ để hệ thống sinh bút toán tự động.</p>
        }
        @if (canManage) {
          <div class="form-grid">
            <div class="field">
              <label for="kt-start">Ngày bắt đầu ghi sổ</label>
              <input id="kt-start" appDate [ngModel]="draft()" (ngModelChange)="draft.set($event)" />
            </div>
          </div>
          <div class="toolbar">
            <button type="button" class="btn btn-primary" (click)="save(draft())"><app-nav-icon name="check" />Lưu</button>
            @if (startDate()) { <button type="button" class="btn btn-danger-ghost" (click)="save('')">Tắt sổ cái</button> }
          </div>
        }
      } @else {
        <p class="subtitle">Đang tải…</p>
      }
    </section>

    @for (g of groups; track g.title) {
      <section class="section-bare section-block">
        <h3>{{ g.title }}</h3>
        <div class="toolbar">
          @for (l of g.links; track l.to) { <a class="btn" [routerLink]="l.to">{{ l.label }}</a> }
        </div>
      </section>
    }
  `,
})
export class AccountingComponent {
  protected readonly toast = inject(ToastService);
  private readonly svc = inject(AccountingService);
  readonly canManage = inject(AuthService).can('accounting.manage_account');
  readonly groups = GROUPS;
  readonly startDate = signal<string | null>(null);
  /** Ngày bắt đầu ghi sổ đang nhập (chưa lưu). */
  readonly draft = signal('');
  readonly loaded = signal(false);
  readonly formatDay = formatDay;

  constructor() {
    this.load();
  }

  private async load() {
    try {
      const s = await this.svc.settings();
      this.startDate.set(s.ledgerStartDate ?? null);
      this.draft.set(s.ledgerStartDate?.slice(0, 10) ?? '');
    } catch (e) {
      this.toast.error(errorText(e));
    } finally {
      this.loaded.set(true);
    }
  }

  async save(value: string) {
    try {
      const s = await this.svc.setSettings(value || null);
      this.startDate.set(s.ledgerStartDate ?? null);
      this.draft.set(s.ledgerStartDate?.slice(0, 10) ?? '');
      this.toast.success(value ? 'Đã bật sổ cái.' : 'Đã tắt sổ cái.');
    } catch (e) {
      this.toast.error(errorText(e));
    }
  }
}
