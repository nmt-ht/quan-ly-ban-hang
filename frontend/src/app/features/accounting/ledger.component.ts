/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AccountingService } from '../../core/services/accounting.service';
import { errorText } from '../../core/api/api.service';
import { LedgerView } from '../../core/models/domain.models';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { PrintService } from '../../shared/print/print.service';
import { BookPrintComponent } from '../../shared/print/tt133/book-print.component';
import { BookSpec, ledgerBookSpec } from '../../shared/print/tt133/tt133-books';
import { formatVnd } from '../../shared/format.util';
import { formatDay } from '../../shared/period';
import { ToastService } from '../../core/services/toast.service';

/** /ke-toan/so-cai/:code — sổ cái một tài khoản + số dư luỹ kế. */
@Component({
  selector: 'app-accounting-ledger',
  standalone: true,
  imports: [RouterLink, NavIconComponent, BookPrintComponent],
  template: `
   <div class="screen-only">
    <p class="subtitle"><a class="crumb" routerLink="/ke-toan/can-doi-phat-sinh">Bảng cân đối số phát sinh</a> / Sổ cái</p>
    <div class="page-header">
      <div>
        <h1>Sổ cái @if (data(); as d) { TK {{ d.account.code }} — {{ d.account.name }} }</h1>
        <p class="subtitle">Từng bút toán của tài khoản trong năm, kèm số dư luỹ kế. Bản in theo mẫu S03b-DNN.</p>
      </div>
      <div class="toolbar">
        <button type="button" class="btn" [disabled]="!data() || printBusy()" (click)="printBook()"><app-nav-icon name="printer" />In sổ S03b-DNN</button>
      </div>
    </div>

    <div class="filters-bar">
      <input type="number" class="year-input" aria-label="Năm" min="2000" max="2100" [value]="period()" (change)="period.set(+$any($event.target).value); load()" />
    </div>

    @if (data(); as d) {
      <dl class="list-totals">
        <div><dt>Số dư đầu kỳ (bên {{ side(d) }})</dt><dd class="num">{{ money(opening()) }}</dd></div>
        <div><dt>Số dư cuối kỳ (bên {{ side(d) }})</dt><dd class="num">{{ money(closing()) }}</dd></div>
      </dl>

      <div class="rp-surface rp-grid">
        <table class="book-table">
          <thead><tr>
            <th scope="col">Ngày</th><th scope="col">Số CT</th><th scope="col">Diễn giải</th>
            <th scope="col" class="r">Nợ</th><th scope="col" class="r">Có</th><th scope="col" class="r">Số dư</th>
          </tr></thead>
          <tbody>
            <tr class="book-open"><td colspan="5">Số dư đầu kỳ</td><td class="r num">{{ money(opening()) }}</td></tr>
            @for (r of d.rows; track $index) {
              <tr>
                <td class="num">{{ formatDay(r.date) }}</td><td class="code">{{ r.code }}</td><td>{{ r.description }}</td>
                <td class="r num" [class.is-zero]="!r.debit">{{ r.debit ? money(r.debit) : '—' }}</td>
                <td class="r num" [class.is-zero]="!r.credit">{{ r.credit ? money(r.credit) : '—' }}</td>
                <td class="r num">{{ money(r.balance) }}</td>
              </tr>
            } @empty {
              <tr><td class="book-none" colspan="6">Chưa có phát sinh.</td></tr>
            }
          </tbody>
        </table>
      </div>
    }
   </div>

   @if (doc(); as b) {
     <app-book-print [formNo]="b.formNo" [title]="b.title" [sub]="b.sub" [sub2]="b.sub2" [columns]="b.columns" [rows]="b.rows" />
   }
  `,
})
export class AccountingLedgerComponent {
  protected readonly toast = inject(ToastService);
  private readonly svc = inject(AccountingService);
  private readonly confirmer = inject(ConfirmService);
  private readonly printer = inject(PrintService);
  private readonly code = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('code') ?? '')), { initialValue: '' });
  readonly data = signal<LedgerView | null>(null);
  readonly doc = signal<BookSpec | null>(null);
  readonly printBusy = signal(false);
  readonly money = formatVnd;
  readonly formatDay = formatDay;
  readonly period = signal(new Date().getFullYear());

  readonly opening = computed(() => {
    const d = this.data();
    return d ? (d.account.normalSide === 'NO' ? d.openingNo - d.openingCo : d.openingCo - d.openingNo) : 0;
  });
  readonly closing = computed(() => this.data()?.rows.at(-1)?.balance ?? this.opening());

  constructor() { this.load(); }

  side(d: LedgerView): string {
    return d.account.normalSide === 'NO' ? 'Nợ' : 'Có';
  }

  /** Sổ Cái S03b-DNN của cả năm đang xem: lấy từ sổ chi tiết tài khoản để có cột tài khoản đối ứng. */
  async printBook() {
    this.printBusy.set(true);
    try {
      const y = this.period();
      const book = await this.svc.accountBook(this.code(), `${y}-01-01`, `${y}-12-31`);
      if (book.truncated && !(await this.confirmer.ask({ title: 'Bản in chỉ gồm 5.000 dòng đầu. Vẫn in?', message: 'Sổ có hơn 5.000 dòng.', confirmLabel: 'Vẫn in', cancelLabel: 'Không in' }))) return;
      const spec = ledgerBookSpec(book);
      await this.printer.print('tt133-s03b', 'A4', () => this.doc.set(spec), () => this.doc.set(null));
    } catch (e) {
      this.toast.error(errorText(e));
    } finally {
      this.printBusy.set(false);
    }
  }

  async load() {
    try { this.data.set(await this.svc.ledger(this.code(), String(this.period()))); }
    catch (e) { this.data.set(null); this.toast.error(errorText(e)); }
  }
}
