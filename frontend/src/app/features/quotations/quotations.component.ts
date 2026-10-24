import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataStore } from '../../core/services/data-store.service';
import { AuthService } from '../../core/services/auth.service';
import { Quotation } from '../../core/models/domain.models';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { FilterMultiSelectComponent, FilterOption } from '../../shared/filter-multi-select/filter-multi-select.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { PeriodFilterComponent, PeriodValue, NO_PERIOD } from '../../shared/period-filter/period-filter.component';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { ColumnFilters, applyColumnFilters } from '../../shared/column-filter';
import { ColumnSort, sortByColumn } from '../../shared/column-sort';
import { foldVi, formatVnd } from '../../shared/format.util';
import { PERIOD_PRESETS, formatDay, inRange, isoDay, rangeLabel } from '../../shared/period';
import { QUOTATION_STATUS_LABEL, QuotationView, quotationStatusClass, quotationView } from '../../shared/status-labels';
import { tagClass } from '../../shared/tag-class';

interface ActiveChip {
  label: string;
  clear: () => void;
}

// Báo giá: danh sách BG… với trạng thái (Hết hạn suy ra từ ngày hiệu lực), lọc như Đơn hàng bán.
@Component({
  selector: 'app-quotations',
  standalone: true,
  imports: [RouterLink, DataTableComponent, FilterMultiSelectComponent, PaginationComponent, PeriodFilterComponent, NavIconComponent],
  templateUrl: './quotations.component.html',
})
export class QuotationsComponent {
  readonly data = inject(DataStore);
  private readonly auth = inject(AuthService);

  readonly search = signal('');
  readonly statuses = signal<string[]>([]);
  readonly period = signal<PeriodValue>(NO_PERIOD);
  readonly headerSort = signal<ColumnSort | null>(null);
  readonly columnFilters = signal<ColumnFilters>({});
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly today = isoDay(new Date());
  readonly canCreate = computed(() => this.auth.can('quote.create'));
  readonly canUpdate = computed(() => this.auth.can('quote.update'));

  private readonly customerById = computed(() => new Map(this.data.customers().map((c) => [c.id, c])));
  private readonly productById = computed(() => new Map(this.data.products().map((p) => [p.id, p])));
  private readonly userByEmail = computed(() => new Map(this.data.users().map((u) => [u.email, u.name])));

  view(q: Quotation): QuotationView {
    return quotationView(q, this.today);
  }

  private readonly matchedExceptStatus = computed(() => {
    const q = foldVi(this.search().trim());
    const range = this.period().range;
    return this.data.quotations().filter((x) => (!q || this.searchText(x).includes(q)) && inRange(x.quoteDate, range));
  });

  readonly statusOptions = computed<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const x of this.matchedExceptStatus()) counts.set(this.view(x), (counts.get(this.view(x)) ?? 0) + 1);
    return (Object.keys(QUOTATION_STATUS_LABEL) as QuotationView[]).map((s) => ({
      value: s, label: QUOTATION_STATUS_LABEL[s], count: counts.get(s) ?? 0, dotClass: tagClass('quotation', s),
    }));
  });

  readonly rows = computed(() => {
    const st = this.statuses();
    const rows = this.matchedExceptStatus().filter((x) => !st.length || st.includes(this.view(x)));
    const hs = this.headerSort();
    const sorted = hs ? sortByColumn(rows, this.columns, hs) : [...rows].sort((a, b) => b.quoteDate.localeCompare(a.quoteDate) || b.code.localeCompare(a.code));
    return applyColumnFilters(sorted, this.columns, this.columnFilters());
  });

  readonly pagedRows = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.rows().slice(start, start + this.pageSize());
  });

  readonly totals = computed(() => {
    const rows = this.rows();
    const open = rows.filter((x) => this.view(x) === 'MOI');
    const won = rows.filter((x) => x.status === 'DA_CHOT');
    const decided = rows.filter((x) => x.status !== 'MOI' || this.view(x) === 'HET_HAN').length;
    return {
      open: open.reduce((s, x) => s + x.totalOrder, 0), openCount: open.length,
      won: won.reduce((s, x) => s + x.totalOrder, 0), wonCount: won.length,
      rate: decided ? Math.round((won.length / decided) * 100) : null,
    };
  });

  readonly chips = computed<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];
    for (const s of this.statuses()) {
      chips.push({ label: QUOTATION_STATUS_LABEL[s as QuotationView], clear: () => this.statuses.update((v) => v.filter((x) => x !== s)) });
    }
    const p = this.period();
    if (p.preset !== null) {
      const label = p.preset === 'custom' ? rangeLabel(p.range) : PERIOD_PRESETS.find((x) => x.value === p.preset)?.label;
      chips.push({ label: `Kỳ: ${label}`, clear: () => this.period.set(NO_PERIOD) });
    }
    for (const col of this.columns) {
      const v = (this.columnFilters()[col.key] ?? '').trim();
      if (v) chips.push({ label: `${col.label}: ${v}`, clear: () => this.columnFilters.update((f) => ({ ...f, [col.key]: '' })) });
    }
    return chips;
  });

  readonly columns: DataTableColumn<Quotation>[] = [
    { key: 'code', label: 'Số báo giá', sortable: true, copy: true, link: (r) => ['/bao-gia', r.id] },
    { key: 'quoteDate', label: 'Ngày báo giá', sortable: true, format: (r) => formatDay(r.quoteDate), mono: true },
    { key: 'customerId', label: 'Khách hàng', sortable: true, sortValue: (r) => this.customerName(r), format: (r) => this.customerName(r) },
    { key: 'lines', label: 'Mặt hàng', sortable: true, align: 'right', format: (r) => String(r.lines.length), filterValue: (r) => r.lines.length },
    { key: 'totalOrder', label: 'Giá trị', sortable: true, align: 'right', format: (r) => formatVnd(r.totalOrder), filterValue: (r) => r.totalOrder },
    { key: 'validUntil', label: 'Hiệu lực đến', sortable: true, sortValue: (r) => r.validUntil ?? '', format: (r) => (r.validUntil ? formatDay(r.validUntil) : '—'), mono: true },
    {
      key: 'status', label: 'Trạng thái', sortable: true, sortValue: (r) => QUOTATION_STATUS_LABEL[this.view(r)],
      format: (r) => QUOTATION_STATUS_LABEL[this.view(r)], badge: (r) => quotationStatusClass(this.view(r)),
    },
    { key: 'orderCode', label: 'Đơn hàng', sortable: true, sortValue: (r) => r.orderCode ?? '', format: (r) => r.orderCode ?? '—', link: (r) => (r.orderId ? ['/don-hang', r.orderId] : null) },
    { key: 'salesRep', label: 'Người báo giá', sortable: true, sortValue: (r) => this.userName(r.salesRep || r.createdBy), format: (r) => this.userName(r.salesRep || r.createdBy) },
  ];

  constructor() {
    effect(() => {
      this.rows();
      untracked(() => this.page.set(1));
    });
  }

  userName(email: string): string {
    return this.userByEmail().get(email) ?? (email || '—');
  }

  customerName(q: Quotation): string {
    const c = this.customerById().get(q.customerId);
    return c ? c.companyName || c.name : q.customerId;
  }

  money(n: number): string {
    return formatVnd(n);
  }

  clearAll(): void {
    this.statuses.set([]);
    this.period.set(NO_PERIOD);
    this.columnFilters.set({});
  }

  private searchText(q: Quotation): string {
    const c = this.customerById().get(q.customerId);
    const items = q.lines.map((l) => {
      const p = this.productById().get(l.productId);
      return `${p?.code ?? ''} ${p?.name ?? ''}`;
    });
    return foldVi([q.code, q.orderCode ?? '', c?.code ?? '', c?.name ?? '', c?.companyName ?? '', c?.phone ?? '', q.description ?? '', ...items].join(' '));
  }
}
