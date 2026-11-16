/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService, ProductionCostInput } from '../../core/services/accounting.service';
import { AuthService } from '../../core/services/auth.service';
import { errorText } from '../../core/api/api.service';
import { ProductionCostRow } from '../../core/models/domain.models';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { formatVnd } from '../../shared/format.util';
import { MoneyInputDirective } from '../../shared/money-input.directive';
import { isoDay } from '../../shared/period';

const STATUS: Record<string, string> = { NHAP: 'Nháp', DANG_SAN_XUAT: 'Đang sản xuất', HOAN_TAT: 'Đã nghiệm thu' };
const STATUS_BADGE: Record<string, string> = { NHAP: 'badge-muted', DANG_SAN_XUAT: 'badge-warning', HOAN_TAT: 'badge-success' };

function blankForm(): ProductionCostInput {
  return { orderId: '', kind: 'NHAN_CONG', amount: 0, date: isoDay(new Date()), creditAccount: '334', description: '' };
}

/** /ke-toan/gia-thanh — giá thành sản xuất từng lệnh (vật tư + nhân công + sản xuất chung, TK 154). */
@Component({
  selector: 'app-accounting-production-costs',
  standalone: true,
  imports: [FormsModule, NavIconComponent, DataTableComponent, MoneyInputDirective],
  template: `
    <div class="page-header">
      <div>
        <h1>Giá thành sản xuất</h1>
        <p class="subtitle">Vật tư lấy từ phiếu xuất kho của lệnh. Nhân công và sản xuất chung nhập thêm ở đây (Nợ 154), rồi cộng vào giá thành khi nghiệm thu (Nợ 155 / Có 154).</p>
      </div>
      @if (canAdd) {
        <div class="toolbar">
          <button type="button" class="btn btn-primary" (click)="showForm.set(!showForm())"><app-nav-icon [name]="showForm() ? 'x' : 'plus'" />{{ showForm() ? 'Đóng' : 'Nhập chi phí' }}</button>
        </div>
      }
    </div>
    @if (notice()) {
      <div class="notice" role="status">
        <span>{{ notice() }}</span>
        <button type="button" class="notice-x" aria-label="Đóng thông báo" (click)="notice.set('')"><app-nav-icon name="x" /></button>
      </div>
    }
    @if (failure()) { <div class="notice is-error" role="alert"><span>{{ failure() }}</span></div> }

    @if (showForm() && canAdd) {
      <section class="card section-block" aria-labelledby="gt-form">
        <h2 id="gt-form" class="form-section-title">Nhập chi phí cho lệnh sản xuất</h2>
        <div class="form-grid-3">
          <div class="field span-2">
            <label for="gt-order">Lệnh sản xuất <span class="required-mark">*</span></label>
            <select id="gt-order" [(ngModel)]="form.orderId">
              <option value="">Chọn lệnh…</option>
              @for (o of openOrders(); track o.id) { <option [value]="o.id">{{ o.code }} — {{ o.productName }} ({{ status(o.status) }})</option> }
            </select>
          </div>
          <div class="field">
            <label for="gt-kind">Loại chi phí</label>
            <select id="gt-kind" [(ngModel)]="form.kind">
              <option value="NHAN_CONG">Nhân công trực tiếp</option>
              <option value="SAN_XUAT_CHUNG">Sản xuất chung</option>
            </select>
          </div>
          <div class="field">
            <label for="gt-amount">Số tiền <span class="required-mark">*</span></label>
            <input id="gt-amount" type="text" appMoney class="num money-field" placeholder="0" [(ngModel)]="form.amount" />
          </div>
          <div class="field">
            <label for="gt-date">Ngày</label>
            <input id="gt-date" type="date" [(ngModel)]="form.date" />
          </div>
          <div class="field">
            <label for="gt-credit">TK đối ứng (Có)</label>
            <select id="gt-credit" [(ngModel)]="form.creditAccount">
              <option value="334">334 — Phải trả người lao động</option>
              <option value="111">111 — Tiền mặt</option>
              <option value="112">112 — Tiền gửi NH</option>
              <option value="331">331 — Phải trả người bán</option>
              <option value="214">214 — Hao mòn TSCĐ</option>
              <option value="242">242 — Chi phí trả trước</option>
            </select>
          </div>
          <div class="field span-3">
            <label for="gt-desc">Diễn giải</label>
            <input id="gt-desc" type="text" maxlength="300" [(ngModel)]="form.description" />
          </div>
        </div>
        <div class="toolbar">
          <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="save()">Lưu</button>
          <button type="button" class="btn" (click)="showForm.set(false)">Bỏ qua</button>
        </div>
      </section>
    }

    @if (rows().length) {
      <dl class="list-totals">
        <div><dt>Lệnh sản xuất</dt><dd class="num">{{ rows().length }}</dd></div>
        <div><dt>Tổng giá thành</dt><dd class="num">{{ money(totalCost()) }}</dd></div>
      </dl>
    }

    <app-data-table [columns]="columns" [rows]="rows()" emptyTitle="Chưa có lệnh sản xuất" emptyHint="Lệnh sản xuất lập ở phân hệ Kho." />
  `,
  styles: [`.money-field { text-align: right; }`],
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

  readonly columns: DataTableColumn<ProductionCostRow>[] = [
    { key: 'code', label: 'Lệnh', copy: true },
    { key: 'product', label: 'Thành phẩm', format: (r) => `${r.productCode} — ${r.productName}` },
    { key: 'status', label: 'Trạng thái', format: (r) => this.status(r.status), badge: (r) => STATUS_BADGE[r.status] ?? 'badge-muted' },
    { key: 'qty', label: 'SL', align: 'right', format: (r) => String(r.produced ?? r.quantity) },
    { key: 'material', label: 'Vật tư', align: 'right', format: (r) => formatVnd(r.material) },
    { key: 'labor', label: 'Nhân công', align: 'right', format: (r) => formatVnd(r.labor) },
    { key: 'overhead', label: 'SX chung', align: 'right', format: (r) => formatVnd(r.overhead) },
    { key: 'total', label: 'Tổng giá thành', align: 'right', format: (r) => formatVnd(r.total) },
    { key: 'unitCost', label: 'Giá thành / đơn vị', align: 'right', format: (r) => formatVnd(r.unitCost) },
  ];

  constructor() { this.load(); }

  status(s: string) { return STATUS[s] ?? s; }
  totalCost(): number { return this.rows().reduce((s, r) => s + r.total, 0); }

  async load() {
    try { this.rows.set(await this.svc.productionCosts()); } catch (e) { this.failure.set(errorText(e)); }
  }

  async save() {
    this.failure.set(''); this.notice.set(''); this.saving.set(true);
    try {
      await this.svc.addProductionCost({ ...this.form, amount: Number(this.form.amount), description: this.form.description || undefined });
      this.notice.set('Đã nhập chi phí.'); this.showForm.set(false); this.form = blankForm();
      await this.load();
    } catch (e) { this.failure.set(errorText(e)); }
    finally { this.saving.set(false); }
  }
}
