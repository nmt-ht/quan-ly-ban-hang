import { Component, computed, effect, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../core/services/mock-data.service';
import { Supplier } from '../../core/models/domain.models';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { ColumnFilters, applyColumnFilters } from '../../shared/column-filter';
import { ColumnSort, sortByColumn } from '../../shared/column-sort';
import { foldVi, formatVnd } from '../../shared/format.util';
import { formatDay } from '../../shared/period';
import { supplierStatusClass, supplierStatusLabel } from '../../shared/status-labels';
import { downloadWorkbook, exportFileName } from '../../shared/excel.util';
import { SUPPLIER_SORTS, SupplierSort, creditLabel, sortSuppliers } from './supplier.rules';
import { SupplierService } from './supplier.service';
import { AllowedLinkDirective } from '../../shared/allowed-link.directive';

interface ActiveChip {
  label: string;
  clear: () => void;
}

type StatusFilter = 'all' | 'active' | 'inactive';
type CreditFilter = 'all' | 'credit' | 'cash';

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [CommonModule, RouterLink, AllowedLinkDirective, DataTableComponent, PaginationComponent, NavIconComponent],
  templateUrl: './suppliers.component.html',
})
export class SuppliersComponent {
  readonly search = signal('');
  readonly status = signal<StatusFilter>('all');
  readonly credit = signal<CreditFilter>('all');
  readonly owing = signal(false);
  readonly sort = signal<SupplierSort>('name-asc');
  readonly columnFilters = signal<ColumnFilters>({});
  // Clicking a column header overrides the "Sắp xếp" select; picking from the select clears it.
  readonly headerSort = signal<ColumnSort | null>(null);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly exporting = signal(false);
  readonly sorts = SUPPLIER_SORTS;

  // Every filter except Trạng thái — feeds the result and the status counts.
  private readonly matchedExceptStatus = computed(() => {
    const q = foldVi(this.search().trim());
    const credit = this.credit();
    const owing = this.owing();
    return this.data.suppliers().filter((s) => {
      if (q && !this.searchText(s).includes(q)) return false;
      if (credit === 'credit' && s.creditDays <= 0) return false;
      if (credit === 'cash' && s.creditDays > 0) return false;
      if (owing && this.svc.statsOf(s.id).payable <= 0) return false;
      return true;
    });
  });

  readonly statusCounts = computed(() => {
    const rows = this.matchedExceptStatus();
    const active = rows.filter((s) => s.isActive).length;
    return { all: rows.length, active, inactive: rows.length - active };
  });

  readonly suppliers = computed(() => {
    const st = this.status();
    const rows = this.matchedExceptStatus().filter((s) => st === 'all' || s.isActive === (st === 'active'));
    return sortByColumn(applyColumnFilters(sortSuppliers(rows, this.sort()), this.columns, this.columnFilters()), this.columns, this.headerSort());
  });

  readonly pagedSuppliers = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.suppliers().slice(start, start + this.pageSize());
  });

  readonly totals = computed(() => {
    let payable = 0;
    let overdue = 0;
    for (const s of this.suppliers()) {
      const st = this.svc.statsOf(s.id);
      payable += Math.max(0, st.payable);
      overdue += st.overdue;
    }
    return { payable, overdue };
  });

  readonly chips = computed<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];
    if (this.status() !== 'all') {
      chips.push({ label: this.status() === 'active' ? 'Còn hợp tác' : 'Ngừng hợp tác', clear: () => this.status.set('all') });
    }
    if (this.credit() !== 'all') {
      chips.push({ label: this.credit() === 'credit' ? 'Được nợ' : 'Trả ngay', clear: () => this.credit.set('all') });
    }
    if (this.owing()) chips.push({ label: 'Còn công nợ', clear: () => this.owing.set(false) });
    for (const col of this.columns) {
      const v = (this.columnFilters()[col.key] ?? '').trim();
      if (v) chips.push({ label: `${col.label}: ${v}`, clear: () => this.columnFilters.update((f) => ({ ...f, [col.key]: '' })) });
    }
    return chips;
  });

  readonly columns: DataTableColumn<Supplier>[] = [
    { key: 'code', label: 'Mã NCC', copy: true, link: (r) => ['/nha-cung-cap', r.id] },
    { key: 'name', label: 'Tên nhà cung cấp' },
    { key: 'contactPhone', label: 'Liên hệ', format: (r) => r.contactPhone || '—', mono: true },
    { key: 'taxCode', label: 'Mã số thuế', format: (r) => r.taxCode || '—', mono: true },
    { key: 'address', label: 'Địa chỉ', format: (r) => r.address || '—' },
    { key: 'creditDays', label: 'Được nợ', align: 'right', format: (r) => creditLabel(r.creditDays), filterValue: (r) => r.creditDays },
    {
      key: 'productCount', label: 'Mặt hàng', align: 'right',
      format: (r) => String(this.svc.statsOf(r.id).productCount),
      filterValue: (r) => this.svc.statsOf(r.id).productCount,
    },
    {
      key: 'orderCount', label: 'Đơn nhập', align: 'right',
      format: (r) => String(this.svc.statsOf(r.id).orderCount),
      filterValue: (r) => this.svc.statsOf(r.id).orderCount,
    },
    {
      key: 'payable', label: 'Còn phải trả', align: 'right',
      format: (r) => {
        const v = this.svc.statsOf(r.id).payable;
        return v ? formatVnd(v) : '—';
      },
      filterValue: (r) => this.svc.statsOf(r.id).payable,
    },
    { key: 'isActive', label: 'Trạng thái', format: (r) => supplierStatusLabel(r.isActive), badge: (r) => supplierStatusClass(r.isActive) },
  ];

  constructor(
    readonly data: MockDataService,
    private readonly svc: SupplierService,
  ) {
    effect(() => {
      this.suppliers();
      untracked(() => this.page.set(1));
    });
  }

  money(n: number): string {
    return formatVnd(n);
  }

  clearAll(): void {
    this.status.set('all');
    this.credit.set('all');
    this.owing.set(false);
    this.columnFilters.set({});
  }

  async exportExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      await downloadWorkbook(exportFileName('Nhà cung cấp'), [{
        name: 'Nhà cung cấp',
        columns: [
          { header: 'Mã NCC', width: 14 },
          { header: 'Tên nhà cung cấp', width: 34 },
          { header: 'Điện thoại', width: 14 },
          { header: 'Email', width: 26 },
          { header: 'Mã số thuế', width: 14 },
          { header: 'Địa chỉ', width: 40 },
          { header: 'Số ngày được nợ', width: 14 },
          { header: 'Số mặt hàng', width: 12 },
          { header: 'Số đơn nhập', width: 12 },
          { header: 'Còn phải trả', width: 16, numFmt: '#,##0' },
          { header: 'Trạng thái', width: 16 },
          { header: 'Ngày tạo', width: 12 },
          { header: 'Ghi chú', width: 30 },
        ],
        rows: this.suppliers().map((s) => {
          const st = this.svc.statsOf(s.id);
          return [
            s.code, s.name, s.contactPhone ?? '', s.email ?? '', s.taxCode ?? '', s.address ?? '', s.creditDays,
            st.productCount, st.orderCount, st.payable, supplierStatusLabel(s.isActive),
            s.createdAt ? formatDay(s.createdAt) : '', s.note ?? '',
          ];
        }),
      }]);
    } finally {
      this.exporting.set(false);
    }
  }

  private searchText(s: Supplier): string {
    return foldVi([s.code, s.name, s.contactPhone ?? '', s.email ?? '', s.taxCode ?? '', s.address ?? ''].join(' '));
  }
}
