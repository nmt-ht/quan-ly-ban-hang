import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { MockDataService } from '../../../core/services/mock-data.service';
import { DebtService } from '../../../core/services/debt.service';
import { Product, PurchaseOrder } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { CopyButtonComponent } from '../../../shared/copy-button/copy-button.component';
import { ProductPickerComponent } from '../../../shared/product-picker/product-picker.component';
import { MoneyInputDirective } from '../../../shared/money-input.directive';
import { amountTone, formatVnd, formatVndSigned } from '../../../shared/format.util';
import { formatDay } from '../../../shared/period';
import {
  PRODUCT_TYPE_CLASS, PRODUCT_TYPE_LABEL, PURCHASE_ORDER_STATUS_LABEL, purchaseOrderStatusClass, supplierStatusClass,
  supplierStatusLabel,
} from '../../../shared/status-labels';
import { canReceive, receivedPercent } from '../../purchase-orders/purchase-order.rules';
import { creditLabel } from '../supplier.rules';
import { SupplierService } from '../supplier.service';

export type SupplierTab = 'chung' | 'hang' | 'don-nhap' | 'cong-no';

interface CatalogRow {
  productId: string;
  product: Product | undefined;
  supplierCode?: string;
  purchasePrice: number;
  lastOrderPrice?: number; // giá trên đơn nhập gần nhất của NCC này (đơn vị cơ bản)
}

@Component({
  selector: 'app-supplier-detail',
  standalone: true,
  imports: [NgClass, FormsModule, RouterLink, NavIconComponent, CopyButtonComponent, ProductPickerComponent, MoneyInputDirective],
  templateUrl: './supplier-detail.component.html',
  styleUrl: './supplier-detail.component.scss',
})
export class SupplierDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly data = inject(MockDataService);
  private readonly debt = inject(DebtService);
  private readonly svc = inject(SupplierService);

  readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: this.route.snapshot.paramMap.get('id') ?? '' });
  readonly supplier = computed(() => this.data.suppliers().find((s) => s.id === this.id()));
  readonly stats = computed(() => this.svc.statsOf(this.id()));

  readonly money = formatVnd;
  readonly signed = formatVndSigned;
  readonly tone = amountTone;
  readonly day = formatDay;
  readonly creditLabel = creditLabel;
  readonly statusClass = supplierStatusClass;
  readonly statusLabel = supplierStatusLabel;
  readonly typeLabel = PRODUCT_TYPE_LABEL;
  readonly typeClass = PRODUCT_TYPE_CLASS;
  readonly poStatusLabel = PURCHASE_ORDER_STATUS_LABEL;
  readonly poStatusClass = purchaseOrderStatusClass;
  readonly receivedPercent = receivedPercent;

  readonly notice = signal('');

  constructor() {
    // Reset per-record UI when navigating between suppliers (the component is reused).
    effect(() => {
      this.id();
      untracked(() => {
        this.notice.set((history.state as { notice?: string } | null)?.notice ?? '');
        this.resetCatalogForm();
      });
    });
  }

  private readonly productById = computed(() => new Map(this.data.products().map((p) => [p.id, p])));

  // ---------- tabs (?tab=… keeps the tab in the URL) ----------
  private readonly tabParam = toSignal(this.route.queryParamMap.pipe(map((q) => q.get('tab'))), { initialValue: null });

  readonly tabs = computed(() => [
    { id: 'chung' as SupplierTab, label: 'Thông tin chung' },
    { id: 'hang' as SupplierTab, label: 'Danh mục hàng', count: this.catalog().length },
    { id: 'don-nhap' as SupplierTab, label: 'Đơn nhập', count: this.orders().length },
    { id: 'cong-no' as SupplierTab, label: 'Công nợ' },
  ]);

  readonly tab = computed<SupplierTab>(() => {
    const t = this.tabParam() as SupplierTab | null;
    return t && this.tabs().some((x) => x.id === t) ? t : 'chung';
  });

  selectTab(id: SupplierTab): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab: id === 'chung' ? null : id }, replaceUrl: true });
  }

  onTabKey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const ids = this.tabs().map((t) => t.id);
    const i = ids.indexOf(this.tab());
    const next = ids[(i + (event.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length];
    this.selectTab(next);
    setTimeout(() => document.getElementById(`tab-${next}`)?.focus());
  }

  // ---------- trạng thái hợp tác ----------
  readonly openOrders = computed(() => this.orders().filter((o) => canReceive(o.status)));

  toggleActive(): void {
    const s = this.supplier();
    if (!s) return;
    this.svc.setActive(s.id, !s.isActive);
    if (s.isActive) {
      const open = this.openOrders().length;
      this.notice.set(
        `Đã chuyển ${s.code} sang Ngừng hợp tác — không chọn được khi lập đơn nhập mới.` +
          (open ? ` Còn ${open} đơn đang chờ hàng, các đơn này vẫn nhận hàng bình thường.` : ''),
      );
    } else {
      this.notice.set(`${s.code} đã được hợp tác lại.`);
    }
  }

  // ---------- đơn nhập ----------
  readonly orders = computed<PurchaseOrder[]>(() =>
    this.data.purchaseOrders()
      .filter((o) => o.supplierId === this.id())
      .sort((a, b) => b.date.localeCompare(a.date) || b.code.localeCompare(a.code)),
  );

  readonly orderTotals = computed(() => {
    const rows = this.orders().filter((o) => o.status !== 'HUY');
    return { value: rows.reduce((s, o) => s + o.totalValue, 0), received: rows.reduce((s, o) => s + o.receivedValue, 0) };
  });

  // ---------- công nợ ----------
  readonly debtRow = computed(() => this.debt.payables().find((r) => r.partnerId === this.id()));
  readonly payments = computed(() =>
    this.data.cashVouchers()
      .filter((v) => !v.isCancelled && v.partnerType === 'NHA_CUNG_CAP' && v.partnerId === this.id())
      .sort((a, b) => b.date.localeCompare(a.date)),
  );
  readonly paidTotal = computed(() => this.payments().reduce((s, v) => s + (v.kind === 'CHI' ? v.amount : -v.amount), 0));

  accountName(id: string): string {
    return this.data.cashAccounts().find((a) => a.id === id)?.name ?? '—';
  }

  // ---------- danh mục hàng ----------
  readonly catalog = computed<CatalogRow[]>(() => {
    const id = this.id();
    const orders = this.orders();
    return this.data.supplierProducts()
      .filter((c) => c.supplierId === id)
      .map((c) => {
        const line = orders.flatMap((o) => (o.status === 'HUY' ? [] : o.lines)).find((l) => l.productId === c.productId);
        return {
          productId: c.productId,
          product: this.productById().get(c.productId),
          supplierCode: c.supplierCode,
          purchasePrice: c.purchasePrice,
          lastOrderPrice: line ? Math.round(line.unitPrice / (line.ratioToBase ?? 1)) : undefined,
        };
      })
      .sort((a, b) => (a.product?.name ?? '').localeCompare(b.product?.name ?? '', 'vi'));
  });

  // Bought items only (Thành phẩm is made in-house).
  readonly pickableProducts = computed(() =>
    this.data.products()
      .filter((p) => p.type !== 'THANH_PHAM' && p.isActive)
      .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
  );

  readonly stock = computed(() => {
    const m = new Map<string, number>();
    for (const s of this.data.stockLevels()) m.set(s.productId, (m.get(s.productId) ?? 0) + s.quantity);
    return m;
  });

  readonly newProductId = signal('');
  readonly newSupplierCode = signal('');
  readonly newPrice = signal<number | null>(null);
  readonly catalogAttempted = signal(false);

  readonly existingItem = computed(() => this.catalog().find((c) => c.productId === this.newProductId()));
  readonly newProduct = computed(() => this.productById().get(this.newProductId()));

  onPickProduct(productId: string): void {
    this.newProductId.set(productId);
    const existing = this.catalog().find((c) => c.productId === productId);
    // Pre-fill: the current catalog entry, else the last price paid to anyone for this item.
    this.newSupplierCode.set(existing?.supplierCode ?? '');
    this.newPrice.set(existing?.purchasePrice ?? this.lastPaidPrice(productId) ?? null);
  }

  editItem(row: CatalogRow): void {
    this.onPickProduct(row.productId);
    setTimeout(() => document.getElementById('cat-price')?.focus());
  }

  addItem(): void {
    this.catalogAttempted.set(true);
    const productId = this.newProductId();
    const price = this.newPrice();
    if (!productId || price === null || price < 0) return;
    const code = this.newProduct()?.code ?? productId;
    const result = this.svc.upsertCatalogItem({
      supplierId: this.id(),
      productId,
      supplierCode: this.newSupplierCode().trim() || undefined,
      purchasePrice: price,
    });
    this.notice.set(result === 'added' ? `Đã thêm ${code} vào danh mục hàng.` : `Đã cập nhật giá mua của ${code}.`);
    this.resetCatalogForm();
  }

  removeItem(row: CatalogRow): void {
    this.svc.removeCatalogItem(this.id(), row.productId);
    this.notice.set(`Đã bỏ ${row.product?.code ?? row.productId} khỏi danh mục hàng của nhà cung cấp.`);
    if (this.newProductId() === row.productId) this.resetCatalogForm();
  }

  resetCatalogForm(): void {
    this.newProductId.set('');
    this.newSupplierCode.set('');
    this.newPrice.set(null);
    this.catalogAttempted.set(false);
  }

  private lastPaidPrice(productId: string): number | undefined {
    const orders = [...this.data.purchaseOrders()].filter((o) => o.status !== 'HUY').sort((a, b) => b.date.localeCompare(a.date));
    for (const o of orders) {
      const l = o.lines.find((x) => x.productId === productId);
      if (l) return Math.round(l.unitPrice / (l.ratioToBase ?? 1));
    }
    return undefined;
  }
}
