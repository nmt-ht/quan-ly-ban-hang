import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DataStore } from '../../../core/services/data-store.service';
import { AuthService } from '../../../core/services/auth.service';
import { Warehouse } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { foldVi, formatVnd } from '../../../shared/format.util';
import { FrozenColsDirective } from '../../../shared/frozen-cols.directive';
import { WarehouseService } from './warehouse.service';
import { CostService } from '../../../core/services/cost.service';
import { WarehouseFormDialogComponent } from './warehouse-form-dialog.component';
import { businessStatusClass } from '../../../shared/status-labels';

// /thiet-lap/kho — the physical places stock sits in. Each kho has its own page (/thiet-lap/kho/:id).
@Component({
  selector: 'app-warehouses',
  standalone: true,
  imports: [RouterLink, NavIconComponent, FrozenColsDirective, WarehouseFormDialogComponent],
  templateUrl: './warehouses.component.html',
  styleUrls: ['../categories/categories.component.scss', './warehouses.component.scss'],
})
export class WarehousesComponent {
  readonly data = inject(DataStore);
  readonly svc = inject(WarehouseService);
  readonly cost = inject(CostService);
  private readonly router = inject(Router);
  private readonly form = viewChild.required(WarehouseFormDialogComponent);

  readonly canCreate = inject(AuthService).can('warehouse.create');
  readonly canUpdate = inject(AuthService).can('warehouse.update');
  readonly money = formatVnd;
  /** Đang dùng / Ngừng dùng in the colours of the business-status group (Thiết lập › Màu hiển thị). */
  readonly statusClass = (w: Warehouse) => 'badge ' + businessStatusClass(w.isActive !== false);

  readonly search = signal('');
  readonly showInactive = signal(true);
  readonly notice = signal('');

  /** Mã tăng dần (as every coded grid); search on mã, tên, địa chỉ, thủ kho. */
  readonly rows = computed(() => {
    const q = foldVi(this.search().trim());
    return [...this.data.warehouses()]
      .filter((w) => this.showInactive() || w.isActive !== false)
      .filter((w) => !q || foldVi(`${w.code ?? ''} ${w.name} ${w.address ?? ''} ${w.managerName ?? ''}`).includes(q))
      .sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '', 'vi', { numeric: true }) || a.name.localeCompare(b.name, 'vi'))
      .map((w) => ({ w, u: this.svc.usageOf(w.id) }));
  });
  readonly inactiveCount = computed(() => this.data.warehouses().filter((w) => w.isActive === false).length);
  readonly totalValue = computed(() => this.data.warehouses().reduce((s, w) => s + this.svc.usageOf(w.id).value, 0));

  add(): void {
    this.form().open();
  }

  edit(w: Warehouse): void {
    this.form().open(w);
  }

  /** A new kho opens on its own page (to see it, or lập phiếu nhập đầu kỳ); an edit stays on the list. */
  onSaved(e: { warehouse: Warehouse; created: boolean }): void {
    if (e.created) void this.router.navigate(['/thiet-lap/kho', e.warehouse.id], { state: { notice: `Đã thêm kho ${e.warehouse.code} · ${e.warehouse.name}.` } });
    else this.notice.set(`Đã lưu kho ${e.warehouse.code ?? ''} · ${e.warehouse.name}.`);
  }
}
