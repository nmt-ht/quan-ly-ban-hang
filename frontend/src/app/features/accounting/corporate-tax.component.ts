/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { Component, computed, inject, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AccountingService } from '../../core/services/accounting.service';
import { AuthService } from '../../core/services/auth.service';
import { errorText } from '../../core/api/api.service';
import { CitOverview, CitPeriod, CitPreview } from '../../core/models/cit.models';
import { formatVnd } from '../../shared/format.util';
import { formatDay } from '../../shared/period';
import { MoneyInputDirective } from '../../shared/money-input.directive';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { ToastService } from '../../core/services/toast.service';

const PERIODS: { value: CitPeriod; label: string }[] = [
  { value: 'Q1', label: 'Quý I' }, { value: 'Q2', label: 'Quý II' }, { value: 'Q3', label: 'Quý III' }, { value: 'Q4', label: 'Quý IV' },
  { value: 'Y', label: 'Quyết toán năm' },
];

/** /ke-toan/thue-tndn — tạm tính thuế TNDN theo quý, quyết toán năm, ghi Nợ 821 / Có 3334. */
@Component({
  selector: 'app-accounting-corporate-tax',
  standalone: true,
  imports: [FormsModule, RouterLink, MoneyInputDirective, NavIconComponent],
  template: `
    <div class="page-header">
      <div>
        <h1>Thuế thu nhập doanh nghiệp</h1>
        <p class="subtitle">Tạm tính theo quý và quyết toán năm, tính luỹ kế từ đầu năm. Số liệu là hỗ trợ: điều chỉnh, thuế suất và lỗ chuyển do kế toán xác nhận.</p>
      </div>
    </div>

    <div class="filters-bar">
      <input type="number" class="year-input" aria-label="Năm" min="2000" max="2100" [value]="year()" (change)="setYear(+$any($event.target).value)" />
    </div>
        
    @if (ov(); as o) {
      @if (!o.ledgerStartDate) {
        <div class="notice is-error" role="alert"><span>Sổ kế toán chưa bật. Đặt ngày bắt đầu ghi sổ ở <a routerLink="/ke-toan">Kế toán</a> trước.</span></div>
      }
      <dl class="list-totals">
        <div><dt>Thuế TNDN còn phải nộp (TK 3334)</dt><dd class="num">{{ money(o.payable) }}</dd></div>
        <div><dt>Đã ghi chi phí thuế năm {{ o.year }}</dt><dd class="num">{{ money(o.booked) }}</dd></div>
        <div><dt>Lỗ chuyển sang còn dùng được</dt><dd class="num">{{ money(o.lossAvailable) }}</dd></div>
      </dl>

      <section class="card section-block" aria-labelledby="cit-form">
        <h2 id="cit-form" class="form-section-title">Tính thuế kỳ mới</h2>
        @if (o.yearClosed) {
          <p>Năm {{ o.year }} đã đóng sổ. Mở lại năm ở <a routerLink="/ke-toan/ket-chuyen">Kết chuyển cuối kỳ</a> nếu cần tính lại thuế.</p>
        } @else if (!o.nextPeriod) {
          <p>Năm {{ o.year }} đã quyết toán thuế. Huỷ kỳ quyết toán ở danh sách dưới nếu cần làm lại.</p>
        } @else if (canCreate) {
          <p class="subtitle">
            Mỗi kỳ tính từ 01/01 đến cuối kỳ rồi trừ thuế đã ghi các kỳ trước. Điều chỉnh nhập luỹ kế cả năm. Chi phí thuế ghi Nợ 821 / Có 3334; nộp thuế bằng phiếu chi loại "Nộp thuế TNDN".
          </p>
          <div class="form-grid">
            <div class="field">
              <label for="cit-period">Kỳ tính thuế</label>
              <select id="cit-period" [ngModel]="period()" (ngModelChange)="setPeriod($event)">
                @for (p of choices(); track p.value) { <option [value]="p.value">{{ p.label }}</option> }
              </select>
            </div>
            <div class="field">
              <label for="cit-rate">Thuế suất (%)</label>
              <input id="cit-rate" type="number" min="0" max="100" step="0.5" class="num" [ngModel]="rate()" (ngModelChange)="rate.set($event); refresh()" [placeholder]="'Gợi ý ' + (pv()?.suggestedRate ?? 20)" />
            </div>
            <div class="field">
              <label for="cit-add">Điều chỉnh tăng (chi phí không được trừ)</label>
              <input id="cit-add" type="text" appMoney class="num" [ngModel]="addbacks()" (ngModelChange)="addbacks.set($event); refresh()" />
            </div>
            <div class="field">
              <label for="cit-ded">Điều chỉnh giảm (thu nhập miễn thuế…)</label>
              <input id="cit-ded" type="text" appMoney class="num" [ngModel]="deductions()" (ngModelChange)="deductions.set($event); refresh()" />
            </div>
            @if (period() === 'Y') {
              <div class="field">
                <label for="cit-loss">Lỗ năm trước chuyển sang</label>
                <input id="cit-loss" type="text" appMoney class="num" [ngModel]="loss()" (ngModelChange)="loss.set($event); refresh()" [placeholder]="'Tối đa ' + money(o.lossAvailable)" />
              </div>
            }
            <div class="field">
              <label for="cit-note">Ghi chú</label>
              <input id="cit-note" type="text" maxlength="300" [ngModel]="note()" (ngModelChange)="note.set($event)" />
            </div>
          </div>

          @if (pv(); as p) {
            <div class="rp-surface book-wrap">
              <table class="book-table">
                <thead><tr><th scope="col">Chỉ tiêu ({{ day(p.periodEnd) }})</th><th scope="col" class="r">Số tiền</th></tr></thead>
                <tbody>
                  <tr><td>Doanh thu luỹ kế (511, 515, 711)</td><td class="r num">{{ money(p.revenue) }}</td></tr>
                  <tr><td>Lợi nhuận kế toán trước thuế luỹ kế</td><td class="r num" [class.amt-neg]="p.accountingProfit < 0">{{ money(p.accountingProfit) }}</td></tr>
                  <tr><td>+ Điều chỉnh tăng</td><td class="r num">{{ money(p.addbacks) }}</td></tr>
                  <tr><td>− Điều chỉnh giảm</td><td class="r num">{{ money(p.deductions) }}</td></tr>
                  <tr class="book-sum"><td>Thu nhập chịu thuế trước chuyển lỗ</td><td class="r num" [class.amt-neg]="p.beforeLoss < 0">{{ money(p.beforeLoss) }}</td></tr>
                  @if (period() === 'Y') { <tr><td>− Lỗ chuyển sang (còn {{ money(p.lossAvailable) }})</td><td class="r num">{{ money(p.lossUsed) }}</td></tr> }
                  <tr class="book-sum"><td>Thu nhập tính thuế</td><td class="r num">{{ money(p.taxableIncome) }}</td></tr>
                  <tr><td>Thuế suất</td><td class="r num">{{ p.rate }}%</td></tr>
                  <tr><td>Thuế TNDN luỹ kế</td><td class="r num">{{ money(p.taxCumulative) }}</td></tr>
                  <tr><td>− Đã ghi các kỳ trước</td><td class="r num">{{ money(p.taxPrior) }}</td></tr>
                  <tr class="book-sum"><td>Ghi nhận kỳ này {{ p.taxBooked < 0 ? '(hoàn lại, Nợ 3334 / Có 821)' : '(Nợ 821 / Có 3334)' }}</td><td class="r num" [class.amt-neg]="p.taxBooked < 0">{{ money(p.taxBooked) }}</td></tr>
                </tbody>
              </table>
            </div>
            @if (p.blocker) { <p class="subtitle">{{ p.blocker }}</p> }
            @if (p.rate !== p.suggestedRate) { <p class="subtitle">Thuế suất gợi ý theo doanh thu năm là {{ p.suggestedRate }}% (từ kỳ tính thuế 2025; kế toán xác nhận).</p> }
          }
          <div class="toolbar">
            <button type="button" class="btn btn-primary" [disabled]="busy() || !pv() || !!pv()!.blocker" (click)="create()"><app-nav-icon name="check" />Ghi nhận thuế TNDN</button>
          </div>
        } @else {
          <p class="subtitle">Cần quyền nhập bút toán để tính thuế.</p>
        }
      </section>

      <section class="card section-block" aria-labelledby="cit-list">
        <h2 id="cit-list" class="form-section-title">Các kỳ đã tính năm {{ o.year }}</h2>
        <div class="rp-surface book-wrap">
          <table class="book-table">
            <thead><tr>
              <th scope="col">Kỳ</th><th scope="col" class="r">Lợi nhuận kế toán</th><th scope="col" class="r">Thu nhập tính thuế</th><th scope="col" class="r">Thuế suất</th>
              <th scope="col" class="r">Thuế luỹ kế</th><th scope="col" class="r">Ghi kỳ này</th><th scope="col">Trạng thái</th><th scope="col"><span class="visually-hidden">Thao tác</span></th>
            </tr></thead>
            <tbody>
              @for (a of o.assessments; track a.id) {
                <tr [class.is-zero]="a.reversedAt">
                  <td>{{ a.label }}<div class="subtitle">{{ day(a.periodEnd) }} · {{ a.createdByName }}</div></td>
                  <td class="r num" [class.amt-neg]="a.accountingProfit < 0">{{ money(a.accountingProfit) }}</td>
                  <td class="r num">{{ money(a.taxableIncome) }}</td>
                  <td class="r num">{{ a.rate }}%</td>
                  <td class="r num">{{ money(a.taxCumulative) }}</td>
                  <td class="r num" [class.amt-neg]="a.taxBooked < 0">{{ money(a.taxBooked) }}</td>
                  <td>{{ a.reversedAt ? 'Đã huỷ' : 'Đang hiệu lực' }}</td>
                  <td class="r">
                    @if (a.canReverse && canReverse) { <button type="button" class="btn btn-danger-ghost" [disabled]="busy()" (click)="reverse(a.id, a.label)">Huỷ</button> }
                  </td>
                </tr>
              } @empty { <tr><td class="book-none" colspan="8">Năm này chưa tính thuế kỳ nào.</td></tr> }
            </tbody>
          </table>
        </div>
      </section>
    } @else if (!failure()) {
      <p class="subtitle">Đang tải…</p>
    }
  `,
})
export class AccountingCorporateTaxComponent {
  protected readonly toast = inject(ToastService);
  /** A failure still shown by the page logic also raises a toast. */
  protected readonly failureToast = effect(() => this.toast.error(this.failure()));
  private readonly svc = inject(AccountingService);
  private readonly confirmer = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  readonly canCreate = this.auth.can('accounting.manual');
  readonly canReverse = this.auth.can('accounting.reverse');
  readonly money = formatVnd;
  readonly day = formatDay;

  readonly year = signal(new Date().getFullYear());
  readonly ov = signal<CitOverview | null>(null);
  readonly period = signal<CitPeriod>('Q1');
  readonly rate = signal<number | null>(null);
  readonly addbacks = signal<number | null>(null);
  readonly deductions = signal<number | null>(null);
  readonly loss = signal<number | null>(null);
  readonly note = signal('');
  readonly pv = signal<CitPreview | null>(null);
  readonly failure = signal('');
  readonly busy = signal(false);
  /** Các kỳ chọn được: từ kỳ kế tiếp trở đi. */
  readonly choices = computed(() => {
    const next = this.ov()?.nextPeriod;
    const from = PERIODS.findIndex((p) => p.value === next);
    return from < 0 ? [] : PERIODS.slice(from);
  });
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() { void this.load(); }

  setYear(y: number): void {
    if (!y) return;
    this.year.set(y);
    void this.load();
  }

  setPeriod(p: CitPeriod): void {
    this.period.set(p);
    this.loss.set(null);
    void this.refreshNow();
  }

  async load(): Promise<void> {
    this.failure.set('');
    try {
      const o = await this.svc.citOverview(this.year());
      this.ov.set(o);
      this.rate.set(null);
      this.addbacks.set(null);
      this.deductions.set(null);
      this.loss.set(null);
      this.note.set('');
      if (o.nextPeriod) this.period.set(o.nextPeriod);
      await this.refreshNow();
    } catch (e) {
      this.ov.set(null);
      this.failure.set(errorText(e));
    }
  }

  /** Gọi lại số liệu sau khi người dùng ngừng gõ một lúc. */
  refresh(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.refreshNow(), 300);
  }

  private async refreshNow(): Promise<void> {
    if (!this.ov()?.nextPeriod) { this.pv.set(null); return; }
    try {
      this.pv.set(await this.svc.citPreview({
        year: this.year(), period: this.period(), rate: this.rate(), addbacks: this.addbacks() || 0, deductions: this.deductions() || 0,
        lossUsed: this.period() === 'Y' ? this.loss() : null,
      }));
    } catch (e) {
      this.pv.set(null);
      this.failure.set(errorText(e));
    }
  }

  private async run(work: () => Promise<string>): Promise<void> {
    this.busy.set(true); this.failure.set(''); this.toast.clear();
    try { this.toast.success(await work()); await this.load(); }
    catch (e) { this.failure.set(errorText(e)); }
    finally { this.busy.set(false); }
  }

  async create(): Promise<void> {
    const p = this.pv();
    if (!p) return;
    const label = PERIODS.find((x) => x.value === p.period)!.label;
    const ok = await this.confirmer.ask({
      title: `Ghi nhận thuế TNDN ${label} ${p.year}?`,
      message: `Thuế luỹ kế ${formatVnd(p.taxCumulative)}, ghi kỳ này ${formatVnd(p.taxBooked)}.`,
      confirmLabel: 'Ghi nhận', tone: 'primary',
    });
    if (!ok) return;
    return this.run(async () => {
      const r = await this.svc.citCreate({
        year: p.year, period: p.period, rate: p.rate, addbacks: p.addbacks, deductions: p.deductions,
        lossUsed: p.period === 'Y' ? p.lossUsed : undefined, note: this.note().trim() || undefined,
      });
      return `Đã ghi thuế TNDN ${label} ${p.year}: ${formatVnd(r.taxBooked)}.`;
    });
  }

  async reverse(id: string, label: string): Promise<void> {
    const ok = await this.confirmer.ask({ title: `Huỷ lần tính thuế TNDN ${label}?`, message: 'Bút toán 821 / 3334 được đảo lại.', confirmLabel: 'Huỷ lần tính', cancelLabel: 'Không huỷ', tone: 'danger' });
    if (!ok) return;
    return this.run(async () => { await this.svc.citReverse(id); return `Đã huỷ ${label}.`; });
  }
}
