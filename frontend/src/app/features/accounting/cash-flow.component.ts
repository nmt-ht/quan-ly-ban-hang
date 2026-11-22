/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorText } from '../../core/api/api.service';
import { CashFlowView } from '../../core/models/cash-ops.models';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { formatVnd } from '../../shared/format.util';
import { formatDay } from '../../shared/period';
import { PrintService } from '../../shared/print/print.service';
import { StatementPrintComponent, StatementPrintLine } from '../../shared/print/tt133/statement-print.component';
import { cashFlowLines, yearBefore } from '../../shared/print/tt133/tt133-books';
import { CashOpsService } from '../cash-ops/cash-ops.service';

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (year: number, month: number) => new Date(year, month, 0).getDate();
const SECTIONS: { title: string; codes: string[]; total: string }[] = [
  { title: 'I. Lưu chuyển tiền từ hoạt động kinh doanh', codes: ['01', '02', '03', '04', '05', '06', '07'], total: '20' },
  { title: 'II. Lưu chuyển tiền từ hoạt động đầu tư', codes: ['21', '22', '23', '24', '25'], total: '30' },
  { title: 'III. Lưu chuyển tiền từ hoạt động tài chính', codes: ['31', '32', '33', '34', '35'], total: '40' },
];
const TAIL = ['50', '60', '61', '70'];

/**
 * /ke-toan/luu-chuyen-tien-te — báo cáo lưu chuyển tiền tệ theo phương pháp trực tiếp (mẫu B03-DNN), lập từ sổ cái: các bút toán có tiền
 * (111, 112, 113) được xếp theo tài khoản đối ứng. Chuyển tiền nội bộ không xuất hiện.
 */
@Component({
  selector: 'app-accounting-cash-flow',
  standalone: true,
  imports: [FormsModule, NavIconComponent, StatementPrintComponent],
  template: `
   <div class="screen-only">
    <div class="page-header">
      <div>
        <h1>Báo cáo lưu chuyển tiền tệ</h1>
        <p class="subtitle">Phương pháp trực tiếp (B03-DNN). Phân loại theo tài khoản đối ứng của bút toán tiền — cách xếp từng tài khoản vào chỉ tiêu nên được kế toán trưởng xác nhận.</p>
      </div>
      <div class="toolbar">
        <button type="button" class="btn" [disabled]="!data() || printBusy()" (click)="printReport()"><app-nav-icon name="printer" />In báo cáo B03-DNN</button>
        <button type="button" class="btn" [disabled]="!data()" (click)="exportExcel()"><app-nav-icon name="download" />Xuất Excel</button>
      </div>
    </div>

    <div class="filters-bar rp-toolbar">
      <div class="segmented" role="group" aria-label="Kỳ báo cáo">
        <button type="button" [attr.aria-pressed]="kind() === 'nam'" (click)="setKind('nam')">Cả năm</button>
        <button type="button" [attr.aria-pressed]="kind() === 'quy'" (click)="setKind('quy')">Quý</button>
        <button type="button" [attr.aria-pressed]="kind() === 'thang'" (click)="setKind('thang')">Tháng</button>
      </div>
      @if (kind() !== 'nam') {
        <select [attr.aria-label]="kind() === 'thang' ? 'Tháng' : 'Quý'" [value]="n()" (change)="n.set(+$any($event.target).value); load()">
          @for (i of options(); track i) { <option [value]="i" [selected]="i === n()">{{ kind() === 'thang' ? 'Tháng ' : 'Quý ' }}{{ i }}</option> }
        </select>
      }
      <input type="number" aria-label="Năm" class="year-input" min="2000" max="2100" [value]="year()" (change)="year.set(+$any($event.target).value); load()" />
    </div>
    <p class="rp-range">Số liệu từ <span class="num">{{ formatDay(range().from) }}</span> đến <span class="num">{{ formatDay(range().to) }}</span></p>
    @if (failure()) { <div class="notice is-error" role="alert">{{ failure() }}</div> }

    @if (data(); as d) {
      @if (d.check.difference !== 0) {
        <div class="notice is-error" role="alert">Tiền cuối kỳ theo báo cáo lệch {{ money(d.check.difference) }} so với số dư tiền trên sổ cái ({{ money(d.check.ledgerClosing) }}). Kiểm tra bút toán tiền.</div>
      }
      <dl class="list-totals">
        @if (item('20'); as x) { <div><dt>Từ kinh doanh</dt><dd class="num" [class.amt-neg]="x.amount < 0">{{ money(x.amount) }}</dd></div> }
        @if (item('30'); as x) { <div><dt>Từ đầu tư</dt><dd class="num" [class.amt-neg]="x.amount < 0">{{ money(x.amount) }}</dd></div> }
        @if (item('40'); as x) { <div><dt>Từ tài chính</dt><dd class="num" [class.amt-neg]="x.amount < 0">{{ money(x.amount) }}</dd></div> }
        @if (item('70'); as x) { <div><dt>Tiền cuối kỳ</dt><dd class="num">{{ money(x.amount) }}</dd></div> }
      </dl>

      <div class="rp-surface rp-grid">
        <table class="book-table">
          <thead><tr><th scope="col">Chỉ tiêu</th><th scope="col">Mã số</th><th scope="col" class="r">Số tiền</th></tr></thead>
          <tbody>
            @for (s of sections; track s.title) {
              <tr class="book-head"><td colspan="3">{{ s.title }}</td></tr>
              @for (c of s.codes; track c) {
                @if (item(c); as it) {
                  <tr class="book-sub" [title]="detailText(it)">
                    <td>{{ it.label }}</td><td class="code">{{ it.code }}</td>
                    <td class="r num" [class.is-zero]="!it.amount" [class.amt-neg]="it.amount < 0">{{ it.amount ? money(it.amount) : '—' }}</td>
                  </tr>
                }
              }
              @if (item(s.total); as t) {
                <tr class="book-sum"><td>{{ t.label }}</td><td class="code">{{ t.code }}</td><td class="r num" [class.amt-neg]="t.amount < 0">{{ money(t.amount) }}</td></tr>
              }
            }
            @for (c of tail; track c) {
              @if (item(c); as it) {
                <tr class="book-sum"><td>{{ it.label }}</td><td class="code">{{ it.code }}</td><td class="r num" [class.amt-neg]="it.amount < 0">{{ money(it.amount) }}</td></tr>
              }
            }
          </tbody>
        </table>
      </div>
      <details class="rp-notes">
        <summary>Cách tính số liệu</summary>
        <p>Rê chuột vào một chỉ tiêu để xem các tài khoản đối ứng tạo nên số đó. Số âm là tiền chi ra.</p>
        <p>Thuế GTGT, bảo hiểm và thuế TNCN nộp ghi vào "chi khác" (07). Tiền đầu kỳ = số dư đầu năm đã nhập + biến động từ đầu năm; ảnh hưởng tỷ giá (61) chưa tính.</p>
      </details>
    } @else if (!failure()) {
      <div class="empty-state"><h3>Đang tính số liệu…</h3></div>
    }
   </div>

   @if (doc(); as lines) {
     <app-statement-print
       formNo="B03-DNN" title="BÁO CÁO LƯU CHUYỂN TIỀN TỆ" [sub]="docSub()" sub2="(Theo phương pháp trực tiếp) · Đơn vị tính: đồng"
       [heads]="['Kỳ này', 'Kỳ trước']" [lines]="lines" />
   }
  `,
  styles: [`.year-input { width: 5.5rem; }`],
})
export class AccountingCashFlowComponent {
  private readonly svc = inject(CashOpsService);
  private readonly printer = inject(PrintService);
  readonly money = formatVnd;
  readonly formatDay = formatDay;
  readonly sections = SECTIONS;
  readonly tail = TAIL;

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
  /** Báo cáo B03-DNN đang dựng để in (chỉ có trong lúc in). */
  readonly doc = signal<StatementPrintLine[] | null>(null);
  readonly docSub = signal('');
  readonly printBusy = signal(false);

  constructor() { this.load(); }

  setKind(k: 'nam' | 'quy' | 'thang') {
    this.kind.set(k);
    this.n.set(1);
    this.load();
  }

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

  async printReport() {
    const d = this.data();
    if (!d) return;
    this.printBusy.set(true);
    this.failure.set('');
    try {
      // Cột kỳ trước: cùng khoảng ngày năm trước (trước ngày bắt đầu ghi sổ thì toàn số 0).
      const prior = await this.svc.cashFlow(yearBefore(d.from), yearBefore(d.to)).catch(() => null);
      const lines = cashFlowLines(d, prior);
      this.docSub.set(`Từ ngày ${formatDay(d.from)} đến ngày ${formatDay(d.to)}`);
      await this.printer.print('tt133-b03', 'A4', () => this.doc.set(lines), () => this.doc.set(null));
    } catch (e) {
      this.failure.set(errorText(e));
    } finally {
      this.printBusy.set(false);
    }
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
    for (const c of TAIL) { const it = this.item(c); if (it) rows.push([it.label, it.code, it.amount]); }
    await downloadWorkbook(exportFileName(`Báo cáo lưu chuyển tiền tệ ${d.from} đến ${d.to}`), [{
      name: 'B03-DNN', columns: [{ header: 'Chỉ tiêu', width: 80 }, { header: 'Mã số', width: 8 }, { header: 'Số tiền', width: 18, numFmt: '#,##0' }], rows,
    }]);
  }
}
