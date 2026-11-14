import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService } from '../../core/services/accounting.service';
import { DataStore } from '../../core/services/data-store.service';
import { errorText } from '../../core/api/api.service';
import { Account } from '../../core/models/domain.models';
import { AccountBookView } from '../../core/models/books-vat.models';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { formatVnd } from '../../shared/format.util';
import { formatDay, isoDay } from '../../shared/period';

const PRESETS = [
  { code: '111', label: 'Sổ quỹ tiền mặt' },
  { code: '112', label: 'Sổ tiền gửi ngân hàng' },
  { code: '131', label: 'Sổ chi tiết phải thu khách hàng' },
  { code: '331', label: 'Sổ chi tiết phải trả nhà cung cấp' },
];

/**
 * /ke-toan/so-chi-tiet — sổ chi tiết tài khoản theo khoảng ngày: sổ quỹ tiền mặt (111), sổ tiền gửi ngân hàng (112),
 * sổ chi tiết công nợ 131/331 theo từng đối tượng, hoặc bất kỳ TK nào.
 */
@Component({
  selector: 'app-accounting-account-book',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>{{ title() }}</h1>
        <p class="subtitle">Số dư đầu kỳ, từng bút toán, số dư luỹ kế. Đọc từ sổ cái nên chỉ có chứng từ phát sinh từ ngày bắt đầu ghi sổ.</p>
      </div>
      <button type="button" class="btn" [disabled]="!data()" (click)="exportExcel()">Xuất Excel</button>
    </div>

    <div class="toolbar" style="flex-wrap:wrap; gap:8px; margin-bottom:12px">
      @for (p of presets; track p.code) {
        <button type="button" class="btn btn-sm" [class.btn-primary]="code() === p.code" (click)="pick(p.code)">{{ p.label }}</button>
      }
      <label>Tài khoản
        <select [ngModel]="code()" (ngModelChange)="pick($event)">
          @for (a of accounts(); track a.code) { <option [value]="a.code">{{ a.code }} — {{ a.name }}</option> }
        </select>
      </label>
      @if (partnerKind()) {
        <label>{{ partnerKind() === 'KH' ? 'Khách hàng' : 'Nhà cung cấp' }}
          <select [ngModel]="partnerId()" (ngModelChange)="partnerId.set($event); load()">
            <option value="">— Tất cả —</option>
            @for (p of partners(); track p.id) { <option [value]="p.id">{{ p.code }} — {{ p.name }}</option> }
          </select>
        </label>
      }
      <label>Từ ngày <input type="date" [ngModel]="from()" (ngModelChange)="from.set($event)" (change)="load()"></label>
      <label>Đến ngày <input type="date" [ngModel]="to()" (ngModelChange)="to.set($event)" (change)="load()"></label>
    </div>

    @if (failure()) { <div class="notice is-error" role="alert">{{ failure() }}</div> }
    @if (data()?.note; as n) { <div class="notice" role="status">{{ n }}</div> }
    @if (data()?.truncated) { <div class="notice is-error" role="alert">Sổ có hơn 5.000 dòng — chỉ hiển thị 5.000 dòng đầu. Thu hẹp khoảng ngày để xem đủ.</div> }

    <div class="card" style="overflow-x:auto">
      <table style="width:100%; border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left">Ngày</th><th style="text-align:left">Số bút toán</th><th style="text-align:left">Diễn giải</th>
          <th style="text-align:left">TK đối ứng</th>
          @if (showPartner()) { <th style="text-align:left">Đối tượng</th> }
          <th style="text-align:right">Nợ</th><th style="text-align:right">Có</th><th style="text-align:right">Số dư</th>
        </tr></thead>
        <tbody>
          @if (data(); as d) {
            <tr style="font-weight:600">
              <td [attr.colspan]="showPartner() ? 7 : 6">Số dư đầu kỳ</td>
              <td style="text-align:right">{{ balanceText(d.openingNo - d.openingCo, d) }}</td>
            </tr>
            @for (r of d.rows; track $index) {
              <tr>
                <td>{{ formatDay(r.date) }}</td>
                <td>{{ r.code }}</td>
                <td>{{ r.description }}</td>
                <td>{{ r.counterAccounts }}</td>
                @if (showPartner()) { <td>{{ r.partner }}</td> }
                <td style="text-align:right">{{ r.debit ? money(r.debit) : '' }}</td>
                <td style="text-align:right">{{ r.credit ? money(r.credit) : '' }}</td>
                <td style="text-align:right">{{ balanceText(signedNo(r.balance, d), d) }}</td>
              </tr>
            } @empty {
              <tr><td colspan="8" style="text-align:center; padding:16px">Không có phát sinh trong khoảng ngày này.</td></tr>
            }
          }
        </tbody>
        @if (data(); as d) {
          <tfoot>
            <tr style="font-weight:700; border-top:2px solid var(--border, #ccc)">
              <td [attr.colspan]="showPartner() ? 5 : 4">Cộng phát sinh</td>
              <td style="text-align:right">{{ money(d.totalDebit) }}</td>
              <td style="text-align:right">{{ money(d.totalCredit) }}</td>
              <td></td>
            </tr>
            <tr style="font-weight:700">
              <td [attr.colspan]="showPartner() ? 7 : 6">Số dư cuối kỳ</td>
              <td style="text-align:right">{{ balanceText(d.closingNo - d.closingCo, d) }}</td>
            </tr>
          </tfoot>
        }
      </table>
    </div>
  `,
})
export class AccountingAccountBookComponent {
  private readonly svc = inject(AccountingService);
  private readonly store = inject(DataStore);
  readonly presets = PRESETS;
  readonly accounts = signal<Account[]>([]);
  readonly data = signal<AccountBookView | null>(null);
  readonly failure = signal('');
  readonly code = signal('111');
  readonly partnerId = signal('');
  readonly from = signal(`${new Date().getFullYear()}-01-01`);
  readonly to = signal(isoDay(new Date()));
  readonly money = formatVnd;
  readonly formatDay = formatDay;

  readonly partnerKind = computed(() => (this.code() === '131' ? 'KH' : this.code() === '331' ? 'NCC' : null));
  readonly partners = computed(() => (this.partnerKind() === 'KH' ? this.store.customers() : this.partnerKind() === 'NCC' ? this.store.suppliers() : []));
  /** Cột "Đối tượng" khi xem công nợ nhưng chưa chọn một đối tượng. */
  readonly showPartner = computed(() => !!this.partnerKind() && !this.partnerId());
  readonly title = computed(() => PRESETS.find((p) => p.code === this.code())?.label ?? `Sổ chi tiết tài khoản ${this.code()}`);

  constructor() {
    this.svc.accounts().then((a) => this.accounts.set(a.filter((x) => x.isDetail))).catch(() => undefined);
    this.load();
  }

  pick(code: string) {
    this.code.set(code);
    this.partnerId.set('');
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
      this.data.set(await this.svc.accountBook(this.code(), this.from(), this.to(), this.partnerId() || undefined));
    } catch (e) {
      this.data.set(null);
      this.failure.set(errorText(e));
    }
  }

  /** Số dư luỹ kế theo chiều Nợ − Có: dương = dư Nợ. */
  signedNo(balance: number, d: AccountBookView): number {
    return d.account.normalSide === 'NO' ? balance : -balance;
  }

  balanceText(netNo: number, _d: AccountBookView): string {
    if (netNo === 0) return '0';
    return `${formatVnd(Math.abs(netNo))} ${netNo > 0 ? 'Nợ' : 'Có'}`;
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
