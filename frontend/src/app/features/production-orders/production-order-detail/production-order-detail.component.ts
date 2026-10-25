import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { DataStore } from '../../../core/services/data-store.service';
import { CostService } from '../../../core/services/cost.service';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { CopyButtonComponent } from '../../../shared/copy-button/copy-button.component';
import { formatQty, formatVnd } from '../../../shared/format.util';
import { formatDay, isoDay } from '../../../shared/period';
import { tagClass } from '../../../shared/tag-class';
import { PRODUCTION_ORDER_STATUS_LABEL, productionOrderStatusClass } from '../../../shared/status-labels';
import { round4 } from '../../purchase-orders/purchase-order.rules';
import { SalesOrderService } from '../../sales-orders/sales-order.service';
import { WarehouseVoucherService } from '../../warehouse-vouchers/warehouse-voucher.service';
import { errorText } from '../../../core/api/api.service';
import { VOUCHER_KIND_LABEL, kindOf } from '../../warehouse-vouchers/warehouse-voucher.rules';
import { canCancelLsx, canComplete, canStart, isLate } from '../production-order.rules';
import { AllowedLinkDirective } from '../../../shared/allowed-link.directive';
import { AuditHistoryComponent } from '../../../shared/audit/audit-history.component';
import { FrozenColsDirective } from '../../../shared/frozen-cols.directive';

// Xuất vật tư happens before nhập thành phẩm on the same day.
const STEP: Record<string, number> = { XUAT: 0, NHAP: 1, CHUYEN: 2, KIEM_KE: 3 };

// Lệnh sản xuất: định mức chụp lúc lập, xuất vật tư khi bắt đầu, nhập số thực làm được khi hoàn tất.
@Component({
  selector: 'app-production-order-detail',
  standalone: true,
  imports: [FrozenColsDirective, NgClass, FormsModule, RouterLink, AllowedLinkDirective, NavIconComponent, CopyButtonComponent, AuditHistoryComponent],
  templateUrl: './production-order-detail.component.html',
  styleUrls: ['../../../shared/voucher/voucher.scss', './production-order-detail.component.scss'],
})
export class ProductionOrderDetailComponent {
  private readonly route = inject(ActivatedRoute);
  readonly data = inject(DataStore);
  private readonly orders = inject(SalesOrderService);
  // Đơn cũ hơn 90 ngày không nạp sẵn (Pha 1.1): đọc các đơn màn hình này cần.
  private readonly loadOrders = effect(() => {
    const id = this.data.productionOrders().find((x) => x.id === this.id())?.sourceOrderId;
    if (id) untracked(() => void this.orders.ensureMany([id]));
  });
  private readonly stock = inject(WarehouseVoucherService);
  readonly cost = inject(CostService);

  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: this.route.snapshot.paramMap.get('id') ?? '' });

  readonly lsx = computed(() => this.data.productionOrders().find((x) => x.id === this.id()));
  readonly product = computed(() => this.data.products().find((p) => p.id === this.lsx()?.productId));
  readonly order = computed(() => this.data.salesOrders().find((o) => o.id === this.lsx()?.sourceOrderId));
  readonly customer = computed(() => this.data.customers().find((c) => c.id === this.order()?.customerId));
  readonly statusLabel = computed(() => (this.lsx() ? PRODUCTION_ORDER_STATUS_LABEL[this.lsx()!.status] : ''));
  readonly statusClass = computed(() => (this.lsx() ? productionOrderStatusClass(this.lsx()!.status) : ''));
  readonly late = computed(() => !!this.lsx() && isLate(this.lsx()!, this.order(), isoDay(new Date())));
  readonly canStart = computed(() => !!this.lsx() && canStart(this.lsx()!));
  readonly canComplete = computed(() => !!this.lsx() && canComplete(this.lsx()!));
  readonly canCancel = computed(() => !!this.lsx() && canCancelLsx(this.lsx()!));

  readonly day = formatDay;
  readonly money = formatVnd;
  readonly qty = formatQty;
  readonly kindLabel = (v: Parameters<typeof kindOf>[0]) => VOUCHER_KIND_LABEL[kindOf(v)];
  readonly kindClass = (v: Parameters<typeof kindOf>[0]) => tagClass('warehouse-voucher', kindOf(v));

  readonly notice = signal('');
  /** A save the server refused (or that could not reach it). */
  readonly failure = signal('');
  readonly mode = signal<'' | 'complete' | 'cancel'>('');
  readonly produced = signal<number | null>(null);
  readonly cancelReason = signal('');

  constructor() {
    effect(() => {
      this.id();
      untracked(() => {
        this.mode.set('');
        this.notice.set('');
        this.cancelReason.set('');
      });
    });
  }

  /** Định mức theo bản chụp, nhân số lượng lệnh; tồn tính ở kho ngầm định của vật tư (kho sẽ xuất). */
  readonly bom = computed(() => {
    const x = this.lsx();
    if (!x) return [];
    const issued = new Map<string, number>();
    for (const v of this.vouchers()) if (v.type === 'XUAT' && !v.isCancelled) for (const l of v.lines ?? []) issued.set(l.productId, round4((issued.get(l.productId) ?? 0) + l.quantity));
    return this.orders.bomOf(x).map((b, i) => {
      const p = this.data.products().find((q) => q.id === b.componentId);
      const wh = p?.defaultWarehouseId ?? this.data.warehouses()[0]?.id ?? '';
      const need = round4(b.quantityPerUnit * x.quantity);
      const onHand = this.stock.stockAt(b.componentId, wh);
      const price = this.cost.costOf(b.componentId);
      return {
        i, p, per: b.quantityPerUnit, need, wh: this.data.warehouses().find((w) => w.id === wh)?.name ?? '—', onHand,
        short: x.status === 'NHAP' ? round4(Math.max(0, need - onHand)) : 0, issued: issued.get(b.componentId) ?? 0, value: Math.round(need * price),
      };
    });
  });
  readonly shortCount = computed(() => this.bom().filter((b) => b.short > 0).length);
  readonly materialCost = computed(() => this.bom().reduce((s, b) => s + b.value, 0));
  readonly unitCost = computed(() => {
    const x = this.lsx();
    const qty = x?.status === 'HOAN_TAT' ? x.producedQuantity ?? x.quantity : x?.quantity ?? 0;
    return qty > 0 ? Math.round(this.materialCost() / qty) : 0;
  });

  // Phiếu kho of an older lệnh are read on demand (Pha 1.1).
  private readonly loadVouchers = effect(() => {
    const x = this.lsx();
    if (x) untracked(() => void this.stock.ensureOf(x.id, x.code));
  });

  readonly vouchers = computed(() => {
    const x = this.lsx();
    if (!x) return [];
    return this.data.warehouseVouchers()
      .filter((v) => v.productionOrderId === x.id || (!v.productionOrderId && (v.reason ?? '').includes(x.code)))
      .sort((a, b) => a.date.localeCompare(b.date) || STEP[a.type] - STEP[b.type] || a.code.localeCompare(b.code));
  });

  warehouseName(id: string): string {
    return this.data.warehouses().find((w) => w.id === id)?.name ?? id;
  }

  userName(email: string | undefined): string {
    return (email && this.data.users().find((u) => u.email === email)?.name) || email || '—';
  }

  async start(): Promise<void> {
    const x = this.lsx()!;
    const v = await this.attempt(() => this.orders.startProduction(x.id));
    if (!v) return;
    this.notice.set(`${x.code} đang sản xuất${v.length ? ` — đã xuất vật tư (${v.map((p) => p.code).join(', ')})` : ' — chưa có định mức nên không xuất vật tư'}.`);
  }

  openComplete(): void {
    this.produced.set(this.lsx()!.quantity);
    this.mode.set('complete');
  }

  async complete(): Promise<void> {
    const x = this.lsx()!;
    const qty = this.produced() ?? 0;
    const v = await this.attempt(() => this.orders.completeProduction(x.id, qty));
    if (!v) return;
    this.mode.set('');
    this.notice.set(v.length
      ? `${x.code} hoàn tất — đã nhập ${qty.toLocaleString('vi-VN')} ${this.product()?.baseUnit ?? ''} vào kho thành phẩm (${v.map((p) => p.code).join(', ')}).`
      : `${x.code} hoàn tất — không có thành phẩm đạt nên không nhập kho.`);
  }

  async cancel(): Promise<void> {
    const x = this.lsx()!;
    const wasRunning = x.status === 'DANG_SAN_XUAT';
    if ((await this.attempt(() => this.orders.cancelProduction(x.id, this.cancelReason()).then(() => true))) === null) return;
    this.mode.set('');
    this.notice.set(`Đã huỷ ${x.code}.${wasRunning ? ' Vật tư đã xuất không tự nhập lại — lập phiếu nhập kho nếu còn dùng được.' : ''}`);
  }

  /** Runs a save; on failure shows why and answers null. */
  private async attempt<T>(save: () => Promise<T>): Promise<T | null> {
    this.failure.set('');
    try {
      return await save();
    } catch (e) {
      this.failure.set(errorText(e));
      return null;
    }
  }
}
