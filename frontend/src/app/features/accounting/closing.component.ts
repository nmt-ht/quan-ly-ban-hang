/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { Component, computed, inject, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AccountingService } from '../../core/services/accounting.service';
import { AuthService } from '../../core/services/auth.service';
import { errorText } from '../../core/api/api.service';
import { ClosingOverview, ClosingPreviewView } from '../../core/models/closing.models';
import { DateInputDirective } from '../../shared/date-input/date-input.directive';
import { formatVnd } from '../../shared/format.util';
import { formatDay, isoDay } from '../../shared/period';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { ToastService } from '../../core/services/toast.service';

/** /ke-toan/ket-chuyen — kết chuyển lãi lỗ đến một ngày, huỷ lần gần nhất, đóng sổ năm. */
@Component({
  selector: 'app-accounting-closing',
  standalone: true,
  imports: [FormsModule, RouterLink, DateInputDirective, NavIconComponent],
  template: `
    <div class="page-header">
      <div>
        <h1>Kết chuyển cuối kỳ</h1>
        <p class="subtitle">Kết chuyển doanh thu, chi phí sang 911 rồi lãi lỗ sang 421; cuối năm đóng sổ để chuyển số dư sang năm sau.</p>
      </div>
    </div>

    <div class="filters-bar">
      <input type="number" class="year-input" aria-label="Năm" min="2000" max="2100" [value]="year()" (change)="setYear(+$any($event.target).value)" />
    </div>
        
    @if (ov(); as o) {
      @if (!o.ledgerStartDate) {
        <div class="notice is-error" role="alert"><span>Sổ kế toán chưa bật. Đặt ngày bắt đầu ghi sổ ở <a routerLink="/ke-toan">Kế toán</a> trước.</span></div>
      }

      <section class="card section-block" aria-labelledby="kc-run">
        <h2 id="kc-run" class="form-section-title">Kết chuyển lãi lỗ</h2>
        @if (o.yearClose) {
          <p>Năm {{ o.year }} đã đóng sổ, không kết chuyển thêm được.</p>
        } @else {
          <p>
            Kết chuyển số dư doanh thu và chi phí từ đầu năm đến hết ngày chọn.
            @if (o.lastClosedDate) { Đã kết chuyển đến <b class="num">{{ day(o.lastClosedDate) }}</b>, chọn ngày sau đó. }
            Báo cáo kết quả kinh doanh vẫn giữ đủ số liệu sau khi kết chuyển.
          </p>
          <div class="form-grid">
            <div class="field">
              <label for="kc-date">Kết chuyển đến hết ngày</label>
              <input id="kc-date" appDate [max]="today" [ngModel]="date()" (ngModelChange)="setDate($event)" />
            </div>
          </div>
          @if (preview(); as p) {
            <dl class="list-totals">
              <div><dt>Doanh thu</dt><dd class="num">{{ money(p.revenue) }}</dd></div>
              <div><dt>Chi phí</dt><dd class="num">{{ money(p.expense) }}</dd></div>
              <div><dt>{{ p.profit >= 0 ? 'Lãi' : 'Lỗ' }}</dt><dd class="num" [class.amt-neg]="p.profit < 0">{{ money(Math.abs(p.profit)) }}</dd></div>
            </dl>
            @if (p.accounts.length) {
              <div class="rp-surface book-wrap">
                <table class="book-table">
                  <thead><tr><th scope="col">TK</th><th scope="col">Tên tài khoản</th><th scope="col" class="r">Số kết chuyển</th></tr></thead>
                  <tbody>
                    @for (a of p.accounts; track a.code) {
                      <tr><td class="code">{{ a.code }}</td><td>{{ a.name }}</td><td class="r num">{{ money(a.amount) }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="subtitle">Không còn số dư doanh thu, chi phí nào để kết chuyển đến ngày này.</p>
            }
          }
          @if (canClose) {
            <div class="toolbar">
              <button type="button" class="btn btn-primary" [disabled]="busy() || !preview()?.accounts?.length || !o.ledgerStartDate" (click)="close()">
                <app-nav-icon name="check" />Kết chuyển
              </button>
            </div>
          }
        }
      </section>

      <section class="card section-block" aria-labelledby="kc-list">
        <h2 id="kc-list" class="form-section-title">Các lần kết chuyển năm {{ o.year }}</h2>
        <div class="rp-surface book-wrap">
          <table class="book-table">
            <thead><tr>
              <th scope="col">Đến hết ngày</th><th scope="col" class="r">Lãi / lỗ</th><th scope="col">Người thực hiện</th><th scope="col">Trạng thái</th><th scope="col"><span class="visually-hidden">Thao tác</span></th>
            </tr></thead>
            <tbody>
              @for (c of o.closings; track c.id) {
                <tr [class.is-zero]="c.reversedAt">
                  <td class="num">{{ day(c.date) }}</td>
                  <td class="r num" [class.amt-neg]="c.profit < 0">{{ money(c.profit) }}</td>
                  <td>{{ c.createdByName }}</td>
                  <td>{{ c.reversedAt ? 'Đã huỷ' : 'Đang hiệu lực' }}</td>
                  <td class="r">
                    @if (c.canReverse && canReverse) { <button type="button" class="btn btn-danger-ghost" [disabled]="busy()" (click)="reverse(c.id, c.date)">Huỷ kết chuyển</button> }
                  </td>
                </tr>
              } @empty { <tr><td class="book-none" colspan="5">Năm này chưa kết chuyển lần nào.</td></tr> }
            </tbody>
          </table>
        </div>
      </section>

      <section class="card section-block" aria-labelledby="kc-year">
        <h2 id="kc-year" class="form-section-title">Đóng sổ năm {{ o.year }}</h2>
        @if (o.yearClose; as y) {
          <p>
            Đã đóng sổ bởi {{ y.closedByName }}: {{ y.profit >= 0 ? 'lãi' : 'lỗ' }} <b class="num">{{ money(Math.abs(y.profit)) }}</b>.
            Số dư cuối năm đã chuyển sang số dư đầu năm {{ o.year + 1 }}{{ o.lockDate ? ', khoá sổ đến ' + day(o.lockDate) : '' }}.
          </p>
          @if (o.nextYearClosed) {
            <p class="subtitle">Năm {{ o.year + 1 }} cũng đã đóng sổ; muốn mở lại năm {{ o.year }} thì mở lại năm {{ o.year + 1 }} trước.</p>
          } @else if (canYear) {
            <p class="subtitle">Mở lại để sửa chứng từ của năm: ngày khoá sổ trả về như trước khi đóng, số dư đầu năm {{ o.year + 1 }} sẽ tính lại khi đóng sổ lại.</p>
            <div class="toolbar">
              <button type="button" class="btn" [disabled]="busy()" (click)="reopenYear()">Mở lại năm {{ o.year }}</button>
            </div>
          }
        } @else {
          <p>
            Đóng sổ năm kết chuyển nốt đến 31/12, chuyển số dư cuối năm sang số dư đầu năm {{ o.year + 1 }} và khoá sổ đến 31/12/{{ o.year }}:
            chứng từ năm {{ o.year }} không lập, sửa hay huỷ được nữa cho đến khi mở lại năm.
          </p>
          @if (o.yearBlocker) { <p class="subtitle">{{ o.yearBlocker }}</p> }
          @if (!o.citAssessed) {
            <p class="subtitle">Chưa quyết toán thuế TNDN năm {{ o.year }}: làm ở <a routerLink="/ke-toan/thue-tndn">Thuế TNDN</a> trước khi đóng sổ để lợi nhuận kết chuyển là lợi nhuận sau thuế.</p>
          }
          @if (canYear) {
            <div class="toolbar">
              <button type="button" class="btn btn-primary" [disabled]="busy() || !!o.yearBlocker" (click)="closeYear()">Đóng sổ năm {{ o.year }}</button>
            </div>
          } @else {
            <p class="subtitle">Cần quyền nhập số dư đầu kỳ và khoá sổ để đóng sổ năm.</p>
          }
        }
      </section>
    } @else if (!failure()) {
      <p class="subtitle">Đang tải…</p>
    }
  `,
})
export class AccountingClosingComponent {
  protected readonly toast = inject(ToastService);
  /** A failure still shown by the page logic also raises a toast. */
  protected readonly failureToast = effect(() => this.toast.error(this.failure()));
  private readonly svc = inject(AccountingService);
  private readonly confirmer = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  readonly canClose = this.auth.can('accounting.manual');
  readonly canReverse = this.auth.can('accounting.reverse');
  readonly canYear = this.auth.can('accounting.opening') && this.auth.can('period.lock');
  readonly Math = Math;
  readonly money = formatVnd;
  readonly day = formatDay;
  readonly today = isoDay(new Date());

  readonly year = signal(new Date().getFullYear());
  readonly ov = signal<ClosingOverview | null>(null);
  readonly date = signal('');
  readonly preview = signal<ClosingPreviewView | null>(null);
  readonly failure = signal('');
  readonly busy = signal(false);
  readonly yearEnd = computed(() => `${this.year()}-12-31`);

  constructor() { void this.load(); }

  setYear(y: number): void {
    if (!y) return;
    this.year.set(y);
    void this.load();
  }

  async load(): Promise<void> {
    this.failure.set('');
    try {
      this.ov.set(await this.svc.closingOverview(this.year()));
      const end = this.yearEnd();
      this.date.set(end > this.today ? this.today : end);
      await this.loadPreview();
    } catch (e) {
      this.ov.set(null);
      this.failure.set(errorText(e));
    }
  }

  setDate(value: string): void {
    this.date.set(value);
    void this.loadPreview();
  }

  private async loadPreview(): Promise<void> {
    const d = this.date();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d.slice(0, 4) !== String(this.year())) {
      this.preview.set(null);
      return;
    }
    try { this.preview.set(await this.svc.closingPreview(d)); }
    catch (e) { this.preview.set(null); this.failure.set(errorText(e)); }
  }

  private async run(work: () => Promise<string>): Promise<void> {
    this.busy.set(true); this.failure.set(''); this.toast.clear();
    try { this.toast.success(await work()); await this.load(); }
    catch (e) { this.failure.set(errorText(e)); }
    finally { this.busy.set(false); }
  }

  async close(): Promise<void> {
    const d = this.date();
    const p = this.preview();
    const ok = await this.confirmer.ask({
      title: `Kết chuyển lãi lỗ đến hết ngày ${formatDay(d)}?`,
      message: `${p ? `Kỳ này ${p.profit >= 0 ? 'lãi' : 'lỗ'} ${formatVnd(Math.abs(p.profit))}. ` : ''}Tạo các bút toán 511 / 632 / 642… → 911 → 421. Huỷ lại được nếu chưa đóng sổ năm.`,
      confirmLabel: 'Kết chuyển', tone: 'primary',
    });
    if (!ok) return;
    return this.run(async () => {
      const r = await this.svc.closePeriod(d);
      return `Đã kết chuyển đến hết ngày ${formatDay(r.date)}: ${r.profit >= 0 ? 'lãi' : 'lỗ'} ${formatVnd(Math.abs(r.profit))}.`;
    });
  }

  async reverse(id: string, date: string): Promise<void> {
    const ok = await this.confirmer.ask({ title: `Huỷ lần kết chuyển đến hết ngày ${formatDay(date)}?`, message: 'Các bút toán kết chuyển được đảo lại.', confirmLabel: 'Huỷ kết chuyển', cancelLabel: 'Không huỷ', tone: 'danger' });
    if (!ok) return;
    return this.run(async () => { await this.svc.reverseClosing(id); return 'Đã huỷ lần kết chuyển.'; });
  }

  async closeYear(): Promise<void> {
    const y = this.year();
    const ok = await this.confirmer.ask({
      title: `Đóng sổ năm ${y}?`,
      message: `Hệ thống kết chuyển nốt, chuyển số dư cuối năm sang đầu năm ${y + 1} (thay số dư đầu năm ${y + 1} đã nhập) và khoá sổ đến 31/12/${y}.`,
      confirmLabel: 'Đóng sổ', tone: 'danger',
    });
    if (!ok) return;
    return this.run(async () => {
      const r = await this.svc.closeYear(y);
      return `Đã đóng sổ năm ${r.year}: ${r.profit >= 0 ? 'lãi' : 'lỗ'} ${formatVnd(Math.abs(r.profit))}, chuyển ${r.carriedAccounts} số dư sang năm ${r.year + 1}.`;
    });
  }

  async reopenYear(): Promise<void> {
    const y = this.year();
    const ok = await this.confirmer.ask({ title: `Mở lại năm ${y}?`, message: 'Ngày khoá sổ trở về như trước khi đóng.', confirmLabel: 'Mở lại', tone: 'primary' });
    if (!ok) return;
    return this.run(async () => { await this.svc.reopenYear(y); return `Đã mở lại năm ${y}.`; });
  }
}
