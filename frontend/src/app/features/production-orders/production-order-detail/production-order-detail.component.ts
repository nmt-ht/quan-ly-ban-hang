import { ConfirmService } from '../../../shared/confirm/confirm.service';
import { Component, computed, effect, inject, untracked } from '@angular/core';
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
import { VOUCHER_KIND_LABEL, kindOf } from '../../warehouse-vouchers/warehouse-voucher.rules';
import { canCancelLsx, canComplete, canStart, isLate, productionSteps } from '../production-order.rules';
import { StatusStepsComponent } from '../../../shared/status-steps/status-steps.component';
import { AllowedLinkDirective } from '../../../shared/allowed-link.directive';
import { AuditHistoryComponent } from '../../../shared/audit/audit-history.component';
import { FrozenColsDirective } from '../../../shared/frozen-cols.directive';
import { ToastService } from '../../../core/services/toast.service';

// Xuất vật tư happens before nhập thành phẩm on the same day.
const STEP: Record<string, number> = { XUAT: 0, NHAP: 1, CHUYEN: 2, KIEM_KE: 3 };

// Lệnh sản xuất: định mức chụp lúc lập, xuất vật tư khi bắt đầu, nhập số thực làm được khi hoàn tất.
@Component({
  selector: 'app-production-order-detail',
  standalone: true,
  imports: [FrozenColsDirective, StatusStepsComponent, NgClass, FormsModule, RouterLink, AllowedLinkDirective, NavIconComponent, CopyButtonComponent, AuditHistoryComponent],
  templateUrl: './production-order-detail.component.html',
  styleUrls: ['../../../shared/voucher/voucher.scss', './production-order-detail.component.scss'],
})
export class ProductionOrderDetailComponent {
  protected readonly toast = inject(ToastService);
  private readonly dialogs = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  readonly data = inject(DataStore);
  private readonly orders = inject(SalesOrderService);
  // Lệnh (và đơn gốc) cũ hơn 90 ngày không nạp sẵn (Pha 1.1): đọc khi mở thẳng màn hình này.
  private readonly loadLsx = effect(() => {
    const id = this.id();
    if (id) untracked(() => void this.orders.ensureManyLsx([id]));
  });
  private readonly loadOrders = effect(() => {
    const id = this.data.productionOrders().find((x) => x.id === this.id())?.sourceOrderId;
    if (id) untracked(() => void this.orders.ensureMany([id]));
  });
  private readonly stock = inject(WarehouseVoucherService);
  readonly cost = inject(CostService);

  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: this.route.snapshot.paramMap.get('id') ?? '' });

  readonly steps = computed(() => productionSteps(this.lsx()?.status ?? 'HUY'));
  readonly lsx = computed(() => this.data.productionOrders().find((x) => x.id === this.id()));
  readonly product = computed(() => this.data.products().find((p) => p.id === this.lsx()?.productId));
  readonly order = computed(() => this.data.salesOrders().find((o) => o.id === this.lsx()?.sourceOrderId));
  readonly customer = computed(() => this.data.customers().find((c) => c.id === this.order()?.customerId));
  readonly statusLabel = computed(() => (this.lsx() ? PRODUCTION_ORDER_STATUS_LABEL[this.lsx()!.status] : ''));
  readonly statusClass = computed(() => (this.lsx() ? productionOrderStatusClass(this.lsx()!.status) : ''));
  /** Đơn gốc chỉ đọc, sent with the lệnh: what the xưởng sees when it may not open the đơn. */
  readonly source = computed(() => this.lsx()?.sourceOrder);
  readonly late = computed(() => !!this.lsx() && isLate(this.lsx()!, this.order() ?? this.source(), isoDay(new Date())));
  readonly canStart = computed(() => !!this.lsx() && canStart(this.lsx()!));
  readonly canComplete = computed(() => !!this.lsx() && canComplete(this.lsx()!));
  readonly canCancel = computed(() => !!this.lsx() && canCancelLsx(this.lsx()!));

  readonly day = formatDay;
  readonly money = formatVnd;
  readonly qty = formatQty;
  readonly kindLabel = (v: Parameters<typeof kindOf>[0]) => VOUCHER_KIND_LABEL[kindOf(v)];
  readonly kindClass = (v: Parameters<typeof kindOf>[0]) => tagClass('warehouse-voucher', kindOf(v));

  /** A save the server refused (or that could not reach it). */
  /** Ngày bắt đầu / nghiệm thu — ngày của phiếu xuất vật tư / nhập thành phẩm; hôm nay unless changed. */
  readonly today = isoDay(new Date());

  constructor() {
    effect(() => {
      this.id();
      untracked(() => {
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

  /** Bắt đầu sản xuất: the dialog asks for the day (the phiếu xuất vật tư is dated with it) and does the work. */
  async openStart(): Promise<void> {
    const x = this.lsx();
    if (!x) return;
    let issued: { code: string }[] = [];
    const done = await this.dialogs.form({
      title: `Bắt đầu ${x.code}?`, message: 'Xuất vật tư theo định mức; phiếu xuất ghi ngày dưới đây.',
      confirmLabel: 'Bắt đầu và xuất vật tư', cancelLabel: 'Để sau', tone: 'primary',
      fields: [{ key: 'date', label: 'Ngày bắt đầu', type: 'date', required: true, value: this.today, max: this.today }],
      run: async (v) => { issued = await this.orders.startProduction(x.id, v['date']); },
    });
    if (done) this.toast.success(`${x.code} đang sản xuất${issued.length ? ` — đã xuất vật tư (${issued.map((p) => p.code).join(', ')})` : ' — chưa có định mức nên không xuất vật tư'}.`);
  }

  /** Hoàn tất: the số thực làm được and the nghiệm thu day, then the phiếu nhập thành phẩm. */
  async openComplete(): Promise<void> {
    const x = this.lsx();
    if (!x) return;
    const unit = this.product()?.baseUnit ?? '';
    let received: { code: string }[] = [];
    let qty = 0;
    const done = await this.dialogs.form({
      title: `Hoàn tất ${x.code}?`, message: 'Nhập số thành phẩm đạt để nhập Kho thành phẩm.',
      confirmLabel: 'Hoàn tất và nhập kho', cancelLabel: 'Để sau', tone: 'primary',
      fields: [
        { key: 'qty', label: `Số thực làm được (${unit})`, type: 'number', required: true, value: String(x.quantity),
          hint: `Số lệnh là ${x.quantity.toLocaleString('vi-VN')}. Ít hơn thì phần hỏng tính vào giá thành; đơn bán có thể cần lập lệnh bổ sung.` },
        { key: 'date', label: 'Ngày nghiệm thu', type: 'date', required: true, value: this.today, min: x.startDate ?? undefined, max: this.today },
      ],
      run: async (v) => {
        qty = Number(v['qty'].replace(',', '.'));
        if (!Number.isFinite(qty) || qty < 0) throw new Error('Số thực làm được phải là số, không âm.');
        received = await this.orders.completeProduction(x.id, qty, v['date']);
      },
    });
    if (done) {
      this.toast.success(received.length
        ? `${x.code} hoàn tất — đã nhập ${qty.toLocaleString('vi-VN')} ${unit} vào kho thành phẩm (${received.map((p) => p.code).join(', ')}).`
        : `${x.code} hoàn tất — không có thành phẩm đạt nên không nhập kho.`);
    }
  }

  async askCancel(): Promise<void> {
    const x = this.lsx();
    if (!x) return;
    const wasRunning = x.status === 'DANG_SAN_XUAT';
    const done = await this.dialogs.form({
      title: `Huỷ ${x.code}?`,
      message: wasRunning ? 'Vật tư đã xuất không tự nhập lại — lập phiếu nhập kho nếu còn dùng được.' : 'Lệnh nháp chưa đụng tới kho.',
      confirmLabel: 'Huỷ lệnh', cancelLabel: 'Không huỷ', tone: 'danger',
      fields: [{ key: 'reason', label: 'Lý do huỷ', type: 'textarea', placeholder: 'Không bắt buộc', maxLength: 300 }],
      run: (v) => this.orders.cancelProduction(x.id, v['reason']),
    });
    if (done) this.toast.success(`Đã huỷ ${x.code}.${wasRunning ? ' Vật tư đã xuất không tự nhập lại — lập phiếu nhập kho nếu còn dùng được.' : ''}`);
  }
}
