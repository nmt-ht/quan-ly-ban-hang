import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { DataStore } from '../../../core/services/data-store.service';
import { SalesOrder, TripLoad } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { CopyButtonComponent } from '../../../shared/copy-button/copy-button.component';
import { MoneyInputDirective } from '../../../shared/money-input.directive';
import { foldVi, formatVnd } from '../../../shared/format.util';
import { formatDay } from '../../../shared/period';
import { DELIVERY_TRIP_STATUS_LABEL, SALES_ORDER_STATUS_LABEL, deliveryTripStatusClass, salesOrderStatusClass } from '../../../shared/status-labels';
import { round4 } from '../../purchase-orders/purchase-order.rules';
import { lineRatio, lineRemaining, movesStock } from '../../sales-orders/sales-order.rules';
import {
  canArrange, canCancel, canComplete, canConfirm, canEditCosts, canEditHeader, canLoadOrder, canReturn, canShip, costTotal,
  isConfirmed, remainingValue, unitValues,
} from '../delivery-trip.rules';
import { DeliveryTripService } from '../delivery-trip.service';
import { TripHeaderDialogComponent } from '../trip-header-dialog/trip-header-dialog.component';
import { PrintDocumentComponent } from '../../../shared/print/print-document.component';
import { AllowedLinkDirective } from '../../../shared/allowed-link.directive';
import { errorText } from '../../../core/api/api.service';
import { AuditHistoryComponent } from '../../../shared/audit/audit-history.component';

type Tab = 'don' | 'hang' | 'phieu' | 'chi-phi' | 'nhat-ky';
type PrintMode = 'soan' | 'giao' | null;

interface OrderRow {
  order: SalesOrder;
  customerName: string;
  recipient: string;
  phone: string;
  address: string;
  value: number; // giá trị trên chuyến
  received: number; // khách nhận (khi đã chốt)
  confirmed: boolean;
  outcome: string; // Nhận đủ / Nhận một phần / Trả toàn bộ
}

interface ConfirmRow {
  lineIndex: number;
  code: string;
  name: string;
  unit: string;
  loaded: number;
  received: number | null;
  unitValue: number;
}

// Chuyến giao hàng as one MISA-style chứng từ: header + summary, tabs (đơn trên chuyến · hàng trên
// xe · phiếu kho · chi phí), sticky action bar following the trip lifecycle, two printouts.
@Component({
  selector: 'app-delivery-trip-voucher',
  standalone: true,
  imports: [NgClass, FormsModule, RouterLink, AllowedLinkDirective, NavIconComponent, CopyButtonComponent, MoneyInputDirective, TripHeaderDialogComponent, PrintDocumentComponent, AuditHistoryComponent],
  templateUrl: './delivery-trip-voucher.component.html',
  styleUrls: [
    '../../../shared/voucher/voucher.scss',
    '../../purchase-orders/receive-goods-dialog/receive-goods-dialog.component.scss',
    './delivery-trip-voucher.component.scss',
  ],
})
export class DeliveryTripVoucherComponent {
  private readonly route = inject(ActivatedRoute);
  readonly data = inject(DataStore);
  private readonly svc = inject(DeliveryTripService);
  private readonly headerDialog = viewChild.required<TripHeaderDialogComponent>('headerDialog');
  private readonly addDialog = viewChild.required<ElementRef<HTMLDialogElement>>('addDialog');
  private readonly confirmDialog = viewChild.required<ElementRef<HTMLDialogElement>>('confirmDialog');

  readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: this.route.snapshot.paramMap.get('id') ?? '' });
  readonly trip = computed(() => this.data.deliveryTrips().find((t) => t.id === this.id()));

  readonly money = formatVnd;
  readonly day = formatDay;
  readonly statusLabel = DELIVERY_TRIP_STATUS_LABEL;
  readonly statusClass = deliveryTripStatusClass;
  readonly soLabel = SALES_ORDER_STATUS_LABEL;
  readonly soClass = salesOrderStatusClass;

  readonly tab = signal<Tab>('don');
  readonly notice = signal('');
  /** A step the server refused (or that could not reach it). */
  readonly failure = signal('');
  readonly printMode = signal<PrintMode>(null);
  readonly confirmCancel = signal(false);
  readonly cancelReason = signal('');

  // costs draft
  readonly fuel = signal<number | null>(null);
  readonly toll = signal<number | null>(null);
  readonly other = signal<number | null>(null);
  readonly costNote = signal('');

  constructor() {
    effect(() => {
      this.id();
      untracked(() => {
        const t = this.trip();
        this.notice.set((history.state as { notice?: string } | null)?.notice ?? '');
        this.tab.set('don');
        this.confirmCancel.set(false);
        this.loadCosts();
        void t;
      });
    });
  }

  private loadCosts(): void {
    const c = this.trip()?.costs;
    this.fuel.set(c?.fuel || null);
    this.toll.set(c?.toll || null);
    this.other.set(c?.other || null);
    this.costNote.set(c?.note ?? '');
  }

  private readonly orderById = computed(() => new Map(this.data.salesOrders().map((o) => [o.id, o])));
  private readonly productById = computed(() => new Map(this.data.products().map((p) => [p.id, p])));
  private readonly customerById = computed(() => new Map(this.data.customers().map((c) => [c.id, c])));

  warehouseName(id: string | undefined): string {
    return id ? this.data.warehouses().find((w) => w.id === id)?.name ?? id : '—';
  }

  userName(email: string | undefined): string {
    return (email && this.data.users().find((u) => u.email === email)?.name) || email || '—';
  }

  /** dd/mm/yyyy hh:mm in local time (stored timestamps are UTC ISO; demo ones are local without zone). */
  time(iso: string | undefined): string {
    if (!iso) return '—';
    if (iso.length <= 10) return formatDay(iso);
    const d = /[zZ]|[+-]\d\d:\d\d$/.test(iso) ? new Date(iso) : new Date(iso.replace('T', ' '));
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private partyOf(o: SalesOrder) {
    const c = this.customerById().get(o.customerId);
    const def = c?.addresses?.find((a) => a.isDefault);
    return {
      customerName: c ? c.companyName || c.name : o.customerId,
      recipient: o.recipientName || def?.recipientName || c?.name || '—',
      phone: o.recipientPhone || def?.phone || c?.phone || '',
      address: o.deliveryAddress || def?.address || '',
    };
  }

  // ---------- đơn trên chuyến ----------
  readonly rows = computed<OrderRow[]>(() => {
    const t = this.trip();
    if (!t) return [];
    return t.orderIds.flatMap((id) => {
      const o = this.orderById().get(id);
      if (!o) return [];
      const v = unitValues(o);
      const loads = this.svc.loadsOf(t, id);
      const value = loads.length ? Math.round(loads.reduce((s, l) => s + l.quantity * (v[l.lineIndex] ?? 0), 0)) : remainingValue(o);
      const conf = t.confirmations?.find((c) => c.orderId === id);
      const received = conf ? Math.round(conf.lines.reduce((s, r) => s + r.received * (v[r.lineIndex] ?? 0), 0)) : 0;
      const loadedQty = loads.reduce((s, l) => s + l.quantity, 0);
      const gotQty = conf ? conf.lines.reduce((s, r) => s + r.received, 0) : 0;
      const outcome = !conf ? '' : gotQty === 0 ? 'Trả toàn bộ' : round4(gotQty) >= round4(loadedQty) ? 'Nhận đủ' : 'Nhận một phần';
      return [{ order: o, ...this.partyOf(o), value, received, confirmed: !!conf, outcome }];
    });
  });

  readonly unconfirmed = computed(() => this.rows().filter((r) => !r.confirmed).length);

  // ---------- hàng trên xe (phiếu soạn hàng) ----------
  /** Loads, or (while gom đơn) what would be loaded now. */
  private readonly effectiveLoads = computed<TripLoad[]>(() => {
    const t = this.trip();
    if (!t) return [];
    if (t.loads?.length) return t.loads;
    return t.orderIds.flatMap((id) => {
      const o = this.orderById().get(id);
      if (!o) return [];
      return o.lines.flatMap((l, lineIndex) => {
        const q = lineRemaining(l);
        const p = this.productById().get(l.productId);
        return q > 0 ? [{ orderId: id, lineIndex, productId: l.productId, quantity: q, warehouseId: movesStock(p) ? l.warehouseId || p?.defaultWarehouseId : undefined }] : [];
      });
    });
  });

  /** Gom theo kho → mặt hàng, quy về ĐVT chính. */
  readonly picking = computed(() => {
    const byWh = new Map<string, Map<string, { qty: number; orders: Set<string> }>>();
    for (const l of this.effectiveLoads()) {
      if (!l.warehouseId) continue;
      const o = this.orderById().get(l.orderId);
      if (!o) continue;
      const m = byWh.get(l.warehouseId) ?? new Map();
      const e = m.get(l.productId) ?? { qty: 0, orders: new Set<string>() };
      e.qty = round4(e.qty + l.quantity * lineRatio(o.lines[l.lineIndex]));
      e.orders.add(o.code);
      m.set(l.productId, e);
      byWh.set(l.warehouseId, m);
    }
    return [...byWh].map(([wh, m]) => ({
      warehouseId: wh,
      items: [...m].map(([productId, e]) => {
        const p = this.productById().get(productId);
        const stock = this.data.stockLevels().find((s) => s.productId === productId && s.warehouseId === wh)?.quantity ?? 0;
        return { productId, code: p?.code ?? productId, name: p?.name ?? '—', unit: p?.baseUnit ?? '', qty: e.qty, orders: [...e.orders].join(', '), stock };
      }).sort((a, b) => a.code.localeCompare(b.code)),
    }));
  });

  readonly services = computed(() =>
    this.effectiveLoads().filter((l) => !l.warehouseId).flatMap((l) => {
      const o = this.orderById().get(l.orderId);
      if (!o) return []; // an order this user may not see (another seller's)
      const p = this.productById().get(l.productId);
      return [{ key: `${l.orderId}-${l.lineIndex}`, code: p?.code ?? '', name: p?.name ?? '', qty: l.quantity, unit: o.lines[l.lineIndex].unit, order: o.code }];
    }),
  );

  readonly vouchers = computed(() => (this.trip() ? this.svc.vouchersOf(this.trip()!) : []));

  // ---------- permissions ----------
  readonly can = computed(() => {
    const t = this.trip();
    if (!t) return null;
    return {
      header: canEditHeader(t), arrange: canArrange(t), ship: canShip(t), confirm: canConfirm(t), return: canReturn(t),
      complete: canComplete(t), cancel: canCancel(t), costs: canEditCosts(t),
    };
  });

  readonly costSum = computed(() => (this.fuel() ?? 0) + (this.toll() ?? 0) + (this.other() ?? 0));
  readonly costDirty = computed(() => {
    const c = this.trip()?.costs;
    return (this.fuel() ?? 0) !== (c?.fuel ?? 0) || (this.toll() ?? 0) !== (c?.toll ?? 0) || (this.other() ?? 0) !== (c?.other ?? 0) ||
      this.costNote().trim() !== (c?.note ?? '');
  });
  readonly savedCost = computed(() => costTotal(this.trip()?.costs));

  // ---------- actions ----------
  editHeader(): void {
    this.headerDialog().open(this.trip());
  }

  onHeaderSaved(msg: unknown): void {
    if (typeof msg === 'string') this.notice.set(msg);
  }

  /** Runs a step; on failure shows why and answers null. */
  private async attempt<T>(step: () => Promise<T>): Promise<T | null> {
    this.failure.set('');
    try {
      return await step();
    } catch (e) {
      this.failure.set(errorText(e));
      return null;
    }
  }

  private done = (p: Promise<unknown>) => p.then(() => true);

  async ship(): Promise<void> {
    const t = this.trip()!;
    const v = await this.attempt(() => this.svc.ship(t.id));
    if (!v) return;
    this.notice.set(`Đã xuất kho một lượt${v.length ? ` (${v.map((x) => x.code).join(', ')})` : ''} — ${t.orderIds.length} đơn chuyển sang Đang giao. Chốt giao từng đơn khi xe giao xong.`);
  }

  async returnToWarehouse(): Promise<void> {
    const v = await this.attempt(() => this.svc.returnToWarehouse(this.trip()!.id));
    if (!v) return;
    this.notice.set(v.length
      ? `Xe đã về kho — nhập lại hàng khách không nhận (${v.map((x) => x.code).join(', ')}).`
      : 'Xe đã về kho — khách nhận đủ, không có hàng mang về.');
    this.tab.set('phieu');
  }

  async complete(): Promise<void> {
    if (!(await this.attempt(() => this.done(this.svc.complete(this.trip()!.id))))) return;
    this.notice.set('Chuyến đã hoàn tất.');
  }

  async doCancel(): Promise<void> {
    const ok = await this.attempt(() => this.done(this.svc.cancel(this.trip()!.id, this.cancelReason())));
    this.confirmCancel.set(false);
    if (!ok) return;
    this.notice.set('Đã huỷ chuyến — các đơn đã gỡ khỏi chuyến, vẫn ở Chờ giao hàng.');
  }

  async removeOrder(r: OrderRow): Promise<void> {
    if (!(await this.attempt(() => this.done(this.svc.removeOrder(this.trip()!.id, r.order.id))))) return;
    this.notice.set(`Đã gỡ ${r.order.code} khỏi chuyến.`);
  }

  async saveCosts(): Promise<void> {
    const costs = this.svc.saveCosts(this.trip()!.id, { fuel: this.fuel() ?? 0, toll: this.toll() ?? 0, other: this.other() ?? 0, note: this.costNote() });
    if (!(await this.attempt(() => this.done(costs)))) return;
    this.notice.set(`Đã lưu chi phí chuyến: ${formatVnd(this.costSum())}.`);
  }

  async unconfirm(r: OrderRow): Promise<void> {
    if (!(await this.attempt(() => this.done(this.svc.unconfirm(this.trip()!.id, r.order.id))))) return;
    this.notice.set(`Đã bỏ chốt ${r.order.code} — đơn về Đang giao, công nợ ghi lúc chốt đã gỡ.`);
  }

  print(mode: Exclude<PrintMode, null>): void {
    this.printMode.set(mode);
    setTimeout(() => {
      window.print();
      this.printMode.set(null);
    });
  }

  // ---------- xếp đơn (dialog) ----------
  readonly addSearch = signal('');
  readonly addPicked = signal<string[]>([]);

  readonly candidates = computed(() => {
    const t = this.trip();
    if (!t) return [];
    const tripOf = (id: string | undefined) => (id ? this.data.deliveryTrips().find((x) => x.id === id) : undefined);
    const q = foldVi(this.addSearch().trim());
    return this.data.salesOrders()
      .filter((o) => !t.orderIds.includes(o.id) && canLoadOrder(o, tripOf))
      .map((o) => ({ order: o, ...this.partyOf(o), value: remainingValue(o) }))
      .filter((r) => !q || foldVi(`${r.order.code} ${r.customerName} ${r.recipient} ${r.address}`).includes(q))
      .sort((a, b) => (a.order.neededByDate ?? '9999').localeCompare(b.order.neededByDate ?? '9999') || a.order.code.localeCompare(b.order.code));
  });

  readonly pickedValue = computed(() => this.candidates().filter((c) => this.addPicked().includes(c.order.id)).reduce((s, c) => s + c.value, 0));

  openAdd(): void {
    this.addSearch.set('');
    this.addPicked.set([]);
    this.addDialog().nativeElement.showModal();
  }

  closeAdd(): void {
    this.addDialog().nativeElement.close();
  }

  togglePick(id: string): void {
    this.addPicked.update((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  pickAll(): void {
    const ids = this.candidates().map((c) => c.order.id);
    this.addPicked.set(this.addPicked().length === ids.length ? [] : ids);
  }

  async confirmAdd(): Promise<void> {
    this.closeAdd();
    const n = await this.attempt(() => this.svc.addOrders(this.trip()!.id, this.addPicked()));
    if (n) this.notice.set(`Đã xếp ${n} đơn lên chuyến.`);
  }

  // ---------- chốt giao (dialog) ----------
  readonly confirmOrder = signal<OrderRow | null>(null);
  readonly confirmRows = signal<ConfirmRow[]>([]);
  readonly confirmNote = signal('');
  readonly confirmAttempted = signal(false);

  openConfirm(r: OrderRow): void {
    const t = this.trip()!;
    const v = unitValues(r.order);
    this.confirmOrder.set(r);
    this.confirmRows.set(this.svc.loadsOf(t, r.order.id).map((l) => {
      const p = this.productById().get(l.productId);
      return {
        lineIndex: l.lineIndex, code: p?.code ?? '', name: p?.name ?? '—', unit: r.order.lines[l.lineIndex].unit,
        loaded: l.quantity, received: l.quantity, unitValue: v[l.lineIndex] ?? 0,
      };
    }));
    this.confirmNote.set('');
    this.confirmAttempted.set(false);
    this.confirmDialog().nativeElement.showModal();
  }

  closeConfirm(): void {
    this.confirmDialog().nativeElement.close();
  }

  setReceived(i: number, v: number | null): void {
    this.confirmRows.update((rs) => rs.map((r, j) => (j === i ? { ...r, received: v } : r)));
  }

  receiveAll(value: 'all' | 'none'): void {
    this.confirmRows.update((rs) => rs.map((r) => ({ ...r, received: value === 'all' ? r.loaded : 0 })));
  }

  rowError(r: ConfirmRow): string {
    const q = r.received ?? 0;
    if (q < 0) return 'Không được âm';
    if (round4(q) > r.loaded) return `Tối đa ${r.loaded.toLocaleString('vi-VN')}`;
    return '';
  }

  readonly confirmValue = computed(() => Math.round(this.confirmRows().reduce((s, r) => s + (r.received ?? 0) * r.unitValue, 0)));
  readonly confirmLoadedValue = computed(() => Math.round(this.confirmRows().reduce((s, r) => s + r.loaded * r.unitValue, 0)));
  readonly confirmIssue = computed(() => this.confirmRows().map((r) => this.rowError(r) && `${r.code}: ${this.rowError(r)}`).find(Boolean) ?? '');

  async doConfirm(): Promise<void> {
    this.confirmAttempted.set(true);
    if (this.confirmIssue()) return;
    const r = this.confirmOrder()!;
    this.closeConfirm();
    const lines = this.confirmRows().map((x) => ({ lineIndex: x.lineIndex, received: x.received ?? 0 }));
    if (!(await this.attempt(() => this.done(this.svc.confirm(this.trip()!.id, r.order.id, lines, this.confirmNote()))))) return;
    const v = this.confirmValue();
    this.notice.set(v
      ? `Đã chốt giao ${r.order.code}: khách nhận ${formatVnd(v)} — ghi công nợ phải thu.`
      : `Đã chốt ${r.order.code}: khách trả toàn bộ — hàng nhập lại kho khi xe về.`);
  }

  isConfirmed(orderId: string): boolean {
    const t = this.trip();
    return !!t && isConfirmed(t, orderId);
  }

  linesOf(o: SalesOrder) {
    const t = this.trip()!;
    const loads = this.svc.loadsOf(t, o.id);
    const src = loads.length ? loads : o.lines.map((l, lineIndex) => ({ lineIndex, quantity: lineRemaining(l), productId: l.productId }));
    return src.filter((l) => l.quantity > 0).map((l) => {
      const p = this.productById().get(l.productId);
      const line = o.lines[l.lineIndex];
      return { key: l.lineIndex, code: p?.code ?? '', name: p?.name ?? '', unit: line.unit, qty: l.quantity, price: line.unitPrice };
    });
  }
}
