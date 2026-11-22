/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountingService } from '../../core/services/accounting.service';
import { errorText } from '../../core/api/api.service';
import { TrialBalanceView } from '../../core/models/domain.models';
import { formatVnd } from '../../shared/format.util';
import { ToastService } from '../../core/services/toast.service';

/** /ke-toan/can-doi-phat-sinh — bảng cân đối số phát sinh của kỳ. */
@Component({
  selector: 'app-accounting-trial-balance',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page-header">
      <div>
        <h1>Bảng cân đối số phát sinh</h1>
        <p class="subtitle">Dư đầu kỳ · phát sinh trong kỳ · dư cuối kỳ của từng tài khoản. Bấm mã tài khoản để xem sổ cái.</p>
      </div>
    </div>

    <div class="filters-bar">
      <input type="number" class="year-input" aria-label="Năm" min="2000" max="2100" [value]="period()" (change)="period.set(+$any($event.target).value); load()" />
    </div>
    
    @if (data(); as d) {
      <dl class="list-totals">
        <div><dt>Phát sinh Nợ</dt><dd class="num">{{ money(d.totals.pd) }}</dd></div>
        <div><dt>Phát sinh Có</dt><dd class="num">{{ money(d.totals.pc) }}</dd></div>
        <div><dt>Dư cuối kỳ Nợ</dt><dd class="num">{{ money(d.totals.cd) }}</dd></div>
        <div><dt>Dư cuối kỳ Có</dt><dd class="num">{{ money(d.totals.cc) }}</dd></div>
      </dl>

      <div class="rp-surface rp-grid">
        <table class="book-table">
          <thead>
            <tr>
              <th rowspan="2" scope="col">TK</th><th rowspan="2" scope="col">Tên tài khoản</th>
              <th colspan="2" scope="colgroup" class="c">Dư đầu kỳ</th><th colspan="2" scope="colgroup" class="c">Phát sinh</th><th colspan="2" scope="colgroup" class="c">Dư cuối kỳ</th>
            </tr>
            <tr>
              <th scope="col" class="r">Nợ</th><th scope="col" class="r">Có</th>
              <th scope="col" class="r">Nợ</th><th scope="col" class="r">Có</th>
              <th scope="col" class="r">Nợ</th><th scope="col" class="r">Có</th>
            </tr>
          </thead>
          <tbody>
            @for (r of d.rows; track r.code) {
              <tr>
                <td class="code"><a class="code-link" [routerLink]="['/ke-toan/so-cai', r.code]">{{ r.code }}</a></td>
                <td>{{ r.name }}</td>
                <td class="r num" [class.is-zero]="!r.openingNo">{{ r.openingNo ? money(r.openingNo) : '—' }}</td>
                <td class="r num" [class.is-zero]="!r.openingCo">{{ r.openingCo ? money(r.openingCo) : '—' }}</td>
                <td class="r num" [class.is-zero]="!r.debit">{{ r.debit ? money(r.debit) : '—' }}</td>
                <td class="r num" [class.is-zero]="!r.credit">{{ r.credit ? money(r.credit) : '—' }}</td>
                <td class="r num" [class.is-zero]="!r.closingNo">{{ r.closingNo ? money(r.closingNo) : '—' }}</td>
                <td class="r num" [class.is-zero]="!r.closingCo">{{ r.closingCo ? money(r.closingCo) : '—' }}</td>
              </tr>
            } @empty {
              <tr><td class="book-none" colspan="8">Chưa có số liệu.</td></tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2">TỔNG CỘNG</td>
              <td class="r num">{{ money(d.totals.od) }}</td><td class="r num">{{ money(d.totals.oc) }}</td>
              <td class="r num">{{ money(d.totals.pd) }}</td><td class="r num">{{ money(d.totals.pc) }}</td>
              <td class="r num">{{ money(d.totals.cd) }}</td><td class="r num">{{ money(d.totals.cc) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    }
  `,
})
export class AccountingTrialBalanceComponent {
  protected readonly toast = inject(ToastService);
  private readonly svc = inject(AccountingService);
  readonly data = signal<TrialBalanceView | null>(null);
  readonly money = formatVnd;
  readonly period = signal(new Date().getFullYear());

  constructor() { this.load(); }

  async load() {
    try { this.data.set(await this.svc.trialBalance(String(this.period()))); }
    catch (e) { this.data.set(null); this.toast.error(errorText(e)); }
  }
}
