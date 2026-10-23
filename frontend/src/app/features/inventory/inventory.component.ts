import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DataStore } from '../../core/services/data-store.service';
import { CostService } from '../../core/services/cost.service';
import { Product, ProductType } from '../../core/models/domain.models';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { FilterMultiSelectComponent, FilterOption } from '../../shared/filter-multi-select/filter-multi-select.component';
import { DivideItem, ListRailComponent, ListTabsComponent, syncSliceToUrl } from '../../shared/list-divide/list-divide';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { ColumnFilters, applyColumnFilters } from '../../shared/column-filter';
import { ColumnSort, sortByColumn } from '../../shared/column-sort';
import { foldVi, formatVnd } from '../../shared/format.util';
import { PRODUCT_TYPE_CLASS, PRODUCT_TYPE_LABEL } from '../../shared/status-labels';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { lineRemaining } from '../sales-orders/sales-order.rules';
import { lineRemaining as poLineRemaining } from '../purchase-orders/purchase-order.rules';
import { AllowedLinkDirective } from '../../shared/allowed-link.directive';

type Sort = 'name' | 'code' | 'qty-desc' | 'qty-asc' | 'value';
type TypeTab = 'all' | ProductType;
const STOCK_TYPES: ProductType[] = ['VAT_TU', 'THANH_PHAM'];
const TYPE_PARAM: Record<string, ProductType> = { 'vat-tu': 'VAT_TU', 'thanh-pham': 'THANH_PHAM' };
type StockState = 'AM' | 'DUOI_MIN' | 'HET' | 'ZERO' | 'DU';

// HET = tồn 0 mà có định mức tối thiểu (cần nhập thêm); ZERO = tồn 0, không đặt định mức.
const STATE_LABEL: Record<StockState, string> = { AM: 'Tồn âm', DUOI_MIN: 'Dưới tối thiểu', HET: 'Hết hàng', ZERO: 'Tồn 0', DU: 'Đủ hàng' };

interface StockRow {
  product: Product;
  byWarehouse: Record<string, number>; // ĐVT chính
  qty: number; // tồn trong phạm vi đang xem (tất cả kho hoặc kho đã chọn)
  min: number;
  reserved: number; // khách đã đặt, chưa xuất kho
  incoming: number; // đơn nhập đã gửi NCC, chưa nhận
  available: number; // có thể bán = tồn − đã đặt
  unitCost: number;
  value: number;
  state: StockState;
}

const r4 = (n: number) => Math.round(n * 10000) / 10000;

// /kho/tồn-kho — tồn hiện tại theo mặt hàng (quy về ĐVT chính), từng kho, kèm đã đặt / sắp về / có thể bán.
@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    CommonModule, RouterLink, AllowedLinkDirective, DataTableComponent, FilterMultiSelectComponent, PaginationComponent, NavIconComponent,
    ListTabsComponent, ListRailComponent,
  ],
  templateUrl: './inventory.component.html',
})
export class InventoryComponent {
  readonly data = inject(DataStore);
  private readonly cost = inject(CostService);

  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;
  readonly search = signal('');
  /** Divided by Tính chất (tabs) and Kho (rail): ?tc=vat-tu|thanh-pham · ?kho=<id>. */
  readonly typeTab = signal<TypeTab>(TYPE_PARAM[this.query.get('tc') ?? ''] ?? 'all');
  readonly warehouseId = signal(this.query.get('kho') ?? 'all');
  readonly categories = signal<string[]>([]);
  readonly negativeOnly = signal(false);
  readonly belowMinOnly = signal(false);
  readonly showZero = signal(false);
  readonly sort = signal<Sort>('code'); // default: Mã tăng dần
  readonly columnFilters = signal<ColumnFilters>({});
  // Clicking a column header overrides the "Sắp xếp" select; picking from the select clears it.
  readonly headerSort = signal<ColumnSort | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly exporting = signal(false);
  readonly money = formatVnd;

  constructor() {
    // Lối tắt từ Tổng quan: /kho/ton-kho?belowMin=true
    if (this.query.get('belowMin')) this.belowMinOnly.set(true);
    syncSliceToUrl(() => {
      const t = this.typeTab();
      const w = this.warehouseId();
      return { tc: t === 'all' ? null : (Object.keys(TYPE_PARAM).find((k) => TYPE_PARAM[k] === t) ?? null), kho: w === 'all' ? null : w };
    });
    effect(() => {
      this.rows();
      untracked(() => this.page.set(1));
    });
  }

  /** Warehouses that hold anything (or the selected one): one column each in "Tất cả kho". */
  readonly warehouses = computed(() => {
    const used = new Set(this.data.stockLevels().map((s) => s.warehouseId));
    return this.data.warehouses().filter((w) => used.has(w.id));
  });

  readonly categoryOptions = computed<FilterOption[]>(() => this.data.categories().map((c) => ({ value: c.id, label: c.name })));

  /** Open demand (base units) per product: sales orders not yet shipped. Đang giao đã rời kho nên không tính. */
  private readonly reserved = computed(() => {
    const m = new Map<string, number>();
    for (const o of this.data.salesOrders()) {
      if (['HUY', 'HOAN_THANH', 'TRA_TOAN_BO', 'DANG_GIAO'].includes(o.status) || o.closedDate) continue;
      for (const l of o.lines) m.set(l.productId, r4((m.get(l.productId) ?? 0) + lineRemaining(l) * (l.ratioToBase ?? 1)));
    }
    return m;
  });

  /** Ordered from suppliers, not yet received (base units). */
  private readonly incoming = computed(() => {
    const m = new Map<string, number>();
    for (const o of this.data.purchaseOrders()) {
      if (o.status !== 'DA_GUI_NCC' && o.status !== 'NHAN_MOT_PHAN') continue;
      for (const l of o.lines) m.set(l.productId, r4((m.get(l.productId) ?? 0) + poLineRemaining(l) * (l.ratioToBase ?? 1)));
    }
    return m;
  });

  /** One row per stocked product (dịch vụ không có tồn), as seen from one kho or from all of them. */
  private rowsFor(wh: string): StockRow[] {
    const levels = this.data.stockLevels();
    return this.data.products()
      .filter((p) => p.type !== 'DICH_VU')
      // Một kho: chỉ mặt hàng có theo dõi ở kho đó.
      .filter((p) => wh === 'all' || levels.some((s) => s.productId === p.id && s.warehouseId === wh))
      .map((p) => {
        const mine = levels.filter((s) => s.productId === p.id);
        const byWarehouse: Record<string, number> = {};
        for (const s of mine) byWarehouse[s.warehouseId] = r4((byWarehouse[s.warehouseId] ?? 0) + s.quantity);
        const qty = wh === 'all' ? r4(mine.reduce((s, x) => s + x.quantity, 0)) : (byWarehouse[wh] ?? 0);
        const min = wh === 'all' ? p.minStock : (mine.find((s) => s.warehouseId === wh)?.minStock || 0);
        const reserved = wh === 'all' ? (this.reserved().get(p.id) ?? 0) : 0;
        const unitCost = this.cost.costOf(p.id);
        const state: StockState = qty < 0 ? 'AM' : qty === 0 ? (min > 0 ? 'HET' : 'ZERO') : min > 0 && qty < min ? 'DUOI_MIN' : 'DU';
        return {
          product: p, byWarehouse, qty, min, reserved, incoming: wh === 'all' ? (this.incoming().get(p.id) ?? 0) : 0,
          available: r4(qty - reserved), unitCost, value: Math.round(Math.max(0, qty) * unitCost), state,
        };
      });
  }

  private readonly allRows = computed(() => this.rowsFor(this.warehouseId()));

  /** Search and Nhóm hàng — the filters every tab and rail count honours. */
  private matchesSearch(r: StockRow): boolean {
    const p = r.product;
    const q = foldVi(this.search().trim());
    if (q && !foldVi(`${p.code} ${p.crossRefCode ?? ''} ${p.name}`).includes(q)) return false;
    return !this.categories().length || this.categories().includes(p.categoryId ?? '');
  }

  /** The toggles under the search (tồn âm, dưới tối thiểu, ẩn tồn 0). */
  private matchesToggles(r: StockRow): boolean {
    if (this.negativeOnly() && r.qty >= 0) return false;
    if (this.belowMinOnly() && !(r.state === 'DUOI_MIN' || r.state === 'HET' || r.state === 'AM')) return false;
    // Ẩn mặt hàng tồn 0 trừ khi bật "Hiện cả tồn 0" — hàng hết mà có định mức tối thiểu vẫn hiện (cần nhập).
    return this.showZero() || r.state !== 'ZERO';
  }

  private ofTab(r: StockRow): boolean {
    const t = this.typeTab();
    return t === 'all' || r.product.type === t;
  }

  readonly typeTabs = computed<DivideItem<TypeTab>[]>(() => {
    const rows = this.allRows().filter((r) => this.matchesSearch(r) && this.matchesToggles(r));
    return [
      { value: 'all', label: 'Tất cả', count: rows.length },
      ...STOCK_TYPES.map((t) => ({ value: t, label: PRODUCT_TYPE_LABEL[t], count: rows.filter((r) => r.product.type === t).length })),
    ];
  });

  /** Rail: Tất cả kho, then each kho with the products the list would show there. */
  readonly warehouseRail = computed<DivideItem[]>(() => {
    const count = (wh: string) => this.rowsFor(wh).filter((r) => this.matchesSearch(r) && this.ofTab(r) && this.matchesToggles(r)).length;
    return [{ value: 'all', label: 'Tất cả kho', count: count('all') }, ...this.data.warehouses().map((w) => ({ value: w.id, label: w.name, count: count(w.id) }))];
  });


  private readonly baseRows = computed(() => this.allRows().filter((r) => this.matchesSearch(r) && this.ofTab(r)));

  readonly hiddenZero = computed(() => this.baseRows().filter((r) => r.state === 'ZERO').length);

  readonly rows = computed(() => {
    const rows = this.baseRows().filter((r) => this.matchesToggles(r));
    const s = this.sort();
    rows.sort((a, b) =>
      s === 'code' ? a.product.code.localeCompare(b.product.code, 'vi', { numeric: true })
        : s === 'qty-desc' ? b.qty - a.qty
          : s === 'qty-asc' ? a.qty - b.qty
            : s === 'value' ? b.value - a.value
              : a.product.name.localeCompare(b.product.name, 'vi'),
    );
    return sortByColumn(applyColumnFilters(rows, this.columns(), this.columnFilters()), this.columns(), this.headerSort());
  });

  readonly paged = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.rows().slice(start, start + this.pageSize());
  });

  readonly totals = computed(() => {
    const rows = this.baseRows();
    return {
      items: rows.filter((r) => r.qty !== 0).length,
      value: rows.reduce((s, r) => s + r.value, 0),
      negative: rows.filter((r) => r.state === 'AM').length,
      belowMin: rows.filter((r) => r.state === 'DUOI_MIN' || r.state === 'HET').length,
      shortage: rows.filter((r) => r.available < 0).length,
    };
  });

  private qtyText(n: number): string {
    return n ? n.toLocaleString('vi-VN') : '—';
  }

  /** Columns depend on the warehouse filter: "Tất cả kho" shows one column per kho + tổng + đã đặt / sắp về. */
  readonly columns = computed<DataTableColumn<StockRow>[]>(() => {
    const all = this.warehouseId() === 'all';
    const whCols: DataTableColumn<StockRow>[] = all
      ? this.warehouses().map((w) => ({
          key: `wh-${w.id}`, label: w.name, align: 'right' as const,
          format: (r: StockRow) => this.qtyText(r.byWarehouse[w.id] ?? 0), filterValue: (r: StockRow) => r.byWarehouse[w.id] ?? 0,
          tone: (r: StockRow) => ((r.byWarehouse[w.id] ?? 0) < 0 ? -1 : 0), toneFlow: false,
        }))
      : [];
    return [
      { key: 'code', label: 'Mã hàng', copy: true, link: (r) => ['/hang-hoa', r.product.id], format: (r) => r.product.code },
      { key: 'name', label: 'Tên hàng', format: (r) => r.product.name },
      { key: 'type', sortByText: true, label: 'Tính chất', format: (r) => PRODUCT_TYPE_LABEL[r.product.type], badge: (r) => PRODUCT_TYPE_CLASS[r.product.type] },
      { key: 'unit', label: 'ĐVT', format: (r) => r.product.baseUnit },
      ...whCols,
      {
        key: 'qty', label: all ? 'Tổng tồn' : 'Tồn tại kho', align: 'right', format: (r) => r.qty.toLocaleString('vi-VN'),
        filterValue: (r) => r.qty, tone: (r) => r.qty, toneFlow: false,
      },
      ...(all ? [
        { key: 'reserved', label: 'Khách đã đặt', align: 'right' as const, format: (r: StockRow) => this.qtyText(r.reserved), filterValue: (r: StockRow) => r.reserved },
        {
          key: 'available', label: 'Có thể bán', align: 'right' as const, format: (r: StockRow) => r.available.toLocaleString('vi-VN'),
          filterValue: (r: StockRow) => r.available, tone: (r: StockRow) => r.available, toneFlow: false,
        },
        { key: 'incoming', label: 'Sắp về', align: 'right' as const, format: (r: StockRow) => this.qtyText(r.incoming), filterValue: (r: StockRow) => r.incoming },
      ] : []),
      { key: 'min', label: 'Tối thiểu', align: 'right', format: (r) => this.qtyText(r.min), filterValue: (r) => r.min },
      { key: 'value', label: 'Giá trị tồn', align: 'right', format: (r) => (r.value ? formatVnd(r.value) : '—'), filterValue: (r) => r.value },
      {
        key: 'state', sortByText: true, label: 'Tình trạng', format: (r) => STATE_LABEL[r.state],
        badge: (r) => (r.state === 'AM' ? 'stock-am' : r.state === 'HET' ? 'stock-het' : r.state === 'DUOI_MIN' ? 'stock-low' : r.state === 'ZERO' ? 'stock-zero' : 'stock-ok'),
      },
    ];
  });

  clearAll(): void {
    this.search.set('');
    this.categories.set([]);
    this.negativeOnly.set(false);
    this.belowMinOnly.set(false);
    this.showZero.set(false);
    this.columnFilters.set({});
  }

  readonly hasFilters = computed(
    () => !!this.search() || this.categories().length > 0 ||
      this.negativeOnly() || this.belowMinOnly(),
  );

  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    const whs = this.warehouses();
    try {
      await downloadWorkbook(exportFileName('Tồn kho'), [{
        name: 'Tồn kho',
        columns: [
          { header: 'Mã hàng', width: 13 }, { header: 'Tên hàng', width: 34 }, { header: 'Tính chất', width: 12 }, { header: 'ĐVT', width: 8 },
          ...whs.map((w) => ({ header: w.name, width: 14, numFmt: '#,##0.##' })),
          { header: 'Tổng tồn', width: 12, numFmt: '#,##0.##' }, { header: 'Khách đã đặt', width: 12, numFmt: '#,##0.##' },
          { header: 'Có thể bán', width: 12, numFmt: '#,##0.##' }, { header: 'Sắp về', width: 12, numFmt: '#,##0.##' },
          { header: 'Tối thiểu', width: 10, numFmt: '#,##0.##' }, { header: 'Giá vốn ước tính', width: 14, numFmt: '#,##0' },
          { header: 'Giá trị tồn', width: 15, numFmt: '#,##0' }, { header: 'Tình trạng', width: 14 },
        ],
        rows: this.rows().map((r) => {
          const total = r4(Object.values(r.byWarehouse).reduce((s, v) => s + v, 0));
          const reserved = this.reserved().get(r.product.id) ?? 0;
          return [
            r.product.code, r.product.name, PRODUCT_TYPE_LABEL[r.product.type], r.product.baseUnit,
            ...whs.map((w) => r.byWarehouse[w.id] ?? 0), total, reserved, r4(total - reserved), this.incoming().get(r.product.id) ?? 0,
            r.product.minStock, Math.round(r.unitCost), Math.round(Math.max(0, total) * r.unitCost), STATE_LABEL[r.state],
          ];
        }),
      }]);
    } finally {
      this.exporting.set(false);
    }
  }
}
