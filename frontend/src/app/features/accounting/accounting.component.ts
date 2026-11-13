import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountingService } from '../../core/services/accounting.service';
import { AuthService } from '../../core/services/auth.service';
import { formatDay } from '../../shared/period';

/** /ke-toan — tổng quan kế toán + bật/tắt ngày ghi sổ. */
@Component({
  selector: 'app-accounting',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page-header">
      <div>
        <h1>Kế toán</h1>
        <p class="subtitle">Sổ cái kép theo Thông tư 133. Bút toán được sinh tự động từ giao hàng, thu/chi.</p>
      </div>
    </div>

    @if (notice()) { <div class="notice" role="status">{{ notice() }}</div> }
    @if (failure()) { <div class="notice is-error" role="alert">{{ failure() }}</div> }

    <div class="card section-block" style="padding:16px">
      <h3 class="form-section-title">Trạng thái ghi sổ</h3>
      @if (loaded()) {
        @if (startDate()) {
          <p>Đang ghi sổ từ ngày <b>{{ formatDay(startDate()!) }}</b>. Chứng từ từ ngày này trở đi tự sinh bút toán.</p>
        } @else {
          <p>Sổ cái <b>chưa bật</b>. Đặt ngày bắt đầu ghi sổ để hệ thống sinh bút toán tự động.</p>
        }
        @if (canManage) {
          <div class="toolbar" style="gap:8px; align-items:flex-end; flex-wrap:wrap">
            <label>Ngày bắt đầu ghi sổ<br><input type="date" [value]="startDate() || ''" #d></label>
            <button type="button" class="btn btn-primary" (click)="save(d.value)">Lưu</button>
            @if (startDate()) { <button type="button" class="btn" (click)="save('')">Tắt sổ cái</button> }
          </div>
        }
      }
    </div>

    <div class="card section-block" style="padding:16px">
      <h3 class="form-section-title">Sổ sách &amp; báo cáo</h3>
      <div class="toolbar" style="flex-wrap:wrap; gap:8px">
        <a class="btn btn-primary" routerLink="/ke-toan/so-nhat-ky">Sổ nhật ký chung</a>
        <a class="btn" routerLink="/ke-toan/can-doi-phat-sinh">Bảng cân đối số phát sinh</a>
        <a class="btn" routerLink="/ke-toan/tai-khoan">Hệ thống tài khoản</a>
        <a class="btn" routerLink="/ke-toan/so-du-dau-ky">Số dư đầu kỳ</a>
      </div>
    </div>
  `,
})
export class AccountingComponent {
  private readonly svc = inject(AccountingService);
  readonly canManage = inject(AuthService).can('accounting.manage_account');
  readonly startDate = signal<string | null>(null);
  readonly loaded = signal(false);
  readonly notice = signal('');
  readonly failure = signal('');
  readonly formatDay = formatDay;

  constructor() {
    this.load();
  }

  private async load() {
    try {
      const s = await this.svc.settings();
      this.startDate.set(s.ledgerStartDate ?? null);
    } finally {
      this.loaded.set(true);
    }
  }

  async save(value: string) {
    this.failure.set('');
    try {
      const s = await this.svc.setSettings(value || null);
      this.startDate.set(s.ledgerStartDate ?? null);
      this.notice.set(value ? 'Đã bật sổ cái.' : 'Đã tắt sổ cái.');
    } catch (e) {
      this.failure.set(e instanceof Error ? e.message : 'Không lưu được.');
    }
  }
}
