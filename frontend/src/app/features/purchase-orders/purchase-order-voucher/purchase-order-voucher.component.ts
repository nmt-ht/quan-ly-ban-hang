import { Component, HostListener, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DataStore } from '../../../core/services/data-store.service';
import { Product, PurchaseOrder, PurchaseOrderLine } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { CopyButtonComponent } from '../../../shared/copy-button/copy-button.component';
import { MoneyInputDirective } from '../../../shared/money-input.directive';
import { ProductPickerComponent } from '../../../shared/product-picker/product-picker.component';
import { HasUnsavedChanges, isSaveShortcut, warnBeforeUnload } from '../../../core/guards/unsaved-changes.guard';
import { PrintDocumentComponent } from '../../../shared/print/print-document.component';
import { PrintMenuComponent } from '../../../shared/print/print-menu.component';
import { vndInWords } from '../../../shared/vnd-words';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { PURCHASE_ORDER_STATUS_LABEL, purchaseOrderStatusClass } from '../../../shared/status-labels';
import { formatVnd } from '../../../shared/format.util';
import { formatDay, isoDay } from '../../../shared/period';
import {
  VAT_RATES, canCancel, canComplete, canEdit, canReceive, canSend, lineAmount, lineRemaining, lineVat, orderTotals,
  receivedPercent,
} from '../purchase-order.rules';
import { AuthService } from '../../../core/services/auth.service';
import { seesPurchasePrices } from '../../../core/auth/purchase-prices';
import { PurchaseOrderService } from '../purchase-order.service';
import { ReceiveGoodsDialogComponent } from '../receive-goods-dialog/receive-goods-dialog.component';
import { AllowedLinkDirective } from '../../../shared/allowed-link.directive';
import { errorText } from '../../../core/api/api.service';
import { AuditHistoryComponent } from '../../../shared/audit/audit-history.component';
import { FrozenColsDirective } from '../../../shared/frozen-cols.directive';
import { PickableWarehousesPipe } from '../../../shared/pickable-warehouses.pipe';
import type { ReorderDraft } from '../../inventory/reorder.rules';

type Mode = 'create' | 'edit' | 'view';

interface DraftLine {
  key: string;
  productId: string;
  unitName: string; // '' = base unit
  quantity: number | null;
  unitPrice: number | null;
  vatRate: number;
  warehouseId: string;
  receivedQuantity: number;
}

interface UnitOption {
  value: string; // '' = base unit
  label: string;
  ratio: number;
}

const newKey = () => crypto.randomUUID();
const emptyLine = (): DraftLine => ({
  key: newKey(), productId: '', unitName: '', quantity: null, unitPrice: null, vatRate: 0, warehouseId: '', receivedQuantity: 0,
});

// Đơn nhập hàng as one accounting-style voucher screen (create / view / edit), laid out like
// the MISA "Chứng từ" the customer asked for: header fields + totals panel, an editable goods
// grid, totals footer, and a sticky action bar.
@Component({
  selector: 'app-purchase-order-voucher',
  standalone: true,
  imports: [PickableWarehousesPipe, FrozenColsDirective, 
    NgClass, FormsModule, RouterLink, AllowedLinkDirective, NavIconComponent, CopyButtonComponent, MoneyInputDirective, ProductPickerComponent,
    ReceiveGoodsDialogComponent, PaginationComponent, PrintDocumentComponent, PrintMenuComponent, AuditHistoryComponent,
  ],
  templateUrl: './purchase-order-voucher.component.html',
  styleUrl: '../../../shared/voucher/voucher.scss',
})
export class PurchaseOrderVoucherComponent implements HasUnsavedChanges {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly data = inject(DataStore);
  private readonly orders = inject(PurchaseOrderService);
  private readonly auth = inject(AuthService);
  /** Giá nhập hidden from roles that only receive goods (Thủ kho…): the server sends no prices to them. */
  readonly prices = seesPurchasePrices((c) => this.auth.can(c));
  private readonly receiveDialog = viewChild<ReceiveGoodsDialogComponent>('receiveDialog');

  // The same instance is reused when navigating between orders (/mua-hang/a → /mua-hang/b),
  // so the id is a signal and the draft is reloaded whenever it changes.
  readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), { initialValue: this.route.snapshot.paramMap.get('id') });
  private readonly editRoute = this.route.snapshot.url.at(-1)?.path === 'sua';

  readonly order = computed(() => {
    const id = this.id();
    return id ? this.data.purchaseOrders().find((o) => o.id === id) : undefined;
  });
  readonly notFound = computed(() => !!this.id() && !this.order());
  readonly mode = computed<Mode>(() => {
    if (!this.id()) return 'create';
    const o = this.order();
    return this.editRoute && o && canEdit(o.status) ? 'edit' : 'view';
  });
  readonly editable = computed(() => this.mode() !== 'view');

  // ---------- draft (create / edit) ----------
  readonly supplierId = signal('');
  readonly date = signal(isoDay(new Date()));
  readonly note = signal('');
  readonly lines = signal<DraftLine[]>([emptyLine()]);
  readonly attempted = signal(false);
  readonly tab = signal<'hang' | 'phieu' | 'nhat-ky'>('hang');
  readonly notice = signal('');
  /** A save or status change the server refused (or that could not reach it). */
  readonly failure = signal('');
  readonly busy = signal(false);
  readonly confirmCancel = signal(false);
  readonly cancelReason = signal('');

  readonly vatRates = VAT_RATES;
  readonly statusLabel = PURCHASE_ORDER_STATUS_LABEL;
  readonly statusClass = purchaseOrderStatusClass;
  readonly money = formatVnd;
  readonly words = vndInWords;
  readonly day = formatDay;

  constructor() {
    // Load the draft from the order once per id (not on every store change, or edits would be lost).
    effect(() => {
      const id = this.id();
      untracked(() => {
        const o = this.order();
        // "Lập đơn nhập" from a supplier passes ?ncc=<id> to pre-select it.
        const fromQuery = this.route.snapshot.queryParamMap.get('ncc') ?? '';
        const preset = !id && this.data.suppliers().some((s) => s.id === fromQuery && s.isActive) ? fromQuery : '';
        this.supplierId.set(o?.supplierId ?? preset);
        this.date.set(o ? o.date.slice(0, 10) : isoDay(new Date()));
        this.note.set(o?.note ?? '');
        // "Gợi ý lập đơn nhập" (Tồn kho) hands over the lines to buy in history.state — nothing is saved until Lập đơn.
        const reorder = id ? [] : ((history.state as Partial<ReorderDraft> | null)?.reorder ?? []);
        this.baseline = '';
        this.lines.set(o ? o.lines.map((l) => this.toDraft(l)) : reorder.length ? reorder.map((r) => this.suggested(r.productId, r.quantity)) : [emptyLine()]);
        this.attempted.set(false);
        this.tab.set('hang');
        this.page.set(1);
        this.confirmCancel.set(false);
        if (id) this.notice.set((history.state as { notice?: string } | null)?.notice ?? '');
        else if (reorder.length) this.notice.set(`Đã điền ${reorder.length} vật tư dưới tồn tối thiểu theo gợi ý — xem lại số lượng, giá rồi Lập đơn nhập.`);
        // A suggested order counts as unsaved work: leaving asks first.
        if (!reorder.length) this.baseline = this.snapshot();
      });
    });
  }

  // ---------- lookups ----------
  private readonly productById = computed(() => new Map(this.data.products().map((p) => [p.id, p])));
  readonly supplier = computed(() => this.data.suppliers().find((s) => s.id === this.supplierId()));
  readonly supplierOptions = computed(() =>
    this.data.suppliers().filter((s) => s.isActive || s.id === this.supplierId()),
  );
  // Danh mục hàng của NCC đang chọn: productId → giá mua (đơn vị cơ bản).
  private readonly catalog = computed(() => {
    const sup = this.supplierId();
    return new Map(this.data.supplierProducts().filter((c) => c.supplierId === sup).map((c) => [c.productId, c.purchasePrice]));
  });
  // Bought items: everything except Thành phẩm (made in-house); the supplier's catalog first.
  readonly productOptions = computed(() => {
    const cat = this.catalog();
    return this.data.products()
      .filter((p) => p.type !== 'THANH_PHAM' && p.isActive)
      .sort((a, b) => Number(cat.has(b.id)) - Number(cat.has(a.id)) || a.name.localeCompare(b.name, 'vi'));
  });
  readonly stock = computed(() => {
    const m = new Map<string, number>();
    for (const s of this.data.stockLevels()) m.set(s.productId, (m.get(s.productId) ?? 0) + s.quantity);
    return m;
  });
  readonly creatorName = computed(() => {
    const email = this.order()?.createdBy;
    if (!email) return 'Bạn (người đang đăng nhập)';
    return this.data.users().find((u) => u.email === email)?.name ?? email;
  });

  product(id: string): Product | undefined {
    return this.productById().get(id);
  }

  units(productId: string): UnitOption[] {
    const p = this.product(productId);
    if (!p) return [];
    return [
      { value: '', label: p.baseUnit, ratio: 1 },
      ...p.unitConversions.map((u) => ({ value: u.unitName, label: u.unitName, ratio: u.ratioToBaseUnit })),
    ];
  }

  private ratio(l: DraftLine): number {
    return this.units(l.productId).find((u) => u.value === l.unitName)?.ratio ?? 1;
  }

  // Rows shown in the grid: the draft while editing, the saved order while viewing.
  readonly rows = computed<DraftLine[]>(() => {
    const o = this.order();
    return this.editable() || !o ? this.lines() : o.lines.map((l) => this.toDraft(l));
  });

  private toDraft(l: PurchaseOrderLine): DraftLine {
    return {
      key: newKey(),
      productId: l.productId,
      unitName: l.unitName ?? '',
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      vatRate: l.vatRate ?? 0,
      warehouseId: l.warehouseId ?? '',
      receivedQuantity: l.receivedQuantity,
    };
  }

  private toLine(d: DraftLine): PurchaseOrderLine {
    const ratio = this.ratio(d);
    return {
      productId: d.productId,
      quantity: d.quantity ?? 0,
      unitPrice: d.unitPrice ?? 0,
      receivedQuantity: d.receivedQuantity,
      unitName: d.unitName || undefined,
      ratioToBase: ratio !== 1 ? ratio : undefined,
      vatRate: d.vatRate,
      warehouseId: d.warehouseId || undefined,
    };
  }

  amount(d: DraftLine): number {
    return lineAmount(this.toLine(d));
  }

  vat(d: DraftLine): number {
    return lineVat(this.toLine(d));
  }

  remaining(d: DraftLine): number {
    return lineRemaining(this.toLine(d));
  }

  unitLabel(d: DraftLine): string {
    return d.unitName || this.product(d.productId)?.baseUnit || '—';
  }

  warehouseName(id: string): string {
    return this.data.warehouses().find((w) => w.id === id)?.name ?? '—';
  }

  // Grid pagination (MISA: "Số dòng/trang"); totals always cover every line.
  // ---------- bản in (xem đơn đã lưu) ----------
  printSupplier(o: PurchaseOrder) {
    return this.data.suppliers().find((s) => s.id === o.supplierId);
  }

  readonly printTotals = computed(() => {
    const o = this.order();
    return o ? orderTotals(o.lines) : null;
  });

  readonly printRows = computed(() => {
    const o = this.order();
    if (!o) return [];
    return o.lines.map((l, i) => {
      const p = this.product(l.productId);
      return {
        i, code: p?.code ?? '', name: p?.name ?? l.productId, unit: l.unitName ?? p?.baseUnit ?? '', qty: l.quantity, price: l.unitPrice,
        amount: lineAmount(l), vatRate: l.vatRate ?? 0, vat: lineVat(l),
      };
    });
  });

  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly pageStart = computed(() => (this.page() - 1) * this.pageSize());
  readonly pagedRows = computed(() => this.rows().slice(this.pageStart(), this.pageStart() + this.pageSize()));

  readonly validLines = computed(() => this.rows().filter((l) => l.productId && (l.quantity ?? 0) > 0));
  readonly totals = computed(() => orderTotals(this.validLines().map((l) => this.toLine(l))));
  readonly totalQuantity = computed(() => this.validLines().reduce((s, l) => s + (l.quantity ?? 0), 0));

  // What still blocks saving — shown in the action bar, first one only.
  readonly issues = computed(() => {
    const out: string[] = [];
    if (!this.supplierId()) out.push('Chọn nhà cung cấp');
    if (!this.date()) out.push('Chọn ngày đặt hàng');
    this.lines().forEach((l, i) => {
      if (l.productId && !((l.quantity ?? 0) > 0)) out.push(`Dòng ${i + 1}: nhập số lượng đặt`);
      if (!l.productId && (l.quantity ?? 0) > 0) out.push(`Dòng ${i + 1}: chọn hàng hoá`);
    });
    if (!this.validLines().length) out.push('Thêm ít nhất một dòng hàng có số lượng');
    return out;
  });

  // ---------- grid editing ----------
  patch(i: number, change: Partial<DraftLine>): void {
    this.lines.update((ls) => ls.map((l, j) => (j === i ? { ...l, ...change } : l)));
  }

  /** A line for a suggested vật tư: what picking it would fill in, plus the quantity (ĐVT chính). */
  private suggested(productId: string, quantity: number): DraftLine {
    const p = this.product(productId);
    return {
      ...emptyLine(), productId, quantity, unitPrice: this.lastPrice(productId), vatRate: p?.vatRate ?? 0,
      warehouseId: p?.defaultWarehouseId ?? this.data.warehouses()[0]?.id ?? '',
    };
  }

  setProduct(i: number, productId: string): void {
    const p = this.product(productId);
    this.patch(i, {
      productId,
      unitName: '',
      unitPrice: this.lastPrice(productId),
      vatRate: p?.vatRate ?? 0,
      warehouseId: p?.defaultWarehouseId ?? this.data.warehouses()[0]?.id ?? '',
    });
  }

  setUnit(i: number, unitName: string): void {
    const l = this.lines()[i];
    const before = this.ratio(l);
    const after = this.units(l.productId).find((u) => u.value === unitName)?.ratio ?? 1;
    // Keep the price consistent with the new unit (1 Bó = 10 Cây → price × 10).
    const price = l.unitPrice !== null ? Math.round((l.unitPrice / before) * after) : null;
    this.patch(i, { unitName, unitPrice: price });
  }

  addLine(): void {
    this.lines.update((ls) => [...ls, emptyLine()]);
    // Jump to the page holding the new line.
    this.page.set(Math.ceil(this.lines().length / this.pageSize()));
  }

  removeLine(i: number): void {
    this.lines.update((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : [emptyLine()]));
    const last = Math.max(1, Math.ceil(this.lines().length / this.pageSize()));
    if (this.page() > last) this.page.set(last);
  }

  clearLines(): void {
    this.lines.set([emptyLine()]);
    this.page.set(1);
  }

  // Price in base units: the supplier's catalog price, else the last purchase price (0 if never bought).
  private lastPrice(productId: string): number {
    const listed = this.catalog().get(productId);
    if (listed !== undefined) return listed;
    const orders = [...this.data.purchaseOrders()].sort((a, b) => b.date.localeCompare(a.date));
    for (const o of orders) {
      const l = o.lines.find((x) => x.productId === productId);
      if (l) return Math.round(l.unitPrice / (l.ratioToBase ?? 1));
    }
    return 0;
  }

  // ---------- save ----------
  async save(): Promise<void> {
    this.attempted.set(true);
    if (this.issues().length || this.busy()) return;
    const draft = {
      supplierId: this.supplierId(),
      date: this.date(),
      note: this.note().trim(),
      lines: this.validLines().map((l) => this.toLine(l)),
    };
    const id = this.id();
    const o = await this.attempt(() => (this.mode() === 'edit' && id ? this.orders.update(id, draft) : this.orders.create(draft)));
    if (!o) return;
    this.baseline = this.snapshot();
    this.router.navigate(['/mua-hang', o.id], { state: { notice: this.mode() === 'edit' ? 'Đã lưu thay đổi.' : `Đã tạo đơn ${o.code}.` } });
  }

  /** Runs a save; on failure shows why and answers null. */
  private async attempt<T>(save: () => Promise<T>): Promise<T | null> {
    this.busy.set(true);
    this.failure.set('');
    try {
      return await save();
    } catch (e) {
      this.failure.set(errorText(e));
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  cancelEditing(): void {
    this.baseline = this.snapshot();
    const id = this.id();
    if (id) this.router.navigate(['/mua-hang', id]);
    else this.router.navigateByUrl('/mua-hang');
  }

  // ---------- status actions (view) ----------
  readonly canEdit = computed(() => !!this.order() && canEdit(this.order()!.status));
  readonly canSend = computed(() => !!this.order() && canSend(this.order()!.status));
  readonly canReceive = computed(() => !!this.order() && canReceive(this.order()!.status));
  readonly canComplete = computed(() => !!this.order() && canComplete(this.order()!.status));
  readonly canCancel = computed(() => !!this.order() && canCancel(this.order()!));
  readonly percent = computed(() => (this.order() ? receivedPercent(this.order()!) : 0));

  async send(): Promise<void> {
    if ((await this.attempt(() => this.orders.send(this.id()!).then(() => true))) === null) return;
    this.notice.set('Đã chuyển đơn sang "Đã gửi NCC".');
  }

  async complete(): Promise<void> {
    if ((await this.attempt(() => this.orders.complete(this.id()!).then(() => true))) === null) return;
    this.notice.set('Đơn đã hoàn tất.');
  }

  async doCancel(): Promise<void> {
    const ok = await this.attempt(() => this.orders.cancel(this.id()!, this.cancelReason().trim()).then(() => true));
    this.confirmCancel.set(false);
    if (ok) this.notice.set('Đã huỷ đơn.');
  }

  openReceive(): void {
    this.receiveDialog()?.open();
  }

  onReceived(message: string): void {
    this.notice.set(message);
    this.tab.set('phieu');
  }

  // Phiếu nhập kho created from this order (new receipts carry purchaseOrderId; demo ones the code).
  readonly receipts = computed(() => {
    const o = this.order();
    if (!o) return [];
    return this.data.warehouseVouchers()
      .filter((v) => v.type === 'NHAP' && (v.purchaseOrderId === o.id || (v.reason ?? '').includes(o.code)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.code.localeCompare(a.code));
  });

  receiptQty(v: { lines?: { delta: number }[] }): number {
    return (v.lines ?? []).reduce((s, l) => s + l.delta, 0);
  }

  // ---------- unsaved changes + Ctrl+S ----------
  private baseline = '';

  private snapshot(): string {
    return JSON.stringify([this.supplierId(), this.date(), this.note(), this.lines().map(({ key, ...line }) => line)]);
  }

  hasUnsavedChanges(): boolean {
    return this.editable() && this.snapshot() !== this.baseline;
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(e: BeforeUnloadEvent): void {
    warnBeforeUnload(e, this.hasUnsavedChanges());
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (!this.editable() || !isSaveShortcut(e)) return;
    e.preventDefault();
    this.save();
  }
}
