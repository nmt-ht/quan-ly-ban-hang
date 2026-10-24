import { Component, HostListener, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DataStore } from '../../../core/services/data-store.service';
import { AuthService } from '../../../core/services/auth.service';
import { Product, Quotation, QuotationLine } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { CopyButtonComponent } from '../../../shared/copy-button/copy-button.component';
import { MoneyInputDirective } from '../../../shared/money-input.directive';
import { ProductPickerComponent } from '../../../shared/product-picker/product-picker.component';
import { PrintDocumentComponent } from '../../../shared/print/print-document.component';
import { PrintMenuComponent } from '../../../shared/print/print-menu.component';
import { vndInWords } from '../../../shared/vnd-words';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { QUOTATION_STATUS_LABEL, quotationStatusClass, quotationView } from '../../../shared/status-labels';
import { formatVnd } from '../../../shared/format.util';
import { formatDay, isoDay } from '../../../shared/period';
import { VAT_RATES } from '../../purchase-orders/purchase-order.rules';
import { CUSTOMER_PRICE_LABEL, CUSTOMER_TYPE_LABEL, needsProduction, orderTotals, priceFor } from '../../sales-orders/sales-order.rules';
import { QuotationDraft, QuotationService } from '../quotation.service';
import { activePromotions, applyLinePromotions, orderDiscountFor } from '../../sales-orders/promotion.rules';
import { HasUnsavedChanges, isSaveShortcut, warnBeforeUnload } from '../../../core/guards/unsaved-changes.guard';
import { errorText } from '../../../core/api/api.service';
import { AuditHistoryComponent } from '../../../shared/audit/audit-history.component';
import { FrozenColsDirective } from '../../../shared/frozen-cols.directive';

type Mode = 'create' | 'edit' | 'view';
type Tab = 'hang' | 'nhat-ky';

interface DraftLine {
  key: string;
  productId: string;
  unitName: string; // '' = base unit
  quantity: number | null;
  unitPrice: number | null;
  priceManual: boolean; // typed by hand → not re-priced when the customer changes
  discountRate: number | null;
  discountAmount: number | null;
  vatRate: number;
  length: number | null;
  width: number | null;
  note: string;
  /** Khuyến mãi (Pha 1.6), như trên đơn hàng. */
  discountManual: boolean;
  promotionId: string | null;
  isGift: boolean;
}

interface UnitOption {
  value: string;
  label: string;
  ratio: number;
}

const newKey = () => crypto.randomUUID();
const emptyLine = (): DraftLine => ({
  key: newKey(), productId: '', unitName: '', quantity: null, unitPrice: null, priceManual: false, discountRate: null,
  discountAmount: null, vatRate: 0, length: null, width: null, note: '', discountManual: false, promotionId: null, isGift: false,
});

/** Hiệu lực mặc định của báo giá mới: 7 ngày. */
const DEFAULT_VALID_DAYS = 7;

// Báo giá (Pha 1.4) as one chứng từ like Đơn hàng bán, without kho, giao hàng or thu tiền: the same goods grid,
// đơn giá theo bảng giá của loại khách, chiết khấu, thuế GTGT. From an open báo giá: In, Sửa, Huỷ, Lập đơn hàng
// (opens the order form filled from it; saving the order marks the báo giá Đã lập đơn).
@Component({
  selector: 'app-quotation-voucher',
  standalone: true,
  imports: [
    FrozenColsDirective, NgClass, FormsModule, RouterLink, NavIconComponent, CopyButtonComponent, MoneyInputDirective, ProductPickerComponent,
    PaginationComponent, PrintDocumentComponent, PrintMenuComponent, AuditHistoryComponent,
  ],
  templateUrl: './quotation-voucher.component.html',
  styleUrls: ['../../../shared/voucher/voucher.scss', '../../sales-orders/sales-order-voucher/sales-order-voucher.component.scss'],
})
export class QuotationVoucherComponent implements HasUnsavedChanges {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly data = inject(DataStore);
  private readonly quotes = inject(QuotationService);
  private readonly auth = inject(AuthService);

  readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), { initialValue: this.route.snapshot.paramMap.get('id') });
  private readonly editRoute = this.route.snapshot.url.at(-1)?.path === 'sua';
  readonly today = isoDay(new Date());

  readonly quote = computed(() => {
    const id = this.id();
    return id ? this.data.quotations().find((q) => q.id === id) : undefined;
  });
  readonly notFound = computed(() => !!this.id() && !this.quote());
  readonly mode = computed<Mode>(() => {
    if (!this.id()) return 'create';
    return this.editRoute && this.quote()?.status === 'MOI' && this.auth.can('quote.update') ? 'edit' : 'view';
  });
  readonly editable = computed(() => this.mode() !== 'view');
  readonly view = computed(() => (this.quote() ? quotationView(this.quote()!, this.today) : 'MOI'));

  // ---------- draft ----------
  readonly customerId = signal('');
  readonly recipientName = signal('');
  readonly recipientPhone = signal('');
  readonly deliveryAddress = signal('');
  readonly description = signal('');
  readonly quoteDate = signal(this.today);
  readonly validUntil = signal('');
  readonly salesRep = signal('');
  readonly orderDiscount = signal<number | null>(null);
  readonly orderDiscountManual = signal(false);
  readonly orderPromotionId = signal<string | null>(null);
  readonly applyPromos = signal(true);
  readonly lines = signal<DraftLine[]>([emptyLine()]);
  readonly attempted = signal(false);
  readonly tab = signal<Tab>('hang');
  readonly notice = signal('');
  readonly failure = signal('');
  readonly confirmCancel = signal(false);
  readonly cancelReason = signal('');

  readonly vatRates = VAT_RATES;
  readonly statusLabel = QUOTATION_STATUS_LABEL;
  readonly statusClass = quotationStatusClass;
  readonly typeLabel = CUSTOMER_TYPE_LABEL;
  readonly priceLabel = CUSTOMER_PRICE_LABEL;
  readonly money = formatVnd;
  readonly words = vndInWords;
  readonly day = formatDay;

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => {
        const q = this.quote();
        const preset = this.route.snapshot.queryParamMap.get('customerId') ?? '';
        const customer = !id && this.data.customers().some((c) => c.id === preset && c.isActive) ? preset : '';
        this.customerId.set(q?.customerId ?? customer);
        this.recipientName.set(q?.recipientName ?? '');
        this.recipientPhone.set(q?.recipientPhone ?? '');
        this.deliveryAddress.set(q?.deliveryAddress ?? '');
        if (!q && customer) this.applyDefaultAddress();
        this.description.set(q?.description ?? '');
        this.quoteDate.set(q ? q.quoteDate.slice(0, 10) : this.today);
        this.validUntil.set(q ? (q.validUntil?.slice(0, 10) ?? '') : addDays(this.today, DEFAULT_VALID_DAYS));
        this.salesRep.set(q?.salesRep ?? this.defaultRep());
        this.orderDiscount.set(q?.discountAmount || null);
        this.orderPromotionId.set(q?.promotionId ?? null);
        this.orderDiscountManual.set(!q?.promotionId && !!q?.discountAmount);
        this.applyPromos.set(true);
        this.lines.set(q ? q.lines.map((l) => this.toDraft(l)) : [emptyLine()]);
        this.attempted.set(false);
        this.tab.set('hang');
        this.page.set(1);
        this.confirmCancel.set(false);
        if (id) this.notice.set((history.state as { notice?: string } | null)?.notice ?? '');
        this.baseline = this.snapshot();
      });
    });
  }

  private defaultRep(): string {
    const me = this.auth.user()?.email ?? '';
    return this.data.users().some((u) => u.email === me) ? me : '';
  }

  // ---------- lookups ----------
  private readonly productById = computed(() => new Map(this.data.products().map((p) => [p.id, p])));
  readonly customer = computed(() => this.data.customers().find((c) => c.id === this.customerId()));
  readonly customerType = computed(() => this.customer()?.type ?? 'LE');
  readonly priceList = computed(() => {
    const id = this.customer()?.priceListId;
    return id ? this.data.priceLists().find((l) => l.id === id && l.isActive) : undefined;
  });
  private readonly listItems = computed(() => this.priceList()?.items ?? []);
  readonly promos = computed(() => activePromotions(this.data.promotions(), this.quoteDate(), this.customer()));

  promoName(id: string | null | undefined): string {
    const p = id ? this.data.promotions().find((x) => x.id === id) : undefined;
    return p ? `${p.code} · ${p.name}` : '';
  }
  readonly customerOptions = computed(() =>
    this.data.customers().filter((c) => c.isActive || c.id === this.customerId()).sort((a, b) => a.code.localeCompare(b.code)),
  );
  readonly productOptions = computed(() =>
    this.data.products().filter((p) => p.isActive && p.isSellable).sort((a, b) => a.name.localeCompare(b.name, 'vi')),
  );
  readonly stock = computed(() => {
    const m = new Map<string, number>();
    for (const s of this.data.stockLevels()) m.set(s.productId, (m.get(s.productId) ?? 0) + s.quantity);
    return m;
  });
  readonly repOptions = computed(() => {
    const roles = new Map(this.data.roles().map((r) => [r.id, r.name]));
    return this.data.users().map((u) => ({ email: u.email, label: `${u.name} — ${roles.get(u.roleId) ?? ''}` }));
  });
  readonly addresses = computed(() =>
    [...(this.customer()?.addresses ?? [])].sort((a, b) => Number(b.isDefault) - Number(a.isDefault)),
  );

  userName(email: string): string {
    return this.data.users().find((u) => u.email === email)?.name ?? (email || '—');
  }

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

  unitLabel(l: DraftLine): string {
    return l.unitName || this.product(l.productId)?.baseUnit || '—';
  }

  // ---------- rows & totals ----------
  readonly rows = computed<DraftLine[]>(() => {
    const q = this.quote();
    return this.editable() || !q ? this.lines() : q.lines.map((l) => this.toDraft(l));
  });

  private toDraft(l: QuotationLine): DraftLine {
    return {
      key: newKey(), productId: l.productId, unitName: l.unitName ?? '', quantity: l.quantity, unitPrice: l.unitPrice, priceManual: true,
      discountRate: l.discountRate ?? null, discountAmount: l.discountAmount ?? null, vatRate: l.vatRate ?? 0,
      length: l.length ?? null, width: l.width ?? null, note: l.note ?? '',
      discountManual: !l.promotionId && !l.isGift && !!l.discountAmount, promotionId: l.promotionId ?? null, isGift: !!l.isGift,
    };
  }

  private toLine(d: DraftLine): QuotationLine {
    const ratio = this.ratio(d);
    const qty = d.quantity ?? 0;
    const price = d.unitPrice ?? 0;
    return {
      id: crypto.randomUUID(),
      productId: d.productId,
      unit: this.unitLabel(d),
      unitName: d.unitName || undefined,
      ratioToBase: ratio !== 1 ? ratio : undefined,
      quantity: qty,
      unitPrice: price,
      lineTotal: Math.round(qty * price),
      discountRate: d.discountRate || undefined,
      discountAmount: d.discountAmount || undefined,
      vatRate: d.vatRate,
      length: d.length || undefined,
      width: d.width || undefined,
      note: d.note.trim() || undefined,
      promotionId: d.promotionId,
      isGift: d.isGift || undefined,
    };
  }

  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly pageStart = computed(() => (this.page() - 1) * this.pageSize());
  readonly pagedRows = computed(() => this.rows().slice(this.pageStart(), this.pageStart() + this.pageSize()));

  readonly validLines = computed(() => this.rows().filter((l) => l.productId && (l.quantity ?? 0) > 0));
  private readonly validQuoteLines = computed(() => this.validLines().map((l) => this.toLine(l)));
  readonly totals = computed(() => orderTotals(this.validQuoteLines(), this.orderDiscount() ?? 0));
  readonly totalQuantity = computed(() => this.validLines().reduce((s, l) => s + (l.quantity ?? 0), 0));

  readonly rowCalc = computed(() => {
    const valid = this.validLines();
    const t = this.totals();
    const m = new Map<string, { gross: number; discount: number; vat: number }>();
    valid.forEach((l, i) => m.set(l.key, { gross: t.lines[i].gross, discount: t.lines[i].lineDiscount, vat: t.lines[i].vat }));
    return m;
  });

  readonly showSize = computed(() => this.rows().some((l) => needsProduction(this.product(l.productId)) || l.length || l.width));

  readonly issues = computed(() => {
    const out: string[] = [];
    if (!this.customerId()) out.push('Chọn khách hàng');
    if (!this.quoteDate()) out.push('Chọn ngày báo giá');
    if (this.validUntil() && this.validUntil() < this.quoteDate()) out.push('Ngày hiệu lực trước ngày báo giá');
    this.lines().forEach((l, i) => {
      if (l.productId && !((l.quantity ?? 0) > 0)) out.push(`Dòng ${i + 1}: nhập số lượng`);
      if (!l.productId && (l.quantity ?? 0) > 0) out.push(`Dòng ${i + 1}: chọn hàng hoá`);
      if ((l.discountRate ?? 0) > 100) out.push(`Dòng ${i + 1}: tỷ lệ chiết khấu tối đa 100%`);
    });
    if (!this.validLines().length) out.push('Thêm ít nhất một dòng hàng có số lượng');
    if ((this.orderDiscount() ?? 0) > this.totals().goods - this.totals().lineDiscount) out.push('Chiết khấu cả báo giá lớn hơn tiền hàng');
    return out;
  });

  // ---------- grid editing (same rules as the order form) ----------
  patch(i: number, change: Partial<DraftLine>): void {
    const typed = 'discountRate' in change || 'discountAmount' in change ? { discountManual: true, promotionId: null } : {};
    this.lines.update((ls) => ls.map((l, j) => (j === i ? this.withDiscount({ ...l, ...change, ...typed }, change) : l)));
    this.reprice();
  }

  // ---------- bảng giá & khuyến mãi (Pha 1.6, như trên đơn hàng) ----------

  private reprice(): void {
    const enabled = this.applyPromos();
    const promos = this.promos();
    this.lines.update((ls) => applyLinePromotions(ls, {
      enabled, promos, product: (id) => this.product(id), ratio: (l) => this.ratio(l),
      makeGift: (productId, quantity, promotionId, previous) => this.giftLine(productId, quantity, promotionId, previous),
    }));
    if (this.orderDiscountManual()) return;
    const net = this.lines().filter((l) => !l.isGift && l.productId && (l.quantity ?? 0) > 0)
      .reduce((s, l) => s + Math.round((l.quantity ?? 0) * (l.unitPrice ?? 0)) - (l.discountAmount ?? 0), 0);
    const best = enabled ? orderDiscountFor(promos, net) : null;
    this.orderDiscount.set(best?.amount || null);
    this.orderPromotionId.set(best?.promotionId ?? null);
  }

  private giftLine(productId: string, quantity: number, promotionId: string, previous?: DraftLine): DraftLine {
    const p = this.product(productId);
    const price = p ? priceFor(p, this.customerType(), '', this.listItems()) : 0;
    return {
      ...emptyLine(), key: previous?.key ?? newKey(), productId, quantity, unitPrice: price, priceManual: false,
      discountRate: 100, discountAmount: Math.round(quantity * price), discountManual: true, promotionId, isGift: true,
      vatRate: p?.vatRate ?? 0, note: previous?.note ?? '',
    };
  }

  setOrderDiscount(v: number | null): void {
    this.orderDiscount.set(v);
    this.orderDiscountManual.set(true);
    this.orderPromotionId.set(null);
  }

  setQuoteDate(day: string): void {
    this.quoteDate.set(day);
    this.reprice();
  }

  setApplyPromos(on: boolean): void {
    this.applyPromos.set(on);
    if (on) {
      this.lines.update((ls) => ls.map((l) => (l.isGift ? l : { ...l, discountManual: false })));
      this.orderDiscountManual.set(false);
    }
    this.reprice();
  }

  readonly appliedPromos = computed(() => {
    const ids = new Set([...this.rows().map((l) => l.promotionId), this.orderPromotionId()].filter((x): x is string => !!x));
    return this.data.promotions().filter((p) => ids.has(p.id));
  });

  /** Keep tỷ lệ CK and tiền CK in step: the one typed drives the other. */
  private withDiscount(l: DraftLine, change: Partial<DraftLine>): DraftLine {
    const gross = Math.round((l.quantity ?? 0) * (l.unitPrice ?? 0));
    if ('discountAmount' in change) {
      const amt = Math.min(gross, Math.max(0, l.discountAmount ?? 0));
      return { ...l, discountAmount: amt || null, discountRate: gross && amt ? Math.round((amt / gross) * 10000) / 100 : null };
    }
    if ('discountRate' in change || 'quantity' in change || 'unitPrice' in change) {
      const rate = l.discountRate ?? 0;
      return rate ? { ...l, discountAmount: Math.round((gross * Math.min(rate, 100)) / 100) } : l;
    }
    return l;
  }

  setProduct(i: number, productId: string): void {
    const p = this.product(productId);
    this.patch(i, {
      productId, unitName: '', unitPrice: p ? priceFor(p, this.customerType(), '', this.listItems()) : null, priceManual: false,
      vatRate: p?.vatRate ?? 0, quantity: this.lines()[i].quantity ?? 1,
    });
  }

  setUnit(i: number, unitName: string): void {
    const p = this.product(this.lines()[i].productId);
    if (!p) return;
    this.patch(i, { unitName, unitPrice: priceFor(p, this.customerType(), unitName, this.listItems()), priceManual: false });
  }

  setPrice(i: number, price: number | null): void {
    this.patch(i, { unitPrice: price, priceManual: true });
  }

  private autoFilled = { name: '', phone: '' };

  setAddress(text: string): void {
    this.deliveryAddress.set(text);
    const a = this.addresses().find((x) => x.address === text);
    if (!a) return;
    const name = a.recipientName ?? '';
    const phone = a.phone ?? '';
    if (!this.recipientName().trim() || this.recipientName() === this.autoFilled.name) this.recipientName.set(name);
    if (!this.recipientPhone().trim() || this.recipientPhone() === this.autoFilled.phone) this.recipientPhone.set(phone);
    this.autoFilled = { name, phone };
  }

  private applyDefaultAddress(): void {
    const a = this.addresses()[0];
    this.recipientName.set('');
    this.recipientPhone.set('');
    this.deliveryAddress.set('');
    this.autoFilled = { name: '', phone: '' };
    if (a) this.setAddress(a.address);
  }

  /** Changing the customer re-prices every line whose price was not typed by hand. */
  setCustomer(id: string): void {
    this.customerId.set(id);
    this.applyDefaultAddress();
    const type = this.customerType();
    this.lines.update((ls) =>
      ls.map((l) => {
        const p = this.product(l.productId);
        return p && !l.priceManual ? this.withDiscount({ ...l, unitPrice: priceFor(p, type, l.unitName, this.listItems()) }, { unitPrice: 0 }) : l;
      }),
    );
    this.reprice();
  }

  addLine(): void {
    this.lines.update((ls) => [...ls, emptyLine()]);
    this.page.set(Math.ceil(this.lines().length / this.pageSize()));
  }

  removeLine(i: number): void {
    this.lines.update((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : [emptyLine()]));
    this.reprice();
    const last = Math.max(1, Math.ceil(this.lines().length / this.pageSize()));
    if (this.page() > last) this.page.set(last);
  }

  clearLines(): void {
    this.lines.set([emptyLine()]);
    this.page.set(1);
  }

  // ---------- save ----------
  async save(): Promise<void> {
    this.attempted.set(true);
    if (this.issues().length) return;
    const draft: QuotationDraft = {
      customerId: this.customerId(),
      recipientName: this.recipientName().trim() || undefined,
      recipientPhone: this.recipientPhone().trim() || undefined,
      deliveryAddress: this.deliveryAddress().trim() || undefined,
      description: this.description().trim() || undefined,
      quoteDate: this.quoteDate(),
      validUntil: this.validUntil() || undefined,
      salesRep: this.salesRep(),
      discountAmount: this.orderDiscount() ?? 0,
      promotionId: this.orderPromotionId() ?? undefined,
      lines: this.validQuoteLines(),
    };
    const id = this.id();
    const q = await this.attempt(() => (this.mode() === 'edit' && id ? this.quotes.update(id, draft) : this.quotes.create(draft)));
    if (!q) return;
    this.baseline = this.snapshot();
    this.router.navigate(['/bao-gia', q.id], { state: { notice: this.mode() === 'edit' ? 'Đã lưu thay đổi.' : `Đã lập báo giá ${q.code}.` } });
  }

  cancelEditing(): void {
    this.baseline = this.snapshot();
    const id = this.id();
    if (id) this.router.navigate(['/bao-gia', id]);
    else this.router.navigateByUrl('/bao-gia');
  }

  // ---------- actions (view) ----------
  readonly isOpen = computed(() => this.quote()?.status === 'MOI');
  readonly canEdit = computed(() => this.isOpen() && this.auth.can('quote.update'));
  readonly canCancel = computed(() => this.isOpen() && this.auth.can('quote.cancel'));
  readonly canOrder = computed(() => this.isOpen() && this.auth.can('order.create'));
  /** The order made from it, when this user can see it. */
  readonly order = computed(() => {
    const id = this.quote()?.orderId;
    return id ? this.data.salesOrders().find((o) => o.id === id) : undefined;
  });

  makeOrder(): void {
    const q = this.quote();
    if (q) this.router.navigate(['/don-hang/them-moi'], { queryParams: { quoteId: q.id } });
  }

  async doCancel(): Promise<void> {
    const ok = await this.attempt(() => this.quotes.cancel(this.id()!, this.cancelReason().trim()).then(() => true));
    this.confirmCancel.set(false);
    if (ok) this.notice.set('Đã huỷ báo giá.');
  }

  private async attempt<T>(save: () => Promise<T>): Promise<T | null> {
    this.failure.set('');
    try {
      return await save();
    } catch (e) {
      this.failure.set(errorText(e));
      return null;
    }
  }

  /** Báo giá liền trước / liền sau theo số chứng từ. */
  readonly neighbours = computed(() => {
    const q = this.quote();
    if (!q) return { prev: undefined, next: undefined, index: 0, total: 0 };
    const all = [...this.data.quotations()].sort((a, b) => a.code.localeCompare(b.code));
    const i = all.findIndex((x) => x.id === q.id);
    return { prev: all[i - 1] as Quotation | undefined, next: all[i + 1] as Quotation | undefined, index: i + 1, total: all.length };
  });

  // ---------- bản in ----------
  readonly printRows = computed(() => {
    const q = this.quote();
    if (!q) return [];
    const t = orderTotals(q.lines, q.discountAmount);
    return q.lines.map((l, i) => {
      const p = this.product(l.productId);
      const size = l.length && l.width ? ` (${l.length}×${l.width} cm)` : '';
      return {
        i, code: p?.code ?? '', name: (p?.name ?? l.productId) + size, unit: l.unit, qty: l.quantity, price: l.unitPrice,
        discount: t.lines[i].lineDiscount, vatRate: l.vatRate ?? 0, amount: t.lines[i].gross - t.lines[i].lineDiscount, gift: !!l.isGift,
      };
    });
  });

  readonly printTotals = computed(() => {
    const q = this.quote();
    return q ? orderTotals(q.lines, q.discountAmount) : null;
  });

  // ---------- unsaved changes + Ctrl+S ----------
  private baseline = '';

  private snapshot(): string {
    return JSON.stringify([
      this.customerId(), this.recipientName(), this.recipientPhone(), this.deliveryAddress(), this.description(), this.quoteDate(),
      this.validUntil(), this.salesRep(), this.orderDiscount(), this.lines().map(({ key, ...line }) => line),
    ]);
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

function addDays(day: string, n: number): string {
  const d = new Date(day + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return isoDay(d);
}
