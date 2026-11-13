import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountingService } from '../../core/services/accounting.service';
import { AuthService } from '../../core/services/auth.service';
import { JournalEntryView } from '../../core/models/domain.models';
import { formatVnd } from '../../shared/format.util';
import { formatDay } from '../../shared/period';

/** /ke-toan/so-nhat-ky — sổ nhật ký chung (bút toán + các dòng Nợ/Có). */
@Component({
  selector: 'app-accounting-journal',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page-header">
      <div><h1>Sổ nhật ký chung</h1><p class="subtitle">Tất cả bút toán theo thời gian (mới nhất trước).</p></div>
      @if (canManual) { <a class="btn btn-primary" routerLink="/ke-toan/but-toan">+ Nhập bút toán</a> }
    </div>
    @if (failure()) { <div class="notice is-error" role="alert">{{ failure() }}</div> }

    <div class="card" style="overflow-x:auto">
      <table style="width:100%; border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left">Ngày</th><th style="text-align:left">Số CT</th><th style="text-align:left">Diễn giải</th>
          <th style="text-align:left">Tài khoản</th><th style="text-align:right">Nợ</th><th style="text-align:right">Có</th><th></th>
        </tr></thead>
        <tbody>
          @for (e of entries(); track e.id) {
            @for (l of e.lines; track $index; let i = $index) {
              <tr>
                @if (i === 0) {
                  <td [attr.rowspan]="e.lines.length">{{ formatDay(e.date) }}</td>
                  <td [attr.rowspan]="e.lines.length">{{ e.code }}</td>
                  <td [attr.rowspan]="e.lines.length">{{ e.description }}</td>
                }
                <td>{{ l.accountCode }} — {{ l.accountName }}</td>
                <td style="text-align:right">{{ l.debit ? money(l.debit) : '' }}</td>
                <td style="text-align:right">{{ l.credit ? money(l.credit) : '' }}</td>
                @if (i === 0) {
                  <td [attr.rowspan]="e.lines.length" style="text-align:right">
                    @if (canReverse && !e.isReversal) { <button type="button" class="btn btn-sm" (click)="reverse(e)">Đảo</button> }
                  </td>
                }
              </tr>
            }
          } @empty {
            <tr><td colspan="7" style="text-align:center; padding:16px">Chưa có bút toán nào.</td></tr>
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
    try { this.entries.set(await this.svc.journal()); } catch (e) { this.failure.set(e instanceof Error ? e.message : 'Lỗi tải'); }
  }

  async reverse(e: JournalEntryView) {
    if (!confirm(`Đảo bút toán ${e.code}?`)) return;
    try { await this.svc.reverse(e.id); await this.load(); } catch (err) { this.failure.set(err instanceof Error ? err.message : 'Lỗi'); }
  }
}
