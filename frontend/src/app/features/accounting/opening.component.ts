/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService } from '../../core/services/accounting.service';
import { AuthService } from '../../core/services/auth.service';
import { errorText } from '../../core/api/api.service';
import { OpeningRow } from '../../core/models/domain.models';

const KIND: Record<string, string> = {
  TAI_SAN: 'Tài sản', NO_PHAI_TRA: 'Nợ phải trả', VON_CSH: 'Vốn CSH', DOANH_THU: 'Doanh thu', CHI_PHI: 'Chi phí', KQKD: 'Xác định KQKD',
};
const KIND_ORDER = ['TAI_SAN', 'NO_PHAI_TRA', 'VON_CSH', 'DOANH_THU', 'CHI_PHI', 'KQKD'] as const;
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { formatVnd } from '../../shared/format.util';
import { MoneyInputDirective } from '../../shared/money-input.directive';
import { ToastService } from '../../core/services/toast.service';

/** /ke-toan/so-du-dau-ky — nhập số dư đầu kỳ cho từng tài khoản. */
@Component({
  selector: 'app-accounting-opening',
  standalone: true,
  imports: [FormsModule, NavIconComponent, MoneyInputDirective],
  template: `
    <div class="page-header">
      <div>
        <h1>Số dư đầu kỳ</h1>
        <p class="subtitle">Nhập số dư Nợ/Có đầu kỳ cho từng tài khoản. Tổng Nợ nên bằng tổng Có.</p>
      </div>
      @if (canEdit) {
        <div class="toolbar">
          <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="save()"><app-nav-icon name="check" />Lưu số dư đầu kỳ</button>
        </div>
      }
    </div>

    <div class="filters-bar">
      <input type="number" class="year-input" aria-label="Năm" min="2000" max="2100" [value]="period()" (change)="period.set(+$any($event.target).value); load()" />
    </div>

    <dl class="list-totals">
      <div><dt>Tổng Nợ</dt><dd class="num">{{ money(totalDebit()) }}</dd></div>
      <div><dt>Tổng Có</dt><dd class="num">{{ money(totalCredit()) }}</dd></div>
      <div><dt>Chênh lệch Nợ − Có</dt><dd class="num" [class.text-danger]="difference() !== 0">{{ money(difference()) }}</dd></div>
    </dl>

    <div class="rp-surface rp-grid">
      <table class="line-table book-table">
        <thead><tr>
          <th scope="col">TK</th><th scope="col">Tên tài khoản</th><th scope="col" class="r">Dư Nợ</th><th scope="col" class="r">Dư Có</th>
        </tr></thead>
        <tbody>
          @for (g of groups(); track g.kind) {
            <tr class="op-group">
              <td colspan="2">{{ g.label }}</td>
              <td class="r num">{{ money(groupDebit(g.rows)) }}</td>
              <td class="r num">{{ money(groupCredit(g.rows)) }}</td>
            </tr>
            @for (r of g.rows; track r.code) {
              <tr>
                <td class="code">{{ r.code }}</td><td>{{ r.name }}</td>
                <td class="r"><input type="text" appMoney class="num money-cell" placeholder="0" [attr.aria-label]="'Dư Nợ ' + r.code" [(ngModel)]="r.debit" [disabled]="!canEdit" /></td>
                <td class="r"><input type="text" appMoney class="num money-cell" placeholder="0" [attr.aria-label]="'Dư Có ' + r.code" [(ngModel)]="r.credit" [disabled]="!canEdit" /></td>
              </tr>
            }
          } @empty {
            <tr><td class="book-none" colspan="4">Chưa có tài khoản.</td></tr>
          }
        </tbody>
        <tfoot>
          <tr><td colspan="2">Cộng</td><td class="r num">{{ money(totalDebit()) }}</td><td class="r num">{{ money(totalCredit()) }}</td></tr>
        </tfoot>
      </table>
    </div>
  `,
  styles: [`
    .money-cell { width: 11rem; text-align: right; }
    /* Dải tiêu đề loại tài khoản + tổng Nợ/Có của loại. */
    tr.op-group td { padding-top: var(--space-xs); background: var(--color-paper-2); color: var(--color-ink); font-weight: 600; border-top: var(--rule-hair) solid var(--color-rule-strong); }
  `],
})
export class AccountingOpeningComponent {
  protected readonly toast = inject(ToastService);
  private readonly svc = inject(AccountingService);
  readonly canEdit = inject(AuthService).can('accounting.opening');
  readonly rows = signal<OpeningRow[]>([]);
  readonly saving = signal(false);
  readonly money = formatVnd;
  readonly period = signal(new Date().getFullYear());

  /** Tài khoản gom theo loại (giữ thứ tự số hiệu từ server); loại không có TK thì bỏ. */
  readonly groups = computed(() => {
    const rows = this.rows();
    return KIND_ORDER.map((k) => ({ kind: k, label: KIND[k], rows: rows.filter((r) => r.kind === k) })).filter((g) => g.rows.length);
  });

  // Rows are edited in place (ngModel on r.debit / r.credit), so the totals are plain methods read on every change detection.
  totalDebit(): number { return this.rows().reduce((s, r) => s + (Number(r.debit) || 0), 0); }
  totalCredit(): number { return this.rows().reduce((s, r) => s + (Number(r.credit) || 0), 0); }
  difference(): number { return this.totalDebit() - this.totalCredit(); }
  groupDebit(rows: OpeningRow[]): number { return rows.reduce((s, r) => s + (Number(r.debit) || 0), 0); }
  groupCredit(rows: OpeningRow[]): number { return rows.reduce((s, r) => s + (Number(r.credit) || 0), 0); }

  constructor() { this.load(); }

  async load() {
    try { this.rows.set((await this.svc.openingBalances(String(this.period()))).rows); }
    catch (e) { this.rows.set([]); this.toast.error(errorText(e)); }
  }

  async save() {
    this.saving.set(true);
    try {
      const rows = this.rows().map((r) => ({ accountCode: r.code, debit: Number(r.debit) || 0, credit: Number(r.credit) || 0 }));
      await this.svc.saveOpening(String(this.period()), rows);
      this.toast.success('Đã lưu số dư đầu kỳ.');
    } catch (e) {
      this.toast.error(errorText(e));
    } finally {
      this.saving.set(false);
    }
  }
}
