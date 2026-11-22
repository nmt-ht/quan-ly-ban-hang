/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AccountingService } from '../../core/services/accounting.service';
import { AuthService } from '../../core/services/auth.service';
import { errorText } from '../../core/api/api.service';
import { IncomeStatementView } from '../../core/models/domain.models';
import { IncomeStatementTt133View } from '../../core/models/statements.models';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { formatVnd } from '../../shared/format.util';
import { PrintService } from '../../shared/print/print.service';
import { StatementPrintComponent } from '../../shared/print/tt133/statement-print.component';

type PrintPeriod = 'Y' | 'Q1' | 'Q2' | 'Q3' | 'Q4';
const PERIODS: { value: PrintPeriod; label: string; from: string; to: string }[] = [
  { value: 'Y', label: 'Cả năm', from: '01-01', to: '12-31' },
  { value: 'Q1', label: 'Quý I', from: '01-01', to: '03-31' },
  { value: 'Q2', label: 'Quý II', from: '04-01', to: '06-30' },
  { value: 'Q3', label: 'Quý III', from: '07-01', to: '09-30' },
  { value: 'Q4', label: 'Quý IV', from: '10-01', to: '12-31' },
];

/** /ke-toan/ket-qua-kinh-doanh — Báo cáo kết quả hoạt động kinh doanh; bản in là mẫu B02-DNN (TT133). */
@Component({
  selector: 'app-accounting-income-statement',
  standalone: true,
  imports: [FormsModule, RouterLink, NavIconComponent, StatementPrintComponent],
  template: `
   <div class="screen-only">
    <div class="page-header">
      <div>
        <h1>Kết quả hoạt động kinh doanh</h1>
        <p class="subtitle">Mẫu B02-DNN theo Thông tư 133. Bản in có mã số chỉ tiêu và cột kỳ trước (cùng kỳ năm trước).</p>
      </div>
      <div class="toolbar">
        <select aria-label="Kỳ in báo cáo" [ngModel]="printPeriod()" (ngModelChange)="printPeriod.set($event)">
          @for (p of periods; track p.value) { <option [value]="p.value">{{ p.label }}</option> }
        </select>
        <button type="button" class="btn" [disabled]="busy()" (click)="printReport()"><app-nav-icon name="printer" />In báo cáo B02-DNN</button>
        @if (canClose && data()) {
          <a class="btn" routerLink="/ke-toan/ket-chuyen">Kết chuyển cuối kỳ</a>
        }
      </div>
    </div>

    <div class="filters-bar">
      <input type="number" class="year-input" aria-label="Năm" min="2000" max="2100" [value]="period()" (change)="period.set(+$any($event.target).value); load()" />
    </div>
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
   </div>

   @if (doc(); as p) {
     <app-statement-print formNo="B02-DNN" title="BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH" [sub]="docTitle()" [heads]="docHeads()" [lines]="p.lines" />
   }
  `,
})
export class AccountingIncomeStatementComponent {
  private readonly svc = inject(AccountingService);
  private readonly printer = inject(PrintService);
  readonly canClose = inject(AuthService).can('accounting.manual');
  readonly data = signal<IncomeStatementView | null>(null);
  readonly failure = signal('');
  readonly money = formatVnd;
  readonly period = signal(new Date().getFullYear());
  readonly periods = PERIODS;
  readonly printPeriod = signal<PrintPeriod>('Y');
  readonly doc = signal<IncomeStatementTt133View | null>(null);
  readonly docTitle = signal('');
  readonly docHeads = signal<[string, string]>(['Năm nay', 'Năm trước']);
  readonly busy = signal(false);

  constructor() { this.load(); }

  async load() {
    this.failure.set('');
    try { this.data.set(await this.svc.incomeStatement(String(this.period()))); }
    catch (e) { this.data.set(null); this.failure.set(errorText(e)); }
  }

  async printReport() {
    const p = PERIODS.find((x) => x.value === this.printPeriod())!;
    const year = this.period();
    this.failure.set('');
    this.busy.set(true);
    try {
      const v = await this.svc.incomeStatementTt133(`${year}-${p.from}`, `${year}-${p.to}`);
      this.docTitle.set(p.value === 'Y' ? `Năm ${year}` : `${p.label} năm ${year}`);
      this.docHeads.set(p.value === 'Y' ? ['Năm nay', 'Năm trước'] : ['Kỳ này', 'Kỳ trước']);
      await this.printer.print('tt133-b02', 'A4', () => this.doc.set(v), () => this.doc.set(null));
    } catch (e) {
      this.failure.set(errorText(e));
    } finally {
      this.busy.set(false);
    }
  }
}
