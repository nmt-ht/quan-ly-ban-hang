/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountingService } from '../../core/services/accounting.service';
import { AuthService } from '../../core/services/auth.service';
import { errorText } from '../../core/api/api.service';
import { JournalEntryView } from '../../core/models/domain.models';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { formatVnd } from '../../shared/format.util';
import { formatDay } from '../../shared/period';

/** /ke-toan/so-nhat-ky — sổ nhật ký chung (bút toán + các dòng Nợ/Có). */
@Component({
  selector: 'app-accounting-journal',
  standalone: true,
  imports: [RouterLink, NavIconComponent],
  template: `
    <div class="page-header">
      <div>
        <h1>Sổ nhật ký chung</h1>
        <p class="subtitle">{{ entries().length }} bút toán, mới nhất trước.</p>
      </div>
      @if (canManual) {
        <div class="toolbar">
          <a class="btn btn-primary" routerLink="/ke-toan/but-toan"><app-nav-icon name="plus" />Nhập bút toán</a>
        </div>
      }
    </div>
    @if (failure()) { <div class="notice is-error" role="alert"><span>{{ failure() }}</span></div> }

    <div class="rp-surface rp-grid">
      <table class="book-table">
        <thead><tr>
          <th scope="col">Ngày</th><th scope="col">Số CT</th><th scope="col">Diễn giải</th>
          <th scope="col">Tài khoản</th><th scope="col" class="r">Nợ</th><th scope="col" class="r">Có</th><th scope="col"><span class="visually-hidden">Thao tác</span></th>
        </tr></thead>
        <tbody>
          @for (e of entries(); track e.id) {
            @for (l of e.lines; track $index; let i = $index) {
              <tr [class.book-entry]="i === 0">
                @if (i === 0) {
                  <td class="num" [attr.rowspan]="e.lines.length">{{ formatDay(e.date) }}</td>
                  <td class="code" [attr.rowspan]="e.lines.length">{{ e.code }}</td>
                  <td [attr.rowspan]="e.lines.length">{{ e.description }}</td>
                }
                <td><span class="code">{{ l.accountCode }}</span> {{ l.accountName }}</td>
                <td class="r num" [class.is-zero]="!l.debit">{{ l.debit ? money(l.debit) : '—' }}</td>
                <td class="r num" [class.is-zero]="!l.credit">{{ l.credit ? money(l.credit) : '—' }}</td>
                @if (i === 0) {
                  <td class="r" [attr.rowspan]="e.lines.length">
                    @if (canReverse && !e.isReversal) { <button type="button" class="btn row-act-btn" (click)="reverse(e)">Đảo</button> }
                  </td>
                }
              </tr>
            }
          } @empty {
            <tr><td class="book-none" colspan="7">Chưa có bút toán nào.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class AccountingJournalComponent {
  private readonly svc = inject(AccountingService);
  private readonly auth = inject(AuthService);
  readonly canManual = this.auth.can('accounting.manual');
  readonly canReverse = this.auth.can('accounting.reverse');
  readonly entries = signal<JournalEntryView[]>([]);
  readonly failure = signal('');
  readonly money = formatVnd;
  readonly formatDay = formatDay;

  constructor() { this.load(); }

  private async load() {
    try { this.entries.set(await this.svc.journal()); } catch (e) { this.failure.set(errorText(e)); }
  }

  async reverse(e: JournalEntryView) {
    if (!confirm(`Đảo bút toán ${e.code}?`)) return;
    try { await this.svc.reverse(e.id); await this.load(); } catch (err) { this.failure.set(errorText(err)); }
  }
}
