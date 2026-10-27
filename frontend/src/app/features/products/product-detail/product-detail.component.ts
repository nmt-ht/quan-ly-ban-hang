import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgClass } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { DataStore } from '../../../core/services/data-store.service';
import { Product, UnitConversion, UnitOperation, WarehouseVoucher, WarehouseVoucherType } from '../../../core/models/domain.models';
import { WarehouseVoucherService } from '../../warehouse-vouchers/warehouse-voucher.service';
import { MEASURE_MODES, allowsUnitConversions } from '../product-type-rules';
import { UNIT_OPERATIONS, describe, normalize } from '../unit-conversion';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { CopyButtonComponent } from '../../../shared/copy-button/copy-button.component';
import { PRODUCT_TYPE_CLASS, PRODUCT_TYPE_LABEL, businessStatusClass } from '../../../shared/status-labels';
import { formatVnd } from '../../../shared/format.util';
import { AllowedLinkDirective } from '../../../shared/allowed-link.directive';
import { AuditHistoryComponent } from '../../../shared/audit/audit-history.component';
import { findProduct } from '../product.service';
import { FrozenColsDirective } from '../../../shared/frozen-cols.directive';

interface BomRow {
  product: Product | undefined;
  productId: string;
  quantityPerUnit: number;
}

export type DetailTab = 'chung' | 'quy-doi' | 'gia' | 'ton-kho' | 'dinh-muc' | 'anh' | 'lich-su' | 'nhat-ky';

interface Movement {
  date: string;
  code: string;
  type: WarehouseVoucherType;
  warehouseId: string;
  reason: string;
  change: number; // signed, for this warehouse
  balance: number; // running stock after this movement, in the selected scope
}

const VOUCHER_TYPE_LABEL: Record<WarehouseVoucherType, string> = {
  NHAP: 'Nhập kho',
  XUAT: 'Xuất kho',
  CHUYEN: 'Chuyển kho',
  KIEM_KE: 'Kiểm kê',
};

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [FrozenColsDirective, NgClass, RouterLink, AllowedLinkDirective, NavIconComponent, CopyButtonComponent, AuditHistoryComponent],
  templateUrl: './product-detail.component.html',
})
export class ProductDetailComponent {
  // The URL carries the mã (/hang-hoa/SP0000001); a link by id still opens and is rewritten to the mã.
  private readonly route = inject(ActivatedRoute);
  readonly ref = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: '' });
  readonly measureLabel = (p: Product) => MEASURE_MODES.find((m) => m.value === p.measureMode)?.label;

  readonly product = computed(() => findProduct(this.data.products(), this.ref()));
  readonly id = computed(() => this.product()?.id ?? '');
  private readonly byCode = effect(() => {
    const p = this.product();
    if (p && this.ref() !== p.code) {
      untracked(() => void this.router.navigate(['/hang-hoa', p.code], { replaceUrl: true, queryParamsHandling: 'preserve' }));
    }
  });
  readonly typeLabel = PRODUCT_TYPE_LABEL;
  readonly typeClass = PRODUCT_TYPE_CLASS;
  readonly statusClass = businessStatusClass;
  readonly formatVnd = formatVnd;

  private readonly productById = computed(() => new Map(this.data.products().map((p) => [p.id, p])));

  readonly categoryName = computed(() => {
    const id = this.product()?.categoryId;
    return id ? this.data.categories().find((c) => c.id === id)?.name : undefined;
  });

  readonly defaultWarehouseName = computed(() => {
    const id = this.product()?.defaultWarehouseId;
    return id ? this.data.warehouses().find((w) => w.id === id)?.name : undefined;
  });

  readonly stockRows = computed(() => {
    const id = this.id();
    const levels = this.data.stockLevels().filter((s) => s.productId === id);
    return this.data.warehouses()
      .map((w) => {
        const s = levels.find((l) => l.warehouseId === w.id);
        return { warehouse: w.name, qty: s?.quantity ?? 0, min: s?.minStock ?? 0, tracked: !!s };
      })
      .filter((r) => r.tracked);
  });

  readonly stockTotal = computed(() => this.stockRows().reduce((sum, r) => sum + r.qty, 0));

  // Định mức of this finished product.
  readonly bom = computed<BomRow[]>(() =>
    this.data.bomLines()
      .filter((l) => l.finishedProductId === this.id())
      .map((l) => ({ product: this.productById().get(l.componentId), productId: l.componentId, quantityPerUnit: l.quantityPerUnit })),
  );

  // Finished products whose định mức uses this item.
  readonly usedIn = computed<BomRow[]>(() =>
    this.data.bomLines()
      .filter((l) => l.componentId === this.id())
      .map((l) => ({ product: this.productById().get(l.finishedProductId), productId: l.finishedProductId, quantityPerUnit: l.quantityPerUnit })),
  );

  readonly units = computed(() => {
    const p = this.product();
    return p ? p.unitConversions.map((u) => normalize(u, p)) : [];
  });

  // ---------- tabs (?tab=… keeps the tab in the URL) ----------

  private readonly router = inject(Router);
  private readonly tabParam = toSignal(this.route.queryParamMap.pipe(map((q) => q.get('tab'))), { initialValue: null });

  readonly tabs = computed(() => {
    const p = this.product();
    if (!p) return [];
    const list: { id: DetailTab; label: string; count?: number }[] = [{ id: 'chung', label: 'Thông tin chung' }];
    if (allowsUnitConversions(p.type)) list.push({ id: 'quy-doi', label: 'Đơn vị quy đổi', count: p.unitConversions.length });
    list.push({ id: 'gia', label: 'Giá bán' });
    if (p.type !== 'DICH_VU') list.push({ id: 'ton-kho', label: 'Tồn kho' });
    if (p.type === 'THANH_PHAM') list.push({ id: 'dinh-muc', label: 'Định mức', count: this.bom().length });
    list.push({ id: 'anh', label: 'Ảnh', count: p.images?.length ?? 0 });
    if (p.type !== 'DICH_VU') list.push({ id: 'lich-su', label: 'Lịch sử' });
    list.push({ id: 'nhat-ky', label: 'Nhật ký' });
    return list;
  });

  readonly tab = computed<DetailTab>(() => {
    const t = this.tabParam() as DetailTab | null;
    return t && this.tabs().some((x) => x.id === t) ? t : 'chung';
  });

  selectTab(id: DetailTab): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab: id === 'chung' ? null : id }, replaceUrl: true });
  }

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  onTabKey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const ids = this.tabs().map((t) => t.id);
    const i = ids.indexOf(this.tab());
    const next = ids[(i + (event.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length];
    this.selectTab(next);
    setTimeout(() => document.getElementById(`tab-${next}`)?.focus());
  }

  // ---------- Lịch sử nhập xuất ----------

  readonly historyWarehouse = signal('all');
  readonly voucherTypeLabel = VOUCHER_TYPE_LABEL;

  /** Every phiếu (chưa huỷ) with this mặt hàng, older ones included — read from the server (Pha 1.1). */
  private readonly vouchers = signal<WarehouseVoucher[]>([]);
  private readonly warehouseVouchers = inject(WarehouseVoucherService);
  private readonly loadVouchers = effect(() => {
    const id = this.id();
    this.data.warehouseVouchers(); // read again after a save
    untracked(() => {
      if (!id) return;
      this.warehouseVouchers.page({ productId: id, pageSize: 5000, sort: 'date', dir: 'asc' }).then((p) => this.vouchers.set(p.rows), () => undefined);
    });
  });

  readonly movements = computed<Movement[]>(() => {
    const id = this.id();
    const wh = this.historyWarehouse();
    const rows: Omit<Movement, 'balance'>[] = [];
    for (const v of this.vouchers()) {
      if (v.isCancelled) continue;
      for (const l of v.lines ?? []) {
        if (l.productId !== id) continue;
        const base = { date: v.date, code: v.code, type: v.type, reason: v.reason ?? '' };
        if (v.type === 'NHAP') rows.push({ ...base, warehouseId: v.warehouseId, change: l.delta });
        else if (v.type === 'XUAT') rows.push({ ...base, warehouseId: v.warehouseId, change: -l.delta });
        else if (v.type === 'KIEM_KE') rows.push({ ...base, warehouseId: v.warehouseId, change: l.delta });
        else {
          rows.push({ ...base, warehouseId: v.warehouseId, change: -l.delta });
          if (v.targetWarehouseId) rows.push({ ...base, warehouseId: v.targetWarehouseId, change: l.delta });
        }
      }
    }
    const scoped = rows
      .filter((r) => wh === 'all' || r.warehouseId === wh)
      .sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code));
    let balance = 0;
    const withBalance = scoped.map((r) => ({ ...r, balance: (balance = Math.round((balance + r.change) * 10000) / 10000) }));
    return withBalance.reverse(); // newest first
  });

  warehouseName(id: string): string {
    return this.data.warehouses().find((w) => w.id === id)?.name ?? id;
  }

  constructor(readonly data: DataStore) {}

  opLabel(op: UnitOperation): string {
    return UNIT_OPERATIONS.find((o) => o.value === op)?.label ?? op;
  }

  unitHint(u: Required<UnitConversion>, baseUnit: string): string {
    return describe(u.operation, u.factor, u.unitName, baseUnit);
  }

  qty(n: number): string {
    return n.toLocaleString('vi-VN', { maximumFractionDigits: 4 });
  }
}
