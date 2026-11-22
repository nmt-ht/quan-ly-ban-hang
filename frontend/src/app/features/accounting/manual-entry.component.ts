/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AccountingService } from '../../core/services/accounting.service';
import { errorText } from '../../core/api/api.service';
import { Account } from '../../core/models/domain.models';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { formatVnd } from '../../shared/format.util';
import { MoneyInputDirective } from '../../shared/money-input.directive';
import { isoDay } from '../../shared/period';
import { DateInputDirective } from '../../shared/date-input/date-input.directive';
import { ToastService } from '../../core/services/toast.service';

interface LineRow { accountCode: string; debit: number | null; credit: number | null; description: string }

/** /ke-toan/but-toan — nhập bút toán thủ công (cân Nợ = Có). */
@Component({
  selector: 'app-accounting-manual-entry',
  standalone: true,
  imports: [DateInputDirective, FormsModule, RouterLink, NavIconComponent, MoneyInputDirective],
  template: `
    <p class="subtitle"><a class="crumb" routerLink="/ke-toan/so-nhat-ky">Sổ nhật ký chung</a> / Nhập bút toán</p>
    <div class="page-header">
      <div>
        <h1>Nhập bút toán</h1>
        <p class="subtitle">Tổng Nợ phải bằng tổng Có. Mỗi dòng chỉ ghi Nợ hoặc Có.</p>
      </div>
    </div>

    <section class="card section-block" aria-labelledby="bt-head">
      <h2 id="bt-head" class="form-section-title">Thông tin chung</h2>
      <div class="form-grid-3">
        <div class="field">
          <label for="bt-date">Ngày hạch toán <span class="required-mark">*</span></label>
          <input id="bt-date" appDate [max]="today" [(ngModel)]="date" />
        </div>
        <div class="field span-2">
          <label for="bt-desc">Diễn giải</label>
          <input id="bt-desc" type="text" maxlength="500" placeholder="Nội dung bút toán" [(ngModel)]="description" />
        </div>
      </div>
    </section>

    <section class="card section-block" aria-labelledby="bt-lines">
      <h2 id="bt-lines" class="form-section-title">Định khoản</h2>
      <div class="rp-surface book-wrap">
        <table class="line-table book-table">
          <thead><tr>
            <th scope="col">Tài khoản</th><th scope="col">Diễn giải dòng</th><th scope="col" class="r">Nợ</th><th scope="col" class="r">Có</th>
            <th scope="col"><span class="visually-hidden">Xoá dòng</span></th>
          </tr></thead>
          <tbody>
            @for (l of lines(); track $index; let i = $index) {
              <tr>
                <td>
                  <select class="account-cell" [attr.aria-label]="'Tài khoản dòng ' + (i + 1)" [(ngModel)]="l.accountCode">
                    <option value="">Chọn tài khoản…</option>
                    @for (a of accounts(); track a.code) { <option [value]="a.code">{{ a.code }} — {{ a.name }}</option> }
                  </select>
                </td>
                <td><input type="text" maxlength="300" [attr.aria-label]="'Diễn giải dòng ' + (i + 1)" [(ngModel)]="l.description" /></td>
                <td class="r"><input type="text" appMoney class="num money-cell" placeholder="0" [attr.aria-label]="'Nợ dòng ' + (i + 1)" [(ngModel)]="l.debit" /></td>
                <td class="r"><input type="text" appMoney class="num money-cell" placeholder="0" [attr.aria-label]="'Có dòng ' + (i + 1)" [(ngModel)]="l.credit" /></td>
                <td><button type="button" class="icon-action" [attr.aria-label]="'Xoá dòng ' + (i + 1)" title="Xoá dòng" [disabled]="lines().length <= 2" (click)="removeLine(i)"><app-nav-icon name="trash" /></button></td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr><td colspan="2">Cộng</td><td class="r num">{{ money(totalDebit()) }}</td><td class="r num">{{ money(totalCredit()) }}</td><td></td></tr>
          </tfoot>
        </table>
      </div>
      <button type="button" class="btn" (click)="addLine()"><app-nav-icon name="plus" />Thêm dòng</button>
    </section>

    <div class="form-actions-bar">
      <span class="hint" [class.text-danger]="difference() !== 0" role="status">{{ difference() === 0 ? 'Nợ bằng Có — có thể ghi sổ' : 'Nợ lệch Có ' + money(difference()) }}</span>
      <div class="form-actions">
        <a class="btn" routerLink="/ke-toan/so-nhat-ky">Huỷ</a>
        <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="save()"><app-nav-icon name="check" />Ghi sổ</button>
      </div>
    </div>
  `,
  styles: [`.money-cell { width: 8.5rem; text-align: right; } .account-cell { min-width: 12rem; width: 100%; }`],
})
export class AccountingManualEntryComponent {
  protected readonly toast = inject(ToastService);
  private readonly svc = inject(AccountingService);
  private readonly router = inject(Router);
  readonly accounts = signal<Account[]>([]);
  readonly lines = signal<LineRow[]>([blank(), blank()]);
  readonly today = isoDay(new Date());
  date = isoDay(new Date());
  description = '';
  readonly saving = signal(false);
  readonly money = formatVnd;

  constructor() { this.svc.accounts().then((a) => this.accounts.set(a.filter((x) => x.isDetail && x.isActive))).catch((e) => this.toast.error(errorText(e))); }

  // Lines are edited in place (ngModel), so the totals are plain methods read on every change detection.
  totalDebit(): number { return this.lines().reduce((s, l) => s + (Number(l.debit) || 0), 0); }
  totalCredit(): number { return this.lines().reduce((s, l) => s + (Number(l.credit) || 0), 0); }
  difference(): number { return this.totalDebit() - this.totalCredit(); }
  addLine() { this.lines.update((ls) => [...ls, blank()]); }
  removeLine(i: number) { this.lines.update((ls) => ls.filter((_, j) => j !== i)); }

  async save() {
    const lines = this.lines()
      .filter((l) => l.accountCode && ((Number(l.debit) || 0) !== 0 || (Number(l.credit) || 0) !== 0))
      .map((l) => ({ accountCode: l.accountCode, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: l.description || undefined }));
    this.saving.set(true);
    try {
      await this.svc.createManual({ date: this.date, description: this.description || undefined, lines });
      this.router.navigate(['/ke-toan/so-nhat-ky']);
    } catch (e) {
      this.toast.error(errorText(e));
    } finally {
      this.saving.set(false);
    }
  }
}

function blank(): LineRow { return { accountCode: '', debit: null, credit: null, description: '' }; }
