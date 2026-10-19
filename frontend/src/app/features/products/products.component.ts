import { Component, computed, effect, signal, untracked, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../core/services/mock-data.service';
import { DataTableComponent, DataTableColumn } from '../../shared/data-table/data-table.component';
import { FilterMultiSelectComponent, FilterOption } from '../../shared/filter-multi-select/filter-multi-select.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { CopyButtonComponent } from '../../shared/copy-button/copy-button.component';
import { ColumnFilters, applyColumnFilters } from '../../shared/column-filter';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { Product, ProductType } from '../../core/models/domain.models';
import { PRODUCT_TYPE_CLASS, PRODUCT_TYPE_LABEL, businessStatusClass } from '../../shared/status-labels';
import { foldVi, formatVnd } from '../../shared/format.util';
import { downloadWorkbook, todayStamp } from '../../shared/excel.util';
import { productExportSheet } from './product-excel';
import { ProductImportDialogComponent } from './product-import-dialog/product-import-dialog.component';

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

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [
    CommonModule, RouterLink, DataTableComponent, FilterMultiSelectComponent, PaginationComponent,
    NavIconComponent, ProductImportDialogComponent, CopyButtonComponent,
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
  readonly types = signal<string[]>([]);
  readonly categoryIds = signal<string[]>([]);
  readonly status = signal<StatusFilter>(ALL);
  readonly warehouseId = signal<string>(ALL);
  readonly negativeOnly = signal(false);
  readonly belowMinOnly = signal(false);
  readonly sort = signal<SortKey>('name-asc');
  readonly columnFilters = signal<ColumnFilters>({});

  readonly typeOptions: FilterOption[] = (Object.keys(PRODUCT_TYPE_LABEL) as ProductType[]).map((t) => ({
    value: t,
    label: PRODUCT_TYPE_LABEL[t],
    dotClass: PRODUCT_TYPE_CLASS[t],
  }));

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

  // Every filter except the category one — feeds both the result and the category counts.
  private readonly matchedExceptCategory = computed(() => {
    const q = foldVi(this.search().trim());
    const types = this.types();
    const status = this.status();
    const wh = this.warehouseId();
    const stock = this.stockByProduct();
    const negativeOnly = this.negativeOnly();
    const belowMinOnly = this.belowMinOnly();
    return this.data.products().filter((p) => {
      if (q && ![p.code, p.name, p.crossRefCode ?? ''].some((v) => foldVi(v).includes(q))) return false;
      if (types.length && !types.includes(p.type)) return false;
      if (status === 'active' && !p.isActive) return false;
      if (status === 'inactive' && p.isActive) return false;
      if (wh !== ALL && !stock.has(p.id)) return false;
      if (negativeOnly && this.stockOf(p).qty >= 0) return false;
      if (belowMinOnly && !this.isBelowMin(p)) return false;
      return true;
    });
  });

  readonly categoryOptions = computed<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const p of this.matchedExceptCategory()) {
      if (p.categoryId) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
    }
    return this.data.categories().map((c) => ({ value: c.id, label: c.name, count: counts.get(c.id) ?? 0 }));
  });

  readonly products = computed(() => {
    const cats = this.categoryIds();
    const rows = this.matchedExceptCategory().filter((p) => !cats.length || (p.categoryId && cats.includes(p.categoryId)));
    return this.sorted(applyColumnFilters(rows, this.columns, this.columnFilters()));
  });

  readonly chips = computed<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];
    for (const t of this.types()) {
      chips.push({ label: PRODUCT_TYPE_LABEL[t as ProductType], clear: () => this.types.update((v) => v.filter((x) => x !== t)) });
    }
    const catName = new Map(this.data.categories().map((c) => [c.id, c.name]));
    for (const id of this.categoryIds()) {
      chips.push({ label: catName.get(id) ?? id, clear: () => this.categoryIds.update((v) => v.filter((x) => x !== id)) });
    }
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
    { key: 'type', label: 'Tính chất', format: (r) => PRODUCT_TYPE_LABEL[r.type], badge: (r) => PRODUCT_TYPE_CLASS[r.type] },
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

  constructor(readonly data: MockDataService) {
    // Any change to the result set (filters, sort, imports) starts again from page 1.
    effect(() => {
      this.products();
      untracked(() => this.page.set(1));
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
      await downloadWorkbook(`hang-hoa-${todayStamp()}.xlsx`, [sheet]);
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
    this.types.set([]);
    this.categoryIds.set([]);
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
