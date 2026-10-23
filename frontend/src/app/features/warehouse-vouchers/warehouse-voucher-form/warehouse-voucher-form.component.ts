import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { DataStore } from '../../../core/services/data-store.service';
import { Product, WarehouseVoucherType } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { CopyButtonComponent } from '../../../shared/copy-button/copy-button.component';
import { MoneyInputDirective } from '../../../shared/money-input.directive';
import { ProductPickerComponent } from '../../../shared/product-picker/product-picker.component';
import { formatQty, formatQtySigned, formatVnd } from '../../../shared/format.util';
import { AuthService } from '../../../core/services/auth.service';
import { formatDay, isoDay } from '../../../shared/period';
import { tagClass } from '../../../shared/tag-class';
import { round4 } from '../../purchase-orders/purchase-order.rules';
import { KIND_SLUG, KIND_TEXT, SLUG_KIND, VOUCHER_KIND_LABEL, kindOf, sourceOf } from '../warehouse-voucher.rules';
import { WarehouseVoucherService } from '../warehouse-voucher.service';
import { PrintDocumentComponent, PrintSigner } from '../../../shared/print/print-document.component';
import { AllowedLinkDirective } from '../../../shared/allowed-link.directive';
import { errorText } from '../../../core/api/api.service';
import { AuditHistoryComponent } from '../../../shared/audit/audit-history.component';
import { FrozenColsDirective } from '../../../shared/frozen-cols.directive';
import { PickableWarehousesPipe } from '../../../shared/pickable-warehouses.pipe';

interface Line {
  key: string;
  productId: string;
  unitName: string; // '' = ĐVT chính
  quantity: number | null;
  unitPrice: number | null; // theo unitName (phiếu nhập)
  note: string;
}

interface UnitOption {
  value: string;
  label: string;
  ratio: number;
}

const emptyLine = (): Line => ({ key: crypto.randomUUID(), productId: '', unitName: '', quantity: null, unitPrice: null, note: '' });

// Phiếu kho as one MISA-style chứng từ: /kho/phieu/lap/in|out|transfer|adjust (lập) and /kho/phieu/:id (xem).
@Component({
  selector: 'app-warehouse-voucher-form',
  standalone: true,
  imports: [PickableWarehousesPipe, FrozenColsDirective, NgClass, FormsModule, RouterLink, AllowedLinkDirective, NavIconComponent, CopyButtonComponent, MoneyInputDirective, ProductPickerComponent, PrintDocumentComponent, AuditHistoryComponent],
  templateUrl: './warehouse-voucher-form.component.html',
  styleUrls: ['../../../shared/voucher/voucher.scss', './warehouse-voucher-form.component.scss'],
})
export class WarehouseVoucherFormComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly data = inject(DataStore);
  private readonly svc = inject(WarehouseVoucherService);

  private readonly params = toSignal(this.route.paramMap.pipe(map((p) => ({ id: p.get('id'), kind: p.get('kind') }))), {
    initialValue: { id: this.route.snapshot.paramMap.get('id'), kind: this.route.snapshot.paramMap.get('kind') },
  });

  readonly voucher = computed(() => {
    const id = this.params().id;
    return id ? this.data.warehouseVouchers().find((v) => v.id === id) : undefined;
  });
  readonly viewing = computed(() => !!this.params().id);
  readonly notFound = computed(() => this.viewing() && !this.voucher());
  readonly type = computed<WarehouseVoucherType>(() => this.voucher()?.type ?? SLUG_KIND[this.params().kind ?? ''] ?? 'NHAP');
  readonly text = computed(() => KIND_TEXT[this.type()]);
  readonly kindLabel = computed(() => (this.voucher() ? VOUCHER_KIND_LABEL[kindOf(this.voucher()!)] : VOUCHER_KIND_LABEL[this.type()]));
  readonly kindClass = computed(() => tagClass('warehouse-voucher', this.voucher() ? kindOf(this.voucher()!) : this.type()));
  readonly source = computed(() => (this.voucher() ? sourceOf(this.voucher()!, this.data) : null));

  readonly money = formatVnd;
  readonly qty = formatQty;
  readonly signed = formatQtySigned;
  readonly auth = inject(AuthService);
  readonly day = formatDay;

  // ---------- draft ----------
  readonly date = signal(isoDay(new Date()));
  readonly warehouseId = signal('');
  readonly targetId = signal('');
  readonly reason = signal('');
  readonly note = signal('');
  readonly lines = signal<Line[]>([emptyLine()]);
  readonly attempted = signal(false);
  readonly error = signal('');
  readonly saving = signal(false);
  /** Đơn giá trên phiếu nhập needs its own permission (Thủ kho does not see purchase prices). */
  readonly showPrice = computed(() => this.type() === 'NHAP' && this.auth.can('stock.import_price'));
  readonly notice = signal('');
  readonly confirmCancel = signal(false);
  readonly cancelReason = signal('');

  constructor() {
    effect(() => {
      this.params();
      untracked(() => {
        this.date.set(isoDay(new Date()));
        // ?kho= (from a kho's page) opens the new phiếu on that kho, if it is still in use.
        const kho = this.route.snapshot.queryParamMap.get('kho');
        this.warehouseId.set(kho && this.data.warehouses().some((w) => w.id === kho && w.isActive !== false) ? kho : '');
        this.targetId.set('');
        this.reason.set('');
        this.note.set('');
        this.lines.set([emptyLine()]);
        this.attempted.set(false);
        this.error.set('');
        this.confirmCancel.set(false);
        this.notice.set((history.state as { notice?: string } | null)?.notice ?? '');
      });
    });
  }

  // ---------- lookups ----------
  private readonly productById = computed(() => new Map(this.data.products().map((p) => [p.id, p])));
  readonly productOptions = computed(() =>
    this.data.products().filter((p) => p.type !== 'DICH_VU' && p.isActive).sort((a, b) => a.name.localeCompare(b.name, 'vi')),
  );
  /** Tồn tại kho đang chọn — the picker shows it next to each product. */
  readonly stockHere = computed(() => {
    const wh = this.warehouseId();
    const m = new Map<string, number>();
    for (const s of this.data.stockLevels()) if (!wh || s.warehouseId === wh) m.set(s.productId, (m.get(s.productId) ?? 0) + s.quantity);
    return m;
  });

  product(id: string): Product | undefined {
    return this.productById().get(id);
  }

  warehouseName(id: string | undefined): string {
    return (id && this.data.warehouses().find((w) => w.id === id)?.name) || '—';
  }

  userName(email: string): string {
    return this.data.users().find((u) => u.email === email)?.name ?? (this.auth.user()?.email === email ? this.auth.user()!.name : email);
  }

  units(productId: string): UnitOption[] {
    const p = this.product(productId);
    if (!p) return [];
    return [{ value: '', label: p.baseUnit, ratio: 1 }, ...p.unitConversions.map((u) => ({ value: u.unitName, label: u.unitName, ratio: u.ratioToBaseUnit }))];
  }

  ratio(l: Line): number {
    return this.units(l.productId).find((u) => u.value === l.unitName)?.ratio ?? 1;
  }

  /** Tồn sổ sách tại kho đã chọn, theo ĐVT của dòng. */
  book(l: Line): number | null {
    if (!l.productId || !this.warehouseId()) return null;
    return round4(this.svc.stockAt(l.productId, this.warehouseId()) / this.ratio(l));
  }

  diff(l: Line): number | null {
    const b = this.book(l);
    return b === null || l.quantity === null ? null : round4(l.quantity - b);
  }

  /** Xuất / chuyển quá tồn: allowed (stock may be recorded late), flagged. */
  short(l: Line): boolean {
    const b = this.book(l);
    return (this.type() === 'XUAT' || this.type() === 'CHUYEN') && b !== null && (l.quantity ?? 0) > b;
  }

  // ---------- editing ----------
  patch(i: number, change: Partial<Line>): void {
    this.lines.update((ls) => ls.map((l, j) => (j === i ? { ...l, ...change } : l)));
  }

  setProduct(i: number, productId: string): void {
    const p = this.product(productId);
    // Kiểm kê: gợi ý số đếm = tồn sổ sách (sửa thành số thực tế).
    const book = this.type() === 'KIEM_KE' && this.warehouseId() ? this.svc.stockAt(productId, this.warehouseId()) : null;
    this.patch(i, { productId, unitName: '', quantity: book, unitPrice: this.type() === 'NHAP' ? this.lastPrice(productId) : null });
    if (!this.warehouseId() && p?.defaultWarehouseId && this.type() !== 'CHUYEN') this.warehouseId.set(p.defaultWarehouseId);
  }

  setUnit(i: number, unitName: string): void {
    const l = this.lines()[i];
    const before = this.ratio(l);
    const after = this.units(l.productId).find((u) => u.value === unitName)?.ratio ?? 1;
    this.patch(i, {
      unitName,
      quantity: l.quantity !== null ? round4((l.quantity * before) / after) : null,
      unitPrice: l.unitPrice !== null ? Math.round((l.unitPrice / before) * after) : null,
    });
  }

  addLine(): void {
    this.lines.update((ls) => [...ls, emptyLine()]);
  }

  removeLine(i: number): void {
    this.lines.update((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : [emptyLine()]));
  }

  private lastPrice(productId: string): number | null {
    const orders = [...this.data.purchaseOrders()].filter((o) => o.status !== 'HUY').sort((a, b) => b.date.localeCompare(a.date));
    for (const o of orders) {
      const l = o.lines.find((x) => x.productId === productId);
      if (l) return Math.round(l.unitPrice / (l.ratioToBase ?? 1));
    }
    return null;
  }

  readonly validLines = computed(() =>
    this.lines().filter((l) => l.productId && l.quantity !== null && (this.type() === 'KIEM_KE' ? l.quantity >= 0 : l.quantity > 0)),
  );
  readonly totalQty = computed(() => round4(this.validLines().reduce((s, l) => s + (l.quantity ?? 0) * this.ratio(l), 0)));
  readonly totalValue = computed(() => Math.round(this.validLines().reduce((s, l) => s + (l.quantity ?? 0) * (l.unitPrice ?? 0), 0)));
  readonly totalDiff = computed(() => round4(this.validLines().reduce((s, l) => s + (this.diff(l) ?? 0) * this.ratio(l), 0)));

  readonly issues = computed(() => {
    const out: string[] = [];
    if (!this.date()) out.push('Chọn ngày chứng từ');
    if (!this.warehouseId()) out.push(`Chọn ${this.text().warehouse.toLowerCase()}`);
    if (this.type() === 'CHUYEN') {
      if (!this.targetId()) out.push('Chọn kho nhận');
      else if (this.targetId() === this.warehouseId()) out.push('Kho nhận phải khác kho xuất');
    }
    this.lines().forEach((l, i) => {
      if (l.productId && (l.quantity === null || l.quantity < 0 || (this.type() !== 'KIEM_KE' && l.quantity === 0))) out.push(`Dòng ${i + 1}: nhập ${this.text().qty.toLowerCase()}`);
    });
    const ids = this.validLines().map((l) => l.productId);
    if (new Set(ids).size !== ids.length) out.push('Một mặt hàng xuất hiện hai dòng — gộp lại một dòng');
    if (!this.validLines().length) out.push('Thêm ít nhất một dòng hàng');
    return out;
  });

  async save(): Promise<void> {
    this.attempted.set(true);
    if (this.issues().length || this.saving()) return;
    this.saving.set(true);
    try {
      const v = await this.svc.create({
        type: this.type(),
        date: this.date(),
        warehouseId: this.warehouseId(),
        targetWarehouseId: this.targetId() || undefined,
        reason: this.reason(),
        note: this.note(),
        lines: this.validLines().map((l) => ({
          productId: l.productId, unitName: l.unitName || undefined, ratio: this.ratio(l), quantity: l.quantity ?? 0,
          unitPrice: l.unitPrice ?? undefined, note: l.note,
        })),
      });
      this.router.navigate(['/kho/phieu', v.id], { state: { notice: `Đã lưu ${v.code} — tồn kho đã cập nhật.` } });
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.saving.set(false);
    }
  }

  // ---------- view ----------
  readonly viewLines = computed(() => {
    const v = this.voucher();
    if (!v) return [];
    return (v.lines ?? []).map((l, i) => {
      const p = this.product(l.productId);
      const qty = l.unitQuantity ?? l.quantity;
      // unitPrice is stored per base unit; show it per the line's ĐVT so SL × đơn giá = thành tiền.
      const ratio = qty ? l.quantity / qty : 1;
      return {
        i, p, unit: l.unitName ?? p?.baseUnit ?? '', qty, base: l.quantity, baseUnit: p?.baseUnit ?? '',
        price: l.unitPrice ? Math.round(l.unitPrice * ratio) : undefined, value: l.unitPrice ? Math.round(l.unitPrice * l.quantity) : 0,
        book: l.bookQuantity, delta: l.delta, note: l.note,
      };
    });
  });
  readonly viewTotals = computed(() => {
    const ls = this.viewLines();
    return { qty: round4(ls.reduce((s, l) => s + l.base, 0)), value: ls.reduce((s, l) => s + l.value, 0), delta: round4(ls.reduce((s, l) => s + l.delta, 0)) };
  });
  readonly canCancel = computed(() => !!this.voucher() && this.svc.canCancel(this.voucher()!));
  readonly company = computed(() => this.data.companyInfo());
  readonly newSlug = computed(() => KIND_SLUG[this.type()]);

  async doCancel(): Promise<void> {
    try {
      await this.svc.cancel(this.voucher()!.id, this.cancelReason());
      this.notice.set(`Đã huỷ ${this.voucher()!.code} — tồn kho đã trả về như trước khi lập phiếu.`);
    } catch (e) {
      this.error.set(errorText(e));
    }
    this.confirmCancel.set(false);
  }

  /** Signature block by document type. The maker's name is printed under the signature space. */
  readonly printSigners = computed<PrintSigner[]>(() => {
    const v = this.voucher();
    if (!v) return [];
    const maker = { role: v.type === 'KIEM_KE' ? 'Người kiểm kê' : 'Người lập phiếu', name: this.userName(v.createdBy) };
    switch (v.type) {
      case 'NHAP': return [maker, { role: 'Người giao hàng' }, { role: 'Thủ kho' }, { role: 'Kế toán trưởng' }];
      case 'XUAT': return [maker, { role: 'Người nhận hàng' }, { role: 'Thủ kho' }, { role: 'Kế toán trưởng' }];
      case 'CHUYEN': return [maker, { role: 'Thủ kho xuất' }, { role: 'Thủ kho nhận' }, { role: 'Kế toán trưởng' }];
      default: return [maker, { role: 'Thủ kho' }, { role: 'Kế toán trưởng' }];
    }
  });

  print(): void {
    window.print();
  }
}
