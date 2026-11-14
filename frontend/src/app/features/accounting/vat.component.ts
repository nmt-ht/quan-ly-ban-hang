import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingService } from '../../core/services/accounting.service';
import { AuthService } from '../../core/services/auth.service';
import { errorText } from '../../core/api/api.service';
import { TaxBucket, VatInputsView, VatOutputsView, VatSummaryView } from '../../core/models/books-vat.models';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { formatVnd } from '../../shared/format.util';
import { formatDay } from '../../shared/period';

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
  imports: [FormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Thuế GTGT</h1>
        <p class="subtitle">Số liệu hỗ trợ lập tờ khai theo kỳ. Mẫu 01/GTGT và các chỉ tiêu có thể thay đổi theo văn bản mới — đối chiếu mẫu hiện hành khi kê khai.</p>
      </div>
    </div>

    <div class="toolbar" style="flex-wrap:wrap; gap:8px; margin-bottom:12px">
      <label>Kỳ kê khai
        <select [ngModel]="kind()" (ngModelChange)="kind.set($event); load()">
          <option value="thang">Tháng</option><option value="quy">Quý</option>
        </select>
      </label>
      <label>{{ kind() === 'thang' ? 'Tháng' : 'Quý' }}
        <select [ngModel]="n()" (ngModelChange)="n.set(+$event); load()">
          @for (i of options(); track i) { <option [value]="i">{{ i }}</option> }
        </select>
      </label>
      <label>Năm <input type="number" [ngModel]="year()" (ngModelChange)="year.set(+$event)" (change)="load()" style="width:90px"></label>
      <span class="subtitle">{{ formatDay(range().from) }} – {{ formatDay(range().to) }}</span>
    </div>

    <div class="detail-tabs" role="tablist" style="margin-bottom:12px">
      <button type="button" role="tab" [attr.aria-selected]="tab() === 'tong-hop'" (click)="tab.set('tong-hop')">Tổng hợp</button>
      <button type="button" role="tab" [attr.aria-selected]="tab() === 'ban-ra'" (click)="tab.set('ban-ra')">Bảng kê bán ra @if (outputs()) { <span class="tab-count num">{{ outputs()!.rows.length }}</span> }</button>
      <button type="button" role="tab" [attr.aria-selected]="tab() === 'mua-vao'" (click)="tab.set('mua-vao')">Bảng kê mua vào @if (inputs()) { <span class="tab-count num">{{ inputs()!.rows.length }}</span> }</button>
    </div>

    @if (failure()) { <div class="notice is-error" role="alert">{{ failure() }}</div> }
    @if (notice()) { <div class="notice" role="status">{{ notice() }}</div> }

    @if (tab() === 'tong-hop') {
      @if (summary(); as s) {
        <div class="card" style="overflow-x:auto; margin-bottom:12px">
          <h2 style="margin:0 0 8px">Thuế GTGT đầu ra (bán ra)</h2>
          <table style="width:100%; border-collapse:collapse">
            <thead><tr><th style="text-align:left">Thuế suất</th><th style="text-align:right">Giá trị chưa thuế</th><th style="text-align:right">Thuế GTGT</th></tr></thead>
            <tbody>
              @for (b of s.output.buckets; track b.rate) { <tr><td>{{ rate(b.rate) }}</td><td style="text-align:right">{{ money(b.taxable) }}</td><td style="text-align:right">{{ money(b.vat) }}</td></tr> }
              @empty { <tr><td colspan="3" style="text-align:center; padding:12px">Chưa có hoá đơn bán ra trong kỳ.</td></tr> }
            </tbody>
            <tfoot><tr style="font-weight:700"><td>Cộng ({{ s.output.invoices }} hoá đơn)</td><td style="text-align:right">{{ money(s.output.taxable) }}</td><td style="text-align:right">{{ money(s.output.vat) }}</td></tr></tfoot>
          </table>
        </div>

        <div class="card" style="overflow-x:auto; margin-bottom:12px">
          <h2 style="margin:0 0 8px">Thuế GTGT đầu vào (mua vào có hoá đơn)</h2>
          <table style="width:100%; border-collapse:collapse">
            <thead><tr><th style="text-align:left">Thuế suất</th><th style="text-align:right">Giá trị chưa thuế</th><th style="text-align:right">Thuế GTGT</th></tr></thead>
            <tbody>
              @for (b of s.input.buckets; track b.rate) { <tr><td>{{ rate(b.rate) }}</td><td style="text-align:right">{{ money(b.taxable) }}</td><td style="text-align:right">{{ money(b.vat) }}</td></tr> }
              @empty { <tr><td colspan="3" style="text-align:center; padding:12px">Chưa có hoá đơn mua vào trong kỳ.</td></tr> }
            </tbody>
            <tfoot><tr style="font-weight:700"><td>Cộng ({{ s.input.invoices }} hoá đơn)</td><td style="text-align:right">{{ money(s.input.taxable) }}</td><td style="text-align:right">{{ money(s.input.vat) }}</td></tr></tfoot>
          </table>
          @if (s.input.uninvoicedCount) {
            <p class="text-danger" style="margin:8px 0 0">
              {{ s.input.uninvoicedCount }} khoản mua vào chưa có số hoá đơn NCC (thuế {{ money(s.input.uninvoicedVat) }}) — chưa được tính khấu trừ. Nhập hoá đơn ở thẻ "Hoá đơn NCC" của đơn mua hàng.
            </p>
          }
        </div>

        <div class="card" style="overflow-x:auto; margin-bottom:12px">
          <h2 style="margin:0 0 8px">Thuế phải nộp / còn được khấu trừ</h2>
          <table style="width:100%; border-collapse:collapse">
            <tbody>
              <tr><td>Thuế GTGT đầu ra</td><td style="text-align:right">{{ money(s.output.vat) }}</td></tr>
              <tr><td>Thuế GTGT đầu vào được khấu trừ trong kỳ</td><td style="text-align:right">{{ money(s.input.vat) }}</td></tr>
              <tr><td>Thuế GTGT còn được khấu trừ kỳ trước chuyển sang <span class="subtitle">(theo sổ cái: 133 − 3331 cuối kỳ trước)</span></td><td style="text-align:right">{{ money(s.carryForward) }}</td></tr>
            </tbody>
            <tfoot>
              @if (s.payable > 0) {
                <tr style="font-weight:700"><td>Thuế GTGT phải nộp trong kỳ</td><td style="text-align:right">{{ money(s.payable) }}</td></tr>
              } @else {
                <tr style="font-weight:700"><td>Thuế GTGT còn được khấu trừ chuyển kỳ sau</td><td style="text-align:right">{{ money(s.carryOver) }}</td></tr>
              }
            </tfoot>
          </table>
          @if (canOffset()) {
            <div style="margin-top:12px">
              @if (!confirmOffset()) {
                <button type="button" class="btn" (click)="confirmOffset.set(true)">Khấu trừ thuế GTGT cuối kỳ…</button>
              } @else {
                <p>Ghi bút toán <b>Nợ 3331 / Có 133</b> bằng số nhỏ hơn của hai số dư tại ngày {{ formatDay(range().to) }}. Mỗi ngày chỉ làm được một lần; sai thì đảo bút toán.</p>
                <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="offset()">Xác nhận khấu trừ</button>
                <button type="button" class="btn" (click)="confirmOffset.set(false)">Bỏ qua</button>
              }
            </div>
          }
        </div>

        <div class="card" style="overflow-x:auto">
          <h2 style="margin:0 0 8px">Đối chiếu với sổ cái</h2>
          <table style="width:100%; border-collapse:collapse">
            <thead><tr><th style="text-align:left"></th><th style="text-align:right">Theo sổ cái</th><th style="text-align:right">Theo bảng kê</th><th style="text-align:right">Chênh lệch</th></tr></thead>
            <tbody>
              <tr><td>Thuế đầu ra (TK 3331: bán hàng, trả hàng bán)</td><td style="text-align:right">{{ money(s.reconciliation.outputVatLedger) }}</td><td style="text-align:right">{{ money(s.reconciliation.outputVatInvoiced) }}</td><td style="text-align:right" [class.text-danger]="s.reconciliation.outputDifference !== 0">{{ money(s.reconciliation.outputDifference) }}</td></tr>
              <tr><td>Thuế đầu vào (TK 133: nhận hàng, mua dịch vụ, trả hàng mua)</td><td style="text-align:right">{{ money(s.reconciliation.inputVatLedger) }}</td><td style="text-align:right">{{ money(s.reconciliation.inputVatListed) }}</td><td style="text-align:right" [class.text-danger]="s.reconciliation.inputDifference !== 0">{{ money(s.reconciliation.inputDifference) }}</td></tr>
            </tbody>
          </table>
          <p class="subtitle" style="margin-top:8px">
            Chênh lệch đầu ra thường là hàng đã giao nhưng chưa xuất hoá đơn điện tử (hoặc xuất khác kỳ). Chênh lệch đầu vào thường là khoản chưa có hoá đơn NCC hoặc hoá đơn ghi khác kỳ nhận hàng.
          </p>
        </div>
      } @else if (!failure()) {
        <div class="card" style="padding:16px">Đang tải…</div>
      }
    } @else if (tab() === 'ban-ra') {
      <div class="toolbar" style="margin-bottom:8px"><button type="button" class="btn" [disabled]="!outputs()?.rows?.length" (click)="exportOutputs()">Xuất Excel</button></div>
      <div class="card" style="overflow-x:auto">
        <table style="width:100%; border-collapse:collapse">
          <thead><tr>
            <th style="text-align:left">Ký hiệu</th><th style="text-align:left">Số hoá đơn</th><th style="text-align:left">Ngày</th><th style="text-align:left">Người mua</th><th style="text-align:left">MST</th>
            <th style="text-align:left">Loại</th><th style="text-align:right">Chưa thuế</th><th style="text-align:right">Thuế GTGT</th><th style="text-align:right">Tổng cộng</th>
          </tr></thead>
          <tbody>
            @for (r of outputs()?.rows ?? []; track r.id) {
              <tr>
                <td>{{ r.templateCode }}{{ r.series }}</td><td>{{ r.number || '—' }}</td><td>{{ formatDay(r.date) }}</td><td>{{ r.buyerName }}</td><td>{{ r.buyerTaxCode }}</td>
                <td>{{ kindLabel(r.kind) }}</td>
                <td style="text-align:right">{{ money(r.taxable) }}</td><td style="text-align:right">{{ money(r.vat) }}</td><td style="text-align:right">{{ money(r.total) }}</td>
              </tr>
            } @empty {
              <tr><td colspan="9" style="text-align:center; padding:16px">Không có hoá đơn điện tử đã phát hành trong kỳ.</td></tr>
            }
          </tbody>
          @if (outputs(); as o) {
            <tfoot><tr style="font-weight:700; border-top:2px solid var(--border, #ccc)">
              <td colspan="6">TỔNG CỘNG</td><td style="text-align:right">{{ money(o.totals.taxable) }}</td><td style="text-align:right">{{ money(o.totals.vat) }}</td><td style="text-align:right">{{ money(o.totals.total) }}</td>
            </tr></tfoot>
          }
        </table>
      </div>
      <p class="subtitle" style="margin-top:8px">Chỉ hoá đơn điện tử đã phát hành; hoá đơn bị thay thế không tính; hoá đơn điều chỉnh giảm ghi số âm.</p>
    } @else {
      <div class="toolbar" style="margin-bottom:8px"><button type="button" class="btn" [disabled]="!inputs()?.rows?.length" (click)="exportInputs()">Xuất Excel</button></div>
      <div class="card" style="overflow-x:auto; margin-bottom:12px">
        <table style="width:100%; border-collapse:collapse">
          <thead><tr>
            <th style="text-align:left">Ký hiệu</th><th style="text-align:left">Số hoá đơn</th><th style="text-align:left">Ngày</th><th style="text-align:left">Nhà cung cấp</th><th style="text-align:left">MST</th>
            <th style="text-align:left">Chứng từ</th><th style="text-align:right">Chưa thuế</th><th style="text-align:right">Thuế GTGT</th>
          </tr></thead>
          <tbody>
            @for (r of inputs()?.rows ?? []; track $index) {
              <tr>
                <td>{{ r.series || '' }}</td>
                <td>{{ r.number }} @if (r.kind === 'TRA_HANG') { <span class="badge badge-warning">Trả hàng</span> }</td>
                <td>{{ formatDay(r.date) }}</td><td>{{ r.supplierName }}</td><td>{{ r.supplierTaxCode }}</td><td>{{ r.refs }}</td>
                <td style="text-align:right">{{ money(r.taxable) }}</td><td style="text-align:right">{{ money(r.vat) }}</td>
              </tr>
            } @empty {
              <tr><td colspan="8" style="text-align:center; padding:16px">Không có hoá đơn mua vào trong kỳ.</td></tr>
            }
          </tbody>
          @if (inputs(); as i) {
            <tfoot><tr style="font-weight:700; border-top:2px solid var(--border, #ccc)">
              <td colspan="6">TỔNG CỘNG</td><td style="text-align:right">{{ money(i.totals.taxable) }}</td><td style="text-align:right">{{ money(i.totals.vat) }}</td>
            </tr></tfoot>
          }
        </table>
      </div>
      <p class="subtitle">Dòng "Trả hàng" là phiếu trả lại hàng mua, giảm thuế đầu vào; cần hoá đơn điều chỉnh của NCC để kê khai.</p>

      @if (inputs()?.uninvoiced?.length) {
        <h2>Chưa có hoá đơn NCC — chưa được khấu trừ</h2>
        <div class="card" style="overflow-x:auto">
          <table style="width:100%; border-collapse:collapse">
            <thead><tr><th style="text-align:left">Chứng từ</th><th style="text-align:left">Ngày</th><th style="text-align:left">Nhà cung cấp</th><th style="text-align:right">Chưa thuế</th><th style="text-align:right">Thuế GTGT</th></tr></thead>
            <tbody>
              @for (u of inputs()!.uninvoiced; track $index) {
                <tr>
                  <td>{{ u.ref }} <span class="subtitle">{{ u.source === 'NHAN_HANG' ? '(nhận hàng)' : '(hoá đơn mua)' }}</span></td>
                  <td>{{ formatDay(u.date) }}</td><td>{{ u.supplierName }}</td>
                  <td style="text-align:right">{{ money(u.taxable) }}</td>
                  <td style="text-align:right">@if (u.known) { {{ money(u.vat) }} } @else { <span class="subtitle">không có số liệu</span> }</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }
  `,
})
export class AccountingVatComponent {
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
  readonly notice = signal('');
  readonly busy = signal(false);
  readonly confirmOffset = signal(false);
  readonly canOffset = computed(() => this.auth.can('accounting.manual'));

  constructor() { this.load(); }

  async load() {
    // Đổi giữa tháng và quý thì giữ số trong khoảng hợp lệ.
    if (this.n() > this.options().length) this.n.set(this.options().length);
    this.failure.set('');
    this.notice.set('');
    this.confirmOffset.set(false);
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
    this.busy.set(true);
    this.failure.set('');
    try {
      const r = await this.svc.vatOffset(this.range().to);
      this.notice.set(`Đã khấu trừ thuế GTGT ${formatVnd(r.amount)} (Nợ 3331 / Có 133) ngày ${formatDay(r.date)}.`);
      this.confirmOffset.set(false);
      await this.load();
      this.notice.set(`Đã khấu trừ thuế GTGT ${formatVnd(r.amount)} (Nợ 3331 / Có 133) ngày ${formatDay(r.date)}.`);
    } catch (e) {
      this.failure.set(errorText(e));
    } finally {
      this.busy.set(false);
    }
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
