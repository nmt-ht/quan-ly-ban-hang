import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorText } from '../../core/api/api.service';
import { CashFlowView } from '../../core/models/cash-ops.models';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { formatVnd } from '../../shared/format.util';
import { formatDay } from '../../shared/period';
import { CashOpsService } from '../cash-ops/cash-ops.service';

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (year: number, month: number) => new Date(year, month, 0).getDate();
const SECTIONS: { title: string; codes: string[]; total: string }[] = [
  { title: 'I. Lưu chuyển tiền từ hoạt động kinh doanh', codes: ['01', '02', '03', '04', '05', '06', '07'], total: '20' },
  { title: 'II. Lưu chuyển tiền từ hoạt động đầu tư', codes: ['21', '22', '23', '24', '25'], total: '30' },
  { title: 'III. Lưu chuyển tiền từ hoạt động tài chính', codes: ['31', '32', '33', '34', '35'], total: '40' },
];

/**
 * /ke-toan/luu-chuyen-tien-te — báo cáo lưu chuyển tiền tệ theo phương pháp trực tiếp (mẫu B03-DNN), lập từ sổ cái: các bút toán có tiền
 * (111, 112, 113) được xếp theo tài khoản đối ứng. Chuyển tiền nội bộ không xuất hiện.
 */
@Component({
  selector: 'app-accounting-cash-flow',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Báo cáo lưu chuyển tiền tệ</h1>
        <p class="subtitle">Phương pháp trực tiếp (B03-DNN). Phân loại theo tài khoản đối ứng của bút toán tiền — cách xếp từng tài khoản vào chỉ tiêu nên được kế toán trưởng xác nhận.</p>
      </div>
      <button type="button" class="btn" [disabled]="!data()" (click)="exportExcel()">Xuất Excel</button>
    </div>

    <div class="toolbar" style="flex-wrap:wrap; gap:8px; margin-bottom:12px">
      <label>Kỳ báo cáo
        <select [ngModel]="kind()" (ngModelChange)="kind.set($event); n.set(1); load()">
          <option value="nam">Cả năm</option><option value="quy">Quý</option><option value="thang">Tháng</option>
        </select>
      </label>
      @if (kind() !== 'nam') {
        <label>{{ kind() === 'thang' ? 'Tháng' : 'Quý' }}
          <select [ngModel]="n()" (ngModelChange)="n.set(+$event); load()">
            @for (i of options(); track i) { <option [value]="i">{{ i }}</option> }
          </select>
        </label>
      }
      <label>Năm <input type="number" [ngModel]="year()" (ngModelChange)="year.set(+$event)" (change)="load()" style="width:90px"></label>
      <span class="subtitle">{{ formatDay(range().from) }} – {{ formatDay(range().to) }}</span>
    </div>
    @if (failure()) { <div class="notice is-error" role="alert">{{ failure() }}</div> }

    @if (data(); as d) {
      @if (d.check.difference !== 0) {
        <div class="notice is-error" role="alert">Tiền cuối kỳ theo báo cáo lệch {{ money(d.check.difference) }} so với số dư tiền trên sổ cái ({{ money(d.check.ledgerClosing) }}). Kiểm tra bút toán tiền.</div>
      }
      <div class="card" style="overflow-x:auto">
        <table style="width:100%; border-collapse:collapse">
          <thead><tr><th style="text-align:left">Chỉ tiêu</th><th style="text-align:left; width:60px">Mã số</th><th style="text-align:right">Số tiền</th></tr></thead>
          <tbody>
            @for (s of sections; track s.title) {
              <tr><td colspan="3" style="font-weight:700; padding-top:12px">{{ s.title }}</td></tr>
              @for (c of s.codes; track c) {
                @if (item(c); as it) {
                  <tr [title]="detailText(it)">
                    <td style="padding-left:16px">{{ it.label }}</td><td>{{ it.code }}</td><td style="text-align:right">{{ money(it.amount) }}</td>
                  </tr>
                }
              }
              @if (item(s.total); as t) {
                <tr style="font-weight:700"><td>{{ t.label }}</td><td>{{ t.code }}</td><td style="text-align:right">{{ money(t.amount) }}</td></tr>
              }
            }
            <tr><td colspan="3" style="padding-top:12px"></td></tr>
            @for (c of ['50', '60', '61', '70']; track c) {
              @if (item(c); as it) {
                <tr style="font-weight:700"><td>{{ it.label }}</td><td>{{ it.code }}</td><td style="text-align:right">{{ money(it.amount) }}</td></tr>
              }
            }
          </tbody>
        </table>
      </div>
      <p class="subtitle" style="margin-top:8px">Rê chuột vào một chỉ tiêu để xem các tài khoản đối ứng tạo nên số đó. Số âm là tiền chi ra. Thuế GTGT, bảo hiểm và thuế TNCN nộp ghi vào "chi khác" (07). Tiền đầu kỳ = số dư đầu năm đã nhập + biến động từ đầu năm; ảnh hưởng tỷ giá (61) chưa tính.</p>
    } @else if (!failure()) {
      <div class="card" style="padding:16px">Đang tải…</div>
    }
  `,
})
export class AccountingCashFlowComponent {
  private readonly svc = inject(CashOpsService);
  readonly money = formatVnd;
  readonly formatDay = formatDay;
  readonly sections = SECTIONS;

  readonly kind = signal<'nam' | 'quy' | 'thang'>('nam');
  readonly year = signal(new Date().getFullYear());
  readonly n = signal(1);
  readonly options = computed(() => (this.kind() === 'thang' ? Array.from({ length: 12 }, (_, i) => i + 1) : [1, 2, 3, 4]));
  readonly range = computed(() => {
    const y = this.year();
    if (this.kind() === 'nam') return { from: `${y}-01-01`, to: `${y}-12-31` };
    if (this.kind() === 'thang') { const m = this.n(); return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay(y, m))}` }; }
    const m1 = (this.n() - 1) * 3 + 1, m3 = this.n() * 3;
    return { from: `${y}-${pad(m1)}-01`, to: `${y}-${pad(m3)}-${pad(lastDay(y, m3))}` };
  });

  readonly data = signal<CashFlowView | null>(null);
  readonly failure = signal('');

  constructor() { this.load(); }

  item(code: string) {
    return this.data()?.items.find((i) => i.code === code);
  }

  detailText(it: { detail: { account: string; amount: number }[] }): string {
    return it.detail.length ? it.detail.map((x) => `TK ${x.account}: ${formatVnd(x.amount)}`).join('\n') : '';
  }

  async load() {
    this.failure.set('');
    const { from, to } = this.range();
    try { this.data.set(await this.svc.cashFlow(from, to)); }
    catch (e) { this.data.set(null); this.failure.set(errorText(e)); }
  }

  async exportExcel() {
    const d = this.data();
    if (!d) return;
    const rows: unknown[][] = [];
    for (const s of SECTIONS) {
      rows.push([s.title, '', '']);
      for (const c of s.codes) { const it = this.item(c); if (it) rows.push([it.label, it.code, it.amount]); }
      const t = this.item(s.total); if (t) rows.push([t.label, t.code, t.amount]);
    }
    for (const c of ['50', '60', '61', '70']) { const it = this.item(c); if (it) rows.push([it.label, it.code, it.amount]); }
    await downloadWorkbook(exportFileName(`Báo cáo lưu chuyển tiền tệ ${d.from} đến ${d.to}`), [{
      name: 'B03-DNN', columns: [{ header: 'Chỉ tiêu', width: 80 }, { header: 'Mã số', width: 8 }, { header: 'Số tiền', width: 18, numFmt: '#,##0' }], rows,
    }]);
  }
}
