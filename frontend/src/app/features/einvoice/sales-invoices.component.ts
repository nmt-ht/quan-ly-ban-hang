/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { Component, TemplateRef, computed, inject, signal, viewChild, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorText } from '../../core/api/api.service';
import { AuthService } from '../../core/services/auth.service';
import { OutstandingItem, OutstandingView, RecordImportResult, RecordImportRow, RecordedInvoice } from '../../core/models/einvoice.models';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { SheetRow, downloadWorkbook, exportFileName, readSheet } from '../../shared/excel.util';
import { formatVnd } from '../../shared/format.util';
import { PeriodFilterComponent, PeriodValue } from '../../shared/period-filter/period-filter.component';
import { formatDay, presetRange } from '../../shared/period';
import { EXPORT_COLUMNS, EXPORT_NOTES, ImportColumnMap, detectColumns, exportRows, importRows } from './einvoice-file';
import { EInvoiceService } from './einvoice.service';
import { DateInputDirective } from '../../shared/date-input/date-input.directive';
import { ToastService } from '../../core/services/toast.service';

const SERIES_KEY = 'einvoice.series';
const STATUS_LABEL: Record<string, string> = { PENDING: 'Đang chờ', ISSUED: 'Đã ghi nhận', FAILED: 'Lỗi', REPLACED: 'Đã thay thế', VOID: 'Đã gỡ' };
interface RecForm { item: OutstandingItem; templateCode: '1' | '2'; series: string; number: string; date: string }

function savedSeries(): string {
  try { return localStorage.getItem(SERIES_KEY) || `C${String(new Date().getFullYear()).slice(2)}TAA`; }
  catch { return `C${String(new Date().getFullYear()).slice(2)}TAA`; }
}

/**
 * /hoa-don-ban — hoá đơn bán ra phát hành ngoài phần mềm (cổng của nhà cung cấp, ví dụ MISA): xem đợt giao chưa có hoá đơn, xuất Excel
 * để nhập lên cổng, ghi nhận số hoá đơn (tay hoặc nhập danh sách từ cổng) để bảng kê thuế bán ra có đủ số liệu. Phần mềm không tự
 * phát hành hoá đơn có giá trị pháp lý.
 */
@Component({
  selector: 'app-sales-invoices',
  standalone: true,
  imports: [DateInputDirective, FormsModule, NavIconComponent, DataTableComponent, PeriodFilterComponent],
  template: `
    <div class="page-header">
      <div>
        <h1>Hoá đơn bán ra</h1>
        <p class="subtitle">Hoá đơn được lập và ký trên cổng của nhà cung cấp (MISA…). Tại đây xuất dữ liệu bán hàng để nhập lên cổng, rồi ghi nhận số hoá đơn đã phát hành.</p>
      </div>
      @if (tab() === 'can-lap' && outstanding(); as o) {
        <div class="toolbar">
          <button type="button" class="btn btn-primary" [disabled]="busy() || !o.items.length" (click)="exportExcel()">
            <app-nav-icon name="download" />Xuất Excel {{ selected().length ? '(' + selected().length + ' dòng đã chọn)' : '(tất cả ' + o.items.length + ' dòng)' }}
          </button>
        </div>
      }
    </div>

    <div class="detail-tabs" role="tablist">
      <button type="button" role="tab" [attr.aria-selected]="tab() === 'can-lap'" (click)="tab.set('can-lap')">Cần lập hoá đơn @if (outstanding()) { <span class="tab-count num">{{ outstanding()!.items.length }}</span> }</button>
      <button type="button" role="tab" [attr.aria-selected]="tab() === 'da-ghi'" (click)="tab.set('da-ghi'); loadList()">Đã ghi nhận @if (list()) { <span class="tab-count num">{{ list()!.length }}</span> }</button>
      @if (canRecord()) { <button type="button" role="tab" [attr.aria-selected]="tab() === 'nhap-file'" (click)="tab.set('nhap-file')">Nhập số hoá đơn từ file</button> }
    </div>

    @if (tab() !== 'nhap-file') {
      <div class="filters-bar">
        <input type="search" class="filter-search" placeholder="Tìm số đơn, khách, MST…" aria-label="Tìm hoá đơn" [value]="search()" (input)="search.set($any($event.target).value)" (keyup.enter)="reload()" />
        @if (tab() === 'da-ghi') {
          <select aria-label="Trạng thái" [value]="status()" (change)="status.set($any($event.target).value); loadList()">
            <option value="">Mọi trạng thái</option><option value="ISSUED">Đã ghi nhận</option><option value="VOID">Đã gỡ</option><option value="REPLACED">Đã thay thế</option>
          </select>
        }
        <app-period-filter [value]="period()" (valueChange)="onPeriod($event)" />
        <button type="button" class="btn" (click)="reload()"><app-nav-icon name="refresh" />Tải lại</button>
      </div>
    }

    @if (tab() === 'can-lap') {
      @if (rec(); as r) {
        <section class="card section-block" aria-labelledby="hd-rec">
          <h2 id="hd-rec" class="form-section-title">Ghi nhận số hoá đơn cho {{ r.item.ref }}</h2>
          <div class="form-grid-3">
            <div class="field">
              <label for="hd-tpl">Mẫu số</label>
              <select id="hd-tpl" [ngModel]="r.templateCode" (ngModelChange)="patchRec({ templateCode: $event })"><option value="1">1 — Hoá đơn GTGT</option><option value="2">2 — Hoá đơn bán hàng</option></select>
            </div>
            <div class="field">
              <label for="hd-series">Ký hiệu <span class="required-mark">*</span></label>
              <input id="hd-series" type="text" class="num" maxlength="6" placeholder="C26TAA" [ngModel]="r.series" (ngModelChange)="patchRec({ series: $event.toUpperCase() })" />
            </div>
            <div class="field">
              <label for="hd-no">Số hoá đơn <span class="required-mark">*</span></label>
              <input id="hd-no" type="text" class="num" inputmode="numeric" maxlength="8" [ngModel]="r.number" (ngModelChange)="patchRec({ number: $event })" />
            </div>
            <div class="field">
              <label for="hd-date">Ngày hoá đơn <span class="required-mark">*</span></label>
              <input id="hd-date" appDate [ngModel]="r.date" (ngModelChange)="patchRec({ date: $event })" />
              <span class="hint">Không trước ngày giao {{ formatDay(r.item.date) }}.</span>
            </div>
          </div>
          <div class="toolbar">
            <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="saveRecord()">Ghi nhận</button>
            <button type="button" class="btn" (click)="rec.set(null)">Huỷ</button>
          </div>
        </section>
      }

      @if (outstanding(); as o) {
        @if (o.truncated) { <div class="notice">Có quá nhiều đơn trong khoảng ngày này, chỉ hiện một phần — thu hẹp khoảng ngày.</div> }
        <dl class="list-totals">
          <div><dt>Đợt giao chưa có hoá đơn</dt><dd class="num" [class.text-warning]="o.items.length > 0">{{ o.items.length }}</dd></div>
          <div><dt>Giá trị (gồm thuế)</dt><dd class="num">{{ money(outstandingTotal()) }}</dd></div>
        </dl>
        <p class="rp-notes">Nhập file Excel này lên cổng nhà cung cấp theo bước ghép cột; giữ cột "Mã tham chiếu" để nhập số hoá đơn về sau.</p>

        <div class="rp-surface rp-grid">
          <table class="book-table">
            <thead><tr>
              <th scope="col" class="check-col"><input type="checkbox" [checked]="allSelected()" (change)="toggleAll($any($event.target).checked)" aria-label="Chọn tất cả" /></th>
              <th scope="col">Mã tham chiếu</th><th scope="col">Ngày giao</th><th scope="col">Khách hàng</th><th scope="col">MST</th>
              <th scope="col" class="r">Giá trị (gồm thuế)</th><th scope="col"><span class="visually-hidden">Thao tác</span></th>
            </tr></thead>
            <tbody>
              @for (i of o.items; track i.ref) {
                <tr>
                  <td class="check-col"><input type="checkbox" [checked]="selected().includes(i.ref)" (change)="toggle(i.ref)" [attr.aria-label]="'Chọn ' + i.ref" /></td>
                  <td class="code">{{ i.ref }}</td><td class="num">{{ formatDay(i.date) }}</td><td>{{ i.customerName }}</td><td class="code">{{ i.taxCode }}</td>
                  <td class="r num">{{ money(i.amount) }}</td>
                  <td class="r">@if (canRecord()) { <button type="button" class="btn row-act-btn" (click)="openRecord(i)">Ghi nhận số</button> }</td>
                </tr>
              } @empty {
                <tr><td class="book-none" colspan="7">Không có đợt giao nào chưa có hoá đơn trong khoảng ngày này.</td></tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (!failure()) {
        <div class="empty-state"><h3>Đang tải…</h3></div>
      }
    }

    @if (tab() === 'da-ghi') {

      <app-data-table [columns]="listColumns" [rows]="list() ?? []" [actions]="listActions()" emptyTitle="Chưa có hoá đơn nào" emptyHint="Hoá đơn đã ghi nhận trong khoảng ngày này sẽ hiện ở đây." />
    }

    @if (tab() === 'nhap-file' && canRecord()) {
      <p class="rp-notes">Xuất danh sách hoá đơn đã phát hành từ cổng ra Excel (dòng đầu là tiêu đề). Cần cột mã tham chiếu (hoặc diễn giải chứa mã), số hoá đơn và ngày hoá đơn; cột ký hiệu nếu có. Hoá đơn không có mã tham chiếu (không lập từ dữ liệu của phần mềm) được bỏ qua.</p>
      <div class="toolbar">
        <label class="btn"><app-nav-icon name="upload" />Chọn file Excel <input type="file" accept=".xlsx" class="visually-hidden" (change)="onFile($event)" /></label>
        <button type="button" class="btn" (click)="downloadSample()" title="File Excel mẫu có dòng ví dụ và hướng dẫn"><app-nav-icon name="download" />Tải file mẫu</button>
        @if (fileName()) { <span class="subtitle">{{ fileName() }} · {{ fileRows().length }} dòng</span> }
      </div>
      @if (fileRows().length) {
        <section class="card section-block" aria-labelledby="hd-map">
          <h2 id="hd-map" class="form-section-title">Ghép cột</h2>
          <div class="form-grid-3">
            <div class="field">
              <label for="hd-m-ref">Cột mã tham chiếu</label>
              <select id="hd-m-ref" [ngModel]="map().ref ?? ''" (ngModelChange)="setMap('ref', $event)"><option value="">Chọn cột…</option>@for (h of fileHeaders(); track h) { <option [value]="h">{{ h }}</option> }</select>
            </div>
            <div class="field">
              <label for="hd-m-no">Cột số hoá đơn</label>
              <select id="hd-m-no" [ngModel]="map().number ?? ''" (ngModelChange)="setMap('number', $event)"><option value="">Chọn cột…</option>@for (h of fileHeaders(); track h) { <option [value]="h">{{ h }}</option> }</select>
            </div>
            <div class="field">
              <label for="hd-m-date">Cột ngày hoá đơn</label>
              <select id="hd-m-date" [ngModel]="map().date ?? ''" (ngModelChange)="setMap('date', $event)"><option value="">Chọn cột…</option>@for (h of fileHeaders(); track h) { <option [value]="h">{{ h }}</option> }</select>
            </div>
            <div class="field">
              <label for="hd-m-series">Cột ký hiệu</label>
              <select id="hd-m-series" [ngModel]="map().series ?? ''" (ngModelChange)="setMap('series', $event)"><option value="">Không có</option>@for (h of fileHeaders(); track h) { <option [value]="h">{{ h }}</option> }</select>
            </div>
            <div class="field">
              <label for="hd-d-tpl">Mẫu số mặc định</label>
              <select id="hd-d-tpl" [ngModel]="templateCode()" (ngModelChange)="templateCode.set($event)"><option value="1">1 — Hoá đơn GTGT</option><option value="2">2 — Hoá đơn bán hàng</option></select>
            </div>
            <div class="field">
              <label for="hd-d-series">Ký hiệu mặc định (khi file không có)</label>
              <input id="hd-d-series" type="text" class="num" maxlength="6" [ngModel]="series()" (ngModelChange)="series.set($event.toUpperCase())" />
            </div>
          </div>
          <p class="hint">Đọc được {{ parsed().rows.length }} hoá đơn có mã tham chiếu.</p>
          @for (p of parsed().problems.slice(0, 5); track p) { <p class="hint text-danger">{{ p }}</p> }
          @if (parsed().problems.length > 5) { <p class="hint">… và {{ parsed().problems.length - 5 }} dòng khác.</p> }
          <div class="toolbar">
            <button type="button" class="btn" [disabled]="busy() || !parsed().rows.length" (click)="runImport(true)">Kiểm tra trước</button>
            <button type="button" class="btn btn-primary" [disabled]="busy() || !parsed().rows.length || !checked()" (click)="runImport(false)">Ghi nhận</button>
          </div>
        </section>
      }
      @if (result(); as r) {
        <dl class="list-totals">
          <div><dt>{{ r.dryRun ? 'Hợp lệ (chưa ghi)' : 'Đã ghi' }}</dt><dd class="num">{{ r.summary.ok }}</dd></div>
          <div><dt>Bỏ qua</dt><dd class="num">{{ r.summary.skipped }}</dd></div>
          <div><dt>Lỗi</dt><dd class="num" [class.text-danger]="r.summary.errors > 0">{{ r.summary.errors }}</dd></div>
        </dl>
        <div class="rp-surface book-wrap">
          <table class="book-table">
            <thead><tr><th scope="col">Mã tham chiếu</th><th scope="col">Số hoá đơn</th><th scope="col">Kết quả</th></tr></thead>
            <tbody>
              @for (x of r.results; track x.index) {
                <tr>
                  <td class="code">{{ x.ref || '—' }}</td><td class="code">{{ rowsSent()[x.index]?.number }}</td>
                  <td>
                    <span class="badge" [class.badge-success]="x.status === 'OK'" [class.badge-muted]="x.status === 'SKIPPED'" [class.badge-danger]="x.status === 'ERROR'">{{ x.status === 'OK' ? (r.dryRun ? 'Hợp lệ' : 'Đã ghi') : x.status === 'SKIPPED' ? 'Bỏ qua' : 'Lỗi' }}</span>
                    {{ x.message }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }

    <ng-template #listActionsTpl let-r>
      @if (canRecord() && r.provider === 'EXTERNAL' && r.status === 'ISSUED') {
        <button type="button" class="btn row-act-btn btn-danger-ghost" (click)="askVoid(r)">Gỡ ghi nhận</button>
      }
    </ng-template>
  `,
})
export class SalesInvoicesComponent {
  protected readonly toast = inject(ToastService);
  /** A failure still shown by the page logic also raises a toast. */
  protected readonly failureToast = effect(() => this.toast.error(this.failure()));
  private readonly dialogs = inject(ConfirmService);
  private readonly svc = inject(EInvoiceService);
  private readonly auth = inject(AuthService);
  readonly money = formatVnd;
  readonly formatDay = formatDay;
  readonly statusLabel = (s: string) => STATUS_LABEL[s] ?? s;
  readonly canRecord = computed(() => this.auth.can('einvoice.issue'));

  readonly tab = signal<'can-lap' | 'da-ghi' | 'nhap-file'>('can-lap');
  readonly period = signal<PeriodValue>({ preset: 'last30', range: presetRange('last30') });
  readonly from = computed(() => this.period().range.from ?? '');
  readonly to = computed(() => this.period().range.to ?? '');
  readonly search = signal('');
  readonly status = signal('');
  readonly failure = signal('');
  readonly busy = signal(false);

  readonly outstanding = signal<OutstandingView | null>(null);
  readonly list = signal<RecordedInvoice[] | null>(null);
  readonly selected = signal<string[]>([]);
  readonly rec = signal<RecForm | null>(null);
  readonly outstandingTotal = computed(() => (this.outstanding()?.items ?? []).reduce((sum, i) => sum + i.amount, 0));
  private readonly listActionsRef = viewChild<TemplateRef<{ $implicit: RecordedInvoice }>>('listActionsTpl');
  readonly listActions = computed(() => this.listActionsRef());
  readonly listColumns: DataTableColumn<RecordedInvoice>[] = [
    { key: 'issueDate', label: 'Ngày', format: (r) => formatDay(r.issueDate), mono: true },
    { key: 'invoice', label: 'Hoá đơn', format: (r) => `${r.templateCode}${r.series} · ${r.number || '—'}`, mono: true },
    { key: 'orderCode', label: 'Đơn' },
    { key: 'customerName', label: 'Khách hàng' },
    { key: 'total', label: 'Giá trị (gồm thuế)', align: 'right', format: (r) => formatVnd(r.total) },
    { key: 'status', label: 'Trạng thái', format: (r) => `${STATUS_LABEL[r.status] ?? r.status}${r.reason ? ` — ${r.reason}` : ''}`, badge: (r) => (r.status === 'ISSUED' ? 'badge-success' : r.status === 'FAILED' ? 'badge-danger' : r.status === 'PENDING' ? 'badge-warning' : 'badge-muted') },
    { key: 'provider', label: 'Nguồn', format: (r) => (r.provider === 'EXTERNAL' ? 'Cổng ngoài' : 'Phần mềm') },
  ];

  readonly allSelected = computed(() => {
    const items = this.outstanding()?.items ?? [];
    return items.length > 0 && items.every((i) => this.selected().includes(i.ref));
  });

  // nhập từ file
  readonly fileName = signal('');
  readonly fileHeaders = signal<string[]>([]);
  readonly fileRows = signal<SheetRow[]>([]);
  readonly map = signal<ImportColumnMap>({});
  readonly templateCode = signal<'1' | '2'>('1');
  readonly series = signal(savedSeries());
  readonly result = signal<RecordImportResult | null>(null);
  readonly rowsSent = signal<RecordImportRow[]>([]);
  /** Đã kiểm tra trước bộ dữ liệu hiện tại và có hoá đơn hợp lệ: mới cho ghi (các dòng lỗi vẫn bị bỏ, báo ở kết quả). */
  readonly checked = signal(false);
  readonly parsed = computed(() => importRows(this.fileRows(), this.map()));

  constructor() {
    void this.loadOutstanding();
  }

  onPeriod(v: PeriodValue) {
    this.period.set(v);
    this.reload();
  }

  reload() {
    return this.tab() === 'da-ghi' ? this.loadList() : this.loadOutstanding();
  }

  async loadOutstanding() {
    this.failure.set('');
    try {
      this.outstanding.set(await this.svc.outstanding(this.from(), this.to(), this.search()));
      this.selected.update((s) => s.filter((r) => this.outstanding()!.items.some((i) => i.ref === r)));
    } catch (e) { this.failure.set(errorText(e)); }
  }

  async loadList() {
    this.failure.set('');
    try { this.list.set((await this.svc.list(this.from(), this.to(), this.status(), this.search())).rows.sort((a, b) => b.issueDate.localeCompare(a.issueDate) || (b.number ?? '').localeCompare(a.number ?? '', 'vi', { numeric: true }))); }
    catch (e) { this.failure.set(errorText(e)); }
  }

  private async run(action: () => Promise<unknown>, done?: string) {
    if (this.busy()) return;
    this.busy.set(true);
    this.failure.set('');
    try {
      await action();
      if (done) this.toast.success(done);
    } catch (e) {
      this.failure.set(errorText(e));
    } finally {
      this.busy.set(false);
    }
  }

  toggle(ref: string) {
    this.selected.update((s) => (s.includes(ref) ? s.filter((x) => x !== ref) : [...s, ref]));
  }

  toggleAll(on: boolean) {
    this.selected.set(on ? (this.outstanding()?.items ?? []).map((i) => i.ref) : []);
  }

  exportExcel() {
    const all = this.outstanding()?.items ?? [];
    const pick = this.selected().length ? all.filter((i) => this.selected().includes(i.ref)) : all;
    return this.run(async () => {
      const data = await this.svc.exportData(pick.map((i) => ({ orderId: i.orderId, deliveryId: i.deliveryId ?? undefined })));
      const ok = data.filter((d) => d.invoice);
      const bad = data.filter((d) => d.error);
      if (ok.length) {
        await downloadWorkbook(exportFileName('Dữ liệu hoá đơn bán ra'), [{ name: 'Hoá đơn', columns: EXPORT_COLUMNS, rows: exportRows(ok), notes: EXPORT_NOTES }]);
      }
      this.toast.success(`Đã xuất ${ok.length} hoá đơn.${bad.length ? ` Không xuất được ${bad.length}: ${bad.slice(0, 3).map((b) => b.error).join('; ')}` : ''}`);
    });
  }

  openRecord(item: OutstandingItem) {
    this.rec.set({ item, templateCode: '1', series: savedSeries(), number: '', date: item.date });
  }

  patchRec(change: Partial<RecForm>) {
    this.rec.update((r) => (r ? { ...r, ...change } : r));
  }

  saveRecord() {
    const r = this.rec();
    if (!r) return Promise.resolve();
    return this.run(async () => {
      await this.svc.record({
        orderId: r.item.orderId, deliveryId: r.item.deliveryId ?? undefined, templateCode: r.templateCode, series: r.series.trim(), number: r.number.trim(), issueDate: r.date,
      });
      try { localStorage.setItem(SERIES_KEY, r.series.trim()); } catch { /* không lưu được thì thôi */ }
      this.toast.success(`Đã ghi nhận hoá đơn ${r.templateCode}${r.series.trim()} số ${r.number.trim()} cho ${r.item.ref}.`);
      this.rec.set(null);
      await this.loadOutstanding();
    });
  }

  async askVoid(r: RecordedInvoice): Promise<void> {
    const done = await this.dialogs.form({
      title: `Gỡ ghi nhận hoá đơn ${r.templateCode}${r.series} số ${r.number}?`,
      message: 'Dùng khi nhập nhầm số hoặc hoá đơn đã bị huỷ trên cổng. Đợt giao đó có thể ghi nhận lại.',
      confirmLabel: 'Gỡ ghi nhận', cancelLabel: 'Không gỡ', tone: 'danger',
      fields: [{ key: 'reason', label: 'Lý do gỡ', type: 'textarea', required: true, placeholder: 'Ví dụ: Nhập nhầm số hoá đơn', maxLength: 300 }],
      run: (v) => {
        if (v['reason'].length < 3) throw new Error('Lý do gỡ cần ít nhất 3 ký tự.');
        return this.svc.voidRecord(r.id, v['reason']);
      },
    });
    if (!done) return;
    this.toast.success('Đã gỡ ghi nhận hoá đơn; đợt giao đó có thể ghi nhận lại.');
    await this.loadList();
  }
  /** File mẫu: các cột phần mềm cần để ghi nhận số hoá đơn (danh sách hoá đơn tải từ cổng thường đã có đủ). */
  async downloadSample() {
    await downloadWorkbook('Mẫu nhập số hoá đơn.xlsx', [{
      name: 'Hoá đơn',
      columns: [
        { header: 'Mã tham chiếu', width: 22, required: true }, { header: 'Ký hiệu', width: 12 },
        { header: 'Số hoá đơn', width: 14, required: true }, { header: 'Ngày hoá đơn', width: 14, required: true },
      ],
      rows: [],
      exampleRows: [['DH0000110', 'C26TAA', '0000123', '12/11/2026'], ['DH0000112#2', 'C26TAA', '0000124', '15/11/2026']],
      notes: {
        title: 'Nhập số hoá đơn từ cổng — hướng dẫn',
        lines: [
          'Dùng khi bạn đã lập và ký hoá đơn trên cổng của nhà cung cấp và muốn ghi nhận số hoá đơn về phần mềm một lượt.',
          'Mã tham chiếu: số đơn bán (DH0000110), hoặc số đơn#số đợt giao (DH0000112#2) nếu đơn giao nhiều đợt. Đây là cột "Mã tham chiếu" trong file xuất dữ liệu bán hàng; giữ nguyên khi lập hoá đơn trên cổng.',
          'Danh sách hoá đơn xuất từ cổng thường có sẵn các cột này (có thể tên khác: Số hoá đơn, Ký hiệu, Ngày lập, Diễn giải chứa mã đơn…): chọn file đó và ghép cột ở bước sau, không cần chép lại vào file mẫu.',
          'Hoá đơn không có mã tham chiếu bị bỏ qua. Dùng "Kiểm tra trước" để xem kết quả, rồi "Ghi nhận".',
        ],
      },
    }]);
  }

  async onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.failure.set('');
    this.result.set(null);
    this.checked.set(false);
    try {
      const { headers, rows } = await readSheet(file);
      this.fileName.set(file.name);
      this.fileHeaders.set(headers);
      this.fileRows.set(rows);
      this.map.set(detectColumns(headers));
      if (!rows.length) this.failure.set('File không có dòng dữ liệu nào.');
    } catch (e) {
      this.failure.set(errorText(e));
    }
  }

  setMap(key: keyof ImportColumnMap, value: string) {
    this.map.update((m) => ({ ...m, [key]: value || undefined }));
    this.checked.set(false);
  }

  runImport(dryRun: boolean) {
    const rows = this.parsed().rows;
    return this.run(async () => {
      const r = await this.svc.importRecords(dryRun, this.templateCode(), this.series().trim() || undefined, rows);
      this.rowsSent.set(rows);
      this.result.set(r);
      this.checked.set(dryRun && r.summary.ok > 0);
      if (!dryRun) {
        try { if (this.series().trim()) localStorage.setItem(SERIES_KEY, this.series().trim()); } catch { /* bỏ qua */ }
        this.toast.success(`Đã ghi nhận ${r.summary.ok} hoá đơn.`);
        void this.loadOutstanding();
      }
    });
  }
}
