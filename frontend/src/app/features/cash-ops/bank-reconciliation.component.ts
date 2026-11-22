/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { errorText } from '../../core/api/api.service';
import { AuthService } from '../../core/services/auth.service';
import { DataStore } from '../../core/services/data-store.service';
import { ReconciliationView, StatementLineView, StatementRowInput } from '../../core/models/cash-ops.models';
import { downloadWorkbook, parseDay, readSheet } from '../../shared/excel.util';
import { MoneyInputDirective } from '../../shared/money-input.directive';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { PeriodFilterComponent, PeriodValue } from '../../shared/period-filter/period-filter.component';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { formatVnd } from '../../shared/format.util';
import { formatDay, isoDay } from '../../shared/period';
import { CashOpsService } from './cash-ops.service';
import { DateInputDirective } from '../../shared/date-input/date-input.directive';
import { ToastService } from '../../core/services/toast.service';

// Tiêu đề cột thường gặp của sao kê (đã bỏ dấu, chữ thường): cột nào khớp trước thì dùng.
const COLS = {
  date: ['ngay', 'ngay giao dich', 'ngay gd', 'ngay hach toan', 'date'],
  description: ['dien giai', 'noi dung', 'noi dung giao dich', 'mo ta', 'description'],
  reference: ['so tham chieu', 'ma giao dich', 'so but toan', 'tham chieu', 'so ct', 'reference'],
  amountIn: ['thu', 'ghi co', 'tien vao', 'so tien vao', 'phat sinh co', 'credit'],
  amountOut: ['chi', 'ghi no', 'tien ra', 'so tien ra', 'phat sinh no', 'debit'],
};

function parseMoney(v: unknown): number {
  if (typeof v === 'number') return Math.round(Math.abs(v));
  const digits = String(v ?? '').replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

/**
 * /thu-chi/doi-chieu-ngan-hang — đối chiếu sao kê ngân hàng: nhập dòng sao kê (Excel hoặc tay), tự khớp hoặc chọn tay với phiếu thu / chi
 * cùng chiều và số tiền, rồi xem phần còn lệch giữa số dư sổ sách và số dư trên sao kê.
 */
@Component({
  selector: 'app-bank-reconciliation',
  standalone: true,
  imports: [DateInputDirective, FormsModule, NavIconComponent, PeriodFilterComponent, MoneyInputDirective, PaginationComponent],
  template: `
    <div class="page-header">
      <div>
        <h1>Đối chiếu ngân hàng</h1>
        <p class="subtitle">Nhập sao kê, khớp với phiếu thu / chi, tìm khoản chưa ghi sổ hoặc chưa lên sao kê.</p>
      </div>
      @if (data()) {
        <div class="toolbar">
          <label class="btn"><app-nav-icon name="upload" />Nhập sao kê từ Excel <input type="file" accept=".xlsx" class="visually-hidden" (change)="onFile($event)"></label>
          <button type="button" class="btn" (click)="downloadSample()" title="File Excel mẫu có dòng ví dụ và hướng dẫn"><app-nav-icon name="download" />Tải file mẫu</button>
          <button type="button" class="btn" [attr.aria-pressed]="adding()" (click)="adding.set(!adding())"><app-nav-icon name="plus" />Thêm dòng tay</button>
          <button type="button" class="btn btn-primary" [disabled]="busy() || !data()!.summary.unmatchedLines" (click)="auto()"><app-nav-icon name="check" />Tự khớp</button>
        </div>
      }
    </div>

    <div class="filters-bar">
      <select aria-label="Tài khoản ngân hàng" [value]="accountId()" (change)="accountId.set($any($event.target).value); load()">
        <option value="">Chọn tài khoản ngân hàng…</option>
        @for (a of accounts(); track a.id) { <option [value]="a.id" [selected]="a.id === accountId()">{{ a.name }}</option> }
      </select>
      <app-period-filter [value]="period()" (valueChange)="onPeriod($event)" />
    </div>

    @if (data(); as d) {
      @if (adding()) {
        <section class="card section-block" aria-labelledby="dc-add">
          <h2 id="dc-add" class="form-section-title">Thêm dòng sao kê</h2>
          <div class="form-grid-3">
            <div class="field">
              <label for="dc-date">Ngày</label>
              <input id="dc-date" appDate [ngModel]="manual().date" (ngModelChange)="patchManual({ date: $event })" />
            </div>
            <div class="field span-2">
              <label for="dc-desc">Diễn giải</label>
              <input id="dc-desc" type="text" maxlength="500" [ngModel]="manual().description" (ngModelChange)="patchManual({ description: $event })" />
            </div>
            <div class="field">
              <label for="dc-ref">Số tham chiếu</label>
              <input id="dc-ref" type="text" maxlength="60" class="num" [ngModel]="manual().reference" (ngModelChange)="patchManual({ reference: $event })" />
            </div>
            <div class="field">
              <label for="dc-in">Tiền vào</label>
              <input id="dc-in" type="text" appMoney class="num money-input" placeholder="0" [ngModel]="manual().amountIn" (ngModelChange)="patchManual({ amountIn: $event })" />
            </div>
            <div class="field">
              <label for="dc-out">Tiền ra</label>
              <input id="dc-out" type="text" appMoney class="num money-input" placeholder="0" [ngModel]="manual().amountOut" (ngModelChange)="patchManual({ amountOut: $event })" />
            </div>
          </div>
          <div class="toolbar">
            <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="addManual()">Thêm dòng</button>
            <button type="button" class="btn" (click)="adding.set(false)">Đóng</button>
          </div>
        </section>
      }

      <dl class="list-totals">
        <div><dt>Dòng sao kê đã khớp</dt><dd class="num">{{ d.summary.matched }} / {{ d.summary.lines }}</dd></div>
        <div><dt>Dòng sao kê chưa ghi sổ</dt><dd class="num" [class.text-warning]="d.summary.unmatchedLines > 0">{{ d.summary.unmatchedLines }}</dd></div>
        <div><dt>Phiếu chưa lên sao kê</dt><dd class="num" [class.text-warning]="d.summary.unmatchedVouchers > 0">{{ d.summary.unmatchedVouchers }}</dd></div>
      </dl>

      <section class="section-bare">
        <h3>Số dư sổ sách và sao kê</h3>
        <div class="rp-surface book-wrap">
          <table class="book-table">
            <tbody>
              <tr><td>Số dư theo sổ sách (cuối ngày {{ formatDay(d.to) }})</td><td class="r num">{{ money(d.bookBalance) }}</td></tr>
              <tr><td>+ Dòng sao kê chưa ghi sổ (vào − ra) · {{ d.summary.unmatchedLines }} dòng</td><td class="r num">{{ money(d.summary.unmatchedLinesNet) }}</td></tr>
              <tr><td>− Phiếu chưa lên sao kê (thu − chi) · {{ d.summary.unmatchedVouchers }} phiếu</td><td class="r num">{{ money(d.summary.unmatchedVouchersNet) }}</td></tr>
              <tr class="book-sum"><td>= Số dư sao kê dự kiến</td><td class="r num">{{ money(expected()) }}</td></tr>
              <tr>
                <td><label for="dc-stmt">Số dư cuối kỳ trên sao kê (nhập để so)</label></td>
                <td class="r"><input id="dc-stmt" type="text" appMoney class="num money-input" placeholder="0" [ngModel]="statement()" (ngModelChange)="statement.set($event)" /></td>
              </tr>
            </tbody>
            @if (statement() !== null) {
              <tfoot><tr>
                <td>Chênh lệch chưa giải thích</td>
                <td class="r num" [class.amt-neg]="unexplained() !== 0" [class.is-zero]="unexplained() === 0">{{ money(unexplained()) }}</td>
              </tr></tfoot>
            }
          </table>
        </div>
        <p class="rp-notes">Chênh lệch chỉ có nghĩa khi các kỳ trước đã đối chiếu xong và khoảng ngày bắt đầu từ lúc mở tài khoản hoặc sau lần đối chiếu cuối.</p>
      </section>

      <section class="section-bare">
        <h3>Dòng sao kê</h3>
        <div class="rp-surface book-wrap">
          <table class="book-table">
            <thead><tr>
              <th scope="col">Ngày</th><th scope="col">Diễn giải</th><th scope="col">Số tham chiếu</th>
              <th scope="col" class="r">Tiền vào</th><th scope="col" class="r">Tiền ra</th><th scope="col">Khớp với phiếu</th><th scope="col"><span class="visually-hidden">Xoá</span></th>
            </tr></thead>
            <tbody>
              @for (l of pagedLines(); track l.id) {
                <tr>
                  <td class="num">{{ formatDay(l.date) }}</td><td>{{ l.description }}</td><td class="code">{{ l.reference }}</td>
                  <td class="r num" [class.is-zero]="!l.amountIn">{{ l.amountIn ? money(l.amountIn) : '—' }}</td>
                  <td class="r num" [class.is-zero]="!l.amountOut">{{ l.amountOut ? money(l.amountOut) : '—' }}</td>
                  <td>
                    @if (l.voucherCode) {
                      <span class="row-actions">
                        <span class="badge badge-success">{{ l.voucherCode }}</span>
                        <button type="button" class="btn row-act-btn" (click)="unmatch(l)">Bỏ khớp</button>
                      </span>
                    } @else {
                      <span class="row-actions">
                        <span class="badge badge-warning">Chưa ghi sổ</span>
                        @if (candidates(l).length) {
                          <select [attr.aria-label]="'Phiếu khớp dòng ' + (l.reference || l.date)" [value]="pick()[l.id] ?? ''" (change)="setPick(l.id, $any($event.target).value)">
                            <option value="">Chọn phiếu…</option>
                            @for (v of candidates(l); track v.id) { <option [value]="v.id">{{ v.code }} · {{ formatDay(v.date) }} · {{ money(v.amount) }}</option> }
                          </select>
                          <button type="button" class="btn row-act-btn" [disabled]="!pick()[l.id]" (click)="match(l)">Khớp</button>
                        }
                        @if (l.amountIn > 0 && canReceipt()) { <button type="button" class="btn row-act-btn" (click)="createVoucher(l)">Lập phiếu thu</button> }
                        @if (l.amountOut > 0 && canPayment()) { <button type="button" class="btn row-act-btn" (click)="createVoucher(l)">Lập phiếu chi</button> }
                      </span>
                    }
                  </td>
                  <td><button type="button" class="icon-action" [attr.aria-label]="'Xoá dòng sao kê ' + (l.reference || formatDay(l.date))" title="Xoá dòng" (click)="remove(l)"><app-nav-icon name="trash" /></button></td>
                </tr>
              } @empty {
                <tr><td class="book-none" colspan="7">Chưa có dòng sao kê trong khoảng ngày này. Nhập từ Excel hoặc thêm dòng tay.</td></tr>
              }
            </tbody>
          </table>
        </div>
        <app-pagination [total]="d.lines.length" unit="dòng sao kê" [(page)]="linePage" [(pageSize)]="linePageSize" />
        <p class="rp-notes">File Excel: dòng đầu là tiêu đề, cần cột ngày, diễn giải, số tham chiếu (nếu có), tiền vào (thu / ghi có) và tiền ra (chi / ghi nợ). Dòng cùng số tham chiếu đã nhập thì bỏ qua.</p>
      </section>

      <section class="section-bare">
        <h3>Phiếu chưa có trên sao kê</h3>
        <div class="rp-surface book-wrap">
          <table class="book-table">
            <thead><tr><th scope="col">Số phiếu</th><th scope="col">Ngày</th><th scope="col">Loại</th><th scope="col">Diễn giải</th><th scope="col" class="r">Thu</th><th scope="col" class="r">Chi</th></tr></thead>
            <tbody>
              @for (v of pagedVouchers(); track v.id) {
                <tr>
                  <td class="code">{{ v.code }}</td><td class="num">{{ formatDay(v.date) }}</td><td>{{ v.category }}</td><td>{{ v.description }}</td>
                  <td class="r num" [class.is-zero]="v.kind !== 'THU'">{{ v.kind === 'THU' ? money(v.amount) : '—' }}</td>
                  <td class="r num" [class.is-zero]="v.kind !== 'CHI'">{{ v.kind === 'CHI' ? money(v.amount) : '—' }}</td>
                </tr>
              } @empty {
                <tr><td class="book-none" colspan="6">Mọi phiếu của tài khoản này trong kỳ đã có trên sao kê.</td></tr>
              }
            </tbody>
          </table>
        </div>
        <app-pagination [total]="unmatchedVouchers().length" unit="phiếu" [(page)]="voucherPage" [(pageSize)]="voucherPageSize" />
      </section>
    } @else if (!failure()) {
      <div class="empty-state"><h3>Chọn tài khoản ngân hàng</h3><p>Chọn tài khoản và kỳ để so sao kê với sổ sách.</p></div>
    }
  `,
})
export class BankReconciliationComponent {
  protected readonly toast = inject(ToastService);
  /** A failure still shown by the page logic also raises a toast. */
  protected readonly failureToast = effect(() => this.toast.error(this.failure()));
  private readonly svc = inject(CashOpsService);
  private readonly store = inject(DataStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  readonly canReceipt = computed(() => this.auth.can('voucher.create_receipt'));
  readonly canPayment = computed(() => this.auth.can('voucher.create_payment'));
  readonly money = formatVnd;
  readonly formatDay = formatDay;

  readonly accounts = computed(() => this.store.cashAccounts().filter((a) => a.type === 'NGAN_HANG' && a.isActive !== false));
  readonly accountId = signal('');
  readonly period = signal<PeriodValue>({ preset: 'thisYear', range: { from: `${new Date().getFullYear()}-01-01`, to: isoDay(new Date()) } });
  readonly from = computed(() => this.period().range.from ?? '');
  readonly to = computed(() => this.period().range.to ?? '');
  readonly statement = signal<number | null>(null);
  readonly data = signal<ReconciliationView | null>(null);
  readonly failure = signal('');
  readonly busy = signal(false);
  readonly adding = signal(false);
  readonly manual = signal<StatementRowInput>({ date: isoDay(new Date()), description: '', reference: '', amountIn: undefined, amountOut: undefined });
  readonly pick = signal<Record<string, string>>({});

  readonly unmatchedVouchers = computed(() => (this.data()?.vouchers ?? []).filter((v) => !v.matched));

  // Both lists can run to hundreds of rows over a year: a page at a time, back to page 1 when the data or the period changes.
  readonly linePage = signal(1);
  readonly linePageSize = signal(20);
  readonly voucherPage = signal(1);
  readonly voucherPageSize = signal(20);
  readonly pagedLines = computed(() => {
    const start = (this.linePage() - 1) * this.linePageSize();
    return (this.data()?.lines ?? []).slice(start, start + this.linePageSize());
  });
  readonly pagedVouchers = computed(() => {
    const start = (this.voucherPage() - 1) * this.voucherPageSize();
    return this.unmatchedVouchers().slice(start, start + this.voucherPageSize());
  });
  // Matching a line or deleting one re-reads the data but keeps the page you were working on; a page past the end falls back.
  private readonly resetPages = effect(() => {
    this.accountId();
    this.period();
    untracked(() => { this.linePage.set(1); this.voucherPage.set(1); });
  });
  private readonly clampPages = effect(() => {
    const lines = Math.max(1, Math.ceil((this.data()?.lines.length ?? 0) / this.linePageSize()));
    const vouchers = Math.max(1, Math.ceil(this.unmatchedVouchers().length / this.voucherPageSize()));
    untracked(() => {
      if (this.linePage() > lines) this.linePage.set(lines);
      if (this.voucherPage() > vouchers) this.voucherPage.set(vouchers);
    });
  });
  /** Số dư sao kê dự kiến = sổ sách + dòng sao kê chưa ghi sổ − phiếu chưa lên sao kê. */
  readonly expected = computed(() => {
    const d = this.data();
    return d ? d.bookBalance + d.summary.unmatchedLinesNet - d.summary.unmatchedVouchersNet : 0;
  });
  readonly unexplained = computed(() => (this.statement() ?? 0) - this.expected());

  constructor() {
    // Quay lại từ màn lập phiếu (hoặc liên kết) với ?account= &from= &to= thì giữ nguyên bộ lọc.
    const q = this.route.snapshot.queryParamMap;
    const wanted = q.get('account');
    const first = this.accounts().find((a) => a.id === wanted) ?? this.accounts()[0];
    const day = /^\d{4}-\d{2}-\d{2}$/;
    if (day.test(q.get('from') ?? '') && day.test(q.get('to') ?? '')) this.period.set({ preset: 'custom', range: { from: q.get('from')!, to: q.get('to')! } });
    if (first) { this.accountId.set(first.id); this.load(); }
    this.toast.fromNavigation();
  }

  /** Dòng sao kê chưa ghi sổ → màn lập phiếu thu / chi điền sẵn tài khoản, ngày, số tiền, diễn giải; lập xong tự khớp dòng này. */
  createVoucher(l: StatementLineView) {
    const back = `/thu-chi/doi-chieu-ngan-hang?${new URLSearchParams({ account: this.accountId(), from: this.from(), to: this.to() })}`;
    const amount = l.amountIn > 0 ? l.amountIn : l.amountOut;
    const queryParams: Record<string, string> = { account: this.accountId(), date: l.date, amount: String(amount), line: l.id, back };
    const desc = [l.description, l.reference].filter(Boolean).join(' · ');
    if (desc) queryParams['desc'] = desc;
    void this.router.navigate(['/thu-chi/lap', l.amountIn > 0 ? 'thu' : 'chi'], { queryParams });
  }

  /** Phiếu chưa khớp, cùng chiều và số tiền với dòng sao kê. */
  candidates(l: StatementLineView) {
    return this.unmatchedVouchers().filter((v) => (v.kind === 'THU' ? l.amountIn === v.amount && l.amountIn > 0 : l.amountOut === v.amount && l.amountOut > 0));
  }

  onPeriod(v: PeriodValue) {
    this.period.set(v);
    this.load();
  }

  setPick(lineId: string, voucherId: string) {
    this.pick.update((p) => ({ ...p, [lineId]: voucherId }));
  }

  patchManual(change: Partial<StatementRowInput>) {
    this.manual.update((m) => ({ ...m, ...change }));
  }

  async load() {
    this.failure.set('');
    if (!this.accountId() || !this.from() || !this.to()) { this.data.set(null); return; }
    try { this.data.set(await this.svc.reconciliation(this.accountId(), this.from(), this.to())); }
    catch (e) { this.data.set(null); this.failure.set(errorText(e)); }
  }

  private async run(action: () => Promise<unknown>, done?: string) {
    if (this.busy()) return;
    this.busy.set(true);
    this.failure.set('');
    try {
      await action();
      if (done) this.toast.success(done);
      await this.load();
    } catch (e) {
      this.failure.set(errorText(e));
    } finally {
      this.busy.set(false);
    }
  }

  /** File mẫu: đúng các cột phần mềm đọc, vài dòng ví dụ (nền vàng) và sheet hướng dẫn. Sao kê tải từ ngân hàng thường đã đủ các cột này. */
  async downloadSample() {
    await downloadWorkbook('Mẫu nhập sao kê ngân hàng.xlsx', [{
      name: 'Sao kê',
      columns: [
        { header: 'Ngày', width: 14, required: true }, { header: 'Diễn giải', width: 44 }, { header: 'Số tham chiếu', width: 20 },
        { header: 'Thu (Ghi có)', width: 18, numFmt: '#,##0' }, { header: 'Chi (Ghi nợ)', width: 18, numFmt: '#,##0' },
      ],
      rows: [],
      exampleRows: [
        ['05/11/2026', 'CTY KHUNG TRANH A CHAU CK THANH TOAN DH0000110', 'FT26309001234', 5_000_000, ''],
        ['06/11/2026', 'THANH TOAN TIEN HANG NCC GO PHU THINH', 'FT26310005678', '', 12_500_000],
        ['09/11/2026', 'PHI QUAN LY TAI KHOAN THANG 11', 'FEE26313000001', '', 55_000],
      ],
      notes: {
        title: 'Nhập sao kê ngân hàng — hướng dẫn',
        lines: [
          'Dòng đầu là tiêu đề cột. Mỗi dòng sau là một giao dịch trên sao kê.',
          'Cần cột Ngày và ít nhất một trong hai cột tiền: Thu (Ghi có) = tiền vào, Chi (Ghi nợ) = tiền ra. Mỗi dòng chỉ ghi một trong hai.',
          'Số tham chiếu (mã giao dịch của ngân hàng) nên có: dòng cùng số tham chiếu đã nhập trước đó sẽ được bỏ qua, nên nhập lại cùng một sao kê không nhân đôi.',
          'Cột có thể đặt tên khác: Ngày giao dịch, Nội dung giao dịch, Mã giao dịch, Tiền vào, Tiền ra, Ghi nợ, Ghi có… Phần mềm tự nhận.',
          'Ngày ghi dạng 05/11/2026 hoặc ô ngày của Excel. Số tiền ghi số thường (5000000) hoặc kiểu Việt Nam (5.000.000).',
          'Sau khi nhập, dùng "Tự khớp" để ghép dòng sao kê với phiếu thu / chi cùng số tiền và ngày gần nhau.',
        ],
      },
    }]);
  }

  async onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.failure.set(''); // the same bad file twice must say so twice: the toast follows changes of `failure`
    try {
      const { headers, rows } = await readSheet(file);
      const col = (names: string[]) => names.find((n) => headers.includes(n));
      const c = { date: col(COLS.date), description: col(COLS.description), reference: col(COLS.reference), amountIn: col(COLS.amountIn), amountOut: col(COLS.amountOut) };
      if (!c.date || (!c.amountIn && !c.amountOut)) {
        this.failure.set('Không tìm thấy cột ngày và cột tiền vào / tiền ra. Dòng đầu của file cần có tiêu đề như: Ngày, Diễn giải, Số tham chiếu, Thu (Ghi có), Chi (Ghi nợ).');
        return;
      }
      const out: StatementRowInput[] = [];
      for (const r of rows) {
        const date = parseDay(r.cells.get(c.date));
        const amountIn = c.amountIn ? parseMoney(r.cells.get(c.amountIn)) : 0;
        const amountOut = c.amountOut ? parseMoney(r.cells.get(c.amountOut)) : 0;
        if (!date) { this.failure.set(`Dòng ${r.rowNumber}: ngày không đọc được.`); return; }
        if (!amountIn && !amountOut) continue; // dòng tổng, dòng trống
        out.push({
          date, amountIn: amountIn || undefined, amountOut: amountOut || undefined,
          description: c.description ? String(r.cells.get(c.description) ?? '').trim() || undefined : undefined,
          reference: c.reference ? String(r.cells.get(c.reference) ?? '').trim() || undefined : undefined,
        });
      }
      if (!out.length) { this.failure.set('File không có dòng giao dịch nào.'); return; }
      await this.run(async () => {
        const r = await this.svc.importStatement(this.accountId(), out);
        this.toast.success(`Đã nhập ${r.inserted} dòng sao kê${r.skipped ? `, bỏ ${r.skipped} dòng trùng số tham chiếu` : ''}.`);
      });
    } catch (e) {
      this.failure.set(errorText(e));
    }
  }

  addManual() {
    const m = this.manual();
    return this.run(async () => {
      await this.svc.importStatement(this.accountId(), [{
        date: m.date, description: m.description?.trim() || undefined, reference: m.reference?.trim() || undefined,
        amountIn: m.amountIn ? Math.round(m.amountIn) : undefined, amountOut: m.amountOut ? Math.round(m.amountOut) : undefined,
      }]);
      this.manual.set({ date: m.date, description: '', reference: '', amountIn: undefined, amountOut: undefined });
      this.toast.success('Đã thêm dòng sao kê.');
    });
  }

  auto() {
    return this.run(async () => {
      const r = await this.svc.autoMatch(this.accountId(), this.from(), this.to());
      this.toast.success(`Đã tự khớp ${r.matched}/${r.lines} dòng chưa khớp (cùng chiều, cùng số tiền, lệch ngày tối đa 3 ngày).`);
    });
  }

  match(l: StatementLineView) {
    return this.run(() => this.svc.match(l.id, this.pick()[l.id]), 'Đã khớp dòng sao kê với phiếu.');
  }

  unmatch(l: StatementLineView) {
    return this.run(() => this.svc.unmatch(l.id), 'Đã bỏ khớp.');
  }

  remove(l: StatementLineView) {
    return this.run(() => this.svc.removeLine(l.id), 'Đã xoá dòng sao kê.');
  }
}
