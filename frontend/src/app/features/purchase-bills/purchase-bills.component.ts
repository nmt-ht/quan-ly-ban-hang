/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, errorText } from '../../core/api/api.service';
import { AuthService } from '../../core/services/auth.service';
import { DataStore } from '../../core/services/data-store.service';
import { PurchaseBillInput, PurchaseBillView } from '../../core/models/books-vat.models';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { foldVi, formatVnd } from '../../shared/format.util';
import { MoneyInputDirective } from '../../shared/money-input.directive';
import { formatDay, isoDay } from '../../shared/period';
import { SearchOption, SearchSelectComponent } from '../../shared/search-select/search-select.component';

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
  imports: [FormsModule, NavIconComponent, DataTableComponent, SearchSelectComponent, MoneyInputDirective],
  template: `
    <div class="page-header">
      <div>
        <h1>Hoá đơn mua hàng, dịch vụ</h1>
        <p class="subtitle">Khoản mua không nhập kho (điện, nước, vận chuyển, thuê ngoài…). Ghi chi phí, thuế GTGT đầu vào và công nợ phải trả nhà cung cấp.</p>
      </div>
      @if (canCreate() && !creating()) {
        <div class="toolbar">
          <button type="button" class="btn btn-primary" (click)="startCreate()"><app-nav-icon name="plus" />Lập hoá đơn mua</button>
        </div>
      }
    </div>

    @if (failure()) { <div class="notice is-error" role="alert"><span>{{ failure() }}</span></div> }
    @if (notice()) {
      <div class="notice" role="status">
        <span>{{ notice() }}</span>
        <button type="button" class="notice-x" aria-label="Đóng thông báo" (click)="notice.set('')"><app-nav-icon name="x" /></button>
      </div>
    }

    @if (creating()) {
      <section class="card section-block" aria-labelledby="hm-new">
        <h2 id="hm-new" class="form-section-title">Hoá đơn mua mới</h2>
        <div class="form-grid-3">
          <div class="field span-2">
            <label for="hm-supplier">Nhà cung cấp <span class="required-mark">*</span></label>
            <app-search-select inputId="hm-supplier" ariaLabel="Nhà cung cấp" [options]="supplierOptions()" [(value)]="supplierId" placeholder="Chọn nhà cung cấp…" />
          </div>
          <div class="field">
            <label for="hm-date">Ngày hạch toán <span class="required-mark">*</span></label>
            <input id="hm-date" type="date" [max]="today" [ngModel]="date()" (ngModelChange)="date.set($event)" />
          </div>
          <div class="field">
            <label for="hm-series">Ký hiệu hoá đơn</label>
            <input id="hm-series" type="text" class="num" maxlength="20" placeholder="C26TAA" [ngModel]="series()" (ngModelChange)="series.set($event)" />
          </div>
          <div class="field">
            <label for="hm-no">Số hoá đơn</label>
            <input id="hm-no" type="text" class="num" maxlength="30" [ngModel]="invoiceNo()" (ngModelChange)="invoiceNo.set($event)" />
          </div>
          <div class="field">
            <label for="hm-idate">Ngày hoá đơn</label>
            <input id="hm-idate" type="date" [max]="today" [ngModel]="invoiceDate()" (ngModelChange)="invoiceDate.set($event)" />
          </div>
          <div class="field span-3">
            <label for="hm-desc">Diễn giải</label>
            <input id="hm-desc" type="text" maxlength="300" placeholder="VD: Tiền điện tháng 11" [ngModel]="description()" (ngModelChange)="description.set($event)" />
          </div>
        </div>

        <div class="rp-surface book-wrap">
          <table class="line-table book-table">
            <thead><tr>
              <th scope="col">Tài khoản hạch toán</th><th scope="col">Nội dung</th>
              <th scope="col" class="r">Thành tiền (chưa thuế)</th><th scope="col" class="r">Thuế suất</th><th scope="col" class="r">Tiền thuế</th>
              <th scope="col"><span class="visually-hidden">Xoá dòng</span></th>
            </tr></thead>
            <tbody>
              @for (r of rows(); track $index; let i = $index) {
                <tr>
                  <td>
                    <select class="account-cell" [ngModel]="r.accountCode" (ngModelChange)="patch(i, { accountCode: $event })" [attr.aria-label]="'Tài khoản dòng ' + (i + 1)">
                      @for (a of accounts; track a.code) { <option [value]="a.code">{{ a.code }} — {{ a.name }}</option> }
                    </select>
                  </td>
                  <td><input type="text" maxlength="200" [ngModel]="r.description" (ngModelChange)="patch(i, { description: $event })" [attr.aria-label]="'Nội dung dòng ' + (i + 1)" /></td>
                  <td class="r"><input type="text" appMoney class="num money-cell" placeholder="0" [ngModel]="r.amount" (ngModelChange)="patch(i, { amount: $event })" [attr.aria-label]="'Thành tiền dòng ' + (i + 1)" /></td>
                  <td class="r">
                    <select [ngModel]="r.vatRate" (ngModelChange)="patch(i, { vatRate: +$event })" [attr.aria-label]="'Thuế suất dòng ' + (i + 1)">
                      @for (v of vatRates; track v) { <option [ngValue]="v">{{ v }}%</option> }
                    </select>
                  </td>
                  <td class="r num">{{ money(lineVat(r)) }}</td>
                  <td>@if (rows().length > 1) { <button type="button" class="icon-action" (click)="removeRow(i)" [attr.aria-label]="'Xoá dòng ' + (i + 1)" title="Xoá dòng"><app-nav-icon name="trash" /></button> }</td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr><td colspan="2">Cộng</td><td class="r num">{{ money(totals().taxable) }}</td><td></td><td class="r num">{{ money(totals().vat) }}</td><td></td></tr>
              <tr><td colspan="2">Tổng thanh toán (công nợ phải trả)</td><td class="r num" colspan="3">{{ money(totals().total) }}</td><td></td></tr>
            </tfoot>
          </table>
        </div>
        <button type="button" class="btn" (click)="addRow()"><app-nav-icon name="plus" />Thêm dòng</button>

        @if (attempted() && issue()) { <p class="hint text-danger" role="alert">{{ issue() }}</p> }
        <div class="toolbar">
          <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="save()">Lưu hoá đơn</button>
          <button type="button" class="btn" (click)="creating.set(false)">Bỏ qua</button>
        </div>
      </section>
    }

    @if (cancelRow(); as b) {
      <section class="card section-block" aria-labelledby="hm-cancel">
        <h2 id="hm-cancel" class="form-section-title">Huỷ hoá đơn {{ b.code }}</h2>
        <div class="field">
          <label for="hm-reason">Lý do huỷ</label>
          <input id="hm-reason" type="text" maxlength="300" [ngModel]="reason()" (ngModelChange)="reason.set($event)" />
          <span class="hint">Bút toán được đảo và công nợ phải trả nhà cung cấp tính lại.</span>
        </div>
        <div class="toolbar">
          <button type="button" class="btn btn-danger" [disabled]="busy()" (click)="cancel(b)">Xác nhận huỷ</button>
          <button type="button" class="btn" (click)="cancelling.set(null)">Bỏ qua</button>
        </div>
      </section>
    }

    <div class="filters-bar">
      <input type="search" class="filter-search" placeholder="Tìm số chứng từ, NCC, số hoá đơn…" aria-label="Tìm hoá đơn mua" [value]="search()" (input)="search.set($any($event.target).value)" />
      <button type="button" class="filter-toggle" [attr.aria-pressed]="noInvoiceOnly()" (click)="noInvoiceOnly.set(!noInvoiceOnly())">Chỉ chưa có hoá đơn NCC</button>
      <button type="button" class="filter-toggle" [attr.aria-pressed]="showCancelled()" (click)="showCancelled.set(!showCancelled())">Hiện hoá đơn đã huỷ</button>
    </div>

    @if (live().length) {
      <dl class="list-totals">
        <div><dt>Hoá đơn</dt><dd class="num">{{ live().length }}</dd></div>
        <div><dt>Thuế GTGT đầu vào</dt><dd class="num">{{ money(liveVat()) }}</dd></div>
        <div><dt>Tổng công nợ phát sinh</dt><dd class="num">{{ money(liveTotal()) }}</dd></div>
      </dl>
    }

    <app-data-table
      [columns]="columns" [rows]="visible()" [actions]="rowActions()" emptyTitle="Chưa có hoá đơn mua hàng, dịch vụ"
      [emptyHint]="bills().length ? 'Không có hoá đơn nào khớp bộ lọc.' : 'Lập hoá đơn cho điện, nước, vận chuyển, thuê ngoài… để ghi chi phí và thuế đầu vào.'" />

    <ng-template #rowActionsTpl let-b>
      @if (!b.isCancelled && canCancel()) {
        <button type="button" class="btn row-act-btn btn-danger-ghost" (click)="cancelling.set(b.id); reason.set('')">Huỷ</button>
      }
    </ng-template>
  `,
  styles: [`.money-cell { width: 8.5rem; text-align: right; } .account-cell { min-width: 12rem; width: 100%; }`],
})
export class PurchaseBillsComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly store = inject(DataStore);
  readonly money = formatVnd;
  readonly accounts = EXPENSE_ACCOUNTS;
  readonly vatRates = VAT_RATES;
  readonly today = isoDay(new Date());
  private readonly rowActionsRef = viewChild<TemplateRef<{ $implicit: PurchaseBillView }>>('rowActionsTpl');
  readonly rowActions = computed(() => this.rowActionsRef());

  readonly columns: DataTableColumn<PurchaseBillView>[] = [
    { key: 'code', label: 'Số chứng từ', copy: true },
    { key: 'date', label: 'Ngày', format: (b) => formatDay(b.date), mono: true },
    { key: 'supplier', label: 'Nhà cung cấp', format: (b) => `${b.supplierCode} — ${b.supplierName}` },
    { key: 'invoice', label: 'Hoá đơn NCC', format: (b) => (b.invoiceNo ? `${b.invoiceSeries ?? ''} ${b.invoiceNo}`.trim() : 'Chưa có hoá đơn'), mono: true },
    { key: 'description', label: 'Diễn giải', format: (b) => b.description ?? '' },
    { key: 'taxable', label: 'Chưa thuế', align: 'right', format: (b) => formatVnd(b.taxable) },
    { key: 'vat', label: 'Thuế GTGT', align: 'right', format: (b) => formatVnd(b.vat) },
    { key: 'total', label: 'Tổng cộng', align: 'right', format: (b) => formatVnd(b.total) },
    { key: 'status', label: 'Trạng thái', format: (b) => (b.isCancelled ? 'Đã huỷ' : 'Đã ghi'), badge: (b) => (b.isCancelled ? 'badge-muted' : 'badge-success') },
  ];

  readonly bills = signal<PurchaseBillView[]>([]);
  readonly failure = signal('');
  readonly notice = signal('');
  readonly busy = signal(false);
  readonly creating = signal(false);
  readonly attempted = signal(false);
  readonly search = signal('');
  readonly noInvoiceOnly = signal(false);
  readonly showCancelled = signal(false);
  readonly cancelling = signal<string | null>(null);
  readonly cancelRow = computed(() => this.bills().find((b) => b.id === this.cancelling()) ?? null);
  readonly reason = signal('');
  readonly canCreate = computed(() => this.auth.can('purchase.create'));
  readonly canCancel = computed(() => this.auth.can('purchase.cancel'));
  readonly supplierOptions = computed<SearchOption[]>(() =>
    this.store.suppliers().filter((s) => s.isActive !== false).sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true }))
      .map((s) => ({ value: s.id, code: s.code, label: s.name, search: s.taxCode ?? undefined })),
  );

  readonly live = computed(() => this.bills().filter((b) => !b.isCancelled));
  readonly liveVat = computed(() => this.live().reduce((s, b) => s + b.vat, 0));
  readonly liveTotal = computed(() => this.live().reduce((s, b) => s + b.total, 0));
  readonly visible = computed(() => {
    const q = foldVi(this.search().trim());
    return this.bills().filter((b) =>
      (this.showCancelled() || !b.isCancelled)
      && (!this.noInvoiceOnly() || !b.invoiceNo)
      && (!q || foldVi(`${b.code} ${b.supplierCode} ${b.supplierName} ${b.invoiceSeries ?? ''} ${b.invoiceNo ?? ''} ${b.description ?? ''}`).includes(q)));
  });

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
    this.attempted.set(false);
    this.cancelling.set(null);
    this.creating.set(true);
  }

  patch(i: number, change: Partial<Row>) {
    this.rows.update((rs) => rs.map((r, j) => (j === i ? { ...r, ...change } : r)));
  }

  addRow() { this.rows.update((rs) => [...rs, blankRow()]); }
  removeRow(i: number) { this.rows.update((rs) => rs.filter((_, j) => j !== i)); }

  async save() {
    this.attempted.set(true);
    if (this.issue() || this.busy()) return;
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
