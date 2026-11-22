import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DataStore } from '../../core/services/data-store.service';
import { AuthService } from '../../core/services/auth.service';
import { Contract, ContractStatus } from '../../core/models/contract.models';
import { DataTableColumn, DataTableComponent } from '../../shared/data-table/data-table.component';
import { FilterMultiSelectComponent, FilterOption } from '../../shared/filter-multi-select/filter-multi-select.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { ColumnFilters, applyColumnFilters } from '../../shared/column-filter';
import { ColumnSort, sortByColumn } from '../../shared/column-sort';
import { foldVi, formatVnd } from '../../shared/format.util';
import { formatDay, isoDay } from '../../shared/period';
import { CONTRACT_STATUS_LABEL, contractStatusClass } from '../../shared/status-labels';
import { tagClass } from '../../shared/tag-class';
import { CONTRACT_KIND_LABEL, CONTRACT_KIND_PATH, CONTRACT_PARTY_LABEL, EXPIRY_LABEL, expiryOf, kindOfPath } from './contract.rules';

interface ActiveChip {
  label: string;
  clear: () => void;
}

// Hợp đồng bán (HDB…) / mua (HDM…): một danh sách cho mỗi loại, với giá trị các đơn đã gắn so với giá trị hợp đồng.
@Component({
  selector: 'app-contracts',
  standalone: true,
  imports: [RouterLink, DataTableComponent, FilterMultiSelectComponent, PaginationComponent, NavIconComponent],
  templateUrl: './contracts.component.html',
})
export class ContractsComponent {
  readonly data = inject(DataStore);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly kind = toSignal(this.route.paramMap.pipe(map((p) => kindOfPath(p.get('kind')))), { initialValue: kindOfPath(this.route.snapshot.paramMap.get('kind')) });
  readonly kindLabel = computed(() => CONTRACT_KIND_LABEL[this.kind()]);
  readonly path = computed(() => CONTRACT_KIND_PATH[this.kind()]);
  readonly partyLabel = computed(() => CONTRACT_PARTY_LABEL[this.kind()]);

  readonly search = signal('');
  readonly statuses = signal<string[]>([]);
  /** ?expiry=soon|expired (từ Thông báo): chỉ hợp đồng đang thực hiện sắp hết hạn / quá hạn. */
  readonly expiry = signal<'soon' | 'expired' | null>(null);
  readonly headerSort = signal<ColumnSort | null>(null);
  readonly columnFilters = signal<ColumnFilters>({});
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly today = isoDay(new Date());
  readonly canCreate = computed(() => this.auth.can('contract.create'));
  readonly canUpdate = computed(() => this.auth.can('contract.update'));

  private readonly ofKind = computed(() => this.data.contracts().filter((c) => c.kind === this.kind()));

  private readonly matchedExceptStatus = computed(() => {
    const q = foldVi(this.search().trim());
    const ex = this.expiry();
    return this.ofKind().filter((c) => (!q || this.searchText(c).includes(q)) && (!ex || expiryOf(c, this.today) === ex));
  });

  readonly statusOptions = computed<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const c of this.matchedExceptStatus()) counts.set(c.status, (counts.get(c.status) ?? 0) + 1);
    return (Object.keys(CONTRACT_STATUS_LABEL) as ContractStatus[]).map((s) => ({
      value: s, label: CONTRACT_STATUS_LABEL[s], count: counts.get(s) ?? 0, dotClass: tagClass('contract', s),
    }));
  });

  readonly rows = computed(() => {
    const st = this.statuses();
    const rows = this.matchedExceptStatus().filter((c) => !st.length || st.includes(c.status));
    const hs = this.headerSort();
    const sorted = hs ? sortByColumn(rows, this.columns, hs) : [...rows].sort((a, b) => b.signedDate.localeCompare(a.signedDate) || b.code.localeCompare(a.code));
    return applyColumnFilters(sorted, this.columns, this.columnFilters());
  });

  readonly pagedRows = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.rows().slice(start, start + this.pageSize());
  });

  readonly totals = computed(() => {
    const open = this.rows().filter((c) => c.status === 'DANG_THUC_HIEN');
    return {
      open: open.length,
      value: open.reduce((s, c) => s + c.value, 0),
      orders: open.reduce((s, c) => s + c.orderValue, 0),
      expiring: open.filter((c) => expiryOf(c, this.today) !== 'none').length,
    };
  });

  readonly chips = computed<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];
    const ex = this.expiry();
    if (ex) chips.push({ label: EXPIRY_LABEL[ex], clear: () => this.expiry.set(null) });
    for (const s of this.statuses()) {
      chips.push({ label: CONTRACT_STATUS_LABEL[s as ContractStatus], clear: () => this.statuses.update((v) => v.filter((x) => x !== s)) });
    }
    for (const col of this.columns) {
      const v = (this.columnFilters()[col.key] ?? '').trim();
      if (v) chips.push({ label: `${col.label}: ${v}`, clear: () => this.columnFilters.update((f) => ({ ...f, [col.key]: '' })) });
    }
    return chips;
  });

  readonly columns: DataTableColumn<Contract>[] = [
    { key: 'code', label: 'Mã hợp đồng', sortable: true, copy: true, link: (r) => ['/hop-dong/chi-tiet', r.id] },
    { key: 'contractNo', label: 'Số hợp đồng', sortable: true, sortValue: (r) => r.contractNo ?? '', format: (r) => r.contractNo || '—' },
    { key: 'title', label: 'Trích yếu', sortable: true },
    { key: 'partnerName', label: 'Đối tác', sortable: true, format: (r) => `${r.partnerCode} · ${r.partnerName}` },
    { key: 'signedDate', label: 'Ngày ký', sortable: true, format: (r) => formatDay(r.signedDate), mono: true },
    { key: 'endDate', label: 'Hiệu lực đến', sortable: true, sortValue: (r) => r.endDate ?? '', format: (r) => this.endText(r), mono: true },
    { key: 'value', label: 'Giá trị', sortable: true, align: 'right', format: (r) => (r.value ? formatVnd(r.value) : '—'), filterValue: (r) => r.value },
    { key: 'orderValue', label: 'Đã thực hiện', sortable: true, align: 'right', format: (r) => (r.orderCount ? `${formatVnd(r.orderValue)}${r.percent !== null ? ` · ${r.percent}%` : ''}` : '—'), filterValue: (r) => r.orderValue },
    {
      key: 'status', label: 'Trạng thái', sortable: true, sortValue: (r) => CONTRACT_STATUS_LABEL[r.status],
      format: (r) => CONTRACT_STATUS_LABEL[r.status], badge: (r) => contractStatusClass(r.status),
    },
  ];

  constructor() {
    const ex = this.route.snapshot.queryParamMap.get('expiry');
    if (ex === 'soon' || ex === 'expired') this.expiry.set(ex);
    effect(() => {
      this.rows();
      untracked(() => this.page.set(1));
    });
    // Đổi giữa hợp đồng bán và hợp đồng mua: bỏ bộ lọc của loại trước.
    let first = true;
    effect(() => {
      this.kind();
      if (first) {
        first = false;
        return;
      }
      untracked(() => this.clearAll(true));
    });
  }

  endText(c: Contract): string {
    if (!c.endDate) return '—';
    const e = expiryOf(c, this.today);
    return `${formatDay(c.endDate)}${e === 'none' ? '' : ` · ${EXPIRY_LABEL[e]}`}`;
  }

  money(n: number): string {
    return formatVnd(n);
  }

  clearAll(withSearch = false): void {
    this.statuses.set([]);
    this.expiry.set(null);
    this.columnFilters.set({});
    if (withSearch) this.search.set('');
  }

  private searchText(c: Contract): string {
    return foldVi([c.code, c.contractNo ?? '', c.title, c.partnerCode, c.partnerName, c.description ?? ''].join(' '));
  }
}
