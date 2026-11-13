import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountingService } from '../../core/services/accounting.service';
import { Account } from '../../core/models/domain.models';

const KIND: Record<string, string> = {
  TAI_SAN: 'Tài sản', NO_PHAI_TRA: 'Nợ phải trả', VON_CSH: 'Vốn CSH', DOANH_THU: 'Doanh thu', CHI_PHI: 'Chi phí', KQKD: 'Xác định KQKD',
};

/** /ke-toan/tai-khoan — hệ thống tài khoản (TT133). */
@Component({
  selector: 'app-accounting-chart',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page-header"><div><h1>Hệ thống tài khoản</h1><p class="subtitle">Danh mục tài khoản theo Thông tư 133.</p></div></div>
    @if (failure()) { <div class="notice is-error" role="alert">{{ failure() }}</div> }
    <div class="card" style="overflow-x:auto">
      <table style="width:100%; border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left">Số hiệu</th><th style="text-align:left">Tên tài khoản</th>
          <th style="text-align:left">Loại</th><th style="text-align:left">Dư thường</th><th></th>
        </tr></thead>
        <tbody>
          @for (a of accounts(); track a.code) {
            <tr>
              <td>{{ a.code }}</td>
              <td [style.font-weight]="a.isDetail ? 'normal' : '600'">{{ a.name }}</td>
              <td>{{ kind(a.kind) }}</td>
              <td>{{ a.normalSide === 'NO' ? 'Nợ' : 'Có' }}</td>
              <td>@if (a.isDetail) { <a class="btn btn-sm" [routerLink]="['/ke-toan/so-cai', a.code]">Sổ cái</a> }</td>
            </tr>
          } @empty {
            <tr><td colspan="5" style="text-align:center; padding:16px">Chưa có tài khoản.</td></tr>
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
  kind(k: string) { return KIND[k] ?? k; }

  constructor() {
    this.svc.accounts().then((a) => this.accounts.set(a)).catch((e) => this.failure.set(e instanceof Error ? e.message : 'Lỗi tải'));
  }
}
