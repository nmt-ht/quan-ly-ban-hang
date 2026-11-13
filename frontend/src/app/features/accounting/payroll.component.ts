import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService } from '../../core/services/accounting.service';
import { PayrollParamsView, PayrollRunSummary, PayrollSheetView } from '../../core/models/domain.models';
import { formatVnd } from '../../shared/format.util';
import { CENTER_LABEL } from './employees.component';

/** /ke-toan/luong — tính, chốt, huỷ bảng lương tháng; thiết lập tỷ lệ bảo hiểm, giảm trừ, biểu thuế. */
@Component({
  selector: 'app-accounting-payroll',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Bảng lương</h1>
        <p class="subtitle">Tính bảo hiểm và thuế TNCN theo thiết lập. Chốt: Nợ 642/641/154 / Có 334, 3382–3385; rồi Nợ 334 / Có 3383–3385, 3335. Chi lương lập ở Thu, chi tiền, loại "Chi lương nhân viên".</p>
      </div>
      <label>Kỳ lương<br><input type="month" [(ngModel)]="period" (change)="load()"></label>
    </div>
    @if (notice()) { <div class="notice" role="status">{{ notice() }}</div> }
    @if (failure()) { <div class="notice is-error" role="alert">{{ failure() }}</div> }

    <div class="card section-block" style="padding:16px; margin-bottom:12px">
      <div class="toolbar" style="justify-content:space-between; flex-wrap:wrap; gap:8px">
        <h3 class="form-section-title" style="margin:0">Thiết lập lương</h3>
        <button type="button" class="btn btn-sm" (click)="toggleSettings()">{{ showSettings() ? 'Thu gọn' : 'Xem / sửa' }}</button>
      </div>
      @if (showSettings() && settings(); as s) {
        <p class="subtitle">Mặc định theo quy định áp dụng nửa cuối 2026. Các mức này đổi theo năm, hãy đối chiếu với kế toán trưởng hoặc văn bản mới nhất trước khi chốt lương.</p>
        <div class="toolbar" style="gap:12px; flex-wrap:wrap; align-items:flex-end">
          <label>BHXH NLĐ (%)<br><input type="number" step="0.1" [(ngModel)]="s.bhxhEmployee" style="width:90px"></label>
          <label>BHYT NLĐ (%)<br><input type="number" step="0.1" [(ngModel)]="s.bhytEmployee" style="width:90px"></label>
          <label>BHTN NLĐ (%)<br><input type="number" step="0.1" [(ngModel)]="s.bhtnEmployee" style="width:90px"></label>
          <label>BHXH DN (%)<br><input type="number" step="0.1" [(ngModel)]="s.bhxhEmployer" style="width:90px"></label>
          <label>BHYT DN (%)<br><input type="number" step="0.1" [(ngModel)]="s.bhytEmployer" style="width:90px"></label>
          <label>BHTN DN (%)<br><input type="number" step="0.1" [(ngModel)]="s.bhtnEmployer" style="width:90px"></label>
          <label>KPCĐ (%)<br><input type="number" step="0.1" [(ngModel)]="s.kpcd" style="width:90px"></label>
        </div>
        <div class="toolbar" style="gap:12px; flex-wrap:wrap; align-items:flex-end; margin-top:8px">
          <label>Trần BHXH, BHYT<br><input type="number" [(ngModel)]="s.socialCap" style="width:150px; text-align:right"></label>
          <label>Trần BHTN<br><input type="number" [(ngModel)]="s.unemploymentCap" style="width:150px; text-align:right"></label>
          <label>Giảm trừ bản thân<br><input type="number" [(ngModel)]="s.personalDeduction" style="width:150px; text-align:right"></label>
          <label>Giảm trừ / người phụ thuộc<br><input type="number" [(ngModel)]="s.dependentDeduction" style="width:150px; text-align:right"></label>
        </div>
        <h4 style="margin:12px 0 4px">Biểu thuế TNCN luỹ tiến (theo thu nhập tính thuế tháng)</h4>
        <table style="border-collapse:collapse">
          <thead><tr><th style="text-align:left">Đến mức (đồng)</th><th style="text-align:left">Thuế suất (%)</th><th></th></tr></thead>
          <tbody>
            @for (b of s.brackets; track $index; let i = $index) {
              <tr>
                <td><input type="number" [(ngModel)]="b.upTo" [placeholder]="i === s.brackets.length - 1 ? 'Không giới hạn' : ''" style="width:170px; text-align:right"></td>
                <td><input type="number" step="0.5" [(ngModel)]="b.rate" style="width:90px"></td>
                <td><button type="button" class="btn btn-sm" (click)="removeBracket(i)">x</button></td>
              </tr>
            }
          </tbody>
        </table>
        <div class="toolbar" style="gap:8px; margin-top:8px">
          <button type="button" class="btn btn-sm" (click)="addBracket()">+ Thêm bậc</button>
          <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="saveSettings()">Lưu thiết lập</button>
        </div>
      }
    </div>

    @if (sheet(); as sh) {
      <div class="card" style="overflow-x:auto">
        <div class="toolbar" style="justify-content:space-between; padding:12px 12px 0; flex-wrap:wrap; gap:8px">
          <h3 class="form-section-title" style="margin:0">
            Kỳ {{ sh.period }} — {{ sh.existing ? 'đã chốt' : 'xem trước (chưa chốt)' }}
          </h3>
          <span style="display:flex; gap:8px">
            @if (!sh.existing) {
              <button type="button" class="btn" [disabled]="busy()" (click)="load()">Tính lại</button>
              <button type="button" class="btn btn-primary" [disabled]="busy() || !sh.rows.length" (click)="run()">Chốt bảng lương</button>
            } @else {
              <button type="button" class="btn" [disabled]="busy()" (click)="cancel()">Huỷ bảng lương để tính lại</button>
            }
          </span>
        </div>
        <table style="width:100%; border-collapse:collapse; margin-top:8px">
          <thead><tr>
            <th style="text-align:left">Mã</th><th style="text-align:left">Họ tên</th><th style="text-align:left">Bộ phận</th>
            <th style="text-align:right">Thưởng/PC tháng</th><th style="text-align:right">Tổng thu nhập</th>
            <th style="text-align:right">Bảo hiểm NLĐ</th><th style="text-align:right">Thu nhập tính thuế</th><th style="text-align:right">Thuế TNCN</th>
            <th style="text-align:right">Thực lĩnh</th><th style="text-align:right">DN đóng (BH + KPCĐ)</th>
          </tr></thead>
          <tbody>
            @for (r of sh.rows; track r.employeeId) {
              <tr>
                <td>{{ r.code }}</td><td>{{ r.name }}</td><td>{{ centerLabel(r.center) }}</td>
                <td style="text-align:right">
                  @if (sh.existing) { {{ money(r.adjustment) }} }
                  @else { <input type="number" [(ngModel)]="r.adjustment" style="width:120px; text-align:right"> }
                </td>
                <td style="text-align:right">{{ money(r.gross) }}</td>
                <td style="text-align:right">{{ money(r.bhxhEe + r.bhytEe + r.bhtnEe) }}</td>
                <td style="text-align:right">{{ money(r.taxable) }}</td>
                <td style="text-align:right">{{ money(r.pit) }}</td>
                <td style="text-align:right"><b>{{ money(r.net) }}</b></td>
                <td style="text-align:right">{{ money(r.bhxhEr + r.bhytEr + r.bhtnEr + r.kpcd) }}</td>
              </tr>
            } @empty { <tr><td colspan="10" style="text-align:center; padding:16px">Chưa có nhân viên đang làm việc.</td></tr> }
          </tbody>
          @if (sh.rows.length) {
            <tfoot><tr style="font-weight:700; border-top:2px solid var(--border, #ccc)">
              <td colspan="4">TỔNG CỘNG</td>
              <td style="text-align:right">{{ money(sh.totals.gross) }}</td>
              <td style="text-align:right">{{ money(sh.totals.employeeInsurance) }}</td>
              <td></td>
              <td style="text-align:right">{{ money(sh.totals.pit) }}</td>
              <td style="text-align:right">{{ money(sh.totals.net) }}</td>
              <td style="text-align:right">{{ money(sh.totals.employerCost) }}</td>
            </tr></tfoot>
          }
        </table>
      </div>
    }

    <div class="card" style="overflow-x:auto; margin-top:12px">
      <h3 class="form-section-title" style="padding:12px 12px 0">Các kỳ đã chốt</h3>
      <table style="width:100%; border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left">Kỳ</th><th style="text-align:right">Nhân viên</th><th style="text-align:right">Tổng thu nhập</th>
          <th style="text-align:right">Thuế TNCN</th><th style="text-align:right">Thực lĩnh</th><th style="text-align:right">DN đóng thêm</th><th></th>
        </tr></thead>
        <tbody>
          @for (r of runs(); track r.id) {
            <tr>
              <td>{{ r.period }}</td><td style="text-align:right">{{ r.employees }}</td>
              <td style="text-align:right">{{ money(r.gross) }}</td><td style="text-align:right">{{ money(r.pit) }}</td>
              <td style="text-align:right">{{ money(r.net) }}</td><td style="text-align:right">{{ money(r.employerCost) }}</td>
              <td style="text-align:right"><button type="button" class="btn btn-sm" (click)="open(r.period)">Xem</button></td>
            </tr>
          } @empty { <tr><td colspan="7" style="text-align:center; padding:16px">Chưa chốt bảng lương nào.</td></tr> }
        </tbody>
      </table>
    </div>
  `,
})
export class AccountingPayrollComponent {
  private readonly svc = inject(AccountingService);
  readonly sheet = signal<PayrollSheetView | null>(null);
  readonly runs = signal<PayrollRunSummary[]>([]);
  readonly settings = signal<PayrollParamsView | null>(null);
  readonly showSettings = signal(false);
  readonly busy = signal(false);
  readonly notice = signal('');
  readonly failure = signal('');
  readonly money = formatVnd;
  period = new Date().toISOString().slice(0, 7);

  constructor() { this.load(); this.loadRuns(); }

  centerLabel(c: keyof typeof CENTER_LABEL) { return CENTER_LABEL[c]; }

  /** Kỳ đã chốt thì xem bảng đã lưu; chưa chốt thì tính xem trước (giữ số thưởng/phụ cấp đang nhập). */
  async load() {
    this.failure.set('');
    const keep = new Map((this.sheet()?.rows ?? []).map((r) => [r.employeeId, r.adjustment]));
    try {
      const pv = await this.svc.payrollPreview(this.period, [...keep].map(([employeeId, amount]) => ({ employeeId, amount: Number(amount) || 0 })));
      this.sheet.set(pv.existing ? await this.svc.payrollRunDetail(this.period) : pv);
    } catch (e) { this.failure.set(e instanceof Error ? e.message : 'Lỗi tải'); }
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
    } catch (e) { this.failure.set(e instanceof Error ? e.message : 'Không chốt được.'); }
    finally { this.busy.set(false); }
  }

  async cancel() {
    if (!confirm(`Huỷ bảng lương kỳ ${this.period}? Các bút toán đã ghi sẽ được đảo lại.`)) return;
    this.failure.set(''); this.notice.set(''); this.busy.set(true);
    try {
      await this.svc.payrollCancel(this.period);
      this.notice.set(`Đã huỷ bảng lương kỳ ${this.period}. Có thể tính lại.`);
      this.sheet.set(null); await this.load(); await this.loadRuns();
    } catch (e) { this.failure.set(e instanceof Error ? e.message : 'Không huỷ được.'); }
    finally { this.busy.set(false); }
  }

  async toggleSettings() {
    if (this.showSettings()) { this.showSettings.set(false); return; }
    try { this.settings.set(await this.svc.payrollSettings()); this.showSettings.set(true); }
    catch (e) { this.failure.set(e instanceof Error ? e.message : 'Lỗi tải thiết lập'); }
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
    } catch (e) { this.failure.set(e instanceof Error ? e.message : 'Không lưu được.'); }
    finally { this.busy.set(false); }
  }
}
