/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { Component, inject, signal } from '@angular/core';
import { AccountingService } from '../../core/services/accounting.service';
import { errorText } from '../../core/api/api.service';
import { BalanceSheetView } from '../../core/models/domain.models';
import { formatVnd } from '../../shared/format.util';

/** /ke-toan/can-doi-ke-toan — Bảng cân đối kế toán (B01-DNN, TT133). */
@Component({
  selector: 'app-accounting-balance-sheet',
  standalone: true,
  template: `
    <div class="page-header">
      <div>
        <h1>Bảng cân đối kế toán</h1>
        <p class="subtitle">Mẫu B01-DNN theo Thông tư 133 (rút gọn).</p>
      </div>
    </div>

    <div class="filters-bar">
      <input type="number" class="year-input" aria-label="Năm" min="2000" max="2100" [value]="period()" (change)="period.set(+$any($event.target).value); load()" />
    </div>
    @if (failure()) { <div class="notice is-error" role="alert"><span>{{ failure() }}</span></div> }

    @if (data(); as d) {
      @if (!d.balanced) { <div class="notice is-error" role="alert">Chưa cân: Tổng tài sản {{ money(d.totalAssets) }} ≠ Tổng nguồn vốn {{ money(d.totalResources) }}.</div> }
      <dl class="list-totals">
        <div><dt>Tổng tài sản</dt><dd class="num">{{ money(d.totalAssets) }}</dd></div>
        <div><dt>Tổng nguồn vốn</dt><dd class="num">{{ money(d.totalResources) }}</dd></div>
      </dl>

      <section class="section-bare">
        <h3>Tài sản</h3>
        <div class="rp-surface book-wrap">
          <table class="book-table">
            <thead><tr><th scope="col">Khoản mục</th><th scope="col" class="r">Số tiền</th></tr></thead>
            <tbody>
              @for (a of d.assets; track a.label) {
                <tr><td>{{ a.label }}</td><td class="r num" [class.is-zero]="!a.amount" [class.amt-neg]="a.amount < 0">{{ a.amount ? money(a.amount) : '—' }}</td></tr>
              }
            </tbody>
            <tfoot><tr><td>TỔNG CỘNG TÀI SẢN</td><td class="r num">{{ money(d.totalAssets) }}</td></tr></tfoot>
          </table>
        </div>
      </section>

      <section class="section-bare">
        <h3>Nguồn vốn</h3>
        <div class="rp-surface book-wrap">
          <table class="book-table">
            <thead><tr><th scope="col">Khoản mục</th><th scope="col" class="r">Số tiền</th></tr></thead>
            <tbody>
              @for (r of d.resources; track r.label) {
                <tr><td>{{ r.label }}</td><td class="r num" [class.is-zero]="!r.amount" [class.amt-neg]="r.amount < 0">{{ r.amount ? money(r.amount) : '—' }}</td></tr>
              }
            </tbody>
            <tfoot><tr><td>TỔNG CỘNG NGUỒN VỐN</td><td class="r num">{{ money(d.totalResources) }}</td></tr></tfoot>
          </table>
        </div>
      </section>
    }
  `,
})
export class AccountingBalanceSheetComponent {
  private readonly svc = inject(AccountingService);
  readonly data = signal<BalanceSheetView | null>(null);
  readonly failure = signal('');
  readonly money = formatVnd;
  readonly period = signal(new Date().getFullYear());

  constructor() { this.load(); }

  async load() {
    this.failure.set('');
    try { this.data.set(await this.svc.balanceSheet(String(this.period()))); }
    catch (e) { this.data.set(null); this.failure.set(errorText(e)); }
  }
}
