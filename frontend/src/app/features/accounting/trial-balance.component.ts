import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AccountingService } from '../../core/services/accounting.service';
import { TrialBalanceView } from '../../core/models/domain.models';
import { formatVnd } from '../../shared/format.util';

/** /ke-toan/can-doi-phat-sinh — bảng cân đối số phát sinh của kỳ. */
@Component({
  selector: 'app-accounting-trial-balance',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page-header">
      <div><h1>Bảng cân đối số phát sinh</h1><p class="subtitle">Dư đầu kỳ · phát sinh trong kỳ · dư cuối kỳ của từng tài khoản.</p></div>
      <label>Kỳ (năm) <input type="number" [(ngModel)]="period" (change)="load()" style="width:90px"></label>
    </div>
    @if (failure()) { <div class="notice is-error" role="alert">{{ failure() }}</div> }

    <div class="card" style="overflow-x:auto">
      <table style="width:100%; border-collapse:collapse">
        <thead>
          <tr>
            <th rowspan="2" style="text-align:left">TK</th><th rowspan="2" style="text-align:left">Tên tài khoản</th>
            <th colspan="2" style="text-align:center">Dư đầu kỳ</th>
            <th colspan="2" style="text-align:center">Phát sinh</th>
            <th colspan="2" style="text-align:center">Dư cuối kỳ</th>
          </tr>
          <tr>
            <th style="text-align:right">Nợ</th><th style="text-align:right">Có</th>
            <th style="text-align:right">Nợ</th><th style="text-align:right">Có</th>
            <th style="text-align:right">Nợ</th><th style="text-align:right">Có</th>
          </tr>
        </thead>
        <tbody>
          @for (r of data()?.rows ?? []; track r.code) {
            <tr>
              <td><a [routerLink]="['/ke-toan/so-cai', r.code]">{{ r.code }}</a></td>
              <td>{{ r.name }}</td>
              <td style="text-align:right">{{ r.openingNo ? money(r.openingNo) : '' }}</td>
              <td style="text-align:right">{{ r.openingCo ? money(r.openingCo) : '' }}</td>
              <td style="text-align:right">{{ r.debit ? money(r.debit) : '' }}</td>
              <td style="text-align:right">{{ r.credit ? money(r.credit) : '' }}</td>
              <td style="text-align:right">{{ r.closingNo ? money(r.closingNo) : '' }}</td>
              <td style="text-align:right">{{ r.closingCo ? money(r.closingCo) : '' }}</td>
            </tr>
          } @empty {
            <tr><td colspan="8" style="text-align:center; padding:16px">Chưa có số liệu.</td></tr>
          }
        </tbody>
        @if (data(); as d) {
          <tfoot>
            <tr style="font-weight:700; border-top:2px solid var(--border, #ccc)">
              <td colspan="2">TỔNG CỘNG</td>
              <td style="text-align:right">{{ money(d.totals.od) }}</td>
              <td style="text-align:right">{{ money(d.totals.oc) }}</td>
              <td style="text-align:right">{{ money(d.totals.pd) }}</td>
              <td style="text-align:right">{{ money(d.totals.pc) }}</td>
              <td style="text-align:right">{{ money(d.totals.cd) }}</td>
              <td style="text-align:right">{{ money(d.totals.cc) }}</td>
            </tr>
          </tfoot>
        }
      </table>
    </div>
  `,
})
export class AccountingTrialBalanceComponent {
  private readonly svc = inject(AccountingService);
  readonly data = signal<TrialBalanceView | null>(null);
  readonly failure = signal('');
  readonly money = formatVnd;
  period = new Date().getFullYear();

  constructor() { this.load(); }

  async load() {
    this.failure.set('');
    try { this.data.set(await this.svc.trialBalance(String(this.period))); }
    catch (e) { this.failure.set(e instanceof Error ? e.message : 'Lỗi tải'); }
  }
}
