import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../core/services/mock-data.service';
import { Customer, CustomerType } from '../../core/models/domain.models';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { FilterMultiSelectComponent, FilterOption } from '../../shared/filter-multi-select/filter-multi-select.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { ColumnFilters, applyColumnFilters } from '../../shared/column-filter';
import { ColumnSort, sortByColumn } from '../../shared/column-sort';
import { foldVi, formatVnd } from '../../shared/format.util';
import { formatDay } from '../../shared/period';
import { CUSTOMER_TYPE_SHORT, customerStatusClass, customerStatusLabel, customerTypeClass } from '../../shared/status-labels';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { tagStyle } from '../../shared/tag-colors';
import { CUSTOMER_SORTS, CUSTOMER_TYPES, CustomerSort, creditLabel, taxCodeOf } from './customer.rules';
import { CustomerService } from './customer.service';
import { AllowedLinkDirective } from '../../shared/allowed-link.directive';

interface ActiveChip {
  label: string;
  clear: () => void;
}

type StatusFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, RouterLink, AllowedLinkDirective, DataTableComponent, FilterMultiSelectComponent, PaginationComponent, NavIconComponent],
  templateUrl: './customers.component.html',
})
export class CustomersComponent {
  readonly data = inject(MockDataService);
  private readonly svc = inject(CustomerService);

  readonly search = signal('');
  readonly types = signal<string[]>([]);
  readonly tags = signal<string[]>([]);
  readonly status = signal<StatusFilter>('all');
  readonly owing = signal(false);
  readonly sort = signal<CustomerSort>('name-asc');
  readonly columnFilters = signal<ColumnFilters>({});
  // Clicking a column header overrides the "Sắp xếp" select; picking from the select clears it.
  readonly headerSort = signal<ColumnSort | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly exporting = signal(false);
  readonly sorts = CUSTOMER_SORTS;

  private readonly tagById = computed(() => new Map(this.data.tags().map((t) => [t.id, t.name])));

  readonly typeOptions = computed<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const c of this.data.customers()) counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
    return CUSTOMER_TYPES.map((t) => ({ value: t.value, label: t.label, count: counts.get(t.value) ?? 0, dotClass: customerTypeClass(t.value) }));
  });

  readonly tagOptions = computed<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const c of this.data.customers()) for (const t of c.tagIds) counts.set(t, (counts.get(t) ?? 0) + 1);
    return this.data.tags().map((t) => ({ value: t.id, label: t.name, count: counts.get(t.id) ?? 0 }));
  });

  private readonly matchedExceptStatus = computed(() => {
    const q = foldVi(this.search().trim());
    const types = this.types();
    const tags = this.tags();
    const owing = this.owing();
    return this.data.customers().filter((c) => {
      if (q && !this.searchText(c).includes(q)) return false;
      if (types.length && !types.includes(c.type)) return false;
      if (tags.length && !c.tagIds.some((t) => tags.includes(t))) return false;
      if (owing && this.svc.statsOf(c.id).receivable <= 0) return false;
      return true;
    });
  });

  readonly statusCounts = computed(() => {
    const rows = this.matchedExceptStatus();
    const active = rows.filter((c) => c.isActive).length;
    return { all: rows.length, active, inactive: rows.length - active };
  });

  readonly customers = computed(() => {
    const st = this.status();
    const rows = this.matchedExceptStatus().filter((c) => st === 'all' || c.isActive === (st === 'active'));
    const s = this.sort();
    const stat = (c: Customer) => this.svc.statsOf(c.id);
    const byName = (a: Customer, b: Customer) => a.name.localeCompare(b.name, 'vi');
    rows.sort((a, b) =>
      s === 'name-desc' ? byName(b, a)
        : s === 'code-asc' ? a.code.localeCompare(b.code)
          : s === 'newest' ? (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.code.localeCompare(a.code)
            : s === 'revenue' ? stat(b).revenue - stat(a).revenue
              : s === 'debt' ? stat(b).receivable - stat(a).receivable
                : byName(a, b),
    );
    return sortByColumn(applyColumnFilters(rows, this.columns, this.columnFilters()), this.columns, this.headerSort());
  });

  readonly pagedCustomers = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.customers().slice(start, start + this.pageSize());
  });

  readonly totals = computed(() => {
    let receivable = 0;
    let overdue = 0;
    let revenue = 0;
    for (const c of this.customers()) {
      const s = this.svc.statsOf(c.id);
      receivable += Math.max(0, s.receivable);
      overdue += s.overdue;
      revenue += s.revenue;
    }
    return { receivable, overdue, revenue };
  });

  readonly chips = computed<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];
    for (const t of this.types()) {
      chips.push({ label: `Loại: ${CUSTOMER_TYPE_SHORT[t as CustomerType]}`, clear: () => this.types.update((v) => v.filter((x) => x !== t)) });
    }
    for (const t of this.tags()) {
      chips.push({ label: `Thẻ: ${this.tagById().get(t) ?? t}`, clear: () => this.tags.update((v) => v.filter((x) => x !== t)) });
    }
    if (this.status() !== 'all') {
      chips.push({ label: this.status() === 'active' ? 'Đang theo dõi' : 'Ngừng theo dõi', clear: () => this.status.set('all') });
    }
    if (this.owing()) chips.push({ label: 'Còn công nợ', clear: () => this.owing.set(false) });
    for (const col of this.columns) {
      const v = (this.columnFilters()[col.key] ?? '').trim();
      if (v) chips.push({ label: `${col.label}: ${v}`, clear: () => this.columnFilters.update((f) => ({ ...f, [col.key]: '' })) });
    }
    return chips;
  });

  readonly columns: DataTableColumn<Customer>[] = [
    { key: 'code', label: 'Mã KH', copy: true, link: (r) => ['/khach-hang', r.id] },
    { key: 'name', label: 'Tên khách hàng', format: (r) => (r.companyName ? `${r.name} · ${r.companyName}` : r.name) },
    { key: 'type', sortByText: true, label: 'Loại', format: (r) => CUSTOMER_TYPE_SHORT[r.type], badge: (r) => customerTypeClass(r.type) },
    {
      key: 'tagIds', label: 'Thẻ', format: (r) => r.tagIds.map((t) => this.tagById().get(t) ?? t).join(', ') || '—',
      chips: (r) => this.tagChips(r.tagIds),
    },
    { key: 'phone', label: 'Liên hệ', format: (r) => r.phone || '—', mono: true },
    { key: 'taxCode', sortByText: true, label: 'Mã số thuế', format: (r) => taxCodeOf(r) || '—', mono: true },
    { key: 'creditDays', label: 'Được nợ', align: 'right', format: (r) => (r.creditDays > 0 ? creditLabel(r.creditDays) : '—'), filterValue: (r) => r.creditDays },
    {
      key: 'orderCount', label: 'Đơn hàng', align: 'right',
      format: (r) => String(this.svc.statsOf(r.id).orderCount), filterValue: (r) => this.svc.statsOf(r.id).orderCount,
    },
    {
      key: 'revenue', label: 'Đã mua', align: 'right',
      format: (r) => (this.svc.statsOf(r.id).revenue ? formatVnd(this.svc.statsOf(r.id).revenue) : '—'),
      filterValue: (r) => this.svc.statsOf(r.id).revenue,
    },
    {
      key: 'receivable', label: 'Còn phải thu', align: 'right',
      format: (r) => (this.svc.statsOf(r.id).receivable ? formatVnd(this.svc.statsOf(r.id).receivable) : '—'),
      filterValue: (r) => this.svc.statsOf(r.id).receivable,
    },
    { key: 'isActive', label: 'Trạng thái', format: (r) => customerStatusLabel(r.isActive), badge: (r) => customerStatusClass(r.isActive) },
  ];

  constructor() {
    effect(() => {
      this.customers();
      untracked(() => this.page.set(1));
    });
  }

  private readonly tagObjById = computed(() => new Map(this.data.tags().map((t) => [t.id, t])));

  tagChips(ids: string[]): { label: string; style: Record<string, string> }[] {
    return ids.flatMap((id) => {
      const t = this.tagObjById().get(id);
      return t ? [{ label: t.name, style: tagStyle(t.color) }] : [];
    });
  }

  money(n: number): string {
    return formatVnd(n);
  }

  clearAll(): void {
    this.types.set([]);
    this.tags.set([]);
    this.status.set('all');
    this.owing.set(false);
    this.columnFilters.set({});
  }

  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      await downloadWorkbook(exportFileName('Khách hàng'), [{
        name: 'Khách hàng',
        columns: [
          { header: 'Mã KH', width: 13 },
          { header: 'Tên khách hàng', width: 26 },
          { header: 'Tên công ty', width: 30 },
          { header: 'Loại', width: 10 },
          { header: 'Thẻ', width: 20 },
          { header: 'Điện thoại', width: 14 },
          { header: 'Email', width: 26 },
          { header: 'MST công ty', width: 14 },
          { header: 'MST cá nhân', width: 14 },
          { header: 'Số ngày được nợ', width: 14 },
          { header: 'Địa chỉ giao mặc định', width: 40 },
          { header: 'Số đơn', width: 9 },
          { header: 'Đã mua', width: 15, numFmt: '#,##0' },
          { header: 'Còn phải thu', width: 15, numFmt: '#,##0' },
          { header: 'Trạng thái', width: 15 },
          { header: 'Ngày tạo', width: 12 },
          { header: 'Ghi chú', width: 30 },
        ],
        rows: this.customers().map((c) => {
          const s = this.svc.statsOf(c.id);
          return [
            c.code, c.name, c.companyName ?? '', CUSTOMER_TYPE_SHORT[c.type], c.tagIds.map((t) => this.tagById().get(t) ?? t).join(', '),
            c.phone ?? '', c.email ?? '', c.companyTaxCode ?? '', c.personalTaxCode ?? '', c.creditDays,
            c.addresses?.find((a) => a.isDefault)?.address ?? '', s.orderCount, s.revenue, s.receivable,
            customerStatusLabel(c.isActive), c.createdAt ? formatDay(c.createdAt) : '', c.note ?? '',
          ];
        }),
      }]);
    } finally {
      this.exporting.set(false);
    }
  }

  private searchText(c: Customer): string {
    return foldVi([
      c.code, c.name, c.companyName ?? '', c.phone ?? '', c.email ?? '', c.companyTaxCode ?? '', c.personalTaxCode ?? '',
      ...(c.addresses ?? []).map((a) => `${a.address} ${a.recipientName ?? ''} ${a.phone ?? ''}`),
    ].join(' '));
  }
}
