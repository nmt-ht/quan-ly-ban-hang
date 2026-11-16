import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorText } from '../../core/api/api.service';
import { AuthService } from '../../core/services/auth.service';
import { DataStore } from '../../core/services/data-store.service';
import { CashCountView } from '../../core/models/cash-ops.models';
import { formatVnd } from '../../shared/format.util';
import { formatDay, isoDay } from '../../shared/period';
import { CashOpsService } from './cash-ops.service';

/** Mệnh giá tiền Việt Nam đang lưu hành, từ cao xuống thấp. */
const NOTES = [500_000, 200_000, 100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000, 500];

/**
 * /thu-chi/kiem-ke-quy — kiểm kê quỹ tiền mặt: đếm tiền theo mệnh giá, so với số dư sổ sách cuối ngày, ghi biên bản thừa / thiếu quỹ.
 * Chênh lệch chỉ ghi trên biên bản; xử lý bằng phiếu thu / phiếu chi như thường.
 */
@Component({
  selector: 'app-cash-counts',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Kiểm kê quỹ</h1>
        <p class="subtitle">Đếm tiền mặt theo mệnh giá và so với số dư sổ sách cuối ngày kiểm kê.</p>
      </div>
      @if (canCreate() && !creating()) { <button type="button" class="btn btn-primary" (click)="start()">Lập biên bản kiểm kê</button> }
    </div>
    @if (failure()) { <div class="notice is-error" role="alert">{{ failure() }}</div> }
    @if (notice()) { <div class="notice" role="status">{{ notice() }}</div> }

    @if (creating()) {
      <div class="card" style="margin-bottom:16px">
        <div class="toolbar" style="flex-wrap:wrap; gap:8px">
          <label>Quỹ tiền mặt <span class="required-mark">*</span>
            <select [ngModel]="accountId()" (ngModelChange)="accountId.set($event)">
              <option value="">— Chọn —</option>
              @for (a of accounts(); track a.id) { <option [value]="a.id">{{ a.name }}</option> }
            </select>
          </label>
          <label>Ngày kiểm kê <span class="required-mark">*</span> <input type="date" [ngModel]="date()" (ngModelChange)="date.set($event)"></label>
          <label>Người kiểm kê <input type="text" maxlength="100" [ngModel]="countedBy()" (ngModelChange)="countedBy.set($event)"></label>
        </div>
        <table style="width:100%; max-width:560px; border-collapse:collapse; margin:12px 0">
          <thead><tr><th style="text-align:left">Mệnh giá</th><th style="text-align:right">Số tờ</th><th style="text-align:right">Thành tiền</th></tr></thead>
          <tbody>
            @for (n of notes; track n) {
              <tr>
                <td>{{ money(n) }}</td>
                <td style="text-align:right"><input type="number" min="0" step="1" [ngModel]="counts()[n] ?? null" (ngModelChange)="setCount(n, $event)" style="width:90px; text-align:right" [attr.aria-label]="'Số tờ ' + n"></td>
                <td style="text-align:right">{{ (counts()[n] ?? 0) ? money(n * (counts()[n] ?? 0)) : '' }}</td>
              </tr>
            }
          </tbody>
          <tfoot><tr style="font-weight:700"><td colspan="2">Tổng tiền đếm được</td><td style="text-align:right">{{ money(counted()) }}</td></tr></tfoot>
        </table>
        <p>Số dư sổ sách cuối ngày {{ date() ? formatDay(date()) : '' }}: <b>{{ book() === null ? '…' : money(book()!) }}</b>
          @if (book() !== null) {
            · Chênh lệch:
            <b [class.text-danger]="counted() - book()! !== 0">{{ diffText(counted() - book()!) }}</b>
          }
        </p>
        <label style="display:block; margin:8px 0">Ghi chú
          <input type="text" maxlength="500" [ngModel]="note()" (ngModelChange)="note.set($event)" style="width:100%">
        </label>
        @if (issue()) { <p class="text-danger" role="alert" style="margin:0 0 8px">{{ issue() }}</p> }
        <div class="toolbar">
          <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="save()">Lưu biên bản</button>
          <button type="button" class="btn" (click)="creating.set(false)">Bỏ qua</button>
        </div>
      </div>
    }

    <div class="card" style="overflow-x:auto">
      <table style="width:100%; border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left">Số biên bản</th><th style="text-align:left">Ngày</th><th style="text-align:left">Quỹ</th>
          <th style="text-align:right">Sổ sách</th><th style="text-align:right">Thực tế</th><th style="text-align:right">Chênh lệch</th>
          <th style="text-align:left">Người kiểm kê</th><th style="text-align:left">Trạng thái</th><th></th>
        </tr></thead>
        <tbody>
          @for (c of rows(); track c.id) {
            <tr [style.opacity]="c.isCancelled ? 0.55 : 1">
              <td>{{ c.code }}</td><td>{{ formatDay(c.date) }}</td><td>{{ c.accountName }}</td>
              <td style="text-align:right">{{ money(c.bookAmount) }}</td><td style="text-align:right">{{ money(c.countedAmount) }}</td>
              <td style="text-align:right" [class.text-danger]="c.difference !== 0">{{ diffText(c.difference) }}</td>
              <td>{{ c.countedBy }}</td>
              <td>@if (c.isCancelled) { <span class="badge badge-muted" [title]="c.cancelReason || ''">Đã huỷ</span> } @else if (c.difference === 0) { <span class="badge badge-success">Khớp</span> } @else { <span class="badge badge-warning">{{ c.difference > 0 ? 'Thừa quỹ' : 'Thiếu quỹ' }}</span> }</td>
              <td>@if (!c.isCancelled && canCreate()) { <button type="button" class="btn btn-sm btn-danger-ghost" (click)="cancel(c)">Huỷ</button> }</td>
            </tr>
          } @empty {
            <tr><td colspan="9" style="text-align:center; padding:16px">Chưa có biên bản kiểm kê quỹ nào.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class CashCountsComponent {
  private readonly svc = inject(CashOpsService);
  private readonly auth = inject(AuthService);
  private readonly store = inject(DataStore);
  readonly money = formatVnd;
  readonly formatDay = formatDay;
  readonly notes = NOTES;

  readonly rows = signal<CashCountView[]>([]);
  readonly failure = signal('');
  readonly notice = signal('');
  readonly busy = signal(false);
  readonly creating = signal(false);
  readonly canCreate = computed(() => this.auth.can('voucher.manage_account'));
  readonly accounts = computed(() => this.store.cashAccounts().filter((a) => a.type === 'TIEN_MAT' && a.isActive !== false));

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

  start() {
    this.accountId.set(this.accounts()[0]?.id ?? ''); this.date.set(isoDay(new Date())); this.countedBy.set(''); this.note.set(''); this.counts.set({});
    this.failure.set('');
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

  async cancel(c: CashCountView) {
    this.failure.set('');
    try {
      await this.svc.cancelCount(c.id);
      this.notice.set(`Đã huỷ biên bản ${c.code}.`);
      await this.load();
    } catch (e) {
      this.failure.set(errorText(e));
    }
  }
}
