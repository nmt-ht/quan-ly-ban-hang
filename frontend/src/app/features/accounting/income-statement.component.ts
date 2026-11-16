/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { Component, inject, signal } from '@angular/core';
import { AccountingService } from '../../core/services/accounting.service';
import { AuthService } from '../../core/services/auth.service';
import { errorText } from '../../core/api/api.service';
import { IncomeStatementView } from '../../core/models/domain.models';
import { formatVnd } from '../../shared/format.util';

/** /ke-toan/ket-qua-kinh-doanh — Báo cáo KQKD (B02-DNN, TT133). */
@Component({
  selector: 'app-accounting-income-statement',
  standalone: true,
  template: `
    <div class="page-header">
      <div>
        <h1>Kết quả hoạt động kinh doanh</h1>
        <p class="subtitle">Mẫu B02-DNN theo Thông tư 133.</p>
      </div>
      @if (canClose && data()) {
        <div class="toolbar">
          <button type="button" class="btn" [disabled]="closing()" (click)="close()">Kết chuyển cuối kỳ {{ period() }}</button>
        </div>
      }
    </div>

    <div class="filters-bar">
      <input type="number" class="year-input" aria-label="Năm" min="2000" max="2100" [value]="period()" (change)="period.set(+$any($event.target).value); load()" />
    </div>
    @if (notice()) { <div class="notice" role="status"><span>{{ notice() }}</span></div> }
    @if (failure()) { <div class="notice is-error" role="alert"><span>{{ failure() }}</span></div> }

    @if (data(); as d) {
      <dl class="list-totals">
        <div><dt>Lợi nhuận sau thuế</dt><dd class="num" [class.amt-neg]="d.profitAfterTax < 0">{{ money(d.profitAfterTax) }}</dd></div>
      </dl>
    }

    <div class="rp-surface book-wrap">
      <table class="book-table">
        <thead><tr><th scope="col">Chỉ tiêu</th><th scope="col" class="r">Số tiền</th></tr></thead>
        <tbody>
          @for (it of data()?.items ?? []; track it.label) {
            <tr [class.book-sum]="it.strong">
              <td>{{ it.label }}</td>
              <td class="r num" [class.is-zero]="!it.amount" [class.amt-neg]="it.amount < 0">{{ it.amount ? money(it.amount) : '—' }}</td>
            </tr>
          } @empty { <tr><td class="book-none" colspan="2">Chưa có số liệu.</td></tr> }
        </tbody>
      </table>
    </div>
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
  readonly period = signal(new Date().getFullYear());

  constructor() { this.load(); }

  async load() {
    this.failure.set('');
    try { this.data.set(await this.svc.incomeStatement(String(this.period()))); }
    catch (e) { this.data.set(null); this.failure.set(errorText(e)); }
  }

  async close() {
    if (!confirm(`Kết chuyển cuối kỳ ${this.period()}? Thao tác này tạo bút toán kết chuyển 511/632/642 → 911 → 421.`)) return;
    this.failure.set(''); this.notice.set(''); this.closing.set(true);
    try { await this.svc.closePeriod(String(this.period())); this.notice.set('Đã kết chuyển cuối kỳ.'); await this.load(); }
    catch (e) { this.failure.set(errorText(e)); }
    finally { this.closing.set(false); }
  }
}
