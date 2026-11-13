import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AccountingService } from '../../core/services/accounting.service';
import { Account } from '../../core/models/domain.models';
import { formatVnd } from '../../shared/format.util';

interface LineRow { accountCode: string; debit: number; credit: number; description: string }

/** /ke-toan/but-toan — nhập bút toán thủ công (cân Nợ = Có). */
@Component({
  selector: 'app-accounting-manual-entry',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page-header"><div><h1>Nhập bút toán</h1><p class="subtitle">Tổng Nợ phải bằng tổng Có. Mỗi dòng chỉ ghi Nợ hoặc Có.</p></div></div>
    @if (failure()) { <div class="notice is-error" role="alert">{{ failure() }}</div> }

    <div class="card section-block" style="padding:16px">
      <div class="toolbar" style="gap:16px; flex-wrap:wrap; align-items:flex-end">
        <label>Ngày hạch toán<br><input type="date" [(ngModel)]="date"></label>
        <label style="flex:1; min-width:260px">Diễn giải<br><input type="text" [(ngModel)]="description" style="width:100%" placeholder="Nội dung bút toán"></label>
      </div>

      <table style="width:100%; border-collapse:collapse; margin-top:12px">
        <thead><tr>
          <th style="text-align:left">Tài khoản</th><th style="text-align:left">Diễn giải dòng</th>
          <th style="text-align:right; width:160px">Nợ</th><th style="text-align:right; width:160px">Có</th><th></th>
        </tr></thead>
        <tbody>
          @for (l of lines(); track $index; let i = $index) {
            <tr>
              <td>
                <select [(ngModel)]="l.accountCode" style="width:100%">
                  <option value="">-- chọn TK --</option>
                  @for (a of accounts(); track a.code) { <option [value]="a.code">{{ a.code }} — {{ a.name }}</option> }
                </select>
              </td>
              <td><input type="text" [(ngModel)]="l.description" style="width:100%"></td>
              <td><input type="number" min="0" [(ngModel)]="l.debit" style="width:100%; text-align:right"></td>
              <td><input type="number" min="0" [(ngModel)]="l.credit" style="width:100%; text-align:right"></td>
              <td><button type="button" class="btn btn-sm" (click)="removeLine(i)">x</button></td>
            </tr>
          }
          <tr>
            <td colspan="2" style="text-align:right"><b>Cộng</b></td>
            <td style="text-align:right"><b>{{ money(totalDebit()) }}</b></td>
            <td style="text-align:right"><b>{{ money(totalCredit()) }}</b></td><td></td>
          </tr>
        </tbody>
      </table>

      <div class="toolbar" style="gap:8px; margin-top:12px">
        <button type="button" class="btn" (click)="addLine()">+ Thêm dòng</button>
        <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="save()">Ghi sổ</button>
        <a class="btn" routerLink="/ke-toan/so-nhat-ky">Huỷ</a>
      </div>
    </div>
  `,
})
export class AccountingManualEntryComponent {
  private readonly svc = inject(AccountingService);
  private readonly router = inject(Router);
  readonly accounts = signal<Account[]>([]);
  readonly lines = signal<LineRow[]>([blank(), blank()]);
  date = new Date().toISOString().slice(0, 10);
  description = '';
  readonly saving = signal(false);
  readonly failure = signal('');
  readonly money = formatVnd;

  constructor() { this.svc.accounts().then((a) => this.accounts.set(a.filter((x) => x.isDetail && x.isActive))); }

  totalDebit() { return this.lines().reduce((s, l) => s + (Number(l.debit) || 0), 0); }
  totalCredit() { return this.lines().reduce((s, l) => s + (Number(l.credit) || 0), 0); }
  addLine() { this.lines.update((ls) => [...ls, blank()]); }
  removeLine(i: number) { this.lines.update((ls) => ls.filter((_, j) => j !== i)); }

  async save() {
    this.failure.set('');
    const lines = this.lines()
      .filter((l) => l.accountCode && ((Number(l.debit) || 0) !== 0 || (Number(l.credit) || 0) !== 0))
      .map((l) => ({ accountCode: l.accountCode, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: l.description || undefined }));
    this.saving.set(true);
    try {
      await this.svc.createManual({ date: this.date, description: this.description || undefined, lines });
      this.router.navigate(['/ke-toan/so-nhat-ky']);
    } catch (e) {
      this.failure.set(e instanceof Error ? e.message : 'Không ghi được bút toán.');
    } finally {
      this.saving.set(false);
    }
  }
}

function blank(): LineRow { return { accountCode: '', debit: 0, credit: 0, description: '' }; }
