import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService, FixedAssetInput } from '../../core/services/accounting.service';
import { AuthService } from '../../core/services/auth.service';
import { FixedAssetView } from '../../core/models/domain.models';
import { formatVnd } from '../../shared/format.util';
import { formatDay } from '../../shared/period';

/** /ke-toan/tai-san — tài sản cố định + trích khấu hao. */
@Component({
  selector: 'app-accounting-fixed-assets',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page-header">
      <div><h1>Tài sản cố định</h1><p class="subtitle">Khấu hao đường thẳng (nguyên giá ÷ số tháng). Trích khấu hao: Nợ 642 / Có 214.</p></div>
      @if (canManage) { <button type="button" class="btn btn-primary" (click)="showForm.set(!showForm())">{{ showForm() ? 'Đóng' : '+ Thêm tài sản' }}</button> }
    </div>
    @if (notice()) { <div class="notice" role="status">{{ notice() }}</div> }
    @if (failure()) { <div class="notice is-error" role="alert">{{ failure() }}</div> }

    @if (showForm() && canManage) {
      <div class="card section-block" style="padding:16px; margin-bottom:12px">
        <h3 class="form-section-title">Thêm tài sản cố định</h3>
        <div class="toolbar" style="gap:12px; flex-wrap:wrap; align-items:flex-end">
          <label>Tên tài sản<br><input type="text" [(ngModel)]="form.name" style="min-width:240px"></label>
          <label>Nguyên giá<br><input type="number" min="0" [(ngModel)]="form.cost" style="width:150px; text-align:right"></label>
          <label>Ngày đưa vào dùng<br><input type="date" [(ngModel)]="form.usageStartDate"></label>
          <label>Số tháng KH<br><input type="number" min="1" [(ngModel)]="form.usefulLifeMonths" style="width:100px"></label>
          <label>TK chi phí<br><input type="text" [(ngModel)]="form.expenseAccount" style="width:90px" placeholder="642"></label>
          <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="save()">Lưu</button>
        </div>
      </div>
    }

    @if (canDepreciate) {
      <div class="card section-block" style="padding:16px; margin-bottom:12px">
        <div class="toolbar" style="gap:8px; align-items:flex-end">
          <label>Trích khấu hao kỳ<br><input type="month" [(ngModel)]="period"></label>
          <button type="button" class="btn" [disabled]="depreciating()" (click)="depreciate()">Trích khấu hao</button>
        </div>
      </div>
    }

    <div class="card" style="overflow-x:auto">
      <table style="width:100%; border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left">Mã</th><th style="text-align:left">Tên tài sản</th>
          <th style="text-align:right">Nguyên giá</th><th style="text-align:left">Bắt đầu</th><th style="text-align:right">Số tháng</th>
          <th style="text-align:right">KH/tháng</th><th style="text-align:right">Đã hao mòn</th><th style="text-align:right">Còn lại</th>
        </tr></thead>
        <tbody>
          @for (a of assets(); track a.id) {
            <tr>
              <td>{{ a.code }}</td><td>{{ a.name }}</td>
              <td style="text-align:right">{{ money(a.cost) }}</td>
              <td>{{ formatDay(a.usageStartDate) }}</td>
              <td style="text-align:right">{{ a.usefulLifeMonths }}</td>
              <td style="text-align:right">{{ money(a.monthly) }}</td>
              <td style="text-align:right">{{ money(a.accumulated) }}</td>
              <td style="text-align:right">{{ money(a.remaining) }}</td>
            </tr>
          } @empty { <tr><td colspan="8" style="text-align:center; padding:16px">Chưa có tài sản cố định.</td></tr> }
        </tbody>
      </table>
    </div>
  `,
})
export class AccountingFixedAssetsComponent {
  private readonly svc = inject(AccountingService);
  private readonly auth = inject(AuthService);
  readonly canManage = this.auth.can('accounting.manage_account');
  readonly canDepreciate = this.auth.can('accounting.manual');
  readonly assets = signal<FixedAssetView[]>([]);
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly depreciating = signal(false);
  readonly notice = signal('');
  readonly failure = signal('');
  readonly money = formatVnd;
  readonly formatDay = formatDay;
  period = new Date().toISOString().slice(0, 7);
  form: FixedAssetInput = { name: '', cost: 0, usageStartDate: new Date().toISOString().slice(0, 10), usefulLifeMonths: 12, expenseAccount: '642' };

  constructor() { this.load(); }

  async load() {
    try { this.assets.set(await this.svc.fixedAssets()); } catch (e) { this.failure.set(e instanceof Error ? e.message : 'Lỗi tải'); }
  }

  async save() {
    this.failure.set(''); this.notice.set(''); this.saving.set(true);
    try {
      await this.svc.createAsset({ ...this.form, cost: Number(this.form.cost), usefulLifeMonths: Number(this.form.usefulLifeMonths) });
      this.notice.set('Đã thêm tài sản.'); this.showForm.set(false);
      this.form = { name: '', cost: 0, usageStartDate: new Date().toISOString().slice(0, 10), usefulLifeMonths: 12, expenseAccount: '642' };
      await this.load();
    } catch (e) { this.failure.set(e instanceof Error ? e.message : 'Không lưu được.'); }
    finally { this.saving.set(false); }
  }

  async depreciate() {
    this.failure.set(''); this.notice.set(''); this.depreciating.set(true);
    try {
      const r = await this.svc.depreciate(this.period);
      this.notice.set(r.total > 0 ? `Đã trích khấu hao ${r.count} tài sản: ${formatVnd(r.total)}.` : 'Không có tài sản nào để trích (đã trích kỳ này hoặc hết khấu hao).');
      await this.load();
    } catch (e) { this.failure.set(e instanceof Error ? e.message : 'Không trích được.'); }
    finally { this.depreciating.set(false); }
  }
}
