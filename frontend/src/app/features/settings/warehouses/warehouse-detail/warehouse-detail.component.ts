import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { DataStore } from '../../../../core/services/data-store.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CostService } from '../../../../core/services/cost.service';
import { WarehouseVoucher } from '../../../../core/models/domain.models';
import { NavIconComponent } from '../../../../layout/nav-icon/nav-icon.component';
import { CopyButtonComponent } from '../../../../shared/copy-button/copy-button.component';
import { AuditHistoryComponent } from '../../../../shared/audit/audit-history.component';
import { FrozenColsDirective } from '../../../../shared/frozen-cols.directive';
import { AllowedLinkDirective } from '../../../../shared/allowed-link.directive';
import { formatDay } from '../../../../shared/period';
import { formatQty, formatVnd } from '../../../../shared/format.util';
import { businessStatusClass } from '../../../../shared/status-labels';
import { tagClass } from '../../../../shared/tag-class';
import { errorText } from '../../../../core/api/api.service';
import { VOUCHER_KIND_LABEL, kindOf } from '../../../warehouse-vouchers/warehouse-voucher.rules';
import { WarehouseService } from '../warehouse.service';
import { WarehouseFormDialogComponent } from '../warehouse-form-dialog.component';

type Tab = 'chung' | 'ton-kho' | 'phieu' | 'nhat-ky';
/** Rows shown per tab here; the full list is one click away (Tồn kho / Phiếu kho filtered on this kho). */
const LIMIT = 50;

// /thiet-lap/kho/:id — one kho: who runs it, where it is, what sits in it, what moved through it.
@Component({
  selector: 'app-warehouse-detail',
  standalone: true,
  imports: [RouterLink, AllowedLinkDirective, NavIconComponent, CopyButtonComponent, AuditHistoryComponent, FrozenColsDirective, WarehouseFormDialogComponent],
  templateUrl: './warehouse-detail.component.html',
  styleUrl: './warehouse-detail.component.scss',
})
export class WarehouseDetailComponent {
  readonly data = inject(DataStore);
  readonly svc = inject(WarehouseService);
  readonly cost = inject(CostService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly form = viewChild.required(WarehouseFormDialogComponent);

  readonly canUpdate = this.auth.can('warehouse.update');
  readonly canDelete = this.auth.can('warehouse.delete');
  readonly money = formatVnd;
  readonly qty = formatQty;
  readonly day = formatDay;
  readonly kindLabel = (v: WarehouseVoucher) => VOUCHER_KIND_LABEL[kindOf(v)];
  readonly kindClass = (v: WarehouseVoucher) => 'badge ' + tagClass('warehouse-voucher', kindOf(v));
  readonly limit = LIMIT;

  readonly notice = signal((history.state as { notice?: string } | null)?.notice ?? '');
  readonly failure = signal('');
  readonly confirmDelete = signal(false);

  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: '' });
  readonly warehouse = computed(() => this.data.warehouses().find((w) => w.id === this.id()) ?? null);
  readonly usage = computed(() => this.svc.usageOf(this.id()));
  readonly inUse = computed(() => this.svc.inUse(this.id()));
  readonly statusClass = computed(() => 'badge ' + businessStatusClass(this.warehouse()?.isActive !== false));
  /** The thủ kho's account (for the phone when the kho has none of its own). */
  readonly manager = computed(() => this.data.users().find((u) => u.id === this.warehouse()?.managerId) ?? null);

  private readonly productById = computed(() => new Map(this.data.products().map((p) => [p.id, p])));

  /** What sits here now (and items with a tồn tối thiểu set here even at 0), Mã tăng dần. */
  readonly stockRows = computed(() =>
    this.data.stockLevels()
      .filter((s) => s.warehouseId === this.id() && (s.quantity !== 0 || s.minStock > 0))
      .map((s) => {
        const p = this.productById().get(s.productId);
        return {
          id: s.productId, code: p?.code ?? s.productId, name: p?.name ?? '', unit: p?.baseUnit ?? '', qty: s.quantity, min: s.minStock,
          value: Math.round(Math.max(0, s.quantity) * this.cost.costOf(s.productId)), low: s.minStock > 0 && s.quantity < s.minStock,
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true })),
  );

  /** Phiếu from or into this kho, Mã tăng dần (as every coded grid). */
  readonly vouchers = computed(() =>
    this.data.warehouseVouchers()
      .filter((v) => v.warehouseId === this.id() || v.targetWarehouseId === this.id())
      .sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true })),
  );

  private readonly whName = computed(() => new Map(this.data.warehouses().map((w) => [w.id, w.name])));
  /** "→ Kho X" / "← Kho Y" on a chuyển kho, seen from this kho. */
  direction(v: WarehouseVoucher): string {
    if (v.type !== 'CHUYEN') return '';
    return v.warehouseId === this.id() ? `→ ${this.whName().get(v.targetWarehouseId ?? '') ?? '—'}` : `← ${this.whName().get(v.warehouseId) ?? '—'}`;
  }

  // ---------- tabs (?tab=… keeps the tab in the URL) ----------
  private readonly tabParam = toSignal(this.route.queryParamMap.pipe(map((q) => q.get('tab'))), { initialValue: null });
  readonly tabs = computed(() => [
    { id: 'chung' as Tab, label: 'Thông tin chung' },
    { id: 'ton-kho' as Tab, label: 'Tồn kho', count: this.usage().items },
    { id: 'phieu' as Tab, label: 'Phiếu kho', count: this.usage().vouchers },
    { id: 'nhat-ky' as Tab, label: 'Nhật ký' },
  ]);
  readonly tab = computed<Tab>(() => {
    const t = this.tabParam() as Tab | null;
    return t && this.tabs().some((x) => x.id === t) ? t : 'chung';
  });

  selectTab(id: Tab): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab: id === 'chung' ? null : id }, replaceUrl: true });
  }

  onTabKey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const ids = this.tabs().map((t) => t.id);
    const i = ids.indexOf(this.tab());
    const next = ids[(i + (event.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length];
    this.selectTab(next);
    setTimeout(() => document.getElementById(`tab-${next}`)?.focus());
  }

  // ---------- actions ----------
  edit(): void {
    this.form().open(this.warehouse()!);
  }

  onSaved(): void {
    this.failure.set('');
    this.notice.set('Đã lưu thông tin kho.');
  }

  async toggleActive(): Promise<void> {
    const w = this.warehouse()!;
    const next = w.isActive === false;
    try {
      await this.svc.setActive(w.id, next);
    } catch (e) {
      this.failure.set(errorText(e));
      return;
    }
    this.failure.set('');
    this.notice.set(next ? `Kho "${w.name}" dùng lại — chọn được khi lập chứng từ mới.` : `Kho "${w.name}" ngừng dùng — không còn được chọn khi lập chứng từ mới; tồn và phiếu cũ vẫn giữ.`);
  }

  async doDelete(): Promise<void> {
    const w = this.warehouse()!;
    try {
      await this.svc.remove(w.id);
    } catch (e) {
      this.failure.set(errorText(e));
      this.confirmDelete.set(false);
      return;
    }
    void this.router.navigate(['/thiet-lap/kho']);
  }
}
