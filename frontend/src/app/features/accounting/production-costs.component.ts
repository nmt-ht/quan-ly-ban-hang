import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService, ProductionCostInput } from '../../core/services/accounting.service';
import { AuthService } from '../../core/services/auth.service';
import { ProductionCostRow } from '../../core/models/domain.models';
import { formatVnd } from '../../shared/format.util';

const STATUS: Record<string, string> = { NHAP: 'Nháp', DANG_SAN_XUAT: 'Đang sản xuất', HOAN_TAT: 'Đã nghiệm thu' };

function blankForm(): ProductionCostInput {
  return { orderId: '', kind: 'NHAN_CONG', amount: 0, date: new Date().toISOString().slice(0, 10), creditAccount: '334', description: '' };
}

/** /ke-toan/gia-thanh — giá thành sản xuất từng lệnh (vật tư + nhân công + sản xuất chung, TK 154). */
@Component({
  selector: 'app-accounting-production-costs',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Giá thành sản xuất</h1>
        <p class="subtitle">Vật tư lấy từ phiếu xuất kho của lệnh. Nhân công và sản xuất chung nhập thêm ở đây (Nợ 154), rồi cộng vào giá thành khi nghiệm thu (Nợ 155 / Có 154).</p>
      </div>
      @if (canAdd) { <button type="button" class="btn btn-primary" (click)="showForm.set(!showForm())">{{ showForm() ? 'Đóng' : '+ Nhập chi phí' }}</button> }
    </div>
    @if (notice()) { <div class="notice" role="status">{{ notice() }}</div> }
    @if (failure()) { <div class="notice is-error" role="alert">{{ failure() }}</div> }

    @if (showForm() && canAdd) {
      <div class="card section-block" style="padding:16px; margin-bottom:12px">
        <h3 class="form-section-title">Nhập chi phí cho lệnh sản xuất</h3>
        <div class="toolbar" style="gap:12px; flex-wrap:wrap; align-items:flex-end">
          <label>Lệnh sản xuất<br>
            <select [(ngModel)]="form.orderId" style="min-width:260px">
              <option value="">-- chọn lệnh --</option>
              @for (o of openOrders(); track o.id) { <option [value]="o.id">{{ o.code }} — {{ o.productName }} ({{ status(o.status) }})</option> }
            </select>
          </label>
          <label>Loại chi phí<br>
            <select [(ngModel)]="form.kind">
              <option value="NHAN_CONG">Nhân công trực tiếp</option>
              <option value="SAN_XUAT_CHUNG">Sản xuất chung</option>
            </select>
          </label>
          <label>Số tiền<br><input type="number" min="0" [(ngModel)]="form.amount" style="width:150px; text-align:right"></label>
          <label>Ngày<br><input type="date" [(ngModel)]="form.date"></label>
          <label>TK đối ứng (Có)<br>
            <select [(ngModel)]="form.creditAccount">
              <option value="334">334 — Phải trả người lao động</option>
              <option value="111">111 — Tiền mặt</option>
              <option value="112">112 — Tiền gửi NH</option>
              <option value="331">331 — Phải trả người bán</option>
              <option value="214">214 — Hao mòn TSCĐ</option>
              <option value="242">242 — Chi phí trả trước</option>
            </select>
          </label>
          <label>Diễn giải<br><input type="text" [(ngModel)]="form.description" style="min-width:200px"></label>
          <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="save()">Lưu</button>
        </div>
      </div>
    }

    <div class="card" style="overflow-x:auto">
      <table style="width:100%; border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left">Lệnh</th><th style="text-align:left">Thành phẩm</th><th style="text-align:left">Trạng thái</th>
          <th style="text-align:right">SL</th><th style="text-align:right">Vật tư</th><th style="text-align:right">Nhân công</th>
          <th style="text-align:right">SX chung</th><th style="text-align:right">Tổng giá thành</th><th style="text-align:right">Giá thành / đơn vị</th>
        </tr></thead>
        <tbody>
          @for (r of rows(); track r.id) {
            <tr>
              <td>{{ r.code }}</td>
              <td>{{ r.productCode }} — {{ r.productName }}</td>
              <td>{{ status(r.status) }}</td>
              <td style="text-align:right">{{ r.produced ?? r.quantity }}</td>
              <td style="text-align:right">{{ money(r.material) }}</td>
              <td style="text-align:right">{{ money(r.labor) }}</td>
              <td style="text-align:right">{{ money(r.overhead) }}</td>
              <td style="text-align:right"><b>{{ money(r.total) }}</b></td>
              <td style="text-align:right">{{ money(r.unitCost) }}</td>
            </tr>
          } @empty { <tr><td colspan="9" style="text-align:center; padding:16px">Chưa có lệnh sản xuất.</td></tr> }
        </tbody>
      </table>
    </div>
  `,
})
export class AccountingProductionCostsComponent {
  private readonly svc = inject(AccountingService);
  readonly canAdd = inject(AuthService).can('accounting.manual');
  readonly rows = signal<ProductionCostRow[]>([]);
  readonly openOrders = computed(() => this.rows().filter((r) => r.status !== 'HOAN_TAT'));
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly notice = signal('');
  readonly failure = signal('');
  readonly money = formatVnd;
  form: ProductionCostInput = blankForm();

  constructor() { this.load(); }

  status(s: string) { return STATUS[s] ?? s; }

  async load() {
    try { this.rows.set(await this.svc.productionCosts()); } catch (e) { this.failure.set(e instanceof Error ? e.message : 'Lỗi tải'); }
  }

  async save() {
    this.failure.set(''); this.notice.set(''); this.saving.set(true);
    try {
      await this.svc.addProductionCost({ ...this.form, amount: Number(this.form.amount), description: this.form.description || undefined });
      this.notice.set('Đã nhập chi phí.'); this.showForm.set(false); this.form = blankForm();
      await this.load();
    } catch (e) { this.failure.set(e instanceof Error ? e.message : 'Không lưu được.'); }
    finally { this.saving.set(false); }
  }
}
