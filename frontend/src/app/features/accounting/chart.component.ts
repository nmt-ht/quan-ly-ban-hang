/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountingService } from '../../core/services/accounting.service';
import { errorText } from '../../core/api/api.service';
import { Account } from '../../core/models/domain.models';
import { foldVi } from '../../shared/format.util';

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
    @if (failure()) { <div class="notice is-error" role="alert"><span>{{ failure() }}</span></div> }

    <div class="filters-bar">
      <input type="search" class="filter-search" placeholder="Tìm số hiệu, tên tài khoản…" aria-label="Tìm tài khoản" [value]="search()" (input)="search.set($any($event.target).value)" />
      <select aria-label="Loại tài khoản" [value]="kindFilter()" (change)="kindFilter.set($any($event.target).value)">
        <option value="">Mọi loại</option>
        @for (k of kinds; track k[0]) { <option [value]="k[0]">{{ k[1] }}</option> }
      </select>
    </div>

    <div class="rp-surface rp-grid">
      <table class="book-table">
        <thead><tr>
          <th scope="col">Số hiệu</th><th scope="col">Tên tài khoản</th><th scope="col">Loại</th><th scope="col">Dư thường</th><th scope="col"><span class="visually-hidden">Thao tác</span></th>
        </tr></thead>
        <tbody>
          @for (a of visible(); track a.code) {
            <tr [class.book-head]="!a.isDetail">
              <td class="code">{{ a.code }}</td>
              <td>{{ a.name }}</td>
              <td>{{ kind(a.kind) }}</td>
              <td>{{ a.normalSide === 'NO' ? 'Nợ' : 'Có' }}</td>
              <td class="r">@if (a.isDetail) { <a class="btn row-act-btn" [routerLink]="['/ke-toan/so-cai', a.code]">Sổ cái</a> }</td>
            </tr>
          } @empty {
            <tr><td class="book-none" colspan="5">{{ accounts().length ? 'Không có tài khoản nào khớp bộ lọc.' : 'Chưa có tài khoản.' }}</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class AccountingChartComponent {
  private readonly svc = inject(AccountingService);
  readonly accounts = signal<Account[]>([]);
  readonly failure = signal('');
  readonly search = signal('');
  readonly kindFilter = signal('');
  readonly kinds = Object.entries(KIND);
  kind(k: string) { return KIND[k] ?? k; }

  readonly visible = computed(() => {
    const q = foldVi(this.search().trim());
    return this.accounts().filter((a) => (!this.kindFilter() || a.kind === this.kindFilter()) && (!q || foldVi(`${a.code} ${a.name}`).includes(q)));
  });

  constructor() {
    this.svc.accounts().then((a) => this.accounts.set(a)).catch((e) => this.failure.set(errorText(e)));
  }
}
