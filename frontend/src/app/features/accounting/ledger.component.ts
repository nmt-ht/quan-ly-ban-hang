import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AccountingService } from '../../core/services/accounting.service';
import { LedgerView } from '../../core/models/domain.models';
import { formatVnd } from '../../shared/format.util';
import { formatDay } from '../../shared/period';

/** /ke-toan/so-cai/:code — sổ cái một tài khoản + số dư luỹ kế. */
@Component({
  selector: 'app-accounting-ledger',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Sổ cái @if (data(); as d) { TK {{ d.account.code }} — {{ d.account.name }} }</h1>
        @if (data(); as d) { <p class="subtitle">Số dư đầu kỳ: <b>{{ money(d.account.normalSide === 'NO' ? d.openingNo - d.openingCo : d.openingCo - d.openingNo) }}</b> (bên {{ d.account.normalSide === 'NO' ? 'Nợ' : 'Có' }})</p> }
      </div>
      <label>Kỳ (năm) <input type="number" [(ngModel)]="period" (change)="load()" style="width:90px"></label>
    </div>
    @if (failure()) { <div class="notice is-error" role="alert">{{ failure() }}</div> }

    <div class="card" style="overflow-x:auto">
      <table style="width:100%; border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left">Ngày</th><th style="text-align:left">Số CT</th><th style="text-align:left">Diễn giải</th>
          <th style="text-align:right">Nợ</th><th style="text-align:right">Có</th><th style="text-align:right">Số dư</th>
        </tr></thead>
        <tbody>
          @for (r of data()?.rows ?? []; track $index) {
            <tr>
              <td>{{ formatDay(r.date) }}</td><td>{{ r.code }}</td><td>{{ r.description }}</td>
              <td style="text-align:right">{{ r.debit ? money(r.debit) : '' }}</td>
              <td style="text-align:right">{{ r.credit ? money(r.credit) : '' }}</td>
              <td style="text-align:right">{{ money(r.balance) }}</td>
            </tr>
          } @empty {
            <tr><td colspan="6" style="text-align:center; padding:16px">Chưa có phát sinh.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class AccountingLedgerComponent {
  private readonly svc = inject(AccountingService);
  private readonly code = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('code') ?? '')), { initialValue: '' });
  readonly data = signal<LedgerView | null>(null);
  readonly failure = signal('');
  readonly money = formatVnd;
  readonly formatDay = formatDay;
  period = new Date().getFullYear();

  constructor() { this.load(); }

  async load() {
    this.failure.set('');
    try { this.data.set(await this.svc.ledger(this.code(), String(this.period))); }
    catch (e) { this.failure.set(e instanceof Error ? e.message : 'Lỗi tải'); }
  }
}
