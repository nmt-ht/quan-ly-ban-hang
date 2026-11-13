import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService } from '../../core/services/accounting.service';
import { BalanceSheetView } from '../../core/models/domain.models';
import { formatVnd } from '../../shared/format.util';

/** /ke-toan/can-doi-ke-toan — Bảng cân đối kế toán (B01-DNN, TT133). */
@Component({
  selector: 'app-accounting-balance-sheet',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page-header">
      <div><h1>Bảng cân đối kế toán</h1><p class="subtitle">Mẫu B01-DNN theo Thông tư 133 (rút gọn).</p></div>
      <label>Kỳ (năm) <input type="number" [(ngModel)]="period" (change)="load()" style="width:90px"></label>
    </div>
    @if (failure()) { <div class="notice is-error" role="alert">{{ failure() }}</div> }

    @if (data(); as d) {
      @if (!d.balanced) { <div class="notice is-error">Chưa cân: Tổng tài sản {{ money(d.totalAssets) }} ≠ Tổng nguồn vốn {{ money(d.totalResources) }}.</div> }
      <div class="card" style="overflow-x:auto; margin-bottom:12px">
        <table style="width:100%; border-collapse:collapse">
          <thead><tr><th style="text-align:left">TÀI SẢN</th><th style="text-align:right">Số tiền</th></tr></thead>
          <tbody>
            @for (a of d.assets; track a.label) { <tr><td>{{ a.label }}</td><td style="text-align:right">{{ money(a.amount) }}</td></tr> }
          </tbody>
          <tfoot><tr style="font-weight:700"><td>TỔNG CỘNG TÀI SẢN</td><td style="text-align:right">{{ money(d.totalAssets) }}</td></tr></tfoot>
        </table>
      </div>
      <div class="card" style="overflow-x:auto">
        <table style="width:100%; border-collapse:collapse">
          <thead><tr><th style="text-align:left">NGUỒN VỐN</th><th style="text-align:right">Số tiền</th></tr></thead>
          <tbody>
            @for (r of d.resources; track r.label) { <tr><td>{{ r.label }}</td><td style="text-align:right">{{ money(r.amount) }}</td></tr> }
          </tbody>
          <tfoot><tr style="font-weight:700"><td>TỔNG CỘNG NGUỒN VỐN</td><td style="text-align:right">{{ money(d.totalResources) }}</td></tr></tfoot>
        </table>
      </div>
    }
  `,
})
export class AccountingBalanceSheetComponent {
  private readonly svc = inject(AccountingService);
  readonly data = signal<BalanceSheetView | null>(null);
  readonly failure = signal('');
  readonly money = formatVnd;
  period = new Date().getFullYear();

  constructor() { this.load(); }

  async load() {
    this.failure.set('');
    try { this.data.set(await this.svc.balanceSheet(String(this.period))); }
    catch (e) { this.failure.set(e instanceof Error ? e.message : 'Lỗi tải'); }
  }
}
