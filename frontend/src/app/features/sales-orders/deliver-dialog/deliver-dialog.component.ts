import { Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataStore } from '../../../core/services/data-store.service';
import { SalesOrder } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { isoDay } from '../../../shared/period';
import { formatVnd } from '../../../shared/format.util';
import { round4 } from '../../purchase-orders/purchase-order.rules';
import { defaultWarehouse, lineRatio, lineRemaining, movesStock, orderTotals } from '../sales-order.rules';
import { SalesOrderService } from '../sales-order.service';
import { errorText } from '../../../core/api/api.service';

interface DeliverRow {
  lineIndex: number;
  productCode: string;
  productName: string;
  unit: string;
  ratio: number;
  ordered: number;
  delivered: number;
  remaining: number;
  quantity: number | null;
  warehouseId: string;
  stocked: boolean; // false = dịch vụ, không xuất kho
  valuePerUnit: number; // phải thu cho 1 ĐVT (sau chiết khấu, gồm thuế)
}

// "Giao hàng": khách thực nhận (toàn bộ hoặc một phần). Lập phiếu xuất kho theo kho; tồn kho
// giảm và công nợ phải thu ghi theo giá trị khách nhận (see SalesOrderService.deliver).
@Component({
  selector: 'app-deliver-dialog',
  standalone: true,
  imports: [FormsModule, NavIconComponent],
  templateUrl: './deliver-dialog.component.html',
  styleUrl: '../../purchase-orders/receive-goods-dialog/receive-goods-dialog.component.scss',
})
export class DeliverDialogComponent {
  readonly order = input.required<SalesOrder>();
  readonly delivered = output<string>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly rows = signal<DeliverRow[]>([]);
  readonly date = signal(isoDay(new Date()));
  /** Why the server refused the delivery (shown in the footer). */
  readonly error = signal('');
  readonly busy = signal(false);
  readonly note = signal('');
  readonly attempted = signal(false);
  readonly money = formatVnd;

  constructor(
    readonly data: DataStore,
    private readonly orders: SalesOrderService,
  ) {}

  open(): void {
    const o = this.order();
    const products = new Map(this.data.products().map((p) => [p.id, p]));
    const calc = orderTotals(o.lines, o.discountAmount).lines;
    this.rows.set(
      o.lines
        .map((l, lineIndex) => {
          const p = products.get(l.productId);
          const remaining = lineRemaining(l);
          return {
            lineIndex,
            productCode: p?.code ?? l.productId,
            productName: p?.name ?? '—',
            unit: l.unit || p?.baseUnit || '',
            ratio: lineRatio(l),
            ordered: l.quantity,
            delivered: l.receivedQuantity ?? 0,
            remaining,
            quantity: remaining,
            warehouseId: movesStock(p) ? l.warehouseId || defaultWarehouse(p) : '',
            stocked: movesStock(p),
            valuePerUnit: l.quantity > 0 ? calc[lineIndex].total / l.quantity : 0,
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

  patch(i: number, change: Partial<DeliverRow>): void {
    this.rows.update((rs) => rs.map((r, j) => (j === i ? { ...r, ...change } : r)));
  }

  deliverAll(): void {
    this.rows.update((rs) => rs.map((r) => ({ ...r, quantity: r.remaining })));
  }

  clearAll(): void {
    this.rows.update((rs) => rs.map((r) => ({ ...r, quantity: 0 })));
  }

  /** Tồn của hàng tại kho đã chọn, quy theo ĐVT của dòng. */
  available(r: DeliverRow): number | null {
    if (!r.stocked || !r.warehouseId) return null;
    const lv = this.data.stockLevels().find((s) => s.productId === this.productId(r) && s.warehouseId === r.warehouseId);
    return round4((lv?.quantity ?? 0) / r.ratio);
  }

  private productId(r: DeliverRow): string {
    return this.order().lines[r.lineIndex].productId;
  }

  rowError(r: DeliverRow): string {
    const q = r.quantity ?? 0;
    if (q < 0) return 'Không được âm';
    if (round4(q) > r.remaining) return `Tối đa ${r.remaining.toLocaleString('vi-VN')}`;
    if (q > 0 && r.stocked && !r.warehouseId) return 'Chọn kho xuất';
    return '';
  }

  /** Giao vượt tồn: allowed (stock may be recorded late) but flagged. */
  shortOf(r: DeliverRow): number {
    const a = this.available(r);
    return a !== null && (r.quantity ?? 0) > a ? round4((r.quantity ?? 0) - a) : 0;
  }

  readonly delivering = computed(() => this.rows().filter((r) => (r.quantity ?? 0) > 0));
  readonly value = computed(() => this.delivering().reduce((s, r) => s + Math.round((r.quantity ?? 0) * r.valuePerUnit), 0));
  readonly issues = computed(() => {
    const out: string[] = [];
    if (!this.date()) out.push('Chọn ngày giao');
    this.rows().forEach((r) => {
      const e = this.rowError(r);
      if (e) out.push(`${r.productCode}: ${e}`);
    });
    if (!this.delivering().length) out.push('Nhập số lượng giao cho ít nhất một dòng');
    return out;
  });

  async confirm(): Promise<void> {
    this.attempted.set(true);
    if (this.issues().length || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    let vouchers;
    try {
      vouchers = await this.orders.deliver(
        this.order().id,
        this.delivering().map((r) => ({ lineIndex: r.lineIndex, quantity: r.quantity ?? 0, warehouseId: r.warehouseId })),
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
    const pxk = vouchers.length ? `lập ${vouchers.map((v) => v.code).join(', ')} — ` : '';
    this.delivered.emit(`Đã giao hàng: ${pxk}tồn kho và công nợ phải thu đã cập nhật (+${formatVnd(this.value())}).`);
  }
}
