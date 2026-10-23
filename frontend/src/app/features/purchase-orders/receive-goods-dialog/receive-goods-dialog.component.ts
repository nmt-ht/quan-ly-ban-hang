import { Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataStore } from '../../../core/services/data-store.service';
import { PurchaseOrder } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { isoDay } from '../../../shared/period';
import { formatVnd } from '../../../shared/format.util';
import { lineRemaining, round4 } from '../purchase-order.rules';
import { PurchaseOrderService } from '../purchase-order.service';
import { errorText } from '../../../core/api/api.service';

interface ReceiveRow {
  lineIndex: number;
  productCode: string;
  productName: string;
  unit: string;
  ordered: number;
  received: number;
  remaining: number;
  quantity: number | null;
  warehouseId: string;
  unitPrice: number;
  vatRate: number;
}

// "Nhận hàng": record goods arriving for a purchase order (all or part). Writes a phiếu nhập
// kho per warehouse; stock and công nợ phải trả follow (see PurchaseOrderService.receive).
@Component({
  selector: 'app-receive-goods-dialog',
  standalone: true,
  imports: [FormsModule, NavIconComponent],
  templateUrl: './receive-goods-dialog.component.html',
  styleUrl: './receive-goods-dialog.component.scss',
})
export class ReceiveGoodsDialogComponent {
  readonly order = input.required<PurchaseOrder>();
  readonly received = output<string>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly rows = signal<ReceiveRow[]>([]);
  readonly date = signal(isoDay(new Date()));
  /** Why the server refused the receipt (shown in the footer). */
  readonly error = signal('');
  readonly busy = signal(false);
  readonly note = signal('');
  readonly attempted = signal(false);
  readonly money = formatVnd;

  constructor(
    readonly data: DataStore,
    private readonly orders: PurchaseOrderService,
  ) {}

  open(): void {
    const products = new Map(this.data.products().map((p) => [p.id, p]));
    const firstWh = this.data.warehouses()[0]?.id ?? '';
    this.rows.set(
      this.order().lines
        .map((l, lineIndex) => {
          const p = products.get(l.productId);
          return {
            lineIndex,
            productCode: p?.code ?? l.productId,
            productName: p?.name ?? '—',
            unit: l.unitName ?? p?.baseUnit ?? '',
            ordered: l.quantity,
            received: l.receivedQuantity,
            remaining: lineRemaining(l),
            quantity: lineRemaining(l),
            warehouseId: l.warehouseId ?? p?.defaultWarehouseId ?? firstWh,
            unitPrice: l.unitPrice,
            vatRate: l.vatRate ?? 0,
          };
        })
        .filter((r) => r.remaining > 0),
    );
    this.date.set(isoDay(new Date()));
    this.note.set('');
    this.attempted.set(false);
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  patch(i: number, change: Partial<ReceiveRow>): void {
    this.rows.update((rs) => rs.map((r, j) => (j === i ? { ...r, ...change } : r)));
  }

  receiveAll(): void {
    this.rows.update((rs) => rs.map((r) => ({ ...r, quantity: r.remaining })));
  }

  clearAll(): void {
    this.rows.update((rs) => rs.map((r) => ({ ...r, quantity: 0 })));
  }

  rowError(r: ReceiveRow): string {
    const q = r.quantity ?? 0;
    if (q < 0) return 'Không được âm';
    if (round4(q) > r.remaining) return `Tối đa ${r.remaining.toLocaleString('vi-VN')}`;
    if (q > 0 && !r.warehouseId) return 'Chọn kho';
    return '';
  }

  readonly receiving = computed(() => this.rows().filter((r) => (r.quantity ?? 0) > 0));
  readonly value = computed(() =>
    this.receiving().reduce((s, r) => s + Math.round((r.quantity ?? 0) * r.unitPrice * (1 + r.vatRate / 100)), 0),
  );
  readonly issues = computed(() => {
    const out: string[] = [];
    if (!this.date()) out.push('Chọn ngày nhận');
    this.rows().forEach((r) => {
      const e = this.rowError(r);
      if (e) out.push(`${r.productCode}: ${e}`);
    });
    if (!this.receiving().length) out.push('Nhập số lượng nhận cho ít nhất một dòng');
    return out;
  });

  async confirm(): Promise<void> {
    this.attempted.set(true);
    if (this.issues().length || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    let vouchers;
    try {
      vouchers = await this.orders.receive(
        this.order().id,
        this.receiving().map((r) => ({ lineIndex: r.lineIndex, quantity: r.quantity ?? 0, warehouseId: r.warehouseId })),
        this.date(),
        this.note().trim(),
      );
    } catch (e) {
      this.error.set(errorText(e));
      return;
    } finally {
      this.busy.set(false);
    }
    this.close();
    this.received.emit(
      `Đã nhận hàng: lập ${vouchers.map((v) => v.code).join(', ')} — tồn kho và công nợ phải trả đã cập nhật (+${formatVnd(this.value())}).`,
    );
  }
}
