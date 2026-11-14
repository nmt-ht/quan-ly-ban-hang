import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService } from '../../core/services/accounting.service';
import { errorText } from '../../core/api/api.service';
import { PartnerSummaryView } from '../../core/models/books-vat.models';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { formatVnd } from '../../shared/format.util';
import { isoDay } from '../../shared/period';

/** /ke-toan/tong-hop-cong-no — tổng hợp công nợ phải thu (131) / phải trả (331) theo từng đối tượng, từ sổ cái. */
@Component({
  selector: 'app-accounting-partner-summary',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Tổng hợp công nợ {{ code() === '131' ? 'phải thu khách hàng' : 'phải trả nhà cung cấp' }}</h1>
        <p class="subtitle">Dư đầu kỳ, phát sinh Nợ/Có, dư cuối kỳ của từng {{ code() === '131' ? 'khách hàng' : 'nhà cung cấp' }} theo sổ cái (TK {{ code() }}).</p>
      </div>
      <button type="button" class="btn" [disabled]="!data()" (click)="exportExcel()">Xuất Excel</button>
    </div>

    <div class="toolbar" style="flex-wrap:wrap; gap:8px; margin-bottom:12px">
      <button type="button" class="btn btn-sm" [class.btn-primary]="code() === '131'" (click)="pick('131')">Phải thu (131)</button>
      <button type="button" class="btn btn-sm" [class.btn-primary]="code() === '331'" (click)="pick('331')">Phải trả (331)</button>
      <label>Từ ngày <input type="date" [ngModel]="from()" (ngModelChange)="from.set($event)" (change)="load()"></label>
      <label>Đến ngày <input type="date" [ngModel]="to()" (ngModelChange)="to.set($event)" (change)="load()"></label>
    </div>
    @if (failure()) { <div class="notice is-error" role="alert">{{ failure() }}</div> }

    <div class="card" style="overflow-x:auto">
      <table style="width:100%; border-collapse:collapse">
        <thead>
          <tr>
            <th rowspan="2" style="text-align:left">Mã</th><th rowspan="2" style="text-align:left">{{ code() === '131' ? 'Khách hàng' : 'Nhà cung cấp' }}</th>
            <th colspan="2" style="text-align:center">Dư đầu kỳ</th><th colspan="2" style="text-align:center">Phát sinh</th><th colspan="2" style="text-align:center">Dư cuối kỳ</th>
          </tr>
          <tr>
            <th style="text-align:right">Nợ</th><th style="text-align:right">Có</th>
            <th style="text-align:right">Nợ</th><th style="text-align:right">Có</th>
            <th style="text-align:right">Nợ</th><th style="text-align:right">Có</th>
          </tr>
        </thead>
        <tbody>
          @for (r of data()?.rows ?? []; track $index) {
            <tr>
              <td>{{ r.code }}</td><td>{{ r.name }}</td>
              <td style="text-align:right">{{ r.openingNo ? money(r.openingNo) : '' }}</td>
              <td style="text-align:right">{{ r.openingCo ? money(r.openingCo) : '' }}</td>
              <td style="text-align:right">{{ r.debit ? money(r.debit) : '' }}</td>
              <td style="text-align:right">{{ r.credit ? money(r.credit) : '' }}</td>
              <td style="text-align:right">{{ r.closingNo ? money(r.closingNo) : '' }}</td>
              <td style="text-align:right">{{ r.closingCo ? money(r.closingCo) : '' }}</td>
            </tr>
          } @empty {
            <tr><td colspan="8" style="text-align:center; padding:16px">Chưa có phát sinh công nợ trong khoảng ngày này.</td></tr>
          }
        </tbody>
        @if (data(); as d) {
          <tfoot>
            <tr style="font-weight:700; border-top:2px solid var(--border, #ccc)">
              <td colspan="2">TỔNG CỘNG</td>
              <td style="text-align:right">{{ money(d.totals.openingNo) }}</td><td style="text-align:right">{{ money(d.totals.openingCo) }}</td>
              <td style="text-align:right">{{ money(d.totals.debit) }}</td><td style="text-align:right">{{ money(d.totals.credit) }}</td>
              <td style="text-align:right">{{ money(d.totals.closingNo) }}</td><td style="text-align:right">{{ money(d.totals.closingCo) }}</td>
            </tr>
          </tfoot>
        }
      </table>
    </div>
    <p class="subtitle" style="margin-top:8px">Số dư đầu năm nhập theo tài khoản (không theo đối tượng) nằm ở dòng "Chưa phân đối tượng". Công nợ chi tiết từng chứng từ xem ở Công nợ phải thu / phải trả.</p>
  `,
})
export class AccountingPartnerSummaryComponent {
  private readonly svc = inject(AccountingService);
  readonly data = signal<PartnerSummaryView | null>(null);
  readonly failure = signal('');
  readonly code = signal<'131' | '331'>('131');
  readonly from = signal(`${new Date().getFullYear()}-01-01`);
  readonly to = signal(isoDay(new Date()));
  readonly money = formatVnd;
  readonly label = computed(() => (this.code() === '131' ? 'Công nợ phải thu' : 'Công nợ phải trả'));

  constructor() { this.load(); }

  pick(code: '131' | '331') {
    this.code.set(code);
    this.load();
  }

  async load() {
    this.failure.set('');
    if (!this.from() || !this.to()) return;
    if (this.from().slice(0, 4) !== this.to().slice(0, 4)) {
      this.failure.set('Chọn khoảng trong cùng một năm (số dư đầu kỳ nhập theo năm).');
      this.data.set(null);
      return;
    }
    try {
      this.data.set(await this.svc.partnerSummary(this.code(), this.from(), this.to()));
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
