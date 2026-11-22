/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService } from '../../core/services/accounting.service';
import { DataStore } from '../../core/services/data-store.service';
import { errorText } from '../../core/api/api.service';
import { Account } from '../../core/models/domain.models';
import { AccountBookView } from '../../core/models/books-vat.models';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { formatVnd } from '../../shared/format.util';
import { PeriodFilterComponent, PeriodValue } from '../../shared/period-filter/period-filter.component';
import { formatDay, presetRange } from '../../shared/period';
import { PrintService } from '../../shared/print/print.service';
import { BookPrintComponent } from '../../shared/print/tt133/book-print.component';
import { BookSpec, accountBookSpec } from '../../shared/print/tt133/tt133-books';
import { SearchOption, SearchSelectComponent } from '../../shared/search-select/search-select.component';
import { ToastService } from '../../core/services/toast.service';

const PRESETS = [
  { code: '111', label: 'Sổ quỹ tiền mặt' },
  { code: '112', label: 'Sổ tiền gửi ngân hàng' },
  { code: '131', label: 'Phải thu khách hàng' },
  { code: '331', label: 'Phải trả nhà cung cấp' },
];

/**
 * /ke-toan/so-chi-tiet — sổ chi tiết tài khoản theo khoảng ngày: sổ quỹ tiền mặt (111), sổ tiền gửi ngân hàng (112),
 * sổ chi tiết công nợ 131/331 theo từng đối tượng, hoặc bất kỳ TK nào.
 */
@Component({
  selector: 'app-accounting-account-book',
  standalone: true,
  imports: [FormsModule, NavIconComponent, PeriodFilterComponent, SearchSelectComponent, BookPrintComponent],
  template: `
   <div class="screen-only">
    <div class="page-header">
      <div>
        <h1>{{ title() }}</h1>
        <p class="subtitle">Số dư đầu kỳ, từng bút toán, số dư luỹ kế. Đọc từ sổ cái nên chỉ có chứng từ phát sinh từ ngày bắt đầu ghi sổ.</p>
      </div>
      <div class="toolbar">
        <button type="button" class="btn" [disabled]="!data()" (click)="printBook()"><app-nav-icon name="printer" />In sổ {{ formNo() }}</button>
        <button type="button" class="btn" [disabled]="!data()" (click)="exportExcel()"><app-nav-icon name="download" />Xuất Excel</button>
      </div>
    </div>

    <div class="filters-bar">
      <div class="segmented" role="group" aria-label="Sổ thường dùng">
        @for (p of presets; track p.code) {
          <button type="button" [attr.aria-pressed]="code() === p.code" (click)="pick(p.code)">{{ p.label }}</button>
        }
      </div>
      <select aria-label="Tài khoản" [value]="code()" (change)="pick($any($event.target).value)">
        @for (a of accounts(); track a.code) { <option [value]="a.code">{{ a.code }} — {{ a.name }}</option> }
      </select>
      @if (partnerKind()) {
        <app-search-select
          [ariaLabel]="partnerKind() === 'KH' ? 'Khách hàng' : 'Nhà cung cấp'" [options]="partnerOptions()" [(value)]="partnerId"
          [emptyLabel]="partnerKind() === 'KH' ? 'Tất cả khách hàng' : 'Tất cả nhà cung cấp'" (valueChange)="load()" />
      }
      <app-period-filter [value]="period()" (valueChange)="onPeriod($event)" />
    </div>

    @if (data()?.note; as n) { <div class="notice" role="status">{{ n }}</div> }
    @if (data()?.truncated) { <div class="notice is-error" role="alert">Sổ có hơn 5.000 dòng — chỉ hiển thị 5.000 dòng đầu. Thu hẹp khoảng ngày để xem đủ.</div> }

    @if (data(); as d) {
      <dl class="list-totals">
        <div><dt>Số dư đầu kỳ</dt><dd class="num">{{ balanceText(d.openingNo - d.openingCo) }}</dd></div>
        <div><dt>Phát sinh Nợ</dt><dd class="num">{{ money(d.totalDebit) }}</dd></div>
        <div><dt>Phát sinh Có</dt><dd class="num">{{ money(d.totalCredit) }}</dd></div>
        <div><dt>Số dư cuối kỳ</dt><dd class="num">{{ balanceText(d.closingNo - d.closingCo) }}</dd></div>
      </dl>

      <div class="rp-surface rp-grid">
        <table class="book-table">
          <thead><tr>
            <th scope="col">Ngày</th><th scope="col">Số bút toán</th><th scope="col">Diễn giải</th><th scope="col">TK đối ứng</th>
            @if (showPartner()) { <th scope="col">Đối tượng</th> }
            <th scope="col" class="r">Nợ</th><th scope="col" class="r">Có</th><th scope="col" class="r">Số dư</th>
          </tr></thead>
          <tbody>
            <tr class="book-open">
              <td [attr.colspan]="showPartner() ? 7 : 6">Số dư đầu kỳ</td>
              <td class="r num">{{ balanceText(d.openingNo - d.openingCo) }}</td>
            </tr>
            @for (r of d.rows; track $index) {
              <tr>
                <td class="num">{{ formatDay(r.date) }}</td>
                <td class="code">{{ r.code }}</td>
                <td>{{ r.description }}</td>
                <td class="code">{{ r.counterAccounts }}</td>
                @if (showPartner()) { <td>{{ r.partner }}</td> }
                <td class="r num" [class.is-zero]="!r.debit">{{ r.debit ? money(r.debit) : '—' }}</td>
                <td class="r num" [class.is-zero]="!r.credit">{{ r.credit ? money(r.credit) : '—' }}</td>
                <td class="r num">{{ balanceText(signedNo(r.balance, d)) }}</td>
              </tr>
            } @empty {
              <tr><td class="book-none" [attr.colspan]="showPartner() ? 8 : 7">Không có phát sinh trong khoảng ngày này.</td></tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <td [attr.colspan]="showPartner() ? 5 : 4">Cộng phát sinh</td>
              <td class="r num">{{ money(d.totalDebit) }}</td><td class="r num">{{ money(d.totalCredit) }}</td><td></td>
            </tr>
            <tr>
              <td [attr.colspan]="showPartner() ? 7 : 6">Số dư cuối kỳ</td>
              <td class="r num">{{ balanceText(d.closingNo - d.closingCo) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    }
   </div>

   @if (doc(); as b) {
     <app-book-print [formNo]="b.formNo" [title]="b.title" [sub]="b.sub" [sub2]="b.sub2" [columns]="b.columns" [rows]="b.rows" />
   }
  `,
})
export class AccountingAccountBookComponent {
  protected readonly toast = inject(ToastService);
  private readonly svc = inject(AccountingService);
  private readonly confirmer = inject(ConfirmService);
  private readonly store = inject(DataStore);
  private readonly printer = inject(PrintService);
  readonly presets = PRESETS;
  readonly accounts = signal<Account[]>([]);
  readonly data = signal<AccountBookView | null>(null);
  readonly code = signal('111');
  readonly partnerId = signal('');
  readonly period = signal<PeriodValue>({ preset: 'thisYear', range: presetRange('thisYear') });
  readonly money = formatVnd;
  readonly formatDay = formatDay;

  readonly partnerKind = computed(() => (this.code() === '131' ? 'KH' : this.code() === '331' ? 'NCC' : null));
  readonly partnerOptions = computed<SearchOption[]>(() => {
    const kind = this.partnerKind();
    const list = kind === 'KH' ? this.store.customers().map((c) => ({ id: c.id, code: c.code, name: c.companyName || c.name }))
      : kind === 'NCC' ? this.store.suppliers().map((s) => ({ id: s.id, code: s.code, name: s.name })) : [];
    return [...list].sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true })).map((p) => ({ value: p.id, code: p.code, label: p.name }));
  });
  /** Cột "Đối tượng" khi xem công nợ nhưng chưa chọn một đối tượng. */
  /** Sổ đang in (chỉ có trong lúc in). */
  readonly doc = signal<BookSpec | null>(null);
  /** Mẫu sổ theo tài khoản đang xem: 111 → S04a, 112 → S05, công nợ một đối tượng → S12, còn lại → S19. */
  readonly formNo = computed(() => { const d = this.data(); return d ? accountBookSpec(d).formNo : 'TT133'; });
  readonly showPartner = computed(() => !!this.partnerKind() && !this.partnerId());
  readonly title = computed(() => {
    const p = PRESETS.find((x) => x.code === this.code());
    return p ? (this.code() === '111' || this.code() === '112' ? p.label : `Sổ chi tiết ${p.label.toLowerCase()}`) : `Sổ chi tiết tài khoản ${this.code()}`;
  });

  constructor() {
    this.svc.accounts().then((a) => this.accounts.set(a.filter((x) => x.isDetail))).catch(() => undefined);
    this.load();
  }

  pick(code: string) {
    this.code.set(code);
    this.partnerId.set('');
    this.load();
  }

  onPeriod(v: PeriodValue) {
    this.period.set(v);
    this.load();
  }

  async load() {
    const { from, to } = this.period().range;
    if (!from || !to) { this.data.set(null); this.toast.error('Chọn kỳ có ngày bắt đầu và kết thúc.'); return; }
    if (from.slice(0, 4) !== to.slice(0, 4)) {
      this.toast.error('Chọn khoảng trong cùng một năm (số dư đầu kỳ nhập theo năm).');
      this.data.set(null);
      return;
    }
    try {
      this.data.set(await this.svc.accountBook(this.code(), from, to, this.partnerId() || undefined));
    } catch (e) {
      this.data.set(null);
      this.toast.error(errorText(e));
    }
  }

  /** Số dư luỹ kế theo chiều Nợ − Có: dương = dư Nợ. */
  signedNo(balance: number, d: AccountBookView): number {
    return d.account.normalSide === 'NO' ? balance : -balance;
  }

  balanceText(netNo: number): string {
    if (netNo === 0) return '0';
    return `${formatVnd(Math.abs(netNo))} ${netNo > 0 ? 'Nợ' : 'Có'}`;
  }

  async printBook() {
    const d = this.data();
    if (!d) return;
    if (d.truncated && !(await this.confirmer.ask({ title: 'Bản in chỉ gồm 5.000 dòng đầu. Vẫn in?', message: 'Sổ có hơn 5.000 dòng. Thu hẹp khoảng ngày để in đủ.', confirmLabel: 'Vẫn in', cancelLabel: 'Thu hẹp ngày' }))) return;
    const partner = this.partnerOptions().find((o) => o.value === this.partnerId())?.label;
    const spec = accountBookSpec(d, partner);
    await this.printer.print('tt133-' + spec.formNo.toLowerCase(), 'A4', () => this.doc.set(spec), () => this.doc.set(null));
  }

  async exportExcel() {
    const d = this.data();
    if (!d) return;
    const rows: unknown[][] = [['', '', 'Số dư đầu kỳ', '', '', '', '', d.openingNo - d.openingCo]];
    for (const r of d.rows) rows.push([formatDay(r.date), r.code, r.description ?? '', r.counterAccounts, r.partner ?? '', r.debit, r.credit, this.signedNo(r.balance, d)]);
    rows.push(['', '', 'Cộng phát sinh', '', '', d.totalDebit, d.totalCredit, '']);
    rows.push(['', '', 'Số dư cuối kỳ', '', '', '', '', d.closingNo - d.closingCo]);
    await downloadWorkbook(exportFileName(`${this.title()} TK ${d.account.code}`), [{
      name: `TK ${d.account.code}`.slice(0, 28),
      columns: [
        { header: 'Ngày', width: 12 }, { header: 'Số bút toán', width: 14 }, { header: 'Diễn giải', width: 44 }, { header: 'TK đối ứng', width: 14 },
        { header: 'Đối tượng', width: 28 }, { header: 'Nợ', width: 16, numFmt: '#,##0' }, { header: 'Có', width: 16, numFmt: '#,##0' },
        { header: 'Số dư (+ Nợ / − Có)', width: 20, numFmt: '#,##0' },
      ],
      rows,
    }]);
  }
}
