import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService, PrepaidItemInput } from '../../core/services/accounting.service';
import { AuthService } from '../../core/services/auth.service';
import { PrepaidItemView } from '../../core/models/domain.models';
import { formatVnd } from '../../shared/format.util';
import { formatDay } from '../../shared/period';

function blankForm(): PrepaidItemInput {
  return { name: '', cost: 0, startDate: new Date().toISOString().slice(0, 10), allocationMonths: 12, expenseAccount: '642', fundingAccount: '153' };
}

/** /ke-toan/cong-cu-dung-cu — công cụ dụng cụ & chi phí trả trước (TK 242), phân bổ theo tháng. */
@Component({
  selector: 'app-accounting-prepaid-items',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page-header">
      <div><h1>Công cụ dụng cụ</h1><p class="subtitle">Ghi nhận vào TK 242 rồi phân bổ đều theo tháng: Nợ 642 / Có 242.</p></div>
      @if (canManage) { <button type="button" class="btn btn-primary" (click)="showForm.set(!showForm())">{{ showForm() ? 'Đóng' : '+ Thêm CCDC' }}</button> }
    </div>
    @if (notice()) { <div class="notice" role="status">{{ notice() }}</div> }
    @if (failure()) { <div class="notice is-error" role="alert">{{ failure() }}</div> }

    @if (showForm() && canManage) {
      <div class="card section-block" style="padding:16px; margin-bottom:12px">
        <h3 class="form-section-title">Thêm công cụ dụng cụ</h3>
        <div class="toolbar" style="gap:12px; flex-wrap:wrap; align-items:flex-end">
          <label>Tên<br><input type="text" [(ngModel)]="form.name" style="min-width:240px"></label>
          <label>Giá trị<br><input type="number" min="0" [(ngModel)]="form.cost" style="width:150px; text-align:right"></label>
          <label>Bắt đầu phân bổ<br><input type="date" [(ngModel)]="form.startDate"></label>
          <label>Số tháng<br><input type="number" min="1" [(ngModel)]="form.allocationMonths" style="width:90px"></label>
          <label>TK chi phí<br><input type="text" [(ngModel)]="form.expenseAccount" style="width:80px"></label>
          <label>TK đối ứng<br>
            <select [(ngModel)]="form.fundingAccount">
              <option value="153">153 — Công cụ, dụng cụ</option>
              <option value="111">111 — Tiền mặt</option>
              <option value="112">112 — Tiền gửi NH</option>
              <option value="331">331 — Phải trả người bán</option>
            </select>
          </label>
          <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="save()">Lưu</button>
        </div>
      </div>
    }

    @if (canAllocate) {
      <div class="card section-block" style="padding:16px; margin-bottom:12px">
        <div class="toolbar" style="gap:8px; align-items:flex-end">
          <label>Phân bổ kỳ<br><input type="month" [(ngModel)]="period"></label>
          <button type="button" class="btn" [disabled]="allocating()" (click)="allocate()">Phân bổ</button>
        </div>
      </div>
    }

    <div class="card" style="overflow-x:auto">
      <table style="width:100%; border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left">Mã</th><th style="text-align:left">Tên</th>
          <th style="text-align:right">Giá trị</th><th style="text-align:left">Bắt đầu</th><th style="text-align:right">Số tháng</th>
          <th style="text-align:right">PB/tháng</th><th style="text-align:right">Đã phân bổ</th><th style="text-align:right">Còn lại</th><th style="text-align:left">Trạng thái</th>
        </tr></thead>
        <tbody>
          @for (i of items(); track i.id) {
            <tr>
              <td>{{ i.code }}</td><td>{{ i.name }}</td>
              <td style="text-align:right">{{ money(i.cost) }}</td>
              <td>{{ formatDay(i.startDate) }}</td>
              <td style="text-align:right">{{ i.allocationMonths }}</td>
              <td style="text-align:right">{{ money(i.monthly) }}</td>
              <td style="text-align:right">{{ money(i.allocated) }}</td>
              <td style="text-align:right">{{ money(i.remaining) }}</td>
              <td>{{ i.status === 'HET_PHAN_BO' ? 'Đã phân bổ hết' : 'Đang phân bổ' }}</td>
            </tr>
          } @empty { <tr><td colspan="9" style="text-align:center; padding:16px">Chưa có công cụ dụng cụ.</td></tr> }
        </tbody>
      </table>
    </div>
  `,
})
export class AccountingPrepaidItemsComponent {
  private readonly svc = inject(AccountingService);
  private readonly auth = inject(AuthService);
  readonly canManage = this.auth.can('accounting.manage_account');
  readonly canAllocate = this.auth.can('accounting.manual');
  readonly items = signal<PrepaidItemView[]>([]);
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly allocating = signal(false);
  readonly notice = signal('');
  readonly failure = signal('');
  readonly money = formatVnd;
  readonly formatDay = formatDay;
  period = new Date().toISOString().slice(0, 7);
  form: PrepaidItemInput = blankForm();

  constructor() { this.load(); }

  async load() {
    try { this.items.set(await this.svc.prepaidItems()); } catch (e) { this.failure.set(e instanceof Error ? e.message : 'Lỗi tải'); }
  }

  async save() {
    this.failure.set(''); this.notice.set(''); this.saving.set(true);
    try {
      await this.svc.createPrepaid({ ...this.form, cost: Number(this.form.cost), allocationMonths: Number(this.form.allocationMonths) });
      this.notice.set('Đã thêm công cụ dụng cụ.'); this.showForm.set(false); this.form = blankForm();
      await this.load();
    } catch (e) { this.failure.set(e instanceof Error ? e.message : 'Không lưu được.'); }
    finally { this.saving.set(false); }
  }

  async allocate() {
    this.failure.set(''); this.notice.set(''); this.allocating.set(true);
    try {
      const r = await this.svc.allocatePrepaid(this.period);
      this.notice.set(r.total > 0 ? `Đã phân bổ ${r.count} khoản: ${formatVnd(r.total)}.` : 'Không có khoản nào để phân bổ (đã phân bổ kỳ này, chưa tới ngày bắt đầu, hoặc đã hết).');
      await this.load();
    } catch (e) { this.failure.set(e instanceof Error ? e.message : 'Không phân bổ được.'); }
    finally { this.allocating.set(false); }
  }
}
