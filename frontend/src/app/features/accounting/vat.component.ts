/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { Component, computed, inject, signal, effect } from '@angular/core';
import { AccountingService } from '../../core/services/accounting.service';
import { AuthService } from '../../core/services/auth.service';
import { errorText } from '../../core/api/api.service';
import { TaxBucket, VatInputsView, VatOutputsView, VatSummaryView } from '../../core/models/books-vat.models';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { formatVnd } from '../../shared/format.util';
import { formatDay } from '../../shared/period';
import { ToastService } from '../../core/services/toast.service';

type Tab = 'tong-hop' | 'ban-ra' | 'mua-vao';

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (year: number, month: number) => new Date(year, month, 0).getDate();
const rateLabel = (r: number) => (r < 0 ? 'Không rõ thuế suất' : `${r}%`);
const KIND_LABEL: Record<string, string> = { ORIGINAL: 'Gốc', ADJUST: 'Điều chỉnh', REPLACE: 'Thay thế' };

/**
 * /ke-toan/thue-gtgt — thuế GTGT theo kỳ (tháng / quý): tổng hợp theo thuế suất, bảng kê bán ra (hoá đơn điện tử đã phát hành),
 * bảng kê mua vào (hoá đơn NCC trên lần nhận hàng và hoá đơn mua không qua kho), đối chiếu sổ cái và khấu trừ cuối kỳ.
 */
@Component({
  selector: 'app-accounting-vat',
  standalone: true,
  imports: [NavIconComponent],
  template: `
    <div class="page-header">
      <div>
        <h1>Thuế GTGT</h1>
        <p class="subtitle">Số liệu hỗ trợ lập tờ khai theo kỳ. Mẫu 01/GTGT và các chỉ tiêu có thể thay đổi theo văn bản mới — đối chiếu mẫu hiện hành khi kê khai.</p>
      </div>
      @if (tab() !== 'tong-hop') {
        <div class="toolbar">
          <button type="button" class="btn" [disabled]="tab() === 'ban-ra' ? !outputs()?.rows?.length : !inputs()?.rows?.length" (click)="tab() === 'ban-ra' ? exportOutputs() : exportInputs()">
            <app-nav-icon name="download" />Xuất Excel
          </button>
        </div>
      }
    </div>

    <div class="filters-bar rp-toolbar">
      <div class="segmented" role="group" aria-label="Kỳ kê khai">
        <button type="button" [attr.aria-pressed]="kind() === 'thang'" (click)="setKind('thang')">Tháng</button>
        <button type="button" [attr.aria-pressed]="kind() === 'quy'" (click)="setKind('quy')">Quý</button>
      </div>
      <select [attr.aria-label]="kind() === 'thang' ? 'Tháng' : 'Quý'" (change)="n.set(+$any($event.target).value); load()">
        @for (i of options(); track i) { <option [value]="i" [selected]="i === n()">{{ kind() === 'thang' ? 'Tháng ' : 'Quý ' }}{{ i }}</option> }
      </select>
      <input type="number" aria-label="Năm" class="year-input" min="2000" max="2100" [value]="year()" (change)="year.set(+$any($event.target).value); load()" />
    </div>
    <p class="rp-range">Kỳ từ <span class="num">{{ formatDay(range().from) }}</span> đến <span class="num">{{ formatDay(range().to) }}</span></p>

    <div class="detail-tabs" role="tablist">
      <button type="button" role="tab" [attr.aria-selected]="tab() === 'tong-hop'" (click)="tab.set('tong-hop')">Tổng hợp</button>
      <button type="button" role="tab" [attr.aria-selected]="tab() === 'ban-ra'" (click)="tab.set('ban-ra')">Bảng kê bán ra @if (outputs()) { <span class="tab-count num">{{ outputs()!.rows.length }}</span> }</button>
      <button type="button" role="tab" [attr.aria-selected]="tab() === 'mua-vao'" (click)="tab.set('mua-vao')">Bảng kê mua vào @if (inputs()) { <span class="tab-count num">{{ inputs()!.rows.length }}</span> }</button>
    </div>

        
    @if (tab() === 'tong-hop') {
      @if (summary(); as s) {
        <dl class="list-totals">
          <div><dt>Thuế đầu ra</dt><dd class="num">{{ money(s.output.vat) }}</dd></div>
          <div><dt>Thuế đầu vào được khấu trừ</dt><dd class="num">{{ money(s.input.vat) }}</dd></div>
          @if (s.payable > 0) {
            <div><dt>Phải nộp trong kỳ</dt><dd class="num text-warning">{{ money(s.payable) }}</dd></div>
          } @else {
            <div><dt>Còn được khấu trừ chuyển kỳ sau</dt><dd class="num">{{ money(s.carryOver) }}</dd></div>
          }
        </dl>

        <section class="section-bare">
          <h3>Thuế GTGT đầu ra (bán ra)</h3>
          <div class="rp-surface book-wrap">
            <table class="book-table">
              <thead><tr><th scope="col">Thuế suất</th><th scope="col" class="r">Giá trị chưa thuế</th><th scope="col" class="r">Thuế GTGT</th></tr></thead>
              <tbody>
                @for (b of s.output.buckets; track b.rate) { <tr><td>{{ rate(b.rate) }}</td><td class="r num">{{ money(b.taxable) }}</td><td class="r num">{{ money(b.vat) }}</td></tr> }
                @empty { <tr><td class="book-none" colspan="3">Chưa có hoá đơn bán ra trong kỳ.</td></tr> }
              </tbody>
              <tfoot><tr><td>Cộng ({{ s.output.invoices }} hoá đơn)</td><td class="r num">{{ money(s.output.taxable) }}</td><td class="r num">{{ money(s.output.vat) }}</td></tr></tfoot>
            </table>
          </div>
        </section>

        <section class="section-bare">
          <h3>Thuế GTGT đầu vào (mua vào có hoá đơn)</h3>
          <div class="rp-surface book-wrap">
            <table class="book-table">
              <thead><tr><th scope="col">Thuế suất</th><th scope="col" class="r">Giá trị chưa thuế</th><th scope="col" class="r">Thuế GTGT</th></tr></thead>
              <tbody>
                @for (b of s.input.buckets; track b.rate) { <tr><td>{{ rate(b.rate) }}</td><td class="r num">{{ money(b.taxable) }}</td><td class="r num">{{ money(b.vat) }}</td></tr> }
                @empty { <tr><td class="book-none" colspan="3">Chưa có hoá đơn mua vào trong kỳ.</td></tr> }
              </tbody>
              <tfoot><tr><td>Cộng ({{ s.input.invoices }} hoá đơn)</td><td class="r num">{{ money(s.input.taxable) }}</td><td class="r num">{{ money(s.input.vat) }}</td></tr></tfoot>
            </table>
          </div>
          @if (s.input.uninvoicedCount) {
            <div class="notice is-error" role="alert">
              {{ s.input.uninvoicedCount }} khoản mua vào chưa có số hoá đơn NCC (thuế {{ money(s.input.uninvoicedVat) }}) — chưa được tính khấu trừ. Nhập hoá đơn ở thẻ "Hoá đơn NCC" của đơn mua hàng.
            </div>
          }
        </section>

        <section class="section-bare">
          <h3>Thuế phải nộp / còn được khấu trừ</h3>
          <div class="rp-surface book-wrap">
            <table class="book-table">
              <tbody>
                <tr><td>Thuế GTGT đầu ra</td><td class="r num">{{ money(s.output.vat) }}</td></tr>
                <tr><td>Thuế GTGT đầu vào được khấu trừ trong kỳ</td><td class="r num">{{ money(s.input.vat) }}</td></tr>
                <tr><td>Còn được khấu trừ kỳ trước chuyển sang <span class="subtitle">(theo sổ cái: 133 − 3331 cuối kỳ trước)</span></td><td class="r num">{{ money(s.carryForward) }}</td></tr>
              </tbody>
              <tfoot>
                @if (s.payable > 0) {
                  <tr><td>Thuế GTGT phải nộp trong kỳ</td><td class="r num">{{ money(s.payable) }}</td></tr>
                } @else {
                  <tr><td>Thuế GTGT còn được khấu trừ chuyển kỳ sau</td><td class="r num">{{ money(s.carryOver) }}</td></tr>
                }
              </tfoot>
            </table>
          </div>
          @if (canOffset()) {
            <button type="button" class="btn" (click)="offset()">Khấu trừ thuế GTGT cuối kỳ…</button>
          }
        </section>

        <section class="section-bare">
          <h3>Đối chiếu với sổ cái</h3>
          <div class="rp-surface book-wrap">
            <table class="book-table">
              <thead><tr><th scope="col">Khoản</th><th scope="col" class="r">Theo sổ cái</th><th scope="col" class="r">Theo bảng kê</th><th scope="col" class="r">Chênh lệch</th></tr></thead>
              <tbody>
                <tr>
                  <td>Thuế đầu ra (TK 3331: bán hàng, trả hàng bán)</td>
                  <td class="r num">{{ money(s.reconciliation.outputVatLedger) }}</td><td class="r num">{{ money(s.reconciliation.outputVatInvoiced) }}</td>
                  <td class="r num" [class.is-zero]="!s.reconciliation.outputDifference" [class.amt-neg]="s.reconciliation.outputDifference !== 0">{{ money(s.reconciliation.outputDifference) }}</td>
                </tr>
                <tr>
                  <td>Thuế đầu vào (TK 133: nhận hàng, mua dịch vụ, trả hàng mua)</td>
                  <td class="r num">{{ money(s.reconciliation.inputVatLedger) }}</td><td class="r num">{{ money(s.reconciliation.inputVatListed) }}</td>
                  <td class="r num" [class.is-zero]="!s.reconciliation.inputDifference" [class.amt-neg]="s.reconciliation.inputDifference !== 0">{{ money(s.reconciliation.inputDifference) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="rp-notes">Chênh lệch đầu ra thường là hàng đã giao nhưng chưa xuất hoá đơn điện tử (hoặc xuất khác kỳ). Chênh lệch đầu vào thường là khoản chưa có hoá đơn NCC hoặc hoá đơn ghi khác kỳ nhận hàng.</p>
        </section>
      } @else if (!failure()) {
        <div class="empty-state"><h3>Đang tính số liệu…</h3></div>
      }
    } @else if (tab() === 'ban-ra') {
      <div class="rp-surface rp-grid">
        <table class="book-table">
          <thead><tr>
            <th scope="col">Ký hiệu</th><th scope="col">Số hoá đơn</th><th scope="col">Ngày</th><th scope="col">Người mua</th><th scope="col">MST</th>
            <th scope="col">Loại</th><th scope="col" class="r">Chưa thuế</th><th scope="col" class="r">Thuế GTGT</th><th scope="col" class="r">Tổng cộng</th>
          </tr></thead>
          <tbody>
            @for (r of outputs()?.rows ?? []; track r.id) {
              <tr>
                <td class="code">{{ r.templateCode }}{{ r.series }}</td><td class="code">{{ r.number || '—' }}</td><td class="num">{{ formatDay(r.date) }}</td><td>{{ r.buyerName }}</td><td class="code">{{ r.buyerTaxCode }}</td>
                <td>{{ kindLabel(r.kind) }}</td>
                <td class="r num">{{ money(r.taxable) }}</td><td class="r num">{{ money(r.vat) }}</td><td class="r num">{{ money(r.total) }}</td>
              </tr>
            } @empty {
              <tr><td class="book-none" colspan="9">Không có hoá đơn điện tử đã phát hành trong kỳ.</td></tr>
            }
          </tbody>
          @if (outputs(); as o) {
            <tfoot><tr>
              <td colspan="6">TỔNG CỘNG</td><td class="r num">{{ money(o.totals.taxable) }}</td><td class="r num">{{ money(o.totals.vat) }}</td><td class="r num">{{ money(o.totals.total) }}</td>
            </tr></tfoot>
          }
        </table>
      </div>
      <p class="rp-notes">Chỉ hoá đơn điện tử đã phát hành hoặc đã ghi nhận số; hoá đơn bị thay thế hay đã gỡ không tính; hoá đơn điều chỉnh giảm ghi số âm.</p>
    } @else {
      <div class="rp-surface rp-grid">
        <table class="book-table">
          <thead><tr>
            <th scope="col">Ký hiệu</th><th scope="col">Số hoá đơn</th><th scope="col">Ngày</th><th scope="col">Nhà cung cấp</th><th scope="col">MST</th>
            <th scope="col">Chứng từ</th><th scope="col" class="r">Chưa thuế</th><th scope="col" class="r">Thuế GTGT</th>
          </tr></thead>
          <tbody>
            @for (r of inputs()?.rows ?? []; track $index) {
              <tr>
                <td class="code">{{ r.series || '' }}</td>
                <td class="code">{{ r.number }} @if (r.kind === 'TRA_HANG') { <span class="badge badge-warning">Trả hàng</span> }</td>
                <td class="num">{{ formatDay(r.date) }}</td><td>{{ r.supplierName }}</td><td class="code">{{ r.supplierTaxCode }}</td><td class="code">{{ r.refs }}</td>
                <td class="r num">{{ money(r.taxable) }}</td><td class="r num">{{ money(r.vat) }}</td>
              </tr>
            } @empty {
              <tr><td class="book-none" colspan="8">Không có hoá đơn mua vào trong kỳ.</td></tr>
            }
          </tbody>
          @if (inputs(); as i) {
            <tfoot><tr>
              <td colspan="6">TỔNG CỘNG</td><td class="r num">{{ money(i.totals.taxable) }}</td><td class="r num">{{ money(i.totals.vat) }}</td>
            </tr></tfoot>
          }
        </table>
      </div>
      <p class="rp-notes">Dòng "Trả hàng" là phiếu trả lại hàng mua, giảm thuế đầu vào; cần hoá đơn điều chỉnh của NCC để kê khai.</p>

      @if (inputs()?.uninvoiced?.length) {
        <section class="section-bare">
          <h3>Chưa có hoá đơn NCC — chưa được khấu trừ</h3>
          <div class="rp-surface book-wrap">
            <table class="book-table">
              <thead><tr><th scope="col">Chứng từ</th><th scope="col">Ngày</th><th scope="col">Nhà cung cấp</th><th scope="col" class="r">Chưa thuế</th><th scope="col" class="r">Thuế GTGT</th></tr></thead>
              <tbody>
                @for (u of inputs()!.uninvoiced; track $index) {
                  <tr>
                    <td><span class="code">{{ u.ref }}</span> <span class="subtitle">{{ u.source === 'NHAN_HANG' ? '(nhận hàng)' : '(hoá đơn mua)' }}</span></td>
                    <td class="num">{{ formatDay(u.date) }}</td><td>{{ u.supplierName }}</td>
                    <td class="r num">{{ money(u.taxable) }}</td>
                    <td class="r num">@if (u.known) { {{ money(u.vat) }} } @else { <span class="subtitle">không có số liệu</span> }</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
    }
  `,
  styles: [`.year-input { width: 5.5rem; }`],
})
export class AccountingVatComponent {
  protected readonly toast = inject(ToastService);
  /** A failure still shown by the page logic also raises a toast. */
  protected readonly failureToast = effect(() => this.toast.error(this.failure()));
  private readonly dialogs = inject(ConfirmService);
  private readonly svc = inject(AccountingService);
  private readonly auth = inject(AuthService);
  readonly money = formatVnd;
  readonly formatDay = formatDay;
  readonly rate = rateLabel;
  readonly kindLabel = (k: string) => KIND_LABEL[k] ?? k;

  readonly tab = signal<Tab>('tong-hop');
  readonly kind = signal<'thang' | 'quy'>('thang');
  readonly year = signal(new Date().getFullYear());
  readonly n = signal(new Date().getMonth() + 1);
  readonly options = computed(() => (this.kind() === 'thang' ? Array.from({ length: 12 }, (_, i) => i + 1) : [1, 2, 3, 4]));
  readonly range = computed(() => {
    const y = this.year();
    if (this.kind() === 'thang') {
      const m = Math.min(12, Math.max(1, this.n()));
      return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay(y, m))}` };
    }
    const q = Math.min(4, Math.max(1, this.n()));
    const m1 = (q - 1) * 3 + 1, m3 = q * 3;
    return { from: `${y}-${pad(m1)}-01`, to: `${y}-${pad(m3)}-${pad(lastDay(y, m3))}` };
  });

  readonly summary = signal<VatSummaryView | null>(null);
  readonly outputs = signal<VatOutputsView | null>(null);
  readonly inputs = signal<VatInputsView | null>(null);
  readonly failure = signal('');
  readonly busy = signal(false);
  readonly canOffset = computed(() => this.auth.can('accounting.manual'));

  constructor() { this.load(); }

  setKind(k: 'thang' | 'quy') {
    this.kind.set(k);
    this.load();
  }

  async load() {
    // Đổi giữa tháng và quý thì giữ số trong khoảng hợp lệ.
    if (this.n() > this.options().length) this.n.set(this.options().length);
    this.failure.set('');
    const { from, to } = this.range();
    try {
      const [s, o, i] = await Promise.all([this.svc.vatSummary(from, to), this.svc.vatOutputs(from, to), this.svc.vatInputs(from, to)]);
      this.summary.set(s); this.outputs.set(o); this.inputs.set(i);
    } catch (e) {
      this.summary.set(null); this.outputs.set(null); this.inputs.set(null);
      this.failure.set(errorText(e));
    }
  }

  async offset() {
    const to = this.range().to;
    let done: { amount: number; date: string } | null = null;
    const ok = await this.dialogs.form({
      title: 'Khấu trừ thuế GTGT cuối kỳ?',
      message: `Ghi bút toán Nợ 3331 / Có 133 bằng số nhỏ hơn của hai số dư tại ngày ${formatDay(to)}. Mỗi ngày chỉ làm được một lần; sai thì đảo bút toán.`,
      confirmLabel: 'Khấu trừ', cancelLabel: 'Bỏ qua', tone: 'primary', fields: [],
      run: async () => { done = await this.svc.vatOffset(to); },
    });
    if (!ok || !done) return;
    const r = done as { amount: number; date: string };
    await this.load();
    this.toast.success(`Đã khấu trừ thuế GTGT ${formatVnd(r.amount)} (Nợ 3331 / Có 133) ngày ${formatDay(r.date)}.`);
  }
  async exportOutputs() {
    const o = this.outputs();
    if (!o) return;
    const rows: unknown[][] = o.rows.map((r, i) => [i + 1, `${r.templateCode}${r.series}`, r.number ?? '', formatDay(r.date), r.buyerName, r.buyerTaxCode, this.kindLabel(r.kind), r.taxable, r.vat, r.total]);
    rows.push(['', '', '', '', '', '', 'TỔNG CỘNG', o.totals.taxable, o.totals.vat, o.totals.total]);
    for (const b of o.buckets) rows.push(['', '', '', '', '', '', `Thuế suất ${rateLabel(b.rate)}`, b.taxable, b.vat, '']);
    const n = (header: string) => ({ header, width: 16, numFmt: '#,##0' });
    await downloadWorkbook(exportFileName(`Bảng kê bán ra ${this.range().from} đến ${this.range().to}`), [{
      name: 'Bán ra',
      columns: [{ header: 'STT', width: 6 }, { header: 'Ký hiệu', width: 12 }, { header: 'Số hoá đơn', width: 14 }, { header: 'Ngày', width: 12 }, { header: 'Người mua', width: 34 }, { header: 'MST', width: 16 }, { header: 'Loại', width: 12 }, n('Chưa thuế'), n('Thuế GTGT'), n('Tổng cộng')],
      rows,
    }]);
  }

  async exportInputs() {
    const i = this.inputs();
    if (!i) return;
    const rows: unknown[][] = i.rows.map((r, k) => [k + 1, r.series ?? '', r.number, formatDay(r.date), r.supplierName, r.supplierTaxCode, r.refs, r.kind === 'TRA_HANG' ? 'Trả hàng' : 'Hoá đơn', r.taxable, r.vat]);
    rows.push(['', '', '', '', '', '', '', 'TỔNG CỘNG', i.totals.taxable, i.totals.vat]);
    const n = (header: string) => ({ header, width: 16, numFmt: '#,##0' });
    const sheets = [{
      name: 'Mua vào',
      columns: [{ header: 'STT', width: 6 }, { header: 'Ký hiệu', width: 12 }, { header: 'Số hoá đơn', width: 16 }, { header: 'Ngày', width: 12 }, { header: 'Nhà cung cấp', width: 34 }, { header: 'MST', width: 16 }, { header: 'Chứng từ', width: 22 }, { header: 'Loại', width: 10 }, n('Chưa thuế'), n('Thuế GTGT')],
      rows,
    }, {
      name: 'Chưa có hoá đơn',
      columns: [{ header: 'Chứng từ', width: 16 }, { header: 'Ngày', width: 12 }, { header: 'Nhà cung cấp', width: 34 }, n('Chưa thuế'), n('Thuế GTGT')],
      rows: i.uninvoiced.map((u) => [u.ref, formatDay(u.date), u.supplierName, u.taxable, u.known ? u.vat : '']),
    }];
    await downloadWorkbook(exportFileName(`Bảng kê mua vào ${this.range().from} đến ${this.range().to}`), sheets);
  }
}
