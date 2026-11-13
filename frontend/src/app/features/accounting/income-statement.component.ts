import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService } from '../../core/services/accounting.service';
import { AuthService } from '../../core/services/auth.service';
import { IncomeStatementView } from '../../core/models/domain.models';
import { formatVnd } from '../../shared/format.util';

/** /ke-toan/ket-qua-kinh-doanh — Báo cáo KQKD (B02-DNN, TT133). */
@Component({
  selector: 'app-accounting-income-statement',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page-header">
      <div><h1>Kết quả hoạt động kinh doanh</h1><p class="subtitle">Mẫu B02-DNN theo Thông tư 133.</p></div>
      <label>Kỳ (năm) <input type="number" [(ngModel)]="period" (change)="load()" style="width:90px"></label>
    </div>
    @if (notice()) { <div class="notice" role="status">{{ notice() }}</div> }
    @if (failure()) { <div class="notice is-error" role="alert">{{ failure() }}</div> }

    <div class="card" style="overflow-x:auto">
      <table style="width:100%; border-collapse:collapse">
        <thead><tr><th style="text-align:left">Chỉ tiêu</th><th style="text-align:right">Số tiền</th></tr></thead>
        <tbody>
          @for (it of data()?.items ?? []; track it.label) {
            <tr [style.font-weight]="it.strong ? '700' : '400'">
              <td>{{ it.label }}</td><td style="text-align:right">{{ money(it.amount) }}</td>
            </tr>
          } @empty { <tr><td colspan="2" style="text-align:center; padding:16px">Chưa có số liệu.</td></tr> }
        </tbody>
      </table>
    </div>

    @if (canClose && data()) {
      <div class="toolbar" style="margin-top:12px">
        <button type="button" class="btn" [disabled]="closing()" (click)="close()">Kết chuyển cuối kỳ {{ period }}</button>
      </div>
    }
  `,
})
export class AccountingIncomeStatementComponent {
  private readonly svc = inject(AccountingService);
  readonly canClose = inject(AuthService).can('accounting.manual');
  readonly data = signal<IncomeStatementView | null>(null);
  readonly notice = signal('');
  readonly failure = signal('');
  readonly closing = signal(false);
  readonly money = formatVnd;
  period = new Date().getFullYear();

  constructor() { this.load(); }

  async load() {
    this.failure.set('');
    try { this.data.set(await this.svc.incomeStatement(String(this.period))); }
    catch (e) { this.failure.set(e instanceof Error ? e.message : 'Lỗi tải'); }
  }

  async close() {
    if (!confirm(`Kết chuyển cuối kỳ ${this.period}? Thao tác này tạo bút toán kết chuyển 511/632/642 → 911 → 421.`)) return;
    this.failure.set(''); this.notice.set(''); this.closing.set(true);
    try { await this.svc.closePeriod(String(this.period)); this.notice.set('Đã kết chuyển cuối kỳ.'); await this.load(); }
    catch (e) { this.failure.set(e instanceof Error ? e.message : 'Không kết chuyển được.'); }
    finally { this.closing.set(false); }
  }
}
