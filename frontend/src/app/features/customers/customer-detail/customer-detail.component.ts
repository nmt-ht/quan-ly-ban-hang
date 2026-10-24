import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { DataStore } from '../../../core/services/data-store.service';
import { DebtEntry, DebtService } from '../../../core/services/debt.service';
import { CustomerAddress, SalesOrder } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { CopyButtonComponent } from '../../../shared/copy-button/copy-button.component';
import { amountTone, formatVnd, formatVndSigned } from '../../../shared/format.util';
import { formatDay } from '../../../shared/period';
import {
  CUSTOMER_TYPE_SHORT, SALES_ORDER_STATUS_LABEL, customerStatusClass, customerStatusLabel, customerTypeClass, salesOrderStatusClass,
} from '../../../shared/status-labels';
import { deliveredPercent } from '../../sales-orders/sales-order.rules';
import { tagStyle } from '../../../shared/tag-colors';
import { PHONE_PATTERN, creditLabel } from '../customer.rules';
import { CustomerService } from '../customer.service';
import { AllowedLinkDirective } from '../../../shared/allowed-link.directive';
import { errorText } from '../../../core/api/api.service';
import { AuditHistoryComponent } from '../../../shared/audit/audit-history.component';
import { FrozenColsDirective } from '../../../shared/frozen-cols.directive';

export type CustomerTab = 'chung' | 'dia-chi' | 'don-hang' | 'cong-no' | 'nhat-ky';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [FrozenColsDirective, NgClass, FormsModule, RouterLink, AllowedLinkDirective, NavIconComponent, CopyButtonComponent, AuditHistoryComponent],
  templateUrl: './customer-detail.component.html',
  styleUrls: ['../../suppliers/supplier-detail/supplier-detail.component.scss', './customer-detail.component.scss'],
})
export class CustomerDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly data = inject(DataStore);
  private readonly debt = inject(DebtService);
  private readonly svc = inject(CustomerService);

  readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: this.route.snapshot.paramMap.get('id') ?? '' });
  readonly customer = computed(() => this.data.customers().find((c) => c.id === this.id()));
  readonly stats = computed(() => this.svc.statsOf(this.id()));

  readonly money = formatVnd;
  readonly signed = formatVndSigned;
  readonly tone = amountTone;
  readonly day = formatDay;
  readonly creditLabel = creditLabel;

  priceListName(id: string | null | undefined): string {
    if (!id) return 'Theo loại khách';
    const l = this.data.priceLists().find((x) => x.id === id);
    return l ? l.name + (l.isActive ? '' : ' (ngừng dùng — đang theo loại khách)') : '—';
  }
  readonly typeLabel = CUSTOMER_TYPE_SHORT;
  readonly typeClass = customerTypeClass;
  readonly statusClass = customerStatusClass;
  readonly statusLabel = customerStatusLabel;
  readonly soLabel = SALES_ORDER_STATUS_LABEL;
  readonly soClass = salesOrderStatusClass;
  readonly deliveredPercent = deliveredPercent;

  readonly notice = signal('');
  /** A save the server refused (or that could not reach it). */
  readonly failure = signal('');

  constructor() {
    effect(() => {
      this.id();
      untracked(() => {
        this.notice.set((history.state as { notice?: string } | null)?.notice ?? '');
        this.cancelAddress();
      });
    });
  }

  readonly tagStyle = tagStyle;
  readonly tagList = computed(() => {
    const ids = this.customer()?.tagIds ?? [];
    return this.data.tags().filter((t) => ids.includes(t.id));
  });

  readonly tagNames = computed(() => {
    const ids = this.customer()?.tagIds ?? [];
    return this.data.tags().filter((t) => ids.includes(t.id)).map((t) => t.name);
  });

  // ---------- tabs ----------
  private readonly tabParam = toSignal(this.route.queryParamMap.pipe(map((q) => q.get('tab'))), { initialValue: null });

  readonly tabs = computed(() => [
    { id: 'chung' as CustomerTab, label: 'Thông tin chung' },
    { id: 'dia-chi' as CustomerTab, label: 'Địa chỉ giao hàng', count: this.customer()?.addresses?.length ?? 0 },
    { id: 'don-hang' as CustomerTab, label: 'Đơn hàng', count: this.orders().length },
    { id: 'cong-no' as CustomerTab, label: 'Sổ công nợ' },
    { id: 'nhat-ky' as CustomerTab, label: 'Nhật ký' },
  ]);

  readonly tab = computed<CustomerTab>(() => {
    const t = this.tabParam() as CustomerTab | null;
    return t && this.tabs().some((x) => x.id === t) ? t : 'chung';
  });

  selectTab(id: CustomerTab): void {
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

  // ---------- trạng thái ----------
  async toggleActive(): Promise<void> {
    const c = this.customer();
    if (!c) return;
    if (!(await this.attempt(() => this.svc.setActive(c.id, !c.isActive)))) return;
    this.notice.set(
      c.isActive
        ? `Đã chuyển ${c.code} sang Ngừng theo dõi — không chọn được khi lên đơn mới. Đơn cũ và công nợ vẫn giữ nguyên.`
        : `${c.code} đã được theo dõi lại.`,
    );
  }

  // ---------- đơn hàng & lịch sử mua ----------
  readonly orders = computed<SalesOrder[]>(() =>
    this.data.salesOrders()
      .filter((o) => o.customerId === this.id())
      .sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true })), // Mã tăng dần, as every coded grid
  );

  readonly average = computed(() => (this.stats().receivedOrders ? Math.round(this.stats().revenue / this.stats().receivedOrders) : 0));

  // ---------- công nợ ----------
  readonly debtRow = computed(() => this.debt.receivables().find((r) => r.partnerId === this.id()));
  readonly entries = computed<DebtEntry[]>(() => [...(this.debtRow()?.entries ?? [])].reverse());

  entryStatus(e: DebtEntry): string {
    if (e.kind === 'THANH_TOAN') return e.remaining > 0 ? `${formatVnd(e.remaining)} chưa dùng` : 'Đã đối trừ hết';
    if (e.remaining <= 0) return 'Đã thu đủ';
    if ((e.overdueDays ?? 0) > 0) return `Quá hạn ${e.overdueDays} ngày`;
    if (e.overdueDays === 0) return 'Đến hạn hôm nay';
    return `Còn ${-(e.overdueDays ?? 0)} ngày`;
  }

  // ---------- địa chỉ giao hàng (inline add / edit) ----------
  readonly addrEditing = signal<string | null>(null); // address id, or 'new'
  readonly addrDraft = signal<Partial<CustomerAddress>>({});
  readonly addrAttempted = signal(false);

  startAddress(a?: CustomerAddress): void {
    this.addrEditing.set(a?.id ?? 'new');
    this.addrDraft.set(a ? { ...a } : { isDefault: !(this.customer()?.addresses?.length) });
    this.addrAttempted.set(false);
    setTimeout(() => document.getElementById('ad-address')?.focus());
  }

  cancelAddress(): void {
    this.addrEditing.set(null);
    this.addrDraft.set({});
    this.addrAttempted.set(false);
  }

  patchDraft(change: Partial<CustomerAddress>): void {
    this.addrDraft.update((d) => ({ ...d, ...change }));
  }

  readonly addrError = computed(() => {
    const d = this.addrDraft();
    if (!d.address?.trim()) return 'Nhập địa chỉ';
    if (d.phone && !PHONE_PATTERN.test(d.phone)) return 'Số điện thoại không hợp lệ';
    return '';
  });

  async saveAddress(): Promise<void> {
    this.addrAttempted.set(true);
    const c = this.customer();
    if (!c || this.addrError()) return;
    const d = this.addrDraft();
    const isNew = this.addrEditing() === 'new';
    const ok = await this.attempt(() => this.svc.saveAddress(c.id, {
      id: isNew ? crypto.randomUUID() : this.addrEditing()!,
      label: d.label?.trim() || undefined,
      recipientName: d.recipientName?.trim() || undefined,
      phone: d.phone?.trim() || undefined,
      address: d.address!.trim(),
      isDefault: !!d.isDefault,
    }));
    if (!ok) return;
    this.notice.set(isNew ? 'Đã thêm địa chỉ giao hàng.' : 'Đã lưu địa chỉ giao hàng.');
    this.cancelAddress();
  }

  async removeAddress(a: CustomerAddress): Promise<void> {
    if (!(await this.attempt(() => this.svc.removeAddress(this.id(), a.id)))) return;
    this.notice.set(`Đã xoá địa chỉ "${a.label || a.address}".`);
    if (this.addrEditing() === a.id) this.cancelAddress();
  }

  async makeDefault(a: CustomerAddress): Promise<void> {
    if (!(await this.attempt(() => this.svc.setDefaultAddress(this.id(), a.id)))) return;
    this.notice.set(`"${a.label || a.address}" là địa chỉ giao mặc định.`);
  }

  /** Runs a save; on failure shows why and answers false. */
  private async attempt(save: () => Promise<unknown>): Promise<boolean> {
    this.failure.set('');
    try {
      await save();
      return true;
    } catch (e) {
      this.failure.set(errorText(e));
      return false;
    }
  }
}
