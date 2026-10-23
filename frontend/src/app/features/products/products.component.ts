import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DataStore } from '../../core/services/data-store.service';
import { DataTableComponent, DataTableColumn } from '../../shared/data-table/data-table.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { CopyButtonComponent } from '../../shared/copy-button/copy-button.component';
import { ColumnFilters, applyColumnFilters } from '../../shared/column-filter';
import { ColumnSort, sortByColumn } from '../../shared/column-sort';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { Product, ProductType } from '../../core/models/domain.models';
import { PRODUCT_TYPE_CLASS, PRODUCT_TYPE_LABEL, businessStatusClass } from '../../shared/status-labels';
import { foldVi, formatVnd } from '../../shared/format.util';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { productExportSheet } from './product-excel';
import { ProductImportDialogComponent } from './product-import-dialog/product-import-dialog.component';
import { DivideItem, ListRailComponent, ListTabsComponent, syncSliceToUrl } from '../../shared/list-divide/list-divide';
import { AllowedLinkDirective } from '../../shared/allowed-link.directive';

type ViewMode = 'grid' | 'table';
const VIEW_KEY = 'nt.products.view';

function readView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'table';
  } catch {
    return 'table';
  }
}

type StatusFilter = 'all' | 'active' | 'inactive';
type SortKey = 'name-asc' | 'name-desc' | 'code-asc' | 'code-desc' | 'retail-desc' | 'retail-asc' | 'updated' | 'created';

interface StockInfo {
  qty: number;
  min: number;
}

interface ActiveChip {
  label: string;
  clear: () => void;
}

const ALL = 'all';
/** Nhóm hàng rail: the products with no category. */
const NONE = 'none';

type TypeTab = typeof ALL | ProductType;
const TYPES: ProductType[] = ['VAT_TU', 'THANH_PHAM', 'DICH_VU'];
/** ?tc= in the address (readable, shareable): the tab of each Tính chất. */
const TYPE_PARAM: Record<ProductType, string> = { VAT_TU: 'vat-tu', THANH_PHAM: 'thanh-pham', DICH_VU: 'dich-vu' };


@Component({
  selector: 'app-products',
  standalone: true,
  imports: [
    CommonModule, RouterLink, AllowedLinkDirective, DataTableComponent, PaginationComponent,
    NavIconComponent, ProductImportDialogComponent, CopyButtonComponent, ListTabsComponent, ListRailComponent,
  ],
  templateUrl: './products.component.html',
})
export class ProductsComponent {
  readonly view = signal<ViewMode>(readView());
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly notice = signal('');
  readonly exporting = signal(false);

  private readonly productImport = viewChild.required<ProductImportDialogComponent>('productImport');
  private readonly bomImport = viewChild.required<ProductImportDialogComponent>('bomImport');
  readonly search = signal('');
  private readonly route = inject(ActivatedRoute);
  /** The two ways the catalogue is divided: Tính chất as tabs over the list, Nhóm hàng as the rail beside it. */
  readonly typeTab = signal<TypeTab>(typeFromParam(this.route.snapshot.queryParamMap.get('tc')));
  readonly category = signal<string>(this.route.snapshot.queryParamMap.get('nhom') ?? ALL);
  readonly status = signal<StatusFilter>(ALL);
  readonly warehouseId = signal<string>(ALL);
  readonly negativeOnly = signal(false);
  readonly belowMinOnly = signal(false);
  // Every list with a Mã column opens sorted by it, ascending (design.md › List pages).
  readonly sort = signal<SortKey>('code-asc');
  readonly columnFilters = signal<ColumnFilters>({});
  // Clicking a column header overrides the "Sắp xếp" select; picking from the select clears it.
  readonly headerSort = signal<ColumnSort | null>(null);

  readonly sortOptions: { value: SortKey; label: string }[] = [
    { value: 'name-asc', label: 'Tên A → Z' },
    { value: 'name-desc', label: 'Tên Z → A' },
    { value: 'code-asc', label: 'Mã tăng dần' },
    { value: 'code-desc', label: 'Mã giảm dần' },
    { value: 'retail-desc', label: 'Giá lẻ cao → thấp' },
    { value: 'retail-asc', label: 'Giá lẻ thấp → cao' },
    { value: 'updated', label: 'Sửa gần nhất' },
    { value: 'created', label: 'Mới tạo nhất' },
  ];

  // Stock per product, scoped to the selected warehouse ("Tồn tất cả kho" = sum).
  private readonly stockByProduct = computed(() => {
    const wh = this.warehouseId();
    const map = new Map<string, StockInfo>();
    for (const s of this.data.stockLevels()) {
      if (wh !== ALL && s.warehouseId !== wh) continue;
      const cur = map.get(s.productId) ?? { qty: 0, min: 0 };
      map.set(s.productId, { qty: cur.qty + s.quantity, min: cur.min + s.minStock });
    }
    return map;
  });

  private stockOf(p: Product): StockInfo {
    const s = this.stockByProduct().get(p.id) ?? { qty: 0, min: 0 };
    // All warehouses: product-level minimum, same rule as the dashboard.
    return this.warehouseId() === ALL ? { qty: s.qty, min: p.minStock } : s;
  }

  private isBelowMin(p: Product): boolean {
    const s = this.stockOf(p);
    return p.type !== 'DICH_VU' && p.isActive && s.min > 0 && s.qty < s.min;
  }

  // Every filter except Tính chất and Nhóm hàng — the tab and rail counts are taken from it.
  private readonly matchedBase = computed(() => {
    const q = foldVi(this.search().trim());
    const status = this.status();
    const wh = this.warehouseId();
    const stock = this.stockByProduct();
    const negativeOnly = this.negativeOnly();
    const belowMinOnly = this.belowMinOnly();
    return this.data.products().filter((p) => {
      if (q && ![p.code, p.name, p.crossRefCode ?? ''].some((v) => foldVi(v).includes(q))) return false;
      if (status === 'active' && !p.isActive) return false;
      if (status === 'inactive' && p.isActive) return false;
      if (wh !== ALL && !stock.has(p.id)) return false;
      if (negativeOnly && this.stockOf(p).qty >= 0) return false;
      if (belowMinOnly && !this.isBelowMin(p)) return false;
      return true;
    });
  });

  private inCategory(p: Product): boolean {
    const c = this.category();
    return c === ALL || (c === NONE ? !p.categoryId : p.categoryId === c);
  }

  /** Tabs: how many products of each Tính chất match the other filters and the chosen Nhóm hàng. */
  readonly typeTabs = computed<DivideItem<TypeTab>[]>(() => {
    const rows = this.matchedBase().filter((p) => this.inCategory(p));
    return [
      { value: ALL, label: 'Tất cả', count: rows.length },
      ...TYPES.map((t) => ({ value: t, label: PRODUCT_TYPE_LABEL[t], count: rows.filter((p) => p.type === t).length })),
    ];
  });

  private readonly matchedType = computed(() => {
    const t = this.typeTab();
    return t === ALL ? this.matchedBase() : this.matchedBase().filter((p) => p.type === t);
  });

  /** Rail: every Nhóm hàng (A → Z, empty ones kept so the list never jumps) with its count under the open tab. */
  readonly categoryRail = computed(() => {
    const rows = this.matchedType();
    const counts = new Map<string, number>();
    for (const p of rows) if (p.categoryId) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
    const none = rows.filter((p) => !p.categoryId).length;
    const items: DivideItem[] = [
      { value: ALL, label: 'Tất cả nhóm', count: rows.length },
      ...this.data.categories()
        .map((c) => ({ value: c.id, label: c.name, count: counts.get(c.id) ?? 0 }))
        .sort((a, b) => a.label.localeCompare(b.label, 'vi')),
    ];
    if (none || this.category() === NONE) items.push({ value: NONE, label: 'Chưa phân nhóm', count: none, muted: true });
    return items;
  });

  /** The open Nhóm hàng's name (for the empty state); null for Tất cả. */
  readonly categoryLabel = computed(() => {
    const c = this.category();
    return c === ALL ? null : c === NONE ? 'Chưa phân nhóm' : (this.categoryName().get(c) ?? null);
  });

  readonly products = computed(() => {
    const rows = this.matchedType().filter((p) => this.inCategory(p));
    return sortByColumn(this.sorted(applyColumnFilters(rows, this.columns, this.columnFilters())), this.columns, this.headerSort());
  });

  readonly chips = computed<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];
    if (this.status() !== ALL) {
      chips.push({
        label: this.status() === 'active' ? 'Đang kinh doanh' : 'Ngừng kinh doanh',
        clear: () => this.status.set(ALL),
      });
    }
    if (this.warehouseId() !== ALL) {
      const wh = this.data.warehouses().find((w) => w.id === this.warehouseId());
      chips.push({ label: `Tồn ${wh?.name ?? ''}`, clear: () => this.warehouseId.set(ALL) });
    }
    if (this.negativeOnly()) chips.push({ label: 'Tồn âm', clear: () => this.negativeOnly.set(false) });
    if (this.belowMinOnly()) chips.push({ label: 'Dưới tồn tối thiểu', clear: () => this.belowMinOnly.set(false) });
    for (const col of this.columns) {
      const v = (this.columnFilters()[col.key] ?? '').trim();
      if (!v) continue;
      chips.push({
        label: `${col.label}: ${v}`,
        clear: () => this.columnFilters.update((f) => ({ ...f, [col.key]: '' })),
      });
    }
    return chips;
  });

  readonly columns: DataTableColumn<Product>[] = [
    { key: 'image', label: 'Ảnh', filter: false, image: (r) => r.images?.[0]?.url },
    { key: 'code', label: 'Mã', copy: true, link: (r) => ['/hang-hoa', r.id] },
    { key: 'name', label: 'Tên hàng hoá' },
    { key: 'categoryId', sortByText: true, label: 'Nhóm hàng', format: (r) => this.categoryOf(r) || '—' },
    { key: 'type', sortByText: true, label: 'Tính chất', format: (r) => PRODUCT_TYPE_LABEL[r.type], badge: (r) => PRODUCT_TYPE_CLASS[r.type] },
    { key: 'baseUnit', label: 'ĐVT' },
    {
      key: 'stock',
      label: 'Tồn kho',
      align: 'right',
      format: (r) => (r.type === 'DICH_VU' ? '—' : this.stockOf(r).qty.toLocaleString('vi-VN')),
      filterValue: (r) => (r.type === 'DICH_VU' ? null : this.stockOf(r).qty),
    },
    { key: 'minStock', label: 'Tồn tối thiểu', align: 'right' },
    { key: 'retailPrice', label: 'Giá lẻ', align: 'right', format: (r) => formatVnd(r.retailPrice), filterValue: (r) => r.retailPrice },
    { key: 'wholesalePrice', label: 'Giá sỉ', align: 'right', format: (r) => formatVnd(r.wholesalePrice), filterValue: (r) => r.wholesalePrice },
    {
      key: 'isActive',
      label: 'Trạng thái',
      format: (r) => (r.isActive ? 'Đang kinh doanh' : 'Ngừng kinh doanh'),
      badge: (r) => businessStatusClass(r.isActive),
    },
  ];

  readonly pagedProducts = computed(() => {
    const size = this.pageSize();
    const start = (this.page() - 1) * size;
    return this.products().slice(start, start + size);
  });

  private readonly categoryName = computed(() => new Map(this.data.categories().map((c) => [c.id, c.name])));

  constructor(readonly data: DataStore) {
    // Any change to the result set (filters, sort, imports) starts again from page 1.
    effect(() => {
      this.products();
      untracked(() => this.page.set(1));
    });
    syncSliceToUrl(() => {
      const t = this.typeTab();
      const c = this.category();
      return { tc: t === ALL ? null : TYPE_PARAM[t], nhom: c === ALL ? null : c };
    });
  }

  setView(mode: ViewMode): void {
    this.view.set(mode);
    try {
      localStorage.setItem(VIEW_KEY, mode);
    } catch {
      /* private mode: the choice just won't persist */
    }
  }

  categoryOf(p: Product): string {
    return p.categoryId ? (this.categoryName().get(p.categoryId) ?? '') : '';
  }

  stockLabel(p: Product): string {
    return p.type === 'DICH_VU' ? '—' : this.stockOf(p).qty.toLocaleString('vi-VN');
  }

  belowMin(p: Product): boolean {
    return this.isBelowMin(p);
  }

  typeLabel(p: Product): string {
    return PRODUCT_TYPE_LABEL[p.type];
  }

  typeClass(p: Product): string {
    return PRODUCT_TYPE_CLASS[p.type];
  }

  statusClass(p: Product): string {
    return businessStatusClass(p.isActive);
  }

  money(n: number): string {
    return formatVnd(n);
  }

  // Exports every row matching the current filters and sort, not just the visible page.
  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      const sheet = productExportSheet(this.products(), {
        products: this.data.products(),
        categories: this.data.categories(),
        warehouses: this.data.warehouses(),
        stockLevels: this.data.stockLevels(),
      });
      await downloadWorkbook(exportFileName('Hàng hoá'), [sheet]);
    } finally {
      this.exporting.set(false);
    }
  }

  openProductImport(): void {
    this.productImport().open();
  }

  openBomImport(): void {
    this.bomImport().open();
  }

  onImported(summary: string): void {
    this.notice.set(summary);
  }

  clearAll(): void {
    this.status.set(ALL);
    this.warehouseId.set(ALL);
    this.negativeOnly.set(false);
    this.belowMinOnly.set(false);
    this.columnFilters.set({});
  }

  private sorted(rows: Product[]): Product[] {
    const order = new Map(this.data.products().map((p, i) => [p.id, i]));
    const byName = (a: Product, b: Product) => a.name.localeCompare(b.name, 'vi');
    const byCode = (a: Product, b: Product) => a.code.localeCompare(b.code, 'vi', { numeric: true });
    // Rows without timestamps (demo data) keep their store order, after timestamped ones.
    const byStamp = (key: 'createdAt' | 'updatedAt') => (a: Product, b: Product) =>
      (b[key] ?? '').localeCompare(a[key] ?? '') || order.get(a.id)! - order.get(b.id)!;
    const cmp: Record<SortKey, (a: Product, b: Product) => number> = {
      'name-asc': byName,
      'name-desc': (a, b) => byName(b, a),
      'code-asc': byCode,
      'code-desc': (a, b) => byCode(b, a),
      'retail-desc': (a, b) => b.retailPrice - a.retailPrice,
      'retail-asc': (a, b) => a.retailPrice - b.retailPrice,
      updated: byStamp('updatedAt'),
      created: byStamp('createdAt'),
    };
    return [...rows].sort(cmp[this.sort()]);
  }
}

function typeFromParam(v: string | null): TypeTab {
  return TYPES.find((t) => TYPE_PARAM[t] === v) ?? ALL;
}
