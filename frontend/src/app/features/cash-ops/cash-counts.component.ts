/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { Component, TemplateRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorText } from '../../core/api/api.service';
import { AuthService } from '../../core/services/auth.service';
import { DataStore } from '../../core/services/data-store.service';
import { CashCountView, CountResolution } from '../../core/models/cash-ops.models';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { formatVnd } from '../../shared/format.util';
import { formatDay, isoDay } from '../../shared/period';
import { CashOpsService } from './cash-ops.service';
import { DateInputDirective } from '../../shared/date-input/date-input.directive';

/** Mệnh giá tiền Việt Nam đang lưu hành, từ cao xuống thấp. */
const NOTES = [500_000, 200_000, 100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000, 500];

/**
 * /thu-chi/kiem-ke-quy — kiểm kê quỹ tiền mặt: đếm tiền theo mệnh giá, so với số dư sổ sách cuối ngày, ghi biên bản thừa / thiếu quỹ.
 * Chênh lệch ghi trên biên bản; "Xử lý chênh lệch" lập phiếu chi (thiếu) hoặc phiếu thu (thừa) để sổ quỹ và sổ cái khớp số đếm.
 */
@Component({
  selector: 'app-cash-counts',
  standalone: true,
  imports: [DateInputDirective, FormsModule, NavIconComponent, DataTableComponent],
  template: `
    <div class="page-header">
      <div>
        <h1>Kiểm kê quỹ</h1>
        <p class="subtitle">Đếm tiền mặt theo mệnh giá và so với số dư sổ sách cuối ngày kiểm kê.</p>
      </div>
      @if (canCreate() && !creating()) {
        <div class="toolbar">
          <button type="button" class="btn btn-primary" (click)="start()"><app-nav-icon name="plus" />Lập biên bản kiểm kê</button>
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
      <section class="card section-block" aria-labelledby="kk-new">
        <h2 id="kk-new" class="form-section-title">Biên bản kiểm kê mới</h2>
        <div class="form-grid-3">
          <div class="field">
            <label for="kk-acc">Quỹ tiền mặt <span class="required-mark">*</span></label>
            <select id="kk-acc" [ngModel]="accountId()" (ngModelChange)="accountId.set($event)">
              <option value="">— Chọn —</option>
              @for (a of accounts(); track a.id) { <option [value]="a.id">{{ a.name }}</option> }
            </select>
          </div>
          <div class="field">
            <label for="kk-date">Ngày kiểm kê <span class="required-mark">*</span></label>
            <input id="kk-date" appDate [max]="today" [ngModel]="date()" (ngModelChange)="date.set($event)" />
          </div>
          <div class="field">
            <label for="kk-by">Người kiểm kê</label>
            <input id="kk-by" type="text" maxlength="100" [ngModel]="countedBy()" (ngModelChange)="countedBy.set($event)" />
          </div>
        </div>

        <div class="book-wrap rp-surface">
          <table class="line-table book-table">
            <thead><tr><th scope="col">Mệnh giá</th><th scope="col" class="r">Số tờ</th><th scope="col" class="r">Thành tiền</th></tr></thead>
            <tbody>
              @for (n of notes; track n) {
                <tr>
                  <td class="num">{{ money(n) }}</td>
                  <td class="r"><input type="number" min="0" step="1" class="num count-input" [ngModel]="counts()[n] ?? null" (ngModelChange)="setCount(n, $event)" [attr.aria-label]="'Số tờ ' + money(n)" /></td>
                  <td class="r num" [class.is-zero]="!(counts()[n] ?? 0)">{{ (counts()[n] ?? 0) ? money(n * (counts()[n] ?? 0)) : '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <dl class="list-totals">
          <div><dt>Tổng tiền đếm được</dt><dd class="num">{{ money(counted()) }}</dd></div>
          <div><dt>Số dư sổ sách cuối ngày {{ date() ? formatDay(date()) : '' }}</dt><dd class="num">{{ book() === null ? '…' : money(book()!) }}</dd></div>
          @if (book() !== null) {
            <div><dt>Chênh lệch</dt><dd class="num" [class.text-danger]="counted() - book()! !== 0">{{ diffText(counted() - book()!) }}</dd></div>
          }
        </dl>

        <div class="field">
          <label for="kk-note">Ghi chú</label>
          <input id="kk-note" type="text" maxlength="500" [ngModel]="note()" (ngModelChange)="note.set($event)" />
        </div>
        @if (issue()) { <p class="hint text-danger" role="alert">{{ issue() }}</p> }
        <div class="toolbar">
          <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="save()">Lưu biên bản</button>
          <button type="button" class="btn" (click)="creating.set(false)">Bỏ qua</button>
        </div>
      </section>
    }

    @if (resolveRow(); as c) {
      <section class="card section-block" aria-labelledby="kk-res">
        <h2 id="kk-res" class="form-section-title">Xử lý chênh lệch của {{ c.code }}: {{ diffText(c.difference) }}</h2>
        <div class="form-grid">
          <div class="field">
            <label for="kk-opt">Cách xử lý</label>
            <select id="kk-opt" [ngModel]="resolving()!.option" (ngModelChange)="resolving.set({ id: c.id, option: $event })">
              @for (o of options(c.difference); track o.option) { <option [value]="o.option">{{ o.label }}</option> }
            </select>
            <span class="hint">Lập một phiếu {{ c.difference < 0 ? 'chi' : 'thu' }} {{ money(c.difference < 0 ? -c.difference : c.difference) }} ngày kiểm kê; huỷ biên bản thì phiếu huỷ theo.</span>
          </div>
        </div>
        <div class="toolbar">
          <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="resolve(c)">Lập phiếu {{ c.difference < 0 ? 'chi' : 'thu' }}</button>
          <button type="button" class="btn" (click)="resolving.set(null)">Bỏ qua</button>
        </div>
      </section>
    }

    <div class="filters-bar">
      <button type="button" class="filter-toggle" [attr.aria-pressed]="pendingOnly()" (click)="pendingOnly.set(!pendingOnly())">Chỉ chênh lệch chưa xử lý</button>
      <button type="button" class="filter-toggle" [attr.aria-pressed]="showCancelled()" (click)="showCancelled.set(!showCancelled())">Hiện biên bản đã huỷ</button>
    </div>

    @if (rows().length) {
      <dl class="list-totals">
        <div><dt>Biên bản</dt><dd class="num">{{ liveCount() }}</dd></div>
        <div><dt>Chênh lệch chưa xử lý</dt><dd class="num" [class.text-warning]="pendingCount() > 0">{{ pendingCount() }}</dd></div>
      </dl>
    }

    <app-data-table
      [columns]="columns" [rows]="visible()" [actions]="rowActions()" emptyTitle="Chưa có biên bản kiểm kê quỹ"
      [emptyHint]="rows().length ? 'Không có biên bản nào khớp bộ lọc.' : 'Lập biên bản đầu tiên để so số tiền thực tế với sổ sách.'" />

    <ng-template #rowActionsTpl let-c>
      @if (!c.isCancelled && canCreate()) {
        <span class="row-actions">
          @if (c.difference !== 0 && !c.resolutionVoucherCode) {
            <button type="button" class="btn row-act-btn" (click)="resolving.set({ id: c.id, option: 'CHO_XU_LY' })">Xử lý chênh lệch</button>
          }
          @if (c.resolutionVoucherCode) {
            <button type="button" class="btn row-act-btn" (click)="unresolve(c)">Huỷ xử lý</button>
          }
          <button type="button" class="btn row-act-btn btn-danger-ghost" (click)="cancel(c)">Huỷ</button>
        </span>
      }
    </ng-template>
  `,
  styles: [`.count-input { width: 6rem; text-align: right; }`],
})
export class CashCountsComponent {
  private readonly svc = inject(CashOpsService);
  private readonly auth = inject(AuthService);
  private readonly store = inject(DataStore);
  readonly money = formatVnd;
  readonly formatDay = formatDay;
  readonly notes = NOTES;
  readonly today = isoDay(new Date());
  private readonly rowActionsRef = viewChild<TemplateRef<{ $implicit: CashCountView }>>('rowActionsTpl');
  readonly rowActions = computed(() => this.rowActionsRef());

  readonly columns: DataTableColumn<CashCountView>[] = [
    { key: 'code', label: 'Số biên bản', copy: true },
    { key: 'date', label: 'Ngày', format: (c) => formatDay(c.date), mono: true },
    { key: 'accountName', label: 'Quỹ' },
    { key: 'bookAmount', label: 'Sổ sách', align: 'right', format: (c) => formatVnd(c.bookAmount) },
    { key: 'countedAmount', label: 'Thực tế', align: 'right', format: (c) => formatVnd(c.countedAmount) },
    { key: 'difference', label: 'Chênh lệch', align: 'right', format: (c) => this.diffText(c.difference), tone: (c) => c.difference, toneFlow: false },
    { key: 'countedBy', label: 'Người kiểm kê' },
    { key: 'status', label: 'Trạng thái', format: (c) => this.statusText(c), badge: (c) => this.statusClass(c) },
  ];

  readonly rows = signal<CashCountView[]>([]);
  readonly failure = signal('');
  readonly notice = signal('');
  readonly busy = signal(false);
  readonly creating = signal(false);
  readonly pendingOnly = signal(false);
  readonly showCancelled = signal(false);
  /** Biên bản đang chọn cách xử lý chênh lệch. */
  readonly resolving = signal<{ id: string; option: CountResolution } | null>(null);
  readonly resolveRow = computed(() => this.rows().find((c) => c.id === this.resolving()?.id) ?? null);
  readonly canCreate = computed(() => this.auth.can('voucher.manage_account'));
  readonly accounts = computed(() => this.store.cashAccounts().filter((a) => a.type === 'TIEN_MAT' && a.isActive !== false));

  private readonly needsResolve = (c: CashCountView) => !c.isCancelled && c.difference !== 0 && !c.resolutionVoucherCode;
  readonly liveCount = computed(() => this.rows().filter((c) => !c.isCancelled).length);
  readonly pendingCount = computed(() => this.rows().filter(this.needsResolve).length);
  readonly visible = computed(() =>
    this.rows().filter((c) => (this.showCancelled() || !c.isCancelled) && (!this.pendingOnly() || this.needsResolve(c))),
  );

  readonly accountId = signal('');
  readonly date = signal(isoDay(new Date()));
  readonly countedBy = signal('');
  readonly note = signal('');
  readonly counts = signal<Record<number, number>>({});
  readonly book = signal<number | null>(null);
  readonly counted = computed(() => NOTES.reduce((s, n) => s + n * (this.counts()[n] ?? 0), 0));
  readonly issue = computed(() => {
    if (!this.accountId()) return 'Chọn quỹ tiền mặt.';
    if (!this.date()) return 'Chọn ngày kiểm kê.';
    if (this.date() > isoDay(new Date())) return 'Ngày kiểm kê không được sau hôm nay.';
    return '';
  });

  constructor() {
    this.load();
    // Số dư sổ sách theo quỹ và ngày đang chọn.
    effect(() => {
      const id = this.accountId(), d = this.date();
      this.book.set(null);
      if (!id || !d || d > isoDay(new Date())) return;
      this.svc.bookAmount(id, d).then((r) => this.book.set(r.bookAmount)).catch(() => undefined);
    });
  }

  async load() {
    try { this.rows.set(await this.svc.counts()); } catch (e) { this.failure.set(errorText(e)); }
  }

  private statusText(c: CashCountView): string {
    if (c.isCancelled) return 'Đã huỷ';
    if (c.difference === 0) return 'Khớp';
    if (c.resolutionVoucherCode) return `Đã xử lý · ${c.resolutionVoucherCode}`;
    return c.difference > 0 ? 'Thừa quỹ' : 'Thiếu quỹ';
  }

  private statusClass(c: CashCountView): string {
    if (c.isCancelled) return 'badge-muted';
    if (c.difference === 0 || c.resolutionVoucherCode) return 'badge-success';
    return 'badge-warning';
  }

  start() {
    this.accountId.set(this.accounts()[0]?.id ?? ''); this.date.set(isoDay(new Date())); this.countedBy.set(''); this.note.set(''); this.counts.set({});
    this.failure.set('');
    this.resolving.set(null);
    this.creating.set(true);
  }

  setCount(n: number, v: number | null) {
    this.counts.update((c) => ({ ...c, [n]: Math.max(0, Math.floor(Number(v) || 0)) }));
  }

  diffText(d: number): string {
    return d === 0 ? 'Khớp' : d > 0 ? `Thừa ${formatVnd(d)}` : `Thiếu ${formatVnd(-d)}`;
  }

  async save() {
    if (this.busy()) return;
    if (this.issue()) { this.failure.set(this.issue()); return; }
    this.busy.set(true);
    this.failure.set('');
    try {
      const c = await this.svc.createCount({
        accountId: this.accountId(), date: this.date(), countedBy: this.countedBy().trim() || undefined, note: this.note().trim() || undefined,
        denominations: NOTES.filter((n) => (this.counts()[n] ?? 0) > 0).map((n) => ({ value: n, count: this.counts()[n] })),
      });
      this.creating.set(false);
      this.notice.set(`Đã lập biên bản ${c.code}: ${this.diffText(c.difference)}.`);
      await this.load();
    } catch (e) {
      this.failure.set(errorText(e));
    } finally {
      this.busy.set(false);
    }
  }

  /** Các cách xử lý chọn được (khớp CashCountsService.resolve): thiếu → phiếu chi, thừa → phiếu thu. */
  options(diff: number): { option: CountResolution; label: string }[] {
    return diff < 0
      ? [{ option: 'CHO_XU_LY', label: 'Thiếu quỹ chờ xử lý (Nợ 1381 / Có tiền)' }, { option: 'TINH_VAO_KET_QUA', label: 'Tính vào chi phí khác (Nợ 811 / Có tiền)' }]
      : [{ option: 'CHO_XU_LY', label: 'Thừa quỹ chờ giải quyết (Nợ tiền / Có 3381)' }, { option: 'TINH_VAO_KET_QUA', label: 'Tính vào thu nhập khác (Nợ tiền / Có 711)' }];
  }

  async resolve(c: CashCountView) {
    const r = this.resolving();
    if (!r || this.busy()) return;
    this.busy.set(true);
    this.failure.set('');
    try {
      const out = await this.svc.resolveCount(c, r.option);
      this.resolving.set(null);
      this.notice.set(`Đã lập phiếu ${out.resolutionVoucherCode} xử lý chênh lệch của ${c.code}.`);
      await this.load();
    } catch (e) {
      this.failure.set(errorText(e));
    } finally {
      this.busy.set(false);
    }
  }

  async unresolve(c: CashCountView) {
    this.failure.set('');
    try {
      await this.svc.unresolveCount(c);
      this.notice.set(`Đã huỷ phiếu xử lý chênh lệch của ${c.code}.`);
      await this.load();
    } catch (e) {
      this.failure.set(errorText(e));
    }
  }

  async cancel(c: CashCountView) {
    this.failure.set('');
    try {
      await this.svc.cancelCount(c);
      this.notice.set(`Đã huỷ biên bản ${c.code}${c.resolutionVoucherCode ? ` và phiếu xử lý ${c.resolutionVoucherCode}` : ''}.`);
      await this.load();
    } catch (e) {
      this.failure.set(errorText(e));
    }
  }
}
