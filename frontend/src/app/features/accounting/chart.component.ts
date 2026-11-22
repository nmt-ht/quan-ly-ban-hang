/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountingService } from '../../core/services/accounting.service';
import { errorText } from '../../core/api/api.service';
import { Account } from '../../core/models/domain.models';
import { foldVi } from '../../shared/format.util';
import { ToastService } from '../../core/services/toast.service';

const KIND: Record<string, string> = {
  TAI_SAN: 'Tài sản', NO_PHAI_TRA: 'Nợ phải trả', VON_CSH: 'Vốn CSH', DOANH_THU: 'Doanh thu', CHI_PHI: 'Chi phí', KQKD: 'Xác định KQKD',
};

/** /ke-toan/tai-khoan — hệ thống tài khoản (TT133). */
@Component({
  selector: 'app-accounting-chart',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page-header">
      <div>
        <h1>Hệ thống tài khoản</h1>
        <p class="subtitle">{{ accounts().length }} tài khoản theo Thông tư 133. Bấm "Sổ cái" để xem phát sinh của tài khoản.</p>
      </div>
    </div>

    <div class="filters-bar">
      <input type="search" class="filter-search" placeholder="Tìm số hiệu, tên tài khoản…" aria-label="Tìm tài khoản" [value]="search()" (input)="search.set($any($event.target).value)" />
      <select aria-label="Loại tài khoản" [value]="kindFilter()" (change)="kindFilter.set($any($event.target).value)">
        <option value="">Mọi loại</option>
        @for (k of kinds; track k[0]) { <option [value]="k[0]">{{ k[1] }}</option> }
      </select>
    </div>

    <div class="rp-surface rp-grid coa">
      <table class="book-table">
        <colgroup><col class="c-code" /><col /><col class="c-kind" /><col class="c-side" /><col class="c-act" /></colgroup>
        <thead><tr>
          <th scope="col">Số hiệu</th><th scope="col">Tên tài khoản</th><th scope="col">Loại</th><th scope="col">Dư thường</th><th scope="col"><span class="visually-hidden">Thao tác</span></th>
        </tr></thead>
        <tbody>
          @for (a of visible(); track a.code) {
            <tr [class.book-head]="!a.isDetail" [class.is-detail]="a.isDetail">
              <td class="code">{{ a.code }}</td>
              <td class="coa-name">{{ a.name }}</td>
              <td class="coa-muted">{{ kind(a.kind) }}</td>
              <td class="coa-muted">{{ a.normalSide === 'NO' ? 'Nợ' : 'Có' }}</td>
              <td class="r">@if (a.isDetail) { <a class="btn row-act-btn" [routerLink]="['/ke-toan/so-cai', a.code]">Sổ cái</a> }</td>
            </tr>
          } @empty {
            <tr><td class="book-none" colspan="5">{{ accounts().length ? 'Không có tài khoản nào khớp bộ lọc.' : 'Chưa có tài khoản.' }}</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    /* One readable block: the name, its kind and the Sổ cái button sit a thumb apart instead of across a 1600px row. */
    .coa { max-width: 56rem; }
    .coa table { table-layout: fixed; }
    .coa .c-code { width: 5.5rem; }
    .coa .c-kind { width: 9rem; }
    .coa .c-side { width: 5rem; }
    .coa .c-act { width: 6.5rem; }
    .coa td { padding-block: var(--space-2xs); }
    .coa-name { overflow-wrap: anywhere; }
    .coa tr.is-detail .coa-name { padding-left: var(--space-md); }
    .coa-muted { color: var(--color-muted); }
    .coa tr.book-head .coa-muted { color: var(--color-ink-2); font-weight: 500; }
    .coa tr.book-head td { border-top: var(--rule-hair) solid var(--color-rule-strong); }
  `,
})
export class AccountingChartComponent {
  protected readonly toast = inject(ToastService);
  private readonly svc = inject(AccountingService);
  readonly accounts = signal<Account[]>([]);
  readonly search = signal('');
  readonly kindFilter = signal('');
  readonly kinds = Object.entries(KIND);
  kind(k: string) { return KIND[k] ?? k; }

  readonly visible = computed(() => {
    const q = foldVi(this.search().trim());
    return this.accounts().filter((a) => (!this.kindFilter() || a.kind === this.kindFilter()) && (!q || foldVi(`${a.code} ${a.name}`).includes(q)));
  });

  constructor() {
    this.svc.accounts().then((a) => this.accounts.set(a)).catch((e) => this.toast.error(errorText(e)));
  }
}
