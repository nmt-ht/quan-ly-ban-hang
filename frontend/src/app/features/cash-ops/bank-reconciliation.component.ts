import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorText } from '../../core/api/api.service';
import { DataStore } from '../../core/services/data-store.service';
import { ReconciliationView, StatementLineView, StatementRowInput } from '../../core/models/cash-ops.models';
import { readSheet } from '../../shared/excel.util';
import { formatVnd } from '../../shared/format.util';
import { formatDay, isoDay } from '../../shared/period';
import { CashOpsService } from './cash-ops.service';

// Tiêu đề cột thường gặp của sao kê (đã bỏ dấu, chữ thường): cột nào khớp trước thì dùng.
const COLS = {
  date: ['ngay', 'ngay giao dich', 'ngay gd', 'ngay hach toan', 'date'],
  description: ['dien giai', 'noi dung', 'noi dung giao dich', 'mo ta', 'description'],
  reference: ['so tham chieu', 'ma giao dich', 'so but toan', 'tham chieu', 'so ct', 'reference'],
  amountIn: ['thu', 'ghi co', 'tien vao', 'so tien vao', 'phat sinh co', 'credit'],
  amountOut: ['chi', 'ghi no', 'tien ra', 'so tien ra', 'phat sinh no', 'debit'],
};

function parseDay(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v ?? '').trim();
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(s);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return ymd ? `${ymd[1]}-${ymd[2]}-${ymd[3]}` : null;
}

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
  imports: [FormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Đối chiếu ngân hàng</h1>
        <p class="subtitle">Nhập sao kê, khớp với phiếu thu / chi, tìm khoản chưa ghi sổ hoặc chưa lên sao kê.</p>
      </div>
    </div>
    @if (failure()) { <div class="notice is-error" role="alert">{{ failure() }}</div> }
    @if (notice()) { <div class="notice" role="status">{{ notice() }}</div> }

    <div class="toolbar" style="flex-wrap:wrap; gap:8px; margin-bottom:12px">
      <label>Tài khoản ngân hàng
        <select [ngModel]="accountId()" (ngModelChange)="accountId.set($event); load()">
          <option value="">— Chọn —</option>
          @for (a of accounts(); track a.id) { <option [value]="a.id">{{ a.name }}</option> }
        </select>
      </label>
      <label>Từ ngày <input type="date" [ngModel]="from()" (ngModelChange)="from.set($event)" (change)="load()"></label>
      <label>Đến ngày <input type="date" [ngModel]="to()" (ngModelChange)="to.set($event)" (change)="load()"></label>
      <label>Số dư cuối kỳ trên sao kê <input type="number" step="1" [ngModel]="statement()" (ngModelChange)="statement.set($event)" style="width:170px; text-align:right"></label>
    </div>

    @if (data(); as d) {
      <div class="toolbar" style="flex-wrap:wrap; gap:8px; margin-bottom:12px">
        <label class="btn">Nhập sao kê từ Excel <input type="file" accept=".xlsx" (change)="onFile($event)" style="display:none"></label>
        <button type="button" class="btn" (click)="adding.set(!adding())">Thêm dòng tay</button>
        <button type="button" class="btn btn-primary" [disabled]="busy() || !d.summary.unmatchedLines" (click)="auto()">Tự khớp</button>
      </div>
      <p class="subtitle">File Excel: dòng đầu là tiêu đề, cần cột ngày, diễn giải, số tham chiếu (nếu có), tiền vào (thu / ghi có) và tiền ra (chi / ghi nợ). Dòng cùng số tham chiếu đã nhập thì bỏ qua.</p>

      @if (adding()) {
        <div class="card" style="margin-bottom:12px">
          <div class="toolbar" style="flex-wrap:wrap; gap:8px">
            <label>Ngày <input type="date" [ngModel]="manual().date" (ngModelChange)="patchManual({ date: $event })"></label>
            <label>Diễn giải <input type="text" maxlength="500" [ngModel]="manual().description" (ngModelChange)="patchManual({ description: $event })" style="width:240px"></label>
            <label>Số tham chiếu <input type="text" maxlength="60" [ngModel]="manual().reference" (ngModelChange)="patchManual({ reference: $event })" style="width:130px"></label>
            <label>Tiền vào <input type="number" min="0" [ngModel]="manual().amountIn" (ngModelChange)="patchManual({ amountIn: $event })" style="width:130px; text-align:right"></label>
            <label>Tiền ra <input type="number" min="0" [ngModel]="manual().amountOut" (ngModelChange)="patchManual({ amountOut: $event })" style="width:130px; text-align:right"></label>
            <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="addManual()">Thêm</button>
          </div>
        </div>
      }

      <div class="card" style="margin-bottom:12px">
        <table style="width:100%; max-width:640px; border-collapse:collapse">
          <tbody>
            <tr><td>Số dư theo sổ sách (cuối ngày {{ formatDay(d.to) }})</td><td style="text-align:right">{{ money(d.bookBalance) }}</td></tr>
            <tr><td>+ Dòng sao kê chưa ghi sổ (vào − ra) · {{ d.summary.unmatchedLines }} dòng</td><td style="text-align:right">{{ money(d.summary.unmatchedLinesNet) }}</td></tr>
            <tr><td>− Phiếu chưa lên sao kê (thu − chi) · {{ d.summary.unmatchedVouchers }} phiếu</td><td style="text-align:right">{{ money(d.summary.unmatchedVouchersNet) }}</td></tr>
            <tr style="font-weight:700"><td>= Số dư sao kê dự kiến</td><td style="text-align:right">{{ money(expected()) }}</td></tr>
            @if (statement() !== null) {
              <tr><td>Số dư cuối kỳ trên sao kê</td><td style="text-align:right">{{ money(statement()!) }}</td></tr>
              <tr style="font-weight:700"><td>Chênh lệch chưa giải thích</td><td style="text-align:right" [class.text-danger]="unexplained() !== 0">{{ money(unexplained()) }}</td></tr>
            }
          </tbody>
        </table>
        <p class="subtitle" style="margin:8px 0 0">Đã khớp {{ d.summary.matched }}/{{ d.summary.lines }} dòng sao kê. Chênh lệch chỉ có nghĩa khi các kỳ trước đã đối chiếu xong và khoảng ngày bắt đầu từ lúc mở tài khoản hoặc sau lần đối chiếu cuối.</p>
      </div>

      <h2>Dòng sao kê</h2>
      <div class="card" style="overflow-x:auto; margin-bottom:12px">
        <table style="width:100%; border-collapse:collapse">
          <thead><tr>
            <th style="text-align:left">Ngày</th><th style="text-align:left">Diễn giải</th><th style="text-align:left">Số tham chiếu</th>
            <th style="text-align:right">Tiền vào</th><th style="text-align:right">Tiền ra</th><th style="text-align:left">Khớp với phiếu</th><th></th>
          </tr></thead>
          <tbody>
            @for (l of d.lines; track l.id) {
              <tr>
                <td>{{ formatDay(l.date) }}</td><td>{{ l.description }}</td><td>{{ l.reference }}</td>
                <td style="text-align:right">{{ l.amountIn ? money(l.amountIn) : '' }}</td><td style="text-align:right">{{ l.amountOut ? money(l.amountOut) : '' }}</td>
                <td>
                  @if (l.voucherCode) {
                    <span class="badge badge-success">{{ l.voucherCode }}</span>
                    <button type="button" class="btn btn-sm" (click)="unmatch(l)">Bỏ khớp</button>
                  } @else {
                    @if (candidates(l).length) {
                      <select [ngModel]="pick()[l.id] ?? ''" (ngModelChange)="setPick(l.id, $event)" [attr.aria-label]="'Phiếu khớp dòng ' + (l.reference || l.date)">
                        <option value="">— Chọn phiếu —</option>
                        @for (v of candidates(l); track v.id) { <option [value]="v.id">{{ v.code }} · {{ formatDay(v.date) }} · {{ money(v.amount) }}</option> }
                      </select>
                      <button type="button" class="btn btn-sm" [disabled]="!pick()[l.id]" (click)="match(l)">Khớp</button>
                    } @else {
                      <span class="badge badge-warning">Chưa ghi sổ</span>
                    }
                  }
                </td>
                <td><button type="button" class="btn btn-sm btn-danger-ghost" (click)="remove(l)">Xoá</button></td>
              </tr>
            } @empty {
              <tr><td colspan="7" style="text-align:center; padding:16px">Chưa có dòng sao kê trong khoảng ngày này. Nhập từ Excel hoặc thêm dòng tay.</td></tr>
            }
          </tbody>
        </table>
      </div>

      <h2>Phiếu chưa có trên sao kê</h2>
      <div class="card" style="overflow-x:auto">
        <table style="width:100%; border-collapse:collapse">
          <thead><tr><th style="text-align:left">Số phiếu</th><th style="text-align:left">Ngày</th><th style="text-align:left">Loại</th><th style="text-align:left">Diễn giải</th><th style="text-align:right">Thu</th><th style="text-align:right">Chi</th></tr></thead>
          <tbody>
            @for (v of unmatchedVouchers(); track v.id) {
              <tr>
                <td>{{ v.code }}</td><td>{{ formatDay(v.date) }}</td><td>{{ v.category }}</td><td>{{ v.description }}</td>
                <td style="text-align:right">{{ v.kind === 'THU' ? money(v.amount) : '' }}</td><td style="text-align:right">{{ v.kind === 'CHI' ? money(v.amount) : '' }}</td>
              </tr>
            } @empty {
              <tr><td colspan="6" style="text-align:center; padding:16px">Mọi phiếu của tài khoản này trong kỳ đã có trên sao kê.</td></tr>
            }
          </tbody>
        </table>
      </div>
    } @else if (!failure()) {
      <div class="card" style="padding:16px">Chọn tài khoản ngân hàng để bắt đầu.</div>
    }
  `,
})
export class BankReconciliationComponent {
  private readonly svc = inject(CashOpsService);
  private readonly store = inject(DataStore);
  readonly money = formatVnd;
  readonly formatDay = formatDay;

  readonly accounts = computed(() => this.store.cashAccounts().filter((a) => a.type === 'NGAN_HANG' && a.isActive !== false));
  readonly accountId = signal('');
  readonly from = signal(`${new Date().getFullYear()}-01-01`);
  readonly to = signal(isoDay(new Date()));
  readonly statement = signal<number | null>(null);
  readonly data = signal<ReconciliationView | null>(null);
  readonly failure = signal('');
  readonly notice = signal('');
  readonly busy = signal(false);
  readonly adding = signal(false);
  readonly manual = signal<StatementRowInput>({ date: isoDay(new Date()), description: '', reference: '', amountIn: undefined, amountOut: undefined });
  readonly pick = signal<Record<string, string>>({});

  readonly unmatchedVouchers = computed(() => (this.data()?.vouchers ?? []).filter((v) => !v.matched));
  /** Số dư sao kê dự kiến = sổ sách + dòng sao kê chưa ghi sổ − phiếu chưa lên sao kê. */
  readonly expected = computed(() => {
    const d = this.data();
    return d ? d.bookBalance + d.summary.unmatchedLinesNet - d.summary.unmatchedVouchersNet : 0;
  });
  readonly unexplained = computed(() => (this.statement() ?? 0) - this.expected());

  constructor() {
    const first = this.accounts()[0];
    if (first) { this.accountId.set(first.id); this.load(); }
  }

  /** Phiếu chưa khớp, cùng chiều và số tiền với dòng sao kê. */
  candidates(l: StatementLineView) {
    return this.unmatchedVouchers().filter((v) => (v.kind === 'THU' ? l.amountIn === v.amount && l.amountIn > 0 : l.amountOut === v.amount && l.amountOut > 0));
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
      if (done) this.notice.set(done);
      await this.load();
    } catch (e) {
      this.failure.set(errorText(e));
    } finally {
      this.busy.set(false);
    }
  }

  async onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.notice.set('');
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
        this.notice.set(`Đã nhập ${r.inserted} dòng sao kê${r.skipped ? `, bỏ ${r.skipped} dòng trùng số tham chiếu` : ''}.`);
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
      this.notice.set('Đã thêm dòng sao kê.');
    });
  }

  auto() {
    return this.run(async () => {
      const r = await this.svc.autoMatch(this.accountId(), this.from(), this.to());
      this.notice.set(`Đã tự khớp ${r.matched}/${r.lines} dòng chưa khớp (cùng chiều, cùng số tiền, lệch ngày tối đa 3 ngày).`);
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
