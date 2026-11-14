import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, errorText } from '../../core/api/api.service';
import { AuthService } from '../../core/services/auth.service';
import { DataStore } from '../../core/services/data-store.service';
import { PurchaseBillInput, PurchaseBillView } from '../../core/models/books-vat.models';
import { formatVnd } from '../../shared/format.util';
import { formatDay, isoDay } from '../../shared/period';

/** TK dùng được trên hoá đơn không qua kho (khớp BILL_ACCOUNTS ở server): hàng tồn kho đi qua phiếu nhập kho. */
const EXPENSE_ACCOUNTS = [
  { code: '642', name: 'Chi phí quản lý kinh doanh' },
  { code: '641', name: 'Chi phí bán hàng' },
  { code: '635', name: 'Chi phí tài chính' },
  { code: '811', name: 'Chi phí khác' },
  { code: '242', name: 'Chi phí trả trước' },
];
const VAT_RATES = [0, 5, 8, 10];

interface Row { accountCode: string; description: string; amount: number | null; vatRate: number }
const blankRow = (): Row => ({ accountCode: '642', description: '', amount: null, vatRate: 10 });

/**
 * /hoa-don-mua — hoá đơn mua hàng / dịch vụ KHÔNG qua kho (điện, nước, vận chuyển, thuê ngoài…): ghi nhận chi phí và thuế GTGT
 * đầu vào, tạo công nợ phải trả nhà cung cấp (trả bằng phiếu chi như lần nhận hàng).
 */
@Component({
  selector: 'app-purchase-bills',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Hoá đơn mua hàng, dịch vụ</h1>
        <p class="subtitle">Khoản mua không nhập kho (điện, nước, vận chuyển, thuê ngoài…). Ghi chi phí, thuế GTGT đầu vào và công nợ phải trả nhà cung cấp.</p>
      </div>
      @if (canCreate() && !creating()) { <button type="button" class="btn btn-primary" (click)="startCreate()">Lập hoá đơn mua</button> }
    </div>

    @if (failure()) { <div class="notice is-error" role="alert">{{ failure() }}</div> }
    @if (notice()) { <div class="notice" role="status">{{ notice() }}</div> }

    @if (creating()) {
      <div class="card" style="margin-bottom:16px">
        <h2 style="margin-top:0">Hoá đơn mua mới</h2>
        <div class="toolbar" style="flex-wrap:wrap; gap:8px">
          <label>Nhà cung cấp <span class="required-mark">*</span>
            <select [ngModel]="supplierId()" (ngModelChange)="supplierId.set($event)">
              <option value="">— Chọn —</option>
              @for (s of suppliers(); track s.id) { <option [value]="s.id">{{ s.code }} — {{ s.name }}</option> }
            </select>
          </label>
          <label>Ngày hạch toán <span class="required-mark">*</span> <input type="date" [ngModel]="date()" (ngModelChange)="date.set($event)"></label>
          <label>Ký hiệu hoá đơn <input type="text" maxlength="20" placeholder="C26TAA" [ngModel]="series()" (ngModelChange)="series.set($event)" style="width:110px"></label>
          <label>Số hoá đơn <input type="text" maxlength="30" [ngModel]="invoiceNo()" (ngModelChange)="invoiceNo.set($event)" style="width:130px"></label>
          <label>Ngày hoá đơn <input type="date" [ngModel]="invoiceDate()" (ngModelChange)="invoiceDate.set($event)"></label>
        </div>
        <label style="display:block; margin:8px 0">Diễn giải
          <input type="text" maxlength="300" placeholder="VD: Tiền điện tháng 11" [ngModel]="description()" (ngModelChange)="description.set($event)" style="width:100%">
        </label>

        <table style="width:100%; border-collapse:collapse">
          <thead><tr>
            <th style="text-align:left">Tài khoản hạch toán</th><th style="text-align:left">Nội dung</th>
            <th style="text-align:right">Thành tiền (chưa thuế)</th><th style="text-align:right">Thuế suất</th><th style="text-align:right">Tiền thuế</th><th></th>
          </tr></thead>
          <tbody>
            @for (r of rows(); track $index; let i = $index) {
              <tr>
                <td>
                  <select [ngModel]="r.accountCode" (ngModelChange)="patch(i, { accountCode: $event })" [attr.aria-label]="'Tài khoản dòng ' + (i + 1)">
                    @for (a of accounts; track a.code) { <option [value]="a.code">{{ a.code }} — {{ a.name }}</option> }
                  </select>
                </td>
                <td><input type="text" maxlength="200" [ngModel]="r.description" (ngModelChange)="patch(i, { description: $event })" style="width:100%" [attr.aria-label]="'Nội dung dòng ' + (i + 1)"></td>
                <td style="text-align:right"><input type="number" min="0" step="1" [ngModel]="r.amount" (ngModelChange)="patch(i, { amount: $event })" style="width:150px; text-align:right" [attr.aria-label]="'Thành tiền dòng ' + (i + 1)"></td>
                <td style="text-align:right">
                  <select [ngModel]="r.vatRate" (ngModelChange)="patch(i, { vatRate: +$event })" [attr.aria-label]="'Thuế suất dòng ' + (i + 1)">
                    @for (v of vatRates; track v) { <option [ngValue]="v">{{ v }}%</option> }
                  </select>
                </td>
                <td style="text-align:right">{{ money(lineVat(r)) }}</td>
                <td>@if (rows().length > 1) { <button type="button" class="btn btn-sm" (click)="removeRow(i)" [attr.aria-label]="'Xoá dòng ' + (i + 1)">Xoá</button> }</td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr style="font-weight:600"><td colspan="2"><button type="button" class="btn btn-sm" (click)="addRow()">+ Thêm dòng</button></td>
              <td style="text-align:right">{{ money(totals().taxable) }}</td><td></td><td style="text-align:right">{{ money(totals().vat) }}</td><td></td></tr>
            <tr style="font-weight:700"><td colspan="2">Tổng thanh toán (công nợ phải trả)</td><td colspan="3" style="text-align:right">{{ money(totals().total) }}</td><td></td></tr>
          </tfoot>
        </table>

        @if (issue()) { <p class="text-danger" role="alert" style="margin:8px 0 0">{{ issue() }}</p> }
        <div class="toolbar" style="margin-top:12px">
          <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="save()">Lưu hoá đơn</button>
          <button type="button" class="btn" (click)="creating.set(false)">Bỏ qua</button>
        </div>
      </div>
    }

    <div class="card" style="overflow-x:auto">
      <table style="width:100%; border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left">Số chứng từ</th><th style="text-align:left">Ngày</th><th style="text-align:left">Nhà cung cấp</th><th style="text-align:left">Hoá đơn NCC</th><th style="text-align:left">Diễn giải</th>
          <th style="text-align:right">Chưa thuế</th><th style="text-align:right">Thuế GTGT</th><th style="text-align:right">Tổng cộng</th><th style="text-align:left">Trạng thái</th><th></th>
        </tr></thead>
        <tbody>
          @for (b of bills(); track b.id) {
            <tr [style.opacity]="b.isCancelled ? 0.55 : 1">
              <td>{{ b.code }}</td><td>{{ formatDay(b.date) }}</td><td>{{ b.supplierCode }} — {{ b.supplierName }}</td>
              <td>@if (b.invoiceNo) { {{ b.invoiceSeries }} {{ b.invoiceNo }} } @else { <span class="badge badge-warning">Chưa có hoá đơn</span> }</td>
              <td>{{ b.description }}</td>
              <td style="text-align:right">{{ money(b.taxable) }}</td><td style="text-align:right">{{ money(b.vat) }}</td><td style="text-align:right">{{ money(b.total) }}</td>
              <td>@if (b.isCancelled) { <span class="badge badge-muted" [title]="b.cancelReason || ''">Đã huỷ</span> } @else { <span class="badge badge-success">Đã ghi</span> }</td>
              <td>
                @if (!b.isCancelled && canCancel()) {
                  @if (cancelling() === b.id) {
                    <input type="text" placeholder="Lý do huỷ" maxlength="300" [ngModel]="reason()" (ngModelChange)="reason.set($event)" style="width:160px" aria-label="Lý do huỷ">
                    <button type="button" class="btn btn-sm btn-danger-ghost" [disabled]="busy()" (click)="cancel(b)">Xác nhận huỷ</button>
                    <button type="button" class="btn btn-sm" (click)="cancelling.set(null)">Bỏ qua</button>
                  } @else {
                    <button type="button" class="btn btn-sm btn-danger-ghost" (click)="cancelling.set(b.id); reason.set('')">Huỷ</button>
                  }
                }
              </td>
            </tr>
          } @empty {
            <tr><td colspan="10" style="text-align:center; padding:16px">Chưa có hoá đơn mua hàng, dịch vụ nào.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class PurchaseBillsComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly store = inject(DataStore);
  readonly money = formatVnd;
  readonly formatDay = formatDay;
  readonly accounts = EXPENSE_ACCOUNTS;
  readonly vatRates = VAT_RATES;

  readonly bills = signal<PurchaseBillView[]>([]);
  readonly failure = signal('');
  readonly notice = signal('');
  readonly busy = signal(false);
  readonly creating = signal(false);
  readonly cancelling = signal<string | null>(null);
  readonly reason = signal('');
  readonly canCreate = computed(() => this.auth.can('purchase.create'));
  readonly canCancel = computed(() => this.auth.can('purchase.cancel'));
  readonly suppliers = computed(() => this.store.suppliers().filter((s) => s.isActive !== false));

  readonly supplierId = signal('');
  readonly date = signal(isoDay(new Date()));
  readonly series = signal('');
  readonly invoiceNo = signal('');
  readonly invoiceDate = signal('');
  readonly description = signal('');
  readonly rows = signal<Row[]>([blankRow()]);

  readonly lineVat = (r: Row) => Math.round((Math.round(r.amount ?? 0) * r.vatRate) / 100);
  readonly totals = computed(() => {
    const taxable = this.rows().reduce((s, r) => s + Math.round(r.amount ?? 0), 0);
    const vat = this.rows().reduce((s, r) => s + this.lineVat(r), 0);
    return { taxable, vat, total: taxable + vat };
  });
  readonly issue = computed(() => {
    if (!this.supplierId()) return 'Chọn nhà cung cấp.';
    if (!this.date()) return 'Chọn ngày hạch toán.';
    if (this.date() > isoDay(new Date())) return 'Ngày hạch toán không được sau hôm nay.';
    if ((this.series().trim() || this.invoiceDate()) && !this.invoiceNo().trim()) return 'Nhập số hoá đơn NCC (hoặc xoá ký hiệu và ngày hoá đơn).';
    if (this.invoiceDate() && this.invoiceDate() > isoDay(new Date())) return 'Ngày hoá đơn không được sau hôm nay.';
    const bad = this.rows().findIndex((r) => !r.description.trim() || !(r.amount && r.amount > 0));
    if (bad >= 0) return `Dòng ${bad + 1}: nhập nội dung và thành tiền lớn hơn 0.`;
    return '';
  });

  constructor() { this.load(); }

  async load() {
    try {
      this.bills.set(await this.api.get<PurchaseBillView[]>('/purchase-bills'));
    } catch (e) {
      this.failure.set(errorText(e));
    }
  }

  startCreate() {
    this.supplierId.set(''); this.date.set(isoDay(new Date())); this.series.set(''); this.invoiceNo.set(''); this.invoiceDate.set(''); this.description.set('');
    this.rows.set([blankRow()]);
    this.failure.set('');
    this.creating.set(true);
  }

  patch(i: number, change: Partial<Row>) {
    this.rows.update((rs) => rs.map((r, j) => (j === i ? { ...r, ...change } : r)));
  }

  addRow() { this.rows.update((rs) => [...rs, blankRow()]); }
  removeRow(i: number) { this.rows.update((rs) => rs.filter((_, j) => j !== i)); }

  async save() {
    if (this.issue() || this.busy()) { this.failure.set(this.issue()); return; }
    const body: PurchaseBillInput = {
      supplierId: this.supplierId(), date: this.date(), description: this.description().trim() || undefined,
      invoiceSeries: this.series().trim() || undefined, invoiceNo: this.invoiceNo().trim() || undefined, invoiceDate: this.invoiceDate() || undefined,
      lines: this.rows().map((r) => ({ accountCode: r.accountCode, description: r.description.trim(), amount: Math.round(r.amount ?? 0), vatRate: r.vatRate })),
    };
    this.busy.set(true);
    this.failure.set('');
    try {
      const b = await this.api.post<PurchaseBillView>('/purchase-bills', body);
      this.creating.set(false);
      this.notice.set(`Đã ghi hoá đơn ${b.code}: ${formatVnd(b.total)} (thuế ${formatVnd(b.vat)}) — công nợ phải trả nhà cung cấp tăng.`);
      await this.load();
    } catch (e) {
      this.failure.set(errorText(e));
    } finally {
      this.busy.set(false);
    }
  }

  async cancel(b: PurchaseBillView) {
    this.busy.set(true);
    this.failure.set('');
    try {
      await this.api.post<PurchaseBillView>(`/purchase-bills/${b.id}/cancel`, { reason: this.reason().trim() || undefined });
      this.cancelling.set(null);
      this.notice.set(`Đã huỷ hoá đơn ${b.code}; bút toán được đảo và công nợ phải trả tính lại.`);
      await this.load();
    } catch (e) {
      this.failure.set(errorText(e));
    } finally {
      this.busy.set(false);
    }
  }
}
