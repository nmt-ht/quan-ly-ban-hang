import { Component, HostListener, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DataStore } from '../../core/services/data-store.service';
import { WarehouseVoucher, WarehouseVoucherType } from '../../core/models/domain.models';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { FilterMultiSelectComponent, FilterOption } from '../../shared/filter-multi-select/filter-multi-select.component';
import { DivideItem, ListRailComponent, ListTabsComponent, syncSliceToUrl } from '../../shared/list-divide/list-divide';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { PeriodFilterComponent, PeriodValue, NO_PERIOD } from '../../shared/period-filter/period-filter.component';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { ColumnSort } from '../../shared/column-sort';
import { formatQty, formatQtySigned, formatVnd } from '../../shared/format.util';
import { PERIOD_PRESETS, formatDay, rangeLabel } from '../../shared/period';
import { tagClass } from '../../shared/tag-class';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { KIND_SLUG, VOUCHER_KIND_LABEL, VoucherKindKey, kindOf, sourceOf } from './warehouse-voucher.rules';
import { AllowedLinkDirective } from '../../shared/allowed-link.directive';
import { errorText } from '../../core/api/api.service';
import { SalesOrderService } from '../sales-orders/sales-order.service';
import { PurchaseOrderService } from '../purchase-orders/purchase-order.service';
import { WarehouseVoucherPage, WarehouseVoucherPageQuery, WarehouseVoucherService } from './warehouse-voucher.service';

type KindTab = 'all' | VoucherKindKey;
const KINDS: VoucherKindKey[] = ['NHAP', 'TRA_VE', 'XUAT', 'CHUYEN', 'KIEM_KE'];
/** ?loai= in the address. */
const KIND_PARAM: Record<VoucherKindKey, string> = { NHAP: 'nhap', TRA_VE: 'tra-ve', XUAT: 'xuat', CHUYEN: 'chuyen', KIEM_KE: 'kiem-ke' };

/** Column header → server sort key. */
const COLUMN_SORT: Record<string, string> = {
  code: 'code', date: 'date', type: 'type', warehouseId: 'warehouse', source: 'source', reason: 'reason', lines: 'lines', qty: 'qty',
  value: 'value', createdBy: 'createdBy',
};

const EMPTY_PAGE: WarehouseVoucherPage = { rows: [], total: 0, page: 1, pageSize: 20, kindCounts: {}, warehouseCounts: {}, allCount: 0, totals: { value: 0 } };

interface ActiveChip {
  label: string;
  clear: () => void;
}

// Phiếu kho (Pha 1.1): every phiếu, page by page from the server — search, filters, sort and the counts cover all of
// them, not only those the app loaded at sign-in.
@Component({
  selector: 'app-warehouse-vouchers',
  standalone: true,
  imports: [
    CommonModule, RouterLink, AllowedLinkDirective, DataTableComponent, FilterMultiSelectComponent, PaginationComponent, PeriodFilterComponent,
    NavIconComponent, ListTabsComponent, ListRailComponent,
  ],
  templateUrl: './warehouse-vouchers.component.html',
})
export class WarehouseVouchersComponent {
  readonly data = inject(DataStore);
  private readonly svc = inject(WarehouseVoucherService);
  private readonly salesOrders = inject(SalesOrderService);
  private readonly purchaseOrders = inject(PurchaseOrderService);

  readonly menuOpen = signal(false);
  readonly createMenu: { type: WarehouseVoucherType; label: string; slug: string }[] = [
    { type: 'NHAP', label: 'Phiếu nhập kho', slug: KIND_SLUG.NHAP },
    { type: 'XUAT', label: 'Phiếu xuất kho', slug: KIND_SLUG.XUAT },
    { type: 'CHUYEN', label: 'Phiếu chuyển kho', slug: KIND_SLUG.CHUYEN },
    { type: 'KIEM_KE', label: 'Phiếu kiểm kê', slug: KIND_SLUG.KIEM_KE },
  ];

  readonly notice = signal((history.state as { notice?: string } | null)?.notice ?? '');
  readonly search = signal('');
  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;
  /** Divided by Loại phiếu (tabs) and Kho (rail): ?loai=nhap|tra-ve|xuat|chuyen|kiem-ke · ?kho=<id>. */
  readonly kindTab = signal<KindTab>(KINDS.find((k) => KIND_PARAM[k] === this.query.get('loai')) ?? 'all');
  readonly warehouseId = signal(this.query.get('kho') ?? 'all');
  readonly period = signal<PeriodValue>(NO_PERIOD);
  readonly createdBy = signal<string[]>([]);
  readonly showCancelled = signal(false);
  // Clicking a column header sorts; again reverses; a third click goes back to the default order.
  readonly headerSort = signal<ColumnSort | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly exporting = signal(false);

  readonly result = signal<WarehouseVoucherPage>(EMPTY_PAGE);
  readonly loading = signal(false);
  readonly error = signal('');
  /** The search box waits for typing to pause before asking the server. */
  private readonly searchQuery = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private requestSeq = 0;

  @HostListener('document:keydown.escape')
  closeMenu(): void {
    this.menuOpen.set(false);
  }

  private readonly whName = computed(() => new Map(this.data.warehouses().map((w) => [w.id, w.name])));
  private readonly productById = computed(() => new Map(this.data.products().map((p) => [p.id, p])));
  private readonly userName = computed(() => new Map(this.data.users().map((u) => [u.email, u.name])));

  readonly userOptions = computed<FilterOption[]>(() => {
    const roles = new Map(this.data.roles().map((r) => [r.id, r.name]));
    return this.data.users().map((u) => ({ value: u.email, label: `${u.name} — ${roles.get(u.roleId) ?? ''}` }));
  });

  readonly kindTabs = computed<DivideItem<KindTab>[]>(() => {
    const c = this.result().kindCounts;
    return [
      { value: 'all', label: 'Tất cả', count: KINDS.reduce((n, k) => n + (c[k] ?? 0), 0) },
      ...KINDS.map((k) => ({ value: k, label: VOUCHER_KIND_LABEL[k], count: c[k] ?? 0 })),
    ];
  });

  readonly warehouseRail = computed<DivideItem[]>(() => {
    const r = this.result();
    return [
      { value: 'all', label: 'Tất cả kho', count: r.allCount },
      ...this.data.warehouses().map((w) => ({ value: w.id, label: w.name, count: r.warehouseCounts[w.id] ?? 0 })),
    ];
  });

  readonly rows = computed(() => this.result().rows);
  readonly total = computed(() => this.result().total);

  /** Everything the server needs for the current view (all pages). */
  private readonly filters = computed<WarehouseVoucherPageQuery>(() => {
    const hs = this.headerSort();
    const range = this.period().range;
    const k = this.kindTab();
    const w = this.warehouseId();
    return {
      q: this.searchQuery().trim() || undefined,
      kind: k === 'all' ? undefined : k, warehouseId: w === 'all' ? undefined : w,
      createdBy: this.createdBy(), from: range.from || undefined, to: range.to || undefined, cancelled: this.showCancelled() || undefined,
      // default: Mã tăng dần
      ...(hs ? { sort: COLUMN_SORT[hs.key] ?? 'code', dir: hs.dir } : { sort: 'code', dir: 'asc' as const }),
    };
  });

  readonly totals = computed(() => this.result().totals);

  value(v: WarehouseVoucher): number {
    return (v.lines ?? []).reduce((s, l) => s + (l.unitPrice ?? 0) * l.quantity, 0);
  }

  qty(v: WarehouseVoucher): number {
    return Math.round((v.lines ?? []).reduce((s, l) => s + (v.type === 'KIEM_KE' ? l.delta : l.quantity), 0) * 100) / 100;
  }

  sourceText(v: WarehouseVoucher): string {
    const s = sourceOf(v, this.data);
    return s ? (s.code ? `${s.label} ${s.code}` : s.label) : 'Lập tay';
  }

  warehouseText(v: WarehouseVoucher): string {
    const from = this.whName().get(v.warehouseId) ?? v.warehouseId;
    return v.type === 'CHUYEN' ? `${from} → ${this.whName().get(v.targetWarehouseId ?? '') ?? '—'}` : from;
  }

  readonly chips = computed<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];
    const p = this.period();
    if (p.preset !== null) {
      const label = p.preset === 'custom' ? rangeLabel(p.range) : PERIOD_PRESETS.find((x) => x.value === p.preset)?.label;
      chips.push({ label: `Kỳ: ${label}`, clear: () => this.period.set(NO_PERIOD) });
    }
    for (const e of this.createdBy()) chips.push({ label: `Người lập: ${this.userName().get(e) ?? e}`, clear: () => this.createdBy.update((v) => v.filter((x) => x !== e)) });
    if (this.showCancelled()) chips.push({ label: 'Gồm phiếu đã huỷ', clear: () => this.showCancelled.set(false) });
    return chips;
  });

  readonly columns: DataTableColumn<WarehouseVoucher>[] = [
    { key: 'code', label: 'Số phiếu', copy: true, link: (r) => ['/kho/phieu', r.id] },
    { key: 'date', label: 'Ngày', format: (r) => formatDay(r.date), mono: true },
    { key: 'type', sortByText: true, label: 'Loại', format: (r) => VOUCHER_KIND_LABEL[kindOf(r)], badge: (r) => tagClass('warehouse-voucher', kindOf(r)) },
    { key: 'warehouseId', sortByText: true, label: 'Kho', format: (r) => this.warehouseText(r) },
    { key: 'source', label: 'Chứng từ gốc', format: (r) => this.sourceText(r), link: (r) => sourceOf(r, this.data)?.link ?? null },
    { key: 'reason', label: 'Lý do', format: (r) => (r.isCancelled ? '[Đã huỷ] ' : '') + (r.reason || '—') },
    { key: 'lines', label: 'Số dòng', align: 'right', format: (r) => String(r.lines?.length ?? 0) },
    {
      key: 'qty', label: 'Tổng SL', align: 'right', format: (r) => (r.type === 'KIEM_KE' ? formatQtySigned(this.qty(r)) : formatQty(this.qty(r))),
      tone: (r) => (r.type === 'KIEM_KE' ? this.qty(r) : 0),
    },
    { key: 'value', label: 'Giá trị nhập', align: 'right', format: (r) => (this.value(r) ? formatVnd(this.value(r)) : '—') },
    { key: 'createdBy', sortByText: true, label: 'Người lập', format: (r) => this.userName().get(r.createdBy) ?? r.createdBy },
  ];

  constructor() {
    // New filters start again from page 1.
    effect(() => {
      this.filters();
      untracked(() => this.page.set(1));
    });
    // Ask the server whenever the filters, the page or the phiếu in memory change (a save elsewhere).
    effect(() => {
      const query = { ...this.filters(), page: this.page(), pageSize: this.pageSize() };
      this.data.warehouseVouchers();
      untracked(() => void this.load(query));
    });
    // Chứng từ gốc of older phiếu: read the đơn the app did not load, so the column shows their mã.
    effect(() => {
      const rows = this.rows();
      untracked(() => {
        void this.salesOrders.ensureMany(rows.map((v) => v.salesOrderId ?? ''));
        void this.purchaseOrders.ensureMany(rows.map((v) => v.purchaseOrderId ?? ''));
      });
    });
    syncSliceToUrl(() => {
      const k = this.kindTab();
      const w = this.warehouseId();
      return { loai: k === 'all' ? null : KIND_PARAM[k], kho: w === 'all' ? null : w };
    });
  }

  clearAll(): void {
    this.search.set('');
    this.period.set(NO_PERIOD);
    this.createdBy.set([]);
    this.showCancelled.set(false);
  }

  setSearch(text: string): void {
    this.search.set(text);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.searchQuery.set(text), 300);
  }

  private async load(query: WarehouseVoucherPageQuery): Promise<void> {
    const seq = ++this.requestSeq;
    this.loading.set(true);
    try {
      const res = await this.svc.page(query);
      if (seq !== this.requestSeq) return; // a newer request answered first
      this.result.set(res);
      this.error.set('');
    } catch (e) {
      if (seq === this.requestSeq) this.error.set(errorText(e));
    } finally {
      if (seq === this.requestSeq) this.loading.set(false);
    }
  }

  /** Every matching phiếu (not only this page), in the list's order. */
  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      const all = (await this.svc.page({ ...this.filters(), page: 1, pageSize: 5000 })).rows;
      const rows = all.flatMap((v) => (v.lines ?? []).map((l) => {
        const p = this.productById().get(l.productId);
        return [
          v.code, formatDay(v.date), VOUCHER_KIND_LABEL[kindOf(v)], this.warehouseText(v), v.reason ?? '', p?.code ?? l.productId, p?.name ?? '',
          p?.baseUnit ?? '', v.type === 'KIEM_KE' ? l.bookQuantity ?? '' : '', l.quantity, v.type === 'KIEM_KE' ? l.delta : '',
          l.unitPrice ?? '', l.unitPrice ? l.unitPrice * l.quantity : '', this.userName().get(v.createdBy) ?? v.createdBy, v.isCancelled ? 'Đã huỷ' : '',
        ];
      }));
      await downloadWorkbook(exportFileName('Phiếu kho'), [{
        name: 'Phiếu kho',
        columns: [
          { header: 'Số phiếu', width: 13 }, { header: 'Ngày', width: 12 }, { header: 'Loại', width: 13 }, { header: 'Kho', width: 30 },
          { header: 'Lý do', width: 34 }, { header: 'Mã hàng', width: 12 }, { header: 'Tên hàng', width: 32 }, { header: 'ĐVT', width: 8 },
          { header: 'Tồn sổ sách', width: 11 }, { header: 'Số lượng', width: 11 }, { header: 'Chênh lệch', width: 11 },
          { header: 'Đơn giá', width: 13, numFmt: '#,##0' }, { header: 'Thành tiền', width: 14, numFmt: '#,##0' },
          { header: 'Người lập', width: 18 }, { header: 'Trạng thái', width: 10 },
        ],
        rows,
      }]);
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.exporting.set(false);
    }
  }
}
