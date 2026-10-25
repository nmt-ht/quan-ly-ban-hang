import { Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataStore } from '../../../core/services/data-store.service';
import { AuthService } from '../../../core/services/auth.service';
import { PurchaseOrder } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { isoDay } from '../../../shared/period';
import { formatVnd } from '../../../shared/format.util';
import { seesPurchasePrices } from '../../../core/auth/purchase-prices';
import { round4 } from '../purchase-order.rules';
import { PurchaseOrderService } from '../purchase-order.service';
import { errorText } from '../../../core/api/api.service';
import { FrozenColsDirective } from '../../../shared/frozen-cols.directive';
import { PickableWarehousesPipe } from '../../../shared/pickable-warehouses.pipe';

interface ReturnRow {
  lineId: string;
  productCode: string;
  productName: string;
  unit: string;
  received: number;
  returned: number;
  /** Còn trả được = đã nhận − đã trả (phiếu chưa huỷ). */
  left: number;
  quantity: number | null;
  stocked: boolean; // false = dịch vụ: không xuất kho, chỉ giảm công nợ
  warehouseId: string;
  valuePerUnit: number; // đơn giá × (1 + VAT) — the server fixes the exact amount
}

/** Common reasons, offered as suggestions — any text is accepted. */
const REASONS = ['Hàng lỗi, kém chất lượng', 'Giao sai mẫu / quy cách', 'Giao thừa so với đơn', 'Nhận nhầm'];

// "Trả lại hàng mua" (as MISA): trả nhà cung cấp một phần hàng đã nhận. Hàng xuất khỏi một kho theo giá mua, giá trị
// trả (gồm thuế) giảm công nợ phải trả vào ngày trả (see PurchaseOrderService.createReturn).
@Component({
  selector: 'app-purchase-return-dialog',
  standalone: true,
  imports: [PickableWarehousesPipe, FrozenColsDirective, FormsModule, NavIconComponent],
  templateUrl: './purchase-return-dialog.component.html',
  styleUrl: '../receive-goods-dialog/receive-goods-dialog.component.scss',
})
export class PurchaseReturnDialogComponent {
  readonly order = input.required<PurchaseOrder>();
  readonly returned = output<string>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly auth = inject(AuthService);
  /** Giá trị trả only for roles that see giá nhập. */
  readonly prices = seesPurchasePrices((c) => this.auth.can(c));

  readonly reasons = REASONS;
  readonly rows = signal<ReturnRow[]>([]);
  readonly date = signal(isoDay(new Date()));
  readonly warehouseId = signal('');
  readonly reason = signal('');
  readonly note = signal('');
  readonly error = signal('');
  readonly busy = signal(false);
  readonly attempted = signal(false);
  readonly money = formatVnd;
  readonly today = isoDay(new Date());

  constructor(
    readonly data: DataStore,
    private readonly orders: PurchaseOrderService,
  ) {}

  open(): void {
    const o = this.order();
    const products = new Map(this.data.products().map((p) => [p.id, p]));
    const back = new Map<string, number>();
    for (const r of o.returns ?? []) if (!r.isCancelled) for (const l of r.lines) back.set(l.orderLineId, round4((back.get(l.orderLineId) ?? 0) + l.quantity));
    const rows = o.lines
      .map((l): ReturnRow => {
        const p = products.get(l.productId);
        const received = l.receivedQuantity ?? 0;
        const returned = back.get(l.id ?? '') ?? 0;
        return {
          lineId: l.id ?? '', productCode: p?.code ?? l.productId, productName: p?.name ?? '—', unit: l.unitName || p?.baseUnit || '',
          received, returned, left: round4(received - returned), quantity: null, stocked: p?.type !== 'DICH_VU',
          warehouseId: l.warehouseId || p?.defaultWarehouseId || '', valuePerUnit: (l.unitPrice ?? 0) * (1 + (l.vatRate ?? 0) / 100),
        };
      })
      .filter((r) => r.left > 0);
    this.rows.set(rows);
    const first = rows.find((r) => r.stocked)?.warehouseId ?? '';
    this.warehouseId.set(this.data.warehouses().some((w) => w.id === first && w.isActive !== false) ? first : '');
    this.date.set(this.today);
    this.reason.set('');
    this.note.set('');
    this.error.set('');
    this.attempted.set(false);
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  patch(i: number, change: Partial<ReturnRow>): void {
    this.rows.update((rs) => rs.map((r, j) => (j === i ? { ...r, ...change } : r)));
  }

  returnAll(): void {
    this.rows.update((rs) => rs.map((r) => ({ ...r, quantity: r.left })));
  }

  rowError(r: ReturnRow): string {
    const q = r.quantity ?? 0;
    if (q < 0) return 'Không được âm';
    if (round4(q) > r.left) return `Tối đa ${r.left.toLocaleString('vi-VN')}`;
    return '';
  }

  lineValue(r: ReturnRow): number {
    return Math.round((r.quantity ?? 0) * r.valuePerUnit);
  }

  readonly returning = computed(() => this.rows().filter((r) => (r.quantity ?? 0) > 0));
  readonly needsWarehouse = computed(() => this.returning().some((r) => r.stocked));
  readonly value = computed(() => this.returning().reduce((s, r) => s + this.lineValue(r), 0));
  readonly issues = computed(() => {
    const out: string[] = [];
    if (!this.date()) out.push('Chọn ngày trả');
    else if (this.date() > this.today) out.push('Ngày trả không được sau hôm nay');
    if (!this.reason().trim()) out.push('Nhập lý do trả hàng');
    this.rows().forEach((r) => {
      const e = this.rowError(r);
      if (e) out.push(`${r.productCode}: ${e}`);
    });
    if (!this.returning().length) out.push('Nhập số lượng trả cho ít nhất một dòng');
    if (this.needsWarehouse() && !this.warehouseId()) out.push('Chọn kho xuất trả');
    return out;
  });

  async confirm(): Promise<void> {
    this.attempted.set(true);
    if (this.issues().length || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    let r;
    try {
      r = await this.orders.createReturn(this.order().id, {
        date: this.date(),
        // Only dịch vụ returned: no stock moves, the server still wants a kho — any kho in use.
        warehouseId: this.warehouseId() || (this.data.warehouses().find((w) => w.isActive !== false)?.id ?? ''),
        reason: this.reason().trim(),
        note: this.note().trim() || undefined,
        lines: this.returning().map((x) => ({ orderLineId: x.lineId, quantity: x.quantity ?? 0 })),
      });
    } catch (e) {
      this.error.set(errorText(e));
      return;
    } finally {
      this.busy.set(false);
    }
    this.close();
    const pxk = r.voucherCode ? `, xuất kho bằng ${r.voucherCode}` : '';
    this.returned.emit(`Đã lập phiếu trả lại hàng mua ${r.code}${pxk}` + (r.amount !== null ? ` — công nợ phải trả giảm ${formatVnd(r.amount)}.` : '.'));
  }
}
