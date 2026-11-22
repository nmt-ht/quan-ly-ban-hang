/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountingService } from '../../core/services/accounting.service';
import { AuthService } from '../../core/services/auth.service';
import { errorText } from '../../core/api/api.service';
import { JournalEntryView } from '../../core/models/domain.models';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { formatVnd } from '../../shared/format.util';
import { formatDay, presetRange } from '../../shared/period';
import { PeriodFilterComponent, PeriodValue } from '../../shared/period-filter/period-filter.component';
import { BookPrintComponent } from '../../shared/print/tt133/book-print.component';
import { BookSpec, journalBookSpec } from '../../shared/print/tt133/tt133-books';
import { PrintService } from '../../shared/print/print.service';

/** /ke-toan/so-nhat-ky — sổ nhật ký chung (bút toán + các dòng Nợ/Có); bản in là mẫu S03a-DNN (TT133). */
@Component({
  selector: 'app-accounting-journal',
  standalone: true,
  imports: [RouterLink, NavIconComponent, PeriodFilterComponent, BookPrintComponent],
  template: `
   <div class="screen-only">
    <div class="page-header">
      <div>
        <h1>Sổ nhật ký chung</h1>
        <p class="subtitle">{{ entries().length }} bút toán trong kỳ, mới nhất trước. Bản in theo mẫu S03a-DNN, theo ngày tăng dần.</p>
      </div>
      <div class="toolbar">
        <button type="button" class="btn" [disabled]="printBusy()" (click)="printBook()"><app-nav-icon name="printer" />In sổ S03a-DNN</button>
        @if (canManual) {
          <a class="btn btn-primary" routerLink="/ke-toan/but-toan"><app-nav-icon name="plus" />Nhập bút toán</a>
        }
      </div>
    </div>
    @if (failure()) { <div class="notice is-error" role="alert"><span>{{ failure() }}</span></div> }
    @if (truncated()) { <div class="notice" role="status">Kỳ có hơn 500 bút toán, màn hình chỉ hiện 500 bút toán mới nhất. Bản in lấy đủ kỳ (tối đa 5.000 bút toán).</div> }

    <div class="filters-bar">
      <app-period-filter [value]="period()" (valueChange)="onPeriod($event)" />
    </div>

    <div class="rp-surface rp-grid">
      <table class="book-table">
        <thead><tr>
          <th scope="col">Ngày</th><th scope="col">Số CT</th><th scope="col">Diễn giải</th>
          <th scope="col">Tài khoản</th><th scope="col" class="r">Nợ</th><th scope="col" class="r">Có</th><th scope="col"><span class="visually-hidden">Thao tác</span></th>
        </tr></thead>
        @for (e of entries(); track e.id) {
          <tbody class="book-group">
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
          </tbody>
        } @empty {
          <tbody><tr><td class="book-none" colspan="7">Chưa có bút toán nào.</td></tr></tbody>
        }
      </table>
    </div>
   </div>

   @if (doc(); as b) {
     <app-book-print [formNo]="b.formNo" [title]="b.title" [sub]="b.sub" [sub2]="b.sub2" [columns]="b.columns" [rows]="b.rows" />
   }
  `,
})
export class AccountingJournalComponent {
  private readonly svc = inject(AccountingService);
  private readonly confirmer = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  private readonly printer = inject(PrintService);
  readonly canManual = this.auth.can('accounting.manual');
  readonly canReverse = this.auth.can('accounting.reverse');
  readonly entries = signal<JournalEntryView[]>([]);
  readonly truncated = signal(false);
  readonly failure = signal('');
  readonly period = signal<PeriodValue>({ preset: 'thisYear', range: presetRange('thisYear') });
  readonly doc = signal<BookSpec | null>(null);
  readonly printBusy = signal(false);
  readonly money = formatVnd;
  readonly formatDay = formatDay;

  constructor() { this.load(); }

  onPeriod(v: PeriodValue) {
    this.period.set(v);
    this.load();
  }

  private async load() {
    const { from, to } = this.period().range;
    try {
      const rows = await this.svc.journal(from ?? undefined, to ?? undefined);
      this.entries.set(rows);
      this.truncated.set(rows.length >= 500);
    } catch (e) {
      this.failure.set(errorText(e));
    }
  }

  async reverse(e: JournalEntryView) {
    const ok = await this.confirmer.ask({ title: `Đảo bút toán ${e.code}?`, message: 'Hệ thống ghi một bút toán ngược lại, bút toán gốc vẫn giữ trong sổ.', confirmLabel: 'Đảo bút toán', cancelLabel: 'Không đảo', tone: 'danger' });
    if (!ok) return;
    try { await this.svc.reverse(e.id); await this.load(); } catch (err) { this.failure.set(errorText(err)); }
  }

  async printBook() {
    const { from, to } = this.period().range;
    if (!from || !to) { this.failure.set('Chọn kỳ có ngày bắt đầu và kết thúc để in sổ.'); return; }
    this.failure.set('');
    this.printBusy.set(true);
    try {
      const book = await this.svc.journalBook(from, to);
      if (book.truncated && !(await this.confirmer.ask({ title: 'Bản in chỉ gồm 5.000 bút toán đầu. Vẫn in?', message: 'Kỳ có hơn 5.000 bút toán. Thu hẹp kỳ để in đủ.', confirmLabel: 'Vẫn in', cancelLabel: 'Thu hẹp kỳ' }))) return;
      const spec = journalBookSpec(book);
      await this.printer.print('tt133-s03a', 'A4', () => this.doc.set(spec), () => this.doc.set(null));
    } catch (e) {
      this.failure.set(errorText(e));
    } finally {
      this.printBusy.set(false);
    }
  }
}
