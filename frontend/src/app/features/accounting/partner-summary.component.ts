/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { Component, computed, inject, signal } from '@angular/core';
import { AccountingService } from '../../core/services/accounting.service';
import { errorText } from '../../core/api/api.service';
import { PartnerSummaryView } from '../../core/models/books-vat.models';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { formatVnd } from '../../shared/format.util';
import { PeriodFilterComponent, PeriodValue } from '../../shared/period-filter/period-filter.component';
import { presetRange } from '../../shared/period';

/** /ke-toan/tong-hop-cong-no — tổng hợp công nợ phải thu (131) / phải trả (331) theo từng đối tượng, từ sổ cái. */
@Component({
  selector: 'app-accounting-partner-summary',
  standalone: true,
  imports: [NavIconComponent, PeriodFilterComponent],
  template: `
    <div class="page-header">
      <div>
        <h1>Tổng hợp công nợ {{ code() === '131' ? 'phải thu khách hàng' : 'phải trả nhà cung cấp' }}</h1>
        <p class="subtitle">Dư đầu kỳ, phát sinh Nợ/Có, dư cuối kỳ của từng {{ code() === '131' ? 'khách hàng' : 'nhà cung cấp' }} theo sổ cái (TK {{ code() }}).</p>
      </div>
      <div class="toolbar">
        <button type="button" class="btn" [disabled]="!data()" (click)="exportExcel()"><app-nav-icon name="download" />Xuất Excel</button>
      </div>
    </div>

    <div class="filters-bar">
      <div class="segmented" role="group" aria-label="Loại công nợ">
        <button type="button" [attr.aria-pressed]="code() === '131'" (click)="pick('131')">Phải thu (131)</button>
        <button type="button" [attr.aria-pressed]="code() === '331'" (click)="pick('331')">Phải trả (331)</button>
      </div>
      <app-period-filter [value]="period()" (valueChange)="onPeriod($event)" />
    </div>
    @if (failure()) { <div class="notice is-error" role="alert">{{ failure() }}</div> }

    @if (data(); as d) {
      <dl class="list-totals">
        <div><dt>{{ code() === '131' ? 'Khách hàng' : 'Nhà cung cấp' }} có số liệu</dt><dd class="num">{{ d.rows.length }}</dd></div>
        <div><dt>Dư cuối kỳ Nợ</dt><dd class="num">{{ money(d.totals.closingNo) }}</dd></div>
        <div><dt>Dư cuối kỳ Có</dt><dd class="num">{{ money(d.totals.closingCo) }}</dd></div>
      </dl>

      <div class="rp-surface rp-grid">
        <table class="book-table">
          <thead>
            <tr>
              <th rowspan="2" scope="col">Mã</th><th rowspan="2" scope="col">{{ code() === '131' ? 'Khách hàng' : 'Nhà cung cấp' }}</th>
              <th colspan="2" scope="colgroup" class="c">Dư đầu kỳ</th><th colspan="2" scope="colgroup" class="c">Phát sinh</th><th colspan="2" scope="colgroup" class="c">Dư cuối kỳ</th>
            </tr>
            <tr>
              <th scope="col" class="r">Nợ</th><th scope="col" class="r">Có</th>
              <th scope="col" class="r">Nợ</th><th scope="col" class="r">Có</th>
              <th scope="col" class="r">Nợ</th><th scope="col" class="r">Có</th>
            </tr>
          </thead>
          <tbody>
            @for (r of d.rows; track $index) {
              <tr>
                <td class="code">{{ r.code }}</td><td>{{ r.name }}</td>
                <td class="r num" [class.is-zero]="!r.openingNo">{{ r.openingNo ? money(r.openingNo) : '—' }}</td>
                <td class="r num" [class.is-zero]="!r.openingCo">{{ r.openingCo ? money(r.openingCo) : '—' }}</td>
                <td class="r num" [class.is-zero]="!r.debit">{{ r.debit ? money(r.debit) : '—' }}</td>
                <td class="r num" [class.is-zero]="!r.credit">{{ r.credit ? money(r.credit) : '—' }}</td>
                <td class="r num" [class.is-zero]="!r.closingNo">{{ r.closingNo ? money(r.closingNo) : '—' }}</td>
                <td class="r num" [class.is-zero]="!r.closingCo">{{ r.closingCo ? money(r.closingCo) : '—' }}</td>
              </tr>
            } @empty {
              <tr><td class="book-none" colspan="8">Chưa có phát sinh công nợ trong khoảng ngày này.</td></tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2">TỔNG CỘNG</td>
              <td class="r num">{{ money(d.totals.openingNo) }}</td><td class="r num">{{ money(d.totals.openingCo) }}</td>
              <td class="r num">{{ money(d.totals.debit) }}</td><td class="r num">{{ money(d.totals.credit) }}</td>
              <td class="r num">{{ money(d.totals.closingNo) }}</td><td class="r num">{{ money(d.totals.closingCo) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p class="rp-notes">Số dư đầu năm nhập theo tài khoản (không theo đối tượng) nằm ở dòng "Chưa phân đối tượng". Công nợ chi tiết từng chứng từ xem ở Công nợ phải thu / phải trả.</p>
    }
  `,
})
export class AccountingPartnerSummaryComponent {
  private readonly svc = inject(AccountingService);
  readonly data = signal<PartnerSummaryView | null>(null);
  readonly failure = signal('');
  readonly code = signal<'131' | '331'>('131');
  readonly period = signal<PeriodValue>({ preset: 'thisYear', range: presetRange('thisYear') });
  readonly money = formatVnd;
  readonly label = computed(() => (this.code() === '131' ? 'Công nợ phải thu' : 'Công nợ phải trả'));

  constructor() { this.load(); }

  pick(code: '131' | '331') {
    this.code.set(code);
    this.load();
  }

  onPeriod(v: PeriodValue) {
    this.period.set(v);
    this.load();
  }

  async load() {
    this.failure.set('');
    const { from, to } = this.period().range;
    if (!from || !to) { this.data.set(null); this.failure.set('Chọn kỳ có ngày bắt đầu và kết thúc.'); return; }
    if (from.slice(0, 4) !== to.slice(0, 4)) {
      this.failure.set('Chọn khoảng trong cùng một năm (số dư đầu kỳ nhập theo năm).');
      this.data.set(null);
      return;
    }
    try {
      this.data.set(await this.svc.partnerSummary(this.code(), from, to));
    } catch (e) {
      this.data.set(null);
      this.failure.set(errorText(e));
    }
  }

  async exportExcel() {
    const d = this.data();
    if (!d) return;
    const rows: unknown[][] = d.rows.map((r) => [r.code, r.name, r.openingNo, r.openingCo, r.debit, r.credit, r.closingNo, r.closingCo]);
    rows.push(['', 'TỔNG CỘNG', d.totals.openingNo, d.totals.openingCo, d.totals.debit, d.totals.credit, d.totals.closingNo, d.totals.closingCo]);
    const n = { header: '', width: 16, numFmt: '#,##0' };
    await downloadWorkbook(exportFileName(`Tổng hợp ${this.label()}`), [{
      name: `TK ${d.account.code}`,
      columns: [
        { header: 'Mã', width: 12 }, { header: this.code() === '131' ? 'Khách hàng' : 'Nhà cung cấp', width: 40 },
        { ...n, header: 'Dư đầu kỳ Nợ' }, { ...n, header: 'Dư đầu kỳ Có' }, { ...n, header: 'Phát sinh Nợ' }, { ...n, header: 'Phát sinh Có' },
        { ...n, header: 'Dư cuối kỳ Nợ' }, { ...n, header: 'Dư cuối kỳ Có' },
      ],
      rows,
    }]);
  }
}
