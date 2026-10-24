import { Component, HostListener, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DataStore } from '../../../core/services/data-store.service';
import { DebtService } from '../../../core/services/debt.service';
import { CostService } from '../../../core/services/cost.service';
import { AuthService } from '../../../core/services/auth.service';
import { Product, Quotation, SalesOrder, SalesOrderLine, SalesReturn } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { CopyButtonComponent } from '../../../shared/copy-button/copy-button.component';
import { MoneyInputDirective } from '../../../shared/money-input.directive';
import { ProductPickerComponent } from '../../../shared/product-picker/product-picker.component';
import { PrintDocumentComponent } from '../../../shared/print/print-document.component';
import { PrintMenuComponent } from '../../../shared/print/print-menu.component';
import { vndInWords } from '../../../shared/vnd-words';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { FilterMultiSelectComponent, FilterOption } from '../../../shared/filter-multi-select/filter-multi-select.component';
import {
  PRODUCTION_ORDER_STATUS_LABEL, SALES_ORDER_STATUS_LABEL, productionOrderStatusClass, salesOrderStatusClass,
} from '../../../shared/status-labels';
import { formatVnd } from '../../../shared/format.util';
import { tagStyle } from '../../../shared/tag-colors';
import { formatDay, isoDay } from '../../../shared/period';
import { VAT_RATES, round4 } from '../../purchase-orders/purchase-order.rules';
import {
  CUSTOMER_PRICE_LABEL, CUSTOMER_TYPE_LABEL, canCancel, canClose, canDeliver, canEdit, defaultWarehouse, deliveredPercent,
  lineRemaining, linesNeedingLsx, needsProduction, orderTotals, priceFor,
} from '../sales-order.rules';
import { SalesOrderDraft, SalesOrderService } from '../sales-order.service';
import { QuotationService } from '../../quotations/quotation.service';
import { activePromotions, applyLinePromotions, orderDiscountFor } from '../promotion.rules';
import { HasUnsavedChanges, isSaveShortcut, warnBeforeUnload } from '../../../core/guards/unsaved-changes.guard';
import { DeliverDialogComponent } from '../deliver-dialog/deliver-dialog.component';
import { ReturnDialogComponent } from '../return-dialog/return-dialog.component';
import { ApiService, errorText } from '../../../core/api/api.service';
import { AllowedLinkDirective } from '../../../shared/allowed-link.directive';
import { AuditHistoryComponent } from '../../../shared/audit/audit-history.component';
import { FrozenColsDirective } from '../../../shared/frozen-cols.directive';
import { PickableWarehousesPipe } from '../../../shared/pickable-warehouses.pipe';

type Mode = 'create' | 'edit' | 'view';
type Tab = 'hang' | 'gia-von' | 'lsx' | 'pxk' | 'tra-hang' | 'cong-no' | 'nhat-ky';

interface DraftLine {
  key: string;
  lineId?: string;
  productId: string;
  unitName: string; // '' = base unit
  quantity: number | null;
  unitPrice: number | null;
  priceManual: boolean; // typed by hand → not re-priced when the customer changes
  discountRate: number | null;
  discountAmount: number | null;
  vatRate: number;
  warehouseId: string;
  length: number | null;
  width: number | null;
  note: string;
  receivedQuantity: number;
  /** Khuyến mãi (Pha 1.6): chiết khấu gõ tay không bị ghi đè; dòng tặng do chương trình thêm. */
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
  discountAmount: null, vatRate: 0, warehouseId: '', length: null, width: null, note: '', receivedQuantity: 0,
  discountManual: false, promotionId: null, isGift: false,
});

// Đơn hàng bán as one MISA-style chứng từ (lập / xem / sửa): header fields + totals panel,
// editable goods grid with chiết khấu and thuế GTGT, totals footer, sticky action bar. From the
// saved order: Lập lệnh SX, Giao hàng (phiếu xuất kho + công nợ phải thu), Lập phiếu thu.
@Component({
  selector: 'app-sales-order-voucher',
  standalone: true,
  imports: [PickableWarehousesPipe, FrozenColsDirective, 
    NgClass, FormsModule, RouterLink, AllowedLinkDirective, NavIconComponent, CopyButtonComponent, MoneyInputDirective, ProductPickerComponent,
    PaginationComponent, FilterMultiSelectComponent, DeliverDialogComponent, ReturnDialogComponent, PrintDocumentComponent, PrintMenuComponent, AuditHistoryComponent,
  ],
  templateUrl: './sales-order-voucher.component.html',
  styleUrls: ['../../../shared/voucher/voucher.scss', './sales-order-voucher.component.scss'],
})
export class SalesOrderVoucherComponent implements HasUnsavedChanges {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly data = inject(DataStore);
  private readonly debt = inject(DebtService);
  private readonly orders = inject(SalesOrderService);
  private readonly quotations = inject(QuotationService);
  private readonly api = inject(ApiService);
  readonly cost = inject(CostService);
  private readonly auth = inject(AuthService);
  private readonly deliverDialog = viewChild<DeliverDialogComponent>('deliverDialog');
  private readonly returnDialog = viewChild<ReturnDialogComponent>('returnDialog');

  readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), { initialValue: this.route.snapshot.paramMap.get('id') });
  private readonly editRoute = this.route.snapshot.url.at(-1)?.path === 'sua';

  readonly order = computed(() => {
    const id = this.id();
    return id ? this.data.salesOrders().find((o) => o.id === id) : undefined;
  });
  readonly lsx = computed(() => {
    const id = this.id();
    return id ? this.data.productionOrders().filter((x) => x.sourceOrderId === id).sort((a, b) => a.code.localeCompare(b.code)) : [];
  });
  /** An order older than what the app loads at sign-in is read on demand (Pha 1.1). */
  readonly fetching = signal(false);
  readonly notFound = computed(() => !!this.id() && !this.order() && !this.fetching());
  private readonly hasOrder = computed(() => !!this.order());
  private readonly fetchMissing = effect(() => {
    const id = this.id();
    if (!id || untracked(() => this.order())) return;
    this.fetching.set(true);
    void this.orders.ensure(id).finally(() => this.fetching.set(false));
  });
  readonly mode = computed<Mode>(() => {
    if (!this.id()) return 'create';
    const o = this.order();
    return this.editRoute && o && canEdit(o, this.lsx()) ? 'edit' : 'view';
  });
  readonly editable = computed(() => this.mode() !== 'view');

  // ---------- draft ----------
  readonly customerId = signal('');
  readonly recipientName = signal('');
  readonly recipientPhone = signal('');
  readonly deliveryAddress = signal('');
  readonly description = signal('');
  readonly source = signal('');
  readonly tagIds = signal<string[]>([]);
  readonly orderDate = signal(isoDay(new Date()));
  readonly neededByDate = signal('');
  readonly salesRep = signal('');
  readonly orderDiscount = signal<number | null>(null);
  /** Chiết khấu cả đơn gõ tay: khuyến mãi theo tổng đơn không ghi đè. */
  readonly orderDiscountManual = signal(false);
  readonly orderPromotionId = signal<string | null>(null);
  /** "Áp khuyến mãi": tắt thì không tự điền chiết khấu, không thêm hàng tặng. */
  readonly applyPromos = signal(true);
  /** "Thu tiền ngay": khi khách nhận hàng tự lập phiếu thu vào tài khoản này. */
  readonly payNow = signal(false);
  readonly payAccountId = signal('');
  readonly lines = signal<DraftLine[]>([emptyLine()]);
  /** Lập đơn từ báo giá (?quoteId=): saving links the two and marks the báo giá Đã lập đơn. */
  readonly fromQuote = signal<Quotation | null>(null);
  readonly attempted = signal(false);
  readonly tab = signal<Tab>('hang');
  readonly notice = signal('');
  /** A save the server refused (or that could not reach it). */
  readonly failure = signal('');
  /** The server refused the save for hạn mức công nợ; someone with debt.adjust may save anyway. */
  readonly creditBlocked = computed(() => this.failure().startsWith('Vượt hạn mức công nợ'));
  readonly canOverrideCredit = computed(() => this.auth.can('debt.adjust'));
  readonly confirmCancel = signal(false);
  readonly cancelReason = signal('');
  readonly confirmClose = signal(false);
  /** Phiếu trả đang chờ xác nhận huỷ. */
  readonly confirmCancelReturn = signal<SalesReturn | null>(null);
  readonly cancelReturnReason = signal('');

  readonly vatRates = VAT_RATES;
  readonly statusLabel = SALES_ORDER_STATUS_LABEL;
  readonly statusClass = salesOrderStatusClass;
  readonly lsxLabel = PRODUCTION_ORDER_STATUS_LABEL;
  readonly lsxClass = productionOrderStatusClass;
  readonly typeLabel = CUSTOMER_TYPE_LABEL;
  readonly priceLabel = CUSTOMER_PRICE_LABEL;
  readonly money = formatVnd;
  readonly words = vndInWords;
  readonly day = formatDay;

  constructor() {
    effect(() => {
      const id = this.id();
      this.hasOrder(); // fill the form again once an order read on demand arrives
      untracked(() => {
        const o = this.order();
        const params = this.route.snapshot.queryParamMap;
        const quote = !id ? this.data.quotations().find((x) => x.id === params.get('quoteId') && x.status === 'MOI') ?? null : null;
        const q = quote?.customerId ?? params.get('customerId') ?? '';
        const preset = !id && this.data.customers().some((c) => c.id === q && (c.isActive || !!quote)) ? q : '';
        this.fromQuote.set(quote);
        this.customerId.set(o?.customerId ?? preset);
        this.recipientName.set(o?.recipientName ?? quote?.recipientName ?? '');
        this.recipientPhone.set(o?.recipientPhone ?? quote?.recipientPhone ?? '');
        this.deliveryAddress.set(o?.deliveryAddress ?? quote?.deliveryAddress ?? '');
        if (!o && !quote && preset) this.applyDefaultAddress();
        this.description.set(o?.description ?? quote?.description ?? '');
        this.source.set(o?.source ?? '');
        this.tagIds.set(o?.tagIds ?? []);
        this.orderDate.set(o ? o.orderDate.slice(0, 10) : isoDay(new Date()));
        this.neededByDate.set(o?.neededByDate?.slice(0, 10) ?? '');
        this.salesRep.set(o?.salesRep ?? (quote?.salesRep || this.defaultRep()));
        this.orderDiscount.set(o?.discountAmount || quote?.discountAmount || null);
        const header = o ?? quote;
        this.orderPromotionId.set(header?.promotionId ?? null);
        this.orderDiscountManual.set(!header?.promotionId && !!header?.discountAmount);
        this.applyPromos.set(true);
        this.payNow.set(!!o?.payNowAccountId);
        this.payAccountId.set(o?.payNowAccountId ?? this.defaultAccount());
        this.lines.set(o ? o.lines.map((l) => this.toDraft(l)) : quote ? quote.lines.map((l) => this.toDraft({ ...l, receivedQuantity: 0 })) : [emptyLine()]);
        this.attempted.set(false);
        this.tab.set('hang');
        this.page.set(1);
        this.confirmCancel.set(false);
        this.confirmClose.set(false);
        this.confirmCancelReturn.set(null);
        if (id) this.notice.set((history.state as { notice?: string } | null)?.notice ?? '');
        else this.notice.set(quote ? `Đơn điền sẵn từ báo giá ${quote.code} — chọn kho xuất, ngày cần giao rồi lưu. Lưu xong báo giá chuyển sang Đã lập đơn.` : '');
        this.baseline = this.snapshot();
      });
    });
  }

  private defaultAccount(): string {
    const list = this.accounts();
    return (list.find((a) => a.type === 'TIEN_MAT') ?? list[0])?.id ?? '';
  }

  private defaultRep(): string {
    const me = this.orders.userEmail;
    return this.data.users().some((u) => u.email === me) ? me : '';
  }

  // ---------- lookups ----------
  private readonly productById = computed(() => new Map(this.data.products().map((p) => [p.id, p])));
  readonly customer = computed(() => this.data.customers().find((c) => c.id === this.customerId()));
  readonly customerType = computed(() => this.customer()?.type ?? 'LE');
  /** Bảng giá riêng của khách (đang dùng), Pha 1.6. */
  readonly priceList = computed(() => {
    const id = this.customer()?.priceListId;
    return id ? this.data.priceLists().find((l) => l.id === id && l.isActive) : undefined;
  });
  private readonly listItems = computed(() => this.priceList()?.items ?? []);
  /** Khuyến mãi đang áp cho ngày đặt và khách này. */
  readonly promos = computed(() => activePromotions(this.data.promotions(), this.orderDate(), this.customer()));

  promoName(id: string | null | undefined): string {
    const p = id ? this.data.promotions().find((x) => x.id === id) : undefined;
    return p ? `${p.code} · ${p.name}` : '';
  }
  readonly customerOptions = computed(() =>
    this.data.customers().filter((c) => c.isActive || c.id === this.customerId()).sort((a, b) => a.code.localeCompare(b.code)),
  );
  /** Tài khoản nhận tiền cho "Thu tiền ngay" (tài khoản đang dùng). */
  readonly accounts = computed(() => this.data.cashAccounts().filter((a) => a.isActive !== false));
  readonly accountName = computed(() => this.data.cashAccounts().find((a) => a.id === this.payAccountId())?.name ?? '—');
  readonly customerDebt = computed(() => this.debt.receivables().find((r) => r.partnerId === this.customerId()));
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
  readonly tagOptions = computed<FilterOption[]>(() =>
    this.data.tags().filter((t) => t.isActive || this.tagIds().includes(t.id)).map((t) => ({ value: t.id, label: t.name })),
  );
  readonly tagNames = computed(() => this.data.tags().filter((t) => this.tagIds().includes(t.id)).map((t) => t.name));
  readonly tagList = computed(() => this.data.tags().filter((t) => this.tagIds().includes(t.id)));
  readonly tagStyle = tagStyle;

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

  warehouseName(id: string): string {
    return this.data.warehouses().find((w) => w.id === id)?.name ?? '—';
  }

  // ---------- rows & totals ----------
  readonly rows = computed<DraftLine[]>(() => {
    const o = this.order();
    return this.editable() || !o ? this.lines() : o.lines.map((l) => this.toDraft(l));
  });

  private toDraft(l: SalesOrderLine): DraftLine {
    return {
      key: newKey(), lineId: l.id, productId: l.productId, unitName: l.unitName ?? '', quantity: l.quantity, unitPrice: l.unitPrice,
      priceManual: true, discountRate: l.discountRate ?? null, discountAmount: l.discountAmount ?? null, vatRate: l.vatRate ?? 0,
      warehouseId: l.warehouseId ?? defaultWarehouse(this.product(l.productId)), length: l.length ?? null, width: l.width ?? null,
      note: l.note ?? '', receivedQuantity: l.receivedQuantity ?? 0,
      discountManual: !l.promotionId && !l.isGift && !!l.discountAmount, promotionId: l.promotionId ?? null, isGift: !!l.isGift,
    };
  }

  private toLine(d: DraftLine): SalesOrderLine {
    const ratio = this.ratio(d);
    const qty = d.quantity ?? 0;
    const price = d.unitPrice ?? 0;
    return {
      id: d.lineId ?? crypto.randomUUID(),
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
      warehouseId: d.warehouseId || undefined,
      receivedQuantity: d.receivedQuantity,
      length: d.length || undefined,
      width: d.width || undefined,
      note: d.note.trim() || undefined,
      promotionId: d.promotionId,
      isGift: d.isGift || undefined,
    };
  }

  // ---------- bản in (xem đơn đã lưu) ----------
  printCustomer(o: SalesOrder) {
    return this.data.customers().find((c) => c.id === o.customerId);
  }

  readonly printTotals = computed(() => {
    const o = this.order();
    return o ? orderTotals(o.lines, o.discountAmount) : null;
  });

  readonly printRows = computed(() => {
    const o = this.order();
    if (!o) return [];
    const t = orderTotals(o.lines, o.discountAmount);
    return o.lines.map((l, i) => {
      const p = this.product(l.productId);
      const size = l.length && l.width ? ` (${l.length}×${l.width} cm)` : '';
      return {
        i, code: p?.code ?? '', name: (p?.name ?? l.productId) + size, unit: l.unit, qty: l.quantity, price: l.unitPrice,
        discount: t.lines[i].lineDiscount, vatRate: l.vatRate ?? 0, amount: t.lines[i].gross - t.lines[i].lineDiscount, gift: !!l.isGift,
      };
    });
  });

  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly pageStart = computed(() => (this.page() - 1) * this.pageSize());
  readonly pagedRows = computed(() => this.rows().slice(this.pageStart(), this.pageStart() + this.pageSize()));

  readonly validLines = computed(() => this.rows().filter((l) => l.productId && (l.quantity ?? 0) > 0));
  private readonly validSaleLines = computed(() => this.validLines().map((l) => this.toLine(l)));
  readonly totals = computed(() => orderTotals(this.validSaleLines(), this.orderDiscount() ?? 0));
  readonly totalQuantity = computed(() => this.validLines().reduce((s, l) => s + (l.quantity ?? 0), 0));

  /** Per-row figures (thành tiền, CK, thuế) for the grid, keyed by row key. */
  readonly rowCalc = computed(() => {
    const valid = this.validLines();
    const t = this.totals();
    const m = new Map<string, { gross: number; discount: number; vat: number }>();
    valid.forEach((l, i) => m.set(l.key, { gross: t.lines[i].gross, discount: t.lines[i].lineDiscount, vat: t.lines[i].vat }));
    return m;
  });

  readonly showSize = computed(() => this.rows().some((l) => needsProduction(this.product(l.productId)) || l.length || l.width));

  remaining(l: DraftLine): number {
    return lineRemaining(this.toLine(l));
  }

  readonly issues = computed(() => {
    const out: string[] = [];
    if (!this.customerId()) out.push('Chọn khách hàng');
    if (!this.orderDate()) out.push('Chọn ngày đặt hàng');
    if (this.payNow() && !this.payAccountId()) out.push('Chọn tài khoản nhận tiền');
    if (this.neededByDate() && this.neededByDate() < this.orderDate()) out.push('Ngày cần giao trước ngày đặt');
    this.lines().forEach((l, i) => {
      if (l.productId && !((l.quantity ?? 0) > 0)) out.push(`Dòng ${i + 1}: nhập số lượng`);
      if (!l.productId && (l.quantity ?? 0) > 0) out.push(`Dòng ${i + 1}: chọn hàng hoá`);
      if ((l.discountRate ?? 0) > 100) out.push(`Dòng ${i + 1}: tỷ lệ chiết khấu tối đa 100%`);
    });
    if (!this.validLines().length) out.push('Thêm ít nhất một dòng hàng có số lượng');
    const goodsAfterLineDisc = this.totals().goods - this.totals().lineDiscount;
    if ((this.orderDiscount() ?? 0) > goodsAfterLineDisc) out.push('Chiết khấu đơn lớn hơn tiền hàng');
    return out;
  });

  // ---------- grid editing ----------
  patch(i: number, change: Partial<DraftLine>): void {
    const typed = 'discountRate' in change || 'discountAmount' in change ? { discountManual: true, promotionId: null } : {};
    this.lines.update((ls) => ls.map((l, j) => (j === i ? this.withDiscount({ ...l, ...change, ...typed }, change) : l)));
    this.reprice();
  }

  // ---------- bảng giá & khuyến mãi (Pha 1.6) ----------

  /** Re-apply khuyến mãi after an edit: chiết khấu dòng, hàng tặng, chiết khấu cả đơn (each unless typed by hand). */
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

  /** Hàng tặng: giá theo bảng giá của khách, chiết khấu 100% (thành tiền 0, vẫn xuất kho khi giao). */
  private giftLine(productId: string, quantity: number, promotionId: string, previous?: DraftLine): DraftLine {
    const p = this.product(productId);
    const price = p ? priceFor(p, this.customerType(), '', this.listItems()) : 0;
    return {
      ...emptyLine(), key: previous?.key ?? newKey(), productId, quantity, unitPrice: price, priceManual: false,
      discountRate: 100, discountAmount: Math.round(quantity * price), discountManual: true, promotionId, isGift: true,
      vatRate: p?.vatRate ?? 0, warehouseId: previous?.warehouseId || defaultWarehouse(p), note: previous?.note ?? '',
    };
  }

  setOrderDiscount(v: number | null): void {
    this.orderDiscount.set(v);
    this.orderDiscountManual.set(true);
    this.orderPromotionId.set(null);
  }

  setOrderDate(day: string): void {
    this.orderDate.set(day);
    this.reprice();
  }

  setApplyPromos(on: boolean): void {
    this.applyPromos.set(on);
    if (on) {
      // Bật lại: chiết khấu dòng và cả đơn theo chương trình, kể cả chỗ đã gõ tay trước đó.
      this.lines.update((ls) => ls.map((l) => (l.isGift ? l : { ...l, discountManual: false })));
      this.orderDiscountManual.set(false);
    }
    this.reprice();
  }

  /** Khuyến mãi đang áp trên chứng từ (hiện dưới lưới). */
  readonly appliedPromos = computed(() => {
    const ids = new Set([...this.rows().map((l) => l.promotionId), this.orderPromotionId()].filter((x): x is string => !!x));
    return this.data.promotions().filter((p) => ids.has(p.id));
  });

  /** Keep tỷ lệ CK and tiền CK in step (MISA): the one typed drives the other. */
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
      productId,
      unitName: '',
      unitPrice: p ? priceFor(p, this.customerType(), '', this.listItems()) : null,
      priceManual: false,
      vatRate: p?.vatRate ?? 0,
      warehouseId: defaultWarehouse(p),
      quantity: this.lines()[i].quantity ?? 1,
    });
  }

  setUnit(i: number, unitName: string): void {
    const l = this.lines()[i];
    const p = this.product(l.productId);
    if (!p) return;
    // Unit change re-prices from the price list (the unit may have its own price).
    this.patch(i, { unitName, unitPrice: priceFor(p, this.customerType(), unitName, this.listItems()), priceManual: false });
  }

  setPrice(i: number, price: number | null): void {
    this.patch(i, { unitPrice: price, priceManual: true });
  }

  /** Changing the customer re-prices every line whose price was not typed by hand. */
  /** Saved delivery points of the chosen customer (default first). */
  readonly addresses = computed(() =>
    [...(this.customer()?.addresses ?? [])].sort((a, b) => Number(b.isDefault) - Number(a.isDefault)),
  );

  // What the last saved address filled in, so switching address replaces it but never a typed value.
  private autoFilled = { name: '', phone: '' };

  /** Picking a saved address fills người nhận / điện thoại unless the user typed their own. */
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
  async save(overrideCredit = false): Promise<void> {
    this.attempted.set(true);
    if (this.issues().length) return;
    const draft: SalesOrderDraft = {
      customerId: this.customerId(),
      recipientName: this.recipientName().trim() || undefined,
      recipientPhone: this.recipientPhone().trim() || undefined,
      deliveryAddress: this.deliveryAddress().trim() || undefined,
      description: this.description().trim() || undefined,
      source: this.source().trim() || undefined,
      tagIds: this.tagIds(),
      orderDate: this.orderDate(),
      neededByDate: this.neededByDate() || undefined,
      salesRep: this.salesRep(),
      discountAmount: this.orderDiscount() ?? 0,
      promotionId: this.orderPromotionId() ?? undefined,
      payNowAccountId: this.payNow() && this.payAccountId() ? this.payAccountId() : undefined,
      overrideCreditLimit: overrideCredit || undefined,
      quotationId: this.mode() === 'create' ? this.fromQuote()?.id : undefined,
      lines: this.validSaleLines(),
    };
    const id = this.id();
    const o = await this.attempt(() => (this.mode() === 'edit' && id ? this.orders.update(id, draft) : this.orders.create(draft)));
    if (!o) return;
    if (draft.quotationId) await this.quotations.reload(draft.quotationId).catch(() => undefined);
    this.baseline = this.snapshot(); // saved: leaving the page must not ask again
    this.router.navigate(['/don-hang', o.id], { state: { notice: this.mode() === 'edit' ? 'Đã lưu thay đổi.' : `Đã tạo đơn ${o.code}.` } });
  }

  cancelEditing(): void {
    this.baseline = this.snapshot(); // Huỷ = bỏ thay đổi có chủ ý
    const id = this.id();
    if (id) this.router.navigate(['/don-hang', id]);
    else this.router.navigateByUrl('/don-hang');
  }

  // ---------- status & actions (view) ----------
  readonly canEdit = computed(() => !!this.order() && canEdit(this.order()!, this.lsx()));
  readonly canCancel = computed(() => !!this.order() && canCancel(this.order()!));
  /** Đơn đang nằm trên chuyến giao hàng chưa xong: giao qua chuyến, không giao trực tiếp. */
  readonly activeTrip = computed(() => {
    const id = this.order()?.tripId;
    const t = id ? this.data.deliveryTrips().find((x) => x.id === id) : undefined;
    return t && (t.status === 'GOM_DON' || t.status === 'DA_XUAT_KHO') ? t : undefined;
  });
  readonly canDeliver = computed(() => !!this.order() && canDeliver(this.order()!) && !this.activeTrip());
  readonly canClose = computed(() => !!this.order() && canClose(this.order()!));
  readonly lsxNeeded = computed(() => {
    const o = this.order();
    return o ? linesNeedingLsx(o, this.lsx(), (pid) => needsProduction(this.product(pid))).length : 0;
  });
  readonly percent = computed(() => (this.order() ? deliveredPercent(this.order()!) : 0));
  readonly lsxDone = computed(() => this.lsx().filter((x) => x.status === 'HOAN_TAT').length);
  readonly lsxActive = computed(() => this.lsx().filter((x) => x.status !== 'HUY').length);

  /** Còn phải thu của riêng đơn này (sau khi đối trừ các phiếu thu). */
  readonly debtEntry = computed(() => {
    const o = this.order();
    if (!o) return undefined;
    return this.debt.receivables().find((r) => r.partnerId === o.customerId)?.entries.find((e) => e.ref === o.code && e.kind === 'PHAT_SINH');
  });

  async createLsx(): Promise<void> {
    const created = await this.attempt(() => this.orders.createProductionOrders(this.id()!));
    if (!created) return;
    this.notice.set(`Đã lập ${created.map((x) => x.code).join(', ')} (Nháp). Bắt đầu sản xuất để xuất vật tư theo định mức.`);
    this.tab.set('lsx');
  }

  async startLsx(id: string, code: string): Promise<void> {
    const v = await this.attempt(() => this.orders.startProduction(id));
    if (!v) return;
    this.notice.set(`${code} đang sản xuất${v.length ? ` — đã xuất vật tư (${v.map((x) => x.code).join(', ')})` : ' — mặt hàng chưa có định mức nên không xuất vật tư'}.`);
  }

  async completeLsx(id: string, code: string): Promise<void> {
    const v = await this.attempt(() => this.orders.completeProduction(id));
    if (!v) return;
    this.notice.set(`${code} hoàn tất — đã nhập thành phẩm vào kho (${v.map((x) => x.code).join(', ')}).`);
  }

  async doCancel(): Promise<void> {
    const ok = await this.attempt(() => this.orders.cancel(this.id()!, this.cancelReason().trim()).then(() => true));
    this.confirmCancel.set(false);
    if (!ok) return;
    this.notice.set('Đã huỷ đơn. Lệnh sản xuất chưa hoàn tất của đơn cũng đã huỷ.');
  }

  async doClose(): Promise<void> {
    const ok = await this.attempt(() => this.orders.close(this.id()!).then(() => true));
    this.confirmClose.set(false);
    if (!ok) return;
    this.notice.set('Đã kết thúc đơn — phần còn lại không giao nữa. Công nợ chỉ tính trên số khách đã nhận.');
  }

/** Runs a save; on failure shows why and answers null. */
  private async attempt<T>(save: () => Promise<T>): Promise<T | null> {
    this.failure.set('');
    try {
      return await save();
    } catch (e) {
      this.failure.set(errorText(e));
      return null;
    }
  }

  openDeliver(): void {
    this.deliverDialog()?.open();
  }

  onDelivered(message: string): void {
    this.notice.set(this.order()?.payNowAccountId ? `${message} Đã tự lập phiếu thu vào ${this.accountName()}.` : message);
    this.tab.set('pxk');
  }

  // ---------- trả hàng (Pha 1.5) ----------

  /** Khách đã nhận ít nhất một phần và đơn chưa huỷ: nhận lại được hàng trả. */
  readonly canReturn = computed(() => {
    const o = this.order();
    return !!o && this.auth.can('order.return') && o.status !== 'HUY' && o.lines.some((l) => (l.receivedQuantity ?? 0) > 0);
  });
  readonly returns = computed(() => [...(this.order()?.returns ?? [])].sort((a, b) => b.code.localeCompare(a.code)));
  readonly activeReturns = computed(() => this.returns().filter((r) => !r.isCancelled).length);

  openReturn(): void {
    this.returnDialog()?.open();
  }

  onReturned(message: string): void {
    this.notice.set(message);
    this.tab.set('tra-hang');
  }

  /** "SP001 × 4 · SP002 × 1" — the lines of one phiếu trả, by mã hàng. */
  returnItems(r: SalesReturn): string {
    const lines = new Map((this.order()?.lines ?? []).map((l) => [l.id, l]));
    return r.lines
      .map((x) => {
        const l = lines.get(x.orderLineId);
        return `${this.product(l?.productId ?? '')?.code ?? '?'} × ${x.quantity.toLocaleString('vi-VN')}${l?.unit ? ' ' + l.unit : ''}`;
      })
      .join(' · ');
  }

  askCancelReturn(r: SalesReturn): void {
    this.cancelReturnReason.set('');
    this.confirmCancelReturn.set(r);
  }

  async doCancelReturn(): Promise<void> {
    const r = this.confirmCancelReturn();
    if (!r) return;
    const ok = await this.attempt(() => this.orders.cancelReturn(this.id()!, r.id, this.cancelReturnReason().trim()).then(() => true));
    this.confirmCancelReturn.set(null);
    if (!ok) return;
    this.notice.set(`Đã huỷ phiếu trả ${r.code}${r.voucherCode ? ` — phiếu ${r.voucherCode} đã huỷ, hàng ra khỏi kho` : ''}; công nợ phải thu tăng lại ${this.money(r.amount)}.`);
  }

  // Phiếu xuất kho của đơn: new ones carry salesOrderId; demo ones mention the order / its trip.
  readonly exportVouchers = computed(() => {
    const o = this.order();
    if (!o) return [];
    const trip = o.tripId ? this.data.deliveryTrips().find((t) => t.id === o.tripId)?.code : undefined;
    return this.data.warehouseVouchers()
      .filter((v) => v.type === 'XUAT' && (v.salesOrderId === o.id || (v.reason ?? '').includes(o.code) || (!!trip && (v.reason ?? '').includes(trip))))
      .sort((a, b) => b.date.localeCompare(a.date) || b.code.localeCompare(a.code));
  });

  voucherQty(v: { lines?: { delta: number }[] }): number {
    return round4((v.lines ?? []).reduce((s, l) => s + l.delta, 0));
  }

  // ---------- tab Giá vốn ----------
  /** Per line: giá vốn bình quân hiện tại (CostService, theo ĐVT của dòng), doanh thu thuần sau chiết khấu, lãi gộp. */
  /** Giá vốn đã chốt khi xuất hàng của đơn (per base unit) — mặt hàng đã giao dùng giá này thay cho bình quân hiện tại. */
  readonly issuedCosts = signal<Record<string, number>>({});

  private readonly loadIssuedCosts = effect(() => {
    const o = this.order();
    if (!o || !this.cost.canViewCost() || !o.lines.some((l) => (l.receivedQuantity ?? 0) > 0)) {
      this.issuedCosts.set({});
      return;
    }
    this.api.get<Record<string, number>>(`/sales-orders/${o.id}/issued-costs`).then(
      (c) => this.issuedCosts.set(c),
      () => this.issuedCosts.set({}),
    );
  });

  readonly costRows = computed(() => {
    const t = this.totals();
    const issued = this.issuedCosts();
    return this.validLines().map((l, i) => {
      const p = this.product(l.productId);
      const frozen = issued[l.productId] !== undefined;
      const unitCost = Math.round((frozen ? issued[l.productId] : this.cost.costOf(l.productId)) * this.ratio(l));
      const costAmount = Math.round(unitCost * (l.quantity ?? 0));
      const net = t.lines[i].taxable;
      const profit = net - costAmount;
      return {
        key: l.key, name: p?.name ?? l.productId, code: p?.code ?? '', unit: this.unitLabel(l), quantity: l.quantity ?? 0,
        service: p?.type === 'DICH_VU', unitCost, costAmount, net, profit, margin: net ? (profit / net) * 100 : 0,
        noCost: p?.type !== 'DICH_VU' && unitCost === 0, frozen,
      };
    });
  });

  readonly costTotals = computed(() => {
    const rows = this.costRows();
    const net = rows.reduce((s, r) => s + r.net, 0);
    const costAmount = rows.reduce((s, r) => s + r.costAmount, 0);
    return { net, costAmount, profit: net - costAmount, margin: net ? ((net - costAmount) / net) * 100 : 0, noCost: rows.filter((r) => r.noCost).length };
  });

  percentText(n: number): string {
    return n.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  }

  // ---------- tham chiếu & chuyển chứng từ ----------
  /** Chứng từ liên quan của đơn đã lưu: chuyến giao, phiếu xuất kho, lệnh SX, phiếu thu. */
  readonly references = computed(() => {
    const o = this.order();
    if (!o) return [];
    const out: { label: string; code: string; link: string[]; title: string }[] = [];
    if (o.quotationId && o.quotationCode) out.push({ label: 'Báo giá', code: o.quotationCode, link: ['/bao-gia', o.quotationId], title: 'Báo giá' });
    const trip = o.tripId ? this.data.deliveryTrips().find((t) => t.id === o.tripId) : undefined;
    if (trip) out.push({ label: 'Chuyến giao', code: trip.code, link: ['/giao-hang', trip.id], title: 'Chuyến giao hàng' });
    for (const v of this.exportVouchers()) out.push({ label: 'Phiếu xuất', code: v.code, link: ['/kho/phieu', v.id], title: 'Phiếu xuất kho' });
    for (const x of this.lsx().filter((y) => y.status !== 'HUY')) out.push({ label: 'Lệnh SX', code: x.code, link: ['/san-xuat', x.id], title: 'Lệnh sản xuất' });
    const receipts = this.data.cashVouchers().filter((v) => !v.isCancelled && v.kind === 'THU'
      && (v.allocations?.some((a) => a.ref === o.code) || (v.description ?? '').includes(o.code)));
    for (const v of receipts) out.push({ label: 'Phiếu thu', code: v.code, link: ['/thu-chi', v.id], title: 'Phiếu thu' });
    return out;
  });

  /** Đơn liền trước / liền sau theo số chứng từ (như nút ‹ › của MISA). */
  readonly neighbours = computed(() => {
    const o = this.order();
    if (!o) return { prev: undefined, next: undefined, index: 0, total: 0 };
    const all = [...this.data.salesOrders()].sort((a, b) => a.code.localeCompare(b.code));
    const i = all.findIndex((x) => x.id === o.id);
    return { prev: all[i - 1], next: all[i + 1], index: i + 1, total: all.length };
  });

  lsxStock(productId: string): number {
    return this.stock().get(productId) ?? 0;
  }

  // ---------- unsaved changes + Ctrl+S ----------
  private baseline = '';

  private snapshot(): string {
    return JSON.stringify([
      this.customerId(), this.recipientName(), this.recipientPhone(), this.deliveryAddress(), this.description(), this.source(),
      this.tagIds(), this.orderDate(), this.neededByDate(), this.salesRep(), this.orderDiscount(), this.payNow(), this.payAccountId(),
      this.lines().map(({ key, ...line }) => line),
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
