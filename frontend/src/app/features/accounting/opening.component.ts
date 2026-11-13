import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService } from '../../core/services/accounting.service';
import { AuthService } from '../../core/services/auth.service';
import { OpeningRow } from '../../core/models/domain.models';
import { formatVnd } from '../../shared/format.util';

/** /ke-toan/so-du-dau-ky — nhập số dư đầu kỳ cho từng tài khoản. */
@Component({
  selector: 'app-accounting-opening',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page-header">
      <div><h1>Số dư đầu kỳ</h1><p class="subtitle">Nhập số dư Nợ/Có đầu kỳ cho từng tài khoản. Tổng Nợ nên bằng tổng Có.</p></div>
      <label>Kỳ (năm) <input type="number" [(ngModel)]="period" (change)="load()" style="width:90px"></label>
    </div>
    @if (notice()) { <div class="notice" role="status">{{ notice() }}</div> }
    @if (failure()) { <div class="notice is-error" role="alert">{{ failure() }}</div> }

    <div class="card" style="overflow-x:auto">
      <table style="width:100%; border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left">TK</th><th style="text-align:left">Tên tài khoản</th>
          <th style="text-align:right; width:180px">Dư Nợ</th><th style="text-align:right; width:180px">Dư Có</th>
        </tr></thead>
        <tbody>
          @for (r of rows(); track r.code) {
            <tr>
              <td>{{ r.code }}</td><td>{{ r.name }}</td>
              <td><input type="number" min="0" [(ngModel)]="r.debit" style="width:100%; text-align:right" [disabled]="!canEdit"></td>
              <td><input type="number" min="0" [(ngModel)]="r.credit" style="width:100%; text-align:right" [disabled]="!canEdit"></td>
            </tr>
          }
        </tbody>
        <tfoot>
          <tr style="font-weight:700">
            <td colspan="2" style="text-align:right">Cộng</td>
            <td style="text-align:right">{{ money(totalDebit()) }}</td>
            <td style="text-align:right">{{ money(totalCredit()) }}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    @if (canEdit) {
      <div class="toolbar" style="margin-top:12px">
        <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="save()">Lưu số dư đầu kỳ</button>
      </div>
    }
  `,
})
export class AccountingOpeningComponent {
  private readonly svc = inject(AccountingService);
  readonly canEdit = inject(AuthService).can('accounting.opening');
  readonly rows = signal<OpeningRow[]>([]);
  readonly notice = signal('');
  readonly failure = signal('');
  readonly saving = signal(false);
  readonly money = formatVnd;
  period = new Date().getFullYear();

  constructor() { this.load(); }

  totalDebit() { return this.rows().reduce((s, r) => s + (Number(r.debit) || 0), 0); }
  totalCredit() { return this.rows().reduce((s, r) => s + (Number(r.credit) || 0), 0); }

  async load() {
    this.failure.set('');
    try { this.rows.set((await this.svc.openingBalances(String(this.period))).rows); }
    catch (e) { this.failure.set(e instanceof Error ? e.message : 'Lỗi tải'); }
  }

  async save() {
    this.failure.set('');
    this.notice.set('');
    this.saving.set(true);
    try {
      const rows = this.rows().map((r) => ({ accountCode: r.code, debit: Number(r.debit) || 0, credit: Number(r.credit) || 0 }));
      await this.svc.saveOpening(String(this.period), rows);
      this.notice.set('Đã lưu số dư đầu kỳ.');
    } catch (e) {
      this.failure.set(e instanceof Error ? e.message : 'Không lưu được.');
    } finally {
      this.saving.set(false);
    }
  }
}
