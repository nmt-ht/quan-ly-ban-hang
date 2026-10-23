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
import { ColumnFilters, applyColumnFilters } from '../../shared/column-filter';
import { ColumnSort, sortByColumn } from '../../shared/column-sort';
import { foldVi, formatQty, formatQtySigned, formatVnd } from '../../shared/format.util';
import { PERIOD_PRESETS, formatDay, inRange, rangeLabel } from '../../shared/period';
import { tagClass } from '../../shared/tag-class';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { KIND_SLUG, VOUCHER_KIND_LABEL, VoucherKindKey, kindOf, sourceOf } from './warehouse-voucher.rules';
import { AllowedLinkDirective } from '../../shared/allowed-link.directive';

type KindTab = 'all' | VoucherKindKey;
const KINDS: VoucherKindKey[] = ['NHAP', 'TRA_VE', 'XUAT', 'CHUYEN', 'KIEM_KE'];
/** ?loai= in the address. */
const KIND_PARAM: Record<VoucherKindKey, string> = { NHAP: 'nhap', TRA_VE: 'tra-ve', XUAT: 'xuat', CHUYEN: 'chuyen', KIEM_KE: 'kiem-ke' };

interface ActiveChip {
  label: string;
  clear: () => void;
}

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
  readonly columnFilters = signal<ColumnFilters>({});
  // Clicking a column header sorts; again reverses; a third click goes back to the default order.
  readonly headerSort = signal<ColumnSort | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly exporting = signal(false);

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

  // Every filter except Loại phiếu and Kho — the tab and rail counts are taken from it.
  private readonly matchedBase = computed(() => {
    const q = foldVi(this.search().trim());
    const by = this.createdBy();
    return this.data.warehouseVouchers().filter((v) => {
      if (!this.showCancelled() && v.isCancelled) return false;
      if (q && !this.searchText(v).includes(q)) return false;
      if (!inRange(v.date, this.period().range)) return false;
      if (by.length && !by.includes(v.createdBy)) return false;
      return true;
    });
  });

  /** A chuyển kho belongs to both its warehouses. */
  private inWarehouse(v: WarehouseVoucher, wh = this.warehouseId()): boolean {
    return wh === 'all' || v.warehouseId === wh || v.targetWarehouseId === wh;
  }

  private ofTab(v: WarehouseVoucher): boolean {
    const k = this.kindTab();
    return k === 'all' || kindOf(v) === k;
  }

  readonly kindTabs = computed<DivideItem<KindTab>[]>(() => {
    const rows = this.matchedBase().filter((v) => this.inWarehouse(v));
    return [
      { value: 'all', label: 'Tất cả', count: rows.length },
      ...KINDS.map((k) => ({ value: k, label: VOUCHER_KIND_LABEL[k], count: rows.filter((v) => kindOf(v) === k).length })),
    ];
  });

  readonly warehouseRail = computed<DivideItem[]>(() => {
    const rows = this.matchedBase().filter((v) => this.ofTab(v));
    return [
      { value: 'all', label: 'Tất cả kho', count: rows.length },
      ...this.data.warehouses().map((w) => ({ value: w.id, label: w.name, count: rows.filter((v) => this.inWarehouse(v, w.id)).length })),
    ];
  });

  readonly vouchers = computed(() => {
    const rows = this.matchedBase()
      .filter((v) => this.inWarehouse(v) && this.ofTab(v))
      .sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true })); // default: Mã tăng dần
    return sortByColumn(applyColumnFilters(rows, this.columns, this.columnFilters()), this.columns, this.headerSort());
  });

  readonly paged = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.vouchers().slice(start, start + this.pageSize());
  });

  readonly totals = computed(() => {
    const rows = this.vouchers().filter((v) => !v.isCancelled);
    const count = (k: VoucherKindKey) => rows.filter((v) => kindOf(v) === k).length;
    return { nhap: count('NHAP') + count('TRA_VE'), xuat: count('XUAT'), chuyen: count('CHUYEN'), kiemKe: count('KIEM_KE'), value: rows.reduce((s, v) => s + this.value(v), 0) };
  });

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
    for (const col of this.columns) {
      const v = (this.columnFilters()[col.key] ?? '').trim();
      if (v) chips.push({ label: `${col.label}: ${v}`, clear: () => this.columnFilters.update((f) => ({ ...f, [col.key]: '' })) });
    }
    return chips;
  });

  readonly columns: DataTableColumn<WarehouseVoucher>[] = [
    { key: 'code', label: 'Số phiếu', copy: true, link: (r) => ['/kho/phieu', r.id] },
    { key: 'date', label: 'Ngày', format: (r) => formatDay(r.date), mono: true },
    { key: 'type', sortByText: true, label: 'Loại', format: (r) => VOUCHER_KIND_LABEL[kindOf(r)], badge: (r) => tagClass('warehouse-voucher', kindOf(r)) },
    { key: 'warehouseId', sortByText: true, label: 'Kho', format: (r) => this.warehouseText(r) },
    { key: 'source', label: 'Chứng từ gốc', format: (r) => this.sourceText(r), link: (r) => sourceOf(r, this.data)?.link ?? null },
    { key: 'reason', label: 'Lý do', format: (r) => (r.isCancelled ? '[Đã huỷ] ' : '') + (r.reason || '—') },
    { key: 'lines', label: 'Số dòng', align: 'right', format: (r) => String(r.lines?.length ?? 0), filterValue: (r) => r.lines?.length ?? 0 },
    {
      key: 'qty', label: 'Tổng SL', align: 'right', format: (r) => (r.type === 'KIEM_KE' ? formatQtySigned(this.qty(r)) : formatQty(this.qty(r))),
      filterValue: (r) => this.qty(r), tone: (r) => (r.type === 'KIEM_KE' ? this.qty(r) : 0),
    },
    { key: 'value', label: 'Giá trị nhập', align: 'right', format: (r) => (this.value(r) ? formatVnd(this.value(r)) : '—'), filterValue: (r) => this.value(r) },
    { key: 'createdBy', sortByText: true, label: 'Người lập', format: (r) => this.userName().get(r.createdBy) ?? r.createdBy },
  ];

  constructor() {
    effect(() => {
      this.vouchers();
      untracked(() => this.page.set(1));
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
    this.columnFilters.set({});
  }

  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      const rows = this.vouchers().flatMap((v) => (v.lines ?? []).map((l) => {
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
    } finally {
      this.exporting.set(false);
    }
  }

  private searchText(v: WarehouseVoucher): string {
    const items = (v.lines ?? []).map((l) => {
      const p = this.productById().get(l.productId);
      return `${p?.code ?? ''} ${p?.name ?? ''}`;
    });
    return foldVi([v.code, v.reason ?? '', v.note ?? '', ...items].join(' '));
  }
}
