/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService } from '../../core/services/accounting.service';
import { errorText } from '../../core/api/api.service';
import { BalanceSheetView } from '../../core/models/domain.models';
import { FinancialPositionView } from '../../core/models/statements.models';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { DateInputDirective } from '../../shared/date-input/date-input.directive';
import { formatVnd } from '../../shared/format.util';
import { isoDay } from '../../shared/period';
import { PrintService } from '../../shared/print/print.service';
import { StatementPrintComponent } from '../../shared/print/tt133/statement-print.component';
import { atDayText } from '../../shared/print/tt133/tt133-books';

/** /ke-toan/can-doi-ke-toan — Bảng cân đối kế toán; bản in là Báo cáo tình hình tài chính mẫu B01b-DNN (TT133). */
@Component({
  selector: 'app-accounting-balance-sheet',
  standalone: true,
  imports: [FormsModule, NavIconComponent, DateInputDirective, StatementPrintComponent],
  template: `
   <div class="screen-only">
    <div class="page-header">
      <div>
        <h1>Bảng cân đối kế toán</h1>
        <p class="subtitle">Trên màn hình là bản rút gọn theo các tài khoản đang dùng; bản in đủ chỉ tiêu và mã số theo mẫu B01b-DNN (Thông tư 133).</p>
      </div>
      <div class="toolbar">
        <button type="button" class="btn" [disabled]="printBusy()" (click)="printPosition()"><app-nav-icon name="printer" />In báo cáo B01b-DNN</button>
      </div>
    </div>

    <div class="filters-bar">
      <input type="number" class="year-input" aria-label="Năm" min="2000" max="2100" [value]="period()" (change)="setYear(+$any($event.target).value)" />
      <label class="inline-field">Báo cáo tại ngày <input appDate [ngModel]="asOf()" (ngModelChange)="asOf.set($event)" /></label>
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
   </div>

   @if (position(); as p) {
     <app-statement-print
       formNo="B01b-DNN" title="BÁO CÁO TÌNH HÌNH TÀI CHÍNH" [sub]="atDay(p.date)" [heads]="['Số cuối năm', 'Số đầu năm']" [lines]="p.lines" />
   }
  `,
})
export class AccountingBalanceSheetComponent {
  private readonly svc = inject(AccountingService);
  private readonly printer = inject(PrintService);
  readonly data = signal<BalanceSheetView | null>(null);
  readonly failure = signal('');
  readonly money = formatVnd;
  readonly period = signal(new Date().getFullYear());
  readonly atDay = atDayText;
  /** Ngày lập báo cáo B01b-DNN (mặc định cuối năm đang xem, hoặc hôm nay nếu năm chưa hết). */
  readonly asOf = signal(this.defaultDate(this.period()));
  /** Báo cáo đang dựng để in (chỉ có trong lúc in). */
  readonly position = signal<FinancialPositionView | null>(null);
  readonly printBusy = signal(false);

  constructor() { this.load(); }

  private defaultDate(year: number): string {
    const end = `${year}-12-31`;
    const today = isoDay(new Date());
    return end > today ? today : end;
  }

  setYear(y: number) {
    if (!y) return;
    this.period.set(y);
    this.asOf.set(this.defaultDate(y));
    this.load();
  }

  async printPosition() {
    this.failure.set('');
    this.printBusy.set(true);
    try {
      const v = await this.svc.financialPosition(this.asOf());
      if (!v.balanced || v.unmapped.length) {
        const why = [!v.balanced ? 'tổng tài sản chưa bằng tổng nguồn vốn' : '', v.unmapped.length ? `tài khoản ${v.unmapped.join(', ')} còn số dư nhưng chưa có chỉ tiêu` : ''].filter(Boolean).join('; ');
        if (!confirm(`Báo cáo chưa khớp: ${why}. Vẫn in?`)) return;
      }
      await this.printer.print('tt133-b01b', 'A4', () => this.position.set(v), () => this.position.set(null));
    } catch (e) {
      this.failure.set(errorText(e));
    } finally {
      this.printBusy.set(false);
    }
  }

  async load() {
    this.failure.set('');
    try { this.data.set(await this.svc.balanceSheet(String(this.period()))); }
    catch (e) { this.data.set(null); this.failure.set(errorText(e)); }
  }
}
