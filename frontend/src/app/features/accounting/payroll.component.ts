/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { Component, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService } from '../../core/services/accounting.service';
import { errorText } from '../../core/api/api.service';
import { PayrollParamsView, PayrollRunSummary, PayrollSheetView } from '../../core/models/domain.models';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { formatVnd } from '../../shared/format.util';
import { MoneyInputDirective } from '../../shared/money-input.directive';
import { MonthPickerComponent } from '../../shared/month-picker/month-picker.component';
import { isoDay } from '../../shared/period';
import { CENTER_LABEL } from './employees.component';

/** /ke-toan/luong — tính, chốt, huỷ bảng lương tháng; thiết lập tỷ lệ bảo hiểm, giảm trừ, biểu thuế. */
@Component({
  selector: 'app-accounting-payroll',
  standalone: true,
  imports: [FormsModule, NavIconComponent, DataTableComponent, MoneyInputDirective, MonthPickerComponent],
  template: `
    <div class="page-header">
      <div>
        <h1>Bảng lương</h1>
        <p class="subtitle">Tính bảo hiểm và thuế TNCN theo thiết lập. Chốt: Nợ 642/641/154 / Có 334, 3382–3385; rồi Nợ 334 / Có 3383–3385, 3335. Chi lương lập ở Thu, chi tiền, loại "Chi lương nhân viên".</p>
      </div>
    </div>

    <div class="filters-bar">
      <label class="filter-label" for="pl-period">Kỳ lương</label>
      <app-month-picker inputId="pl-period" ariaLabel="Kỳ lương" [(value)]="period" (valueChange)="load()" />
    </div>
    @if (notice()) {
      <div class="notice" role="status">
        <span>{{ notice() }}</span>
        <button type="button" class="notice-x" aria-label="Đóng thông báo" (click)="notice.set('')"><app-nav-icon name="x" /></button>
      </div>
    }
    @if (failure()) { <div class="notice is-error" role="alert"><span>{{ failure() }}</span></div> }

    @if (sheet(); as sh) {
      <section class="section-bare">
        <h3>Kỳ {{ sh.period }} — {{ sh.existing ? 'đã chốt' : 'xem trước (chưa chốt)' }}</h3>
        @if (sh.rows.length) {
          <dl class="list-totals">
            <div><dt>Tổng thu nhập</dt><dd class="num">{{ money(sh.totals.gross) }}</dd></div>
            <div><dt>Thuế TNCN</dt><dd class="num">{{ money(sh.totals.pit) }}</dd></div>
            <div><dt>Thực lĩnh</dt><dd class="num">{{ money(sh.totals.net) }}</dd></div>
            <div><dt>Doanh nghiệp đóng thêm</dt><dd class="num">{{ money(sh.totals.employerCost) }}</dd></div>
          </dl>
        }
        <div class="toolbar">
          @if (!sh.existing) {
            <button type="button" class="btn" [disabled]="busy()" (click)="load()"><app-nav-icon name="refresh" />Tính lại</button>
            <button type="button" class="btn btn-primary" [disabled]="busy() || !sh.rows.length" (click)="run()"><app-nav-icon name="check" />Chốt bảng lương</button>
          } @else {
            <button type="button" class="btn btn-danger-ghost" [disabled]="busy()" (click)="cancel()">Huỷ bảng lương để tính lại</button>
          }
        </div>
        <div class="rp-surface rp-grid">
          <table class="line-table book-table">
            <thead><tr>
              <th scope="col">Mã</th><th scope="col">Họ tên</th><th scope="col">Bộ phận</th>
              <th scope="col" class="r">Thưởng / phụ cấp tháng</th><th scope="col" class="r">Tổng thu nhập</th>
              <th scope="col" class="r">Bảo hiểm NLĐ</th><th scope="col" class="r">Thu nhập tính thuế</th><th scope="col" class="r">Thuế TNCN</th>
              <th scope="col" class="r">Thực lĩnh</th><th scope="col" class="r">DN đóng (BH + KPCĐ)</th>
            </tr></thead>
            <tbody>
              @for (r of sh.rows; track r.employeeId) {
                <tr>
                  <td class="code">{{ r.code }}</td><td>{{ r.name }}</td><td>{{ centerLabel(r.center) }}</td>
                  <td class="r">
                    @if (sh.existing) { <span class="num">{{ money(r.adjustment) }}</span> }
                    @else { <input type="text" appMoney class="num adj-cell" placeholder="0" [attr.aria-label]="'Thưởng, phụ cấp ' + r.name" [(ngModel)]="r.adjustment" /> }
                  </td>
                  <td class="r num">{{ money(r.gross) }}</td>
                  <td class="r num">{{ money(r.bhxhEe + r.bhytEe + r.bhtnEe) }}</td>
                  <td class="r num">{{ money(r.taxable) }}</td>
                  <td class="r num" [class.is-zero]="!r.pit">{{ r.pit ? money(r.pit) : '—' }}</td>
                  <td class="r num"><b>{{ money(r.net) }}</b></td>
                  <td class="r num">{{ money(r.bhxhEr + r.bhytEr + r.bhtnEr + r.kpcd) }}</td>
                </tr>
              } @empty { <tr><td class="book-none" colspan="10">Chưa có nhân viên đang làm việc.</td></tr> }
            </tbody>
            @if (sh.rows.length) {
              <tfoot><tr>
                <td colspan="4">TỔNG CỘNG</td>
                <td class="r num">{{ money(sh.totals.gross) }}</td>
                <td class="r num">{{ money(sh.totals.employeeInsurance) }}</td>
                <td></td>
                <td class="r num">{{ money(sh.totals.pit) }}</td>
                <td class="r num">{{ money(sh.totals.net) }}</td>
                <td class="r num">{{ money(sh.totals.employerCost) }}</td>
              </tr></tfoot>
            }
          </table>
        </div>
      </section>
    }

    <section class="section-bare">
      <h3>Các kỳ đã chốt</h3>
      <app-data-table [columns]="runColumns" [rows]="runs()" [actions]="runActions()" emptyTitle="Chưa chốt bảng lương nào" emptyHint="Chốt bảng lương của một kỳ để thấy ở đây." />
    </section>

    <section class="card section-block" aria-labelledby="pl-set">
      <div class="toolbar set-head">
        <h2 id="pl-set" class="form-section-title">Thiết lập lương</h2>
        <button type="button" class="btn" [attr.aria-expanded]="showSettings()" (click)="toggleSettings()">{{ showSettings() ? 'Thu gọn' : 'Xem / sửa' }}</button>
      </div>
      @if (showSettings() && settings(); as s) {
        <p class="hint">Mặc định theo quy định áp dụng nửa cuối 2026. Các mức này đổi theo năm, hãy đối chiếu với kế toán trưởng hoặc văn bản mới nhất trước khi chốt lương.</p>
        <div class="form-grid-3">
          <div class="field"><label for="ps-bhxh-e">BHXH người lao động (%)</label><input id="ps-bhxh-e" type="number" step="0.1" class="num" [(ngModel)]="s.bhxhEmployee" /></div>
          <div class="field"><label for="ps-bhyt-e">BHYT người lao động (%)</label><input id="ps-bhyt-e" type="number" step="0.1" class="num" [(ngModel)]="s.bhytEmployee" /></div>
          <div class="field"><label for="ps-bhtn-e">BHTN người lao động (%)</label><input id="ps-bhtn-e" type="number" step="0.1" class="num" [(ngModel)]="s.bhtnEmployee" /></div>
          <div class="field"><label for="ps-bhxh-r">BHXH doanh nghiệp (%)</label><input id="ps-bhxh-r" type="number" step="0.1" class="num" [(ngModel)]="s.bhxhEmployer" /></div>
          <div class="field"><label for="ps-bhyt-r">BHYT doanh nghiệp (%)</label><input id="ps-bhyt-r" type="number" step="0.1" class="num" [(ngModel)]="s.bhytEmployer" /></div>
          <div class="field"><label for="ps-bhtn-r">BHTN doanh nghiệp (%)</label><input id="ps-bhtn-r" type="number" step="0.1" class="num" [(ngModel)]="s.bhtnEmployer" /></div>
          <div class="field"><label for="ps-kpcd">KPCĐ (%)</label><input id="ps-kpcd" type="number" step="0.1" class="num" [(ngModel)]="s.kpcd" /></div>
          <div class="field"><label for="ps-cap1">Trần BHXH, BHYT</label><input id="ps-cap1" type="text" appMoney class="num money-field" [(ngModel)]="s.socialCap" /></div>
          <div class="field"><label for="ps-cap2">Trần BHTN</label><input id="ps-cap2" type="text" appMoney class="num money-field" [(ngModel)]="s.unemploymentCap" /></div>
          <div class="field"><label for="ps-self">Giảm trừ bản thân</label><input id="ps-self" type="text" appMoney class="num money-field" [(ngModel)]="s.personalDeduction" /></div>
          <div class="field"><label for="ps-dep">Giảm trừ mỗi người phụ thuộc</label><input id="ps-dep" type="text" appMoney class="num money-field" [(ngModel)]="s.dependentDeduction" /></div>
        </div>

        <h3 class="form-section-title">Biểu thuế TNCN luỹ tiến (theo thu nhập tính thuế tháng)</h3>
        <div class="rp-surface book-wrap">
          <table class="line-table book-table">
            <thead><tr><th scope="col" class="r">Đến mức (đồng)</th><th scope="col" class="r">Thuế suất (%)</th><th scope="col"><span class="visually-hidden">Xoá bậc</span></th></tr></thead>
            <tbody>
              @for (b of s.brackets; track $index; let i = $index) {
                <tr>
                  <td class="r"><input type="text" appMoney class="num money-field" [attr.aria-label]="'Đến mức bậc ' + (i + 1)" [(ngModel)]="b.upTo" [placeholder]="i === s.brackets.length - 1 ? 'Không giới hạn' : '0'" /></td>
                  <td class="r"><input type="number" step="0.5" class="num rate-cell" [attr.aria-label]="'Thuế suất bậc ' + (i + 1)" [(ngModel)]="b.rate" /></td>
                  <td><button type="button" class="icon-action" [attr.aria-label]="'Xoá bậc ' + (i + 1)" title="Xoá bậc" (click)="removeBracket(i)"><app-nav-icon name="trash" /></button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="toolbar">
          <button type="button" class="btn" (click)="addBracket()"><app-nav-icon name="plus" />Thêm bậc</button>
          <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="saveSettings()">Lưu thiết lập</button>
        </div>
      }
    </section>

    <ng-template #runActionsTpl let-r>
      <button type="button" class="btn row-act-btn" (click)="open(r.period)">Xem</button>
    </ng-template>
  `,
  styles: [`
    .filter-label { font-size: var(--text-sm); color: var(--color-muted); }
    .adj-cell { width: 9rem; text-align: right; }
    .rate-cell { width: 6rem; text-align: right; }
    .money-field { text-align: right; }
    .set-head { justify-content: space-between; align-items: center; }
    .set-head .form-section-title { margin: 0; }
  `],
})
export class AccountingPayrollComponent {
  private readonly svc = inject(AccountingService);
  private readonly confirmer = inject(ConfirmService);
  readonly sheet = signal<PayrollSheetView | null>(null);
  readonly runs = signal<PayrollRunSummary[]>([]);
  readonly settings = signal<PayrollParamsView | null>(null);
  readonly showSettings = signal(false);
  readonly busy = signal(false);
  readonly notice = signal('');
  readonly failure = signal('');
  readonly money = formatVnd;
  period = isoDay(new Date()).slice(0, 7);
  private readonly runActionsRef = viewChild<TemplateRef<{ $implicit: PayrollRunSummary }>>('runActionsTpl');
  readonly runActions = computed(() => this.runActionsRef());

  readonly runColumns: DataTableColumn<PayrollRunSummary>[] = [
    { key: 'period', label: 'Kỳ', mono: true },
    { key: 'employees', label: 'Nhân viên', align: 'right', format: (r) => String(r.employees) },
    { key: 'gross', label: 'Tổng thu nhập', align: 'right', format: (r) => formatVnd(r.gross) },
    { key: 'pit', label: 'Thuế TNCN', align: 'right', format: (r) => formatVnd(r.pit) },
    { key: 'net', label: 'Thực lĩnh', align: 'right', format: (r) => formatVnd(r.net) },
    { key: 'employerCost', label: 'DN đóng thêm', align: 'right', format: (r) => formatVnd(r.employerCost) },
  ];

  constructor() { this.load(); this.loadRuns(); }

  centerLabel(c: keyof typeof CENTER_LABEL) { return CENTER_LABEL[c]; }

  /** Kỳ đã chốt thì xem bảng đã lưu; chưa chốt thì tính xem trước (giữ số thưởng/phụ cấp đang nhập). */
  async load() {
    this.failure.set('');
    const keep = new Map((this.sheet()?.rows ?? []).map((r) => [r.employeeId, r.adjustment]));
    try {
      const pv = await this.svc.payrollPreview(this.period, [...keep].map(([employeeId, amount]) => ({ employeeId, amount: Number(amount) || 0 })));
      this.sheet.set(pv.existing ? await this.svc.payrollRunDetail(this.period) : pv);
    } catch (e) { this.failure.set(errorText(e)); }
  }

  async loadRuns() {
    try { this.runs.set(await this.svc.payrollRuns()); } catch { /* danh sách kỳ đã chốt không bắt buộc */ }
  }

  open(period: string) { this.period = period; this.sheet.set(null); this.load(); }

  async run() {
    const sh = this.sheet();
    if (!sh) return;
    this.failure.set(''); this.notice.set(''); this.busy.set(true);
    try {
      await this.svc.payrollRun(this.period, sh.rows.map((r) => ({ employeeId: r.employeeId, amount: Number(r.adjustment) || 0 })));
      this.notice.set(`Đã chốt bảng lương kỳ ${this.period}.`);
      this.sheet.set(null); await this.load(); await this.loadRuns();
    } catch (e) { this.failure.set(errorText(e)); }
    finally { this.busy.set(false); }
  }

  async cancel() {
    const ok = await this.confirmer.ask({ title: `Huỷ bảng lương kỳ ${this.period}?`, message: 'Các bút toán đã ghi sẽ được đảo lại. Sau đó có thể tính lại.', confirmLabel: 'Huỷ bảng lương', cancelLabel: 'Không huỷ', tone: 'danger' });
    if (!ok) return;
    this.failure.set(''); this.notice.set(''); this.busy.set(true);
    try {
      await this.svc.payrollCancel(this.period);
      this.notice.set(`Đã huỷ bảng lương kỳ ${this.period}. Có thể tính lại.`);
      this.sheet.set(null); await this.load(); await this.loadRuns();
    } catch (e) { this.failure.set(errorText(e)); }
    finally { this.busy.set(false); }
  }

  async toggleSettings() {
    if (this.showSettings()) { this.showSettings.set(false); return; }
    try { this.settings.set(await this.svc.payrollSettings()); this.showSettings.set(true); }
    catch (e) { this.failure.set(errorText(e)); }
  }

  addBracket() {
    const s = this.settings();
    if (s) this.settings.set({ ...s, brackets: [...s.brackets, { upTo: null, rate: 0 }] });
  }

  removeBracket(i: number) {
    const s = this.settings();
    if (s) this.settings.set({ ...s, brackets: s.brackets.filter((_, j) => j !== i) });
  }

  async saveSettings() {
    const s = this.settings();
    if (!s) return;
    this.failure.set(''); this.notice.set(''); this.busy.set(true);
    try {
      const brackets = s.brackets.map((b) => ({ upTo: b.upTo ? Number(b.upTo) : undefined, rate: Number(b.rate) || 0 }));
      this.settings.set(await this.svc.savePayrollSettings({ ...s, brackets }));
      this.notice.set('Đã lưu thiết lập lương. Áp dụng cho các bảng lương chốt từ bây giờ.');
      this.sheet.set(null); await this.load();
    } catch (e) { this.failure.set(errorText(e)); }
    finally { this.busy.set(false); }
  }
}
