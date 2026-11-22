import { Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataStore } from '../../../core/services/data-store.service';
import { SalesOrder } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { isoDay } from '../../../shared/period';
import { formatVnd } from '../../../shared/format.util';
import { SalesOrderService } from '../sales-order.service';
import { errorText } from '../../../core/api/api.service';
import { FrozenColsDirective } from '../../../shared/frozen-cols.directive';
import { DateInputDirective } from '../../../shared/date-input/date-input.directive';
import { MoneyInputDirective } from '../../../shared/money-input.directive';

interface AllowanceRow {
  lineId: string;
  productCode: string;
  productName: string;
  unit: string;
  vatRate: number;
  /** Còn giảm được (chưa thuế) = phần khách đã nhận − đã trả hàng − đã giảm giá (phiếu chưa huỷ), from the server. */
  max: number;
  taxable: number | null;
}

/** Common reasons, offered as suggestions — any text is accepted. */
const REASONS = ['Hàng xước, lỗi nhẹ vẫn dùng được', 'Giao chậm', 'Sai lệch quy cách, kích thước', 'Chiết khấu cho khách quen'];

// "Giảm giá hàng bán": hạ giá phần hàng khách đã nhận, không có hàng đi hay về. Giá trị giảm (chưa thuế, rồi cộng thuế theo thuế
// suất của dòng) giảm công nợ phải thu, doanh thu và thuế GTGT đầu ra vào ngày lập (see SalesOrderService.createAllowance).
@Component({
  selector: 'app-allowance-dialog',
  standalone: true,
  imports: [DateInputDirective, MoneyInputDirective, FrozenColsDirective, FormsModule, NavIconComponent],
  templateUrl: './allowance-dialog.component.html',
  styleUrl: '../../purchase-orders/receive-goods-dialog/receive-goods-dialog.component.scss',
})
export class AllowanceDialogComponent {
  readonly order = input.required<SalesOrder>();
  readonly allowed = output<string>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly reasons = REASONS;
  readonly rows = signal<AllowanceRow[]>([]);
  readonly date = signal(isoDay(new Date()));
  readonly reason = signal('');
  readonly note = signal('');
  readonly error = signal('');
  readonly busy = signal(false);
  readonly loading = signal(false);
  readonly attempted = signal(false);
  readonly money = formatVnd;
  readonly today = isoDay(new Date());

  constructor(
    readonly data: DataStore,
    private readonly orders: SalesOrderService,
  ) {}

  async open(): Promise<void> {
    const o = this.order();
    const products = new Map(this.data.products().map((p) => [p.id, p]));
    this.rows.set([]);
    this.date.set(this.today);
    this.reason.set('');
    this.note.set('');
    this.error.set('');
    this.attempted.set(false);
    this.loading.set(true);
    this.dialog().nativeElement.showModal();
    try {
      const limits = new Map((await this.orders.allowanceLimits(o.id)).map((x) => [x.orderLineId, x.max]));
      this.rows.set(
        o.lines
          .map((l): AllowanceRow => {
            const p = products.get(l.productId);
            return {
              lineId: l.id ?? '', productCode: p?.code ?? l.productId, productName: p?.name ?? '—', unit: l.unit || p?.baseUnit || '',
              vatRate: l.vatRate ?? 0, max: limits.get(l.id ?? '') ?? 0, taxable: null,
            };
          })
          .filter((r) => r.max > 0),
      );
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.loading.set(false);
    }
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  patch(i: number, taxable: number | null): void {
    this.rows.update((rs) => rs.map((r, j) => (j === i ? { ...r, taxable } : r)));
  }

  rowError(r: AllowanceRow): string {
    const t = r.taxable ?? 0;
    if (t < 0) return 'Không được âm';
    if (t > r.max) return `Tối đa ${formatVnd(r.max)}`;
    return '';
  }

  vatOf(r: AllowanceRow): number {
    return Math.round(((r.taxable ?? 0) * r.vatRate) / 100);
  }

  readonly giving = computed(() => this.rows().filter((r) => (r.taxable ?? 0) > 0));
  readonly taxable = computed(() => this.giving().reduce((s, r) => s + (r.taxable ?? 0), 0));
  readonly vat = computed(() => this.giving().reduce((s, r) => s + this.vatOf(r), 0));
  readonly value = computed(() => this.taxable() + this.vat());
  readonly issues = computed(() => {
    const out: string[] = [];
    if (!this.date()) out.push('Chọn ngày giảm giá');
    else if (this.date() > this.today) out.push('Ngày giảm giá không được sau hôm nay');
    if (!this.reason().trim()) out.push('Nhập lý do giảm giá');
    this.rows().forEach((r) => {
      const e = this.rowError(r);
      if (e) out.push(`${r.productCode}: ${e}`);
    });
    if (!this.giving().length) out.push('Nhập số tiền giảm cho ít nhất một dòng');
    return out;
  });

  async confirm(): Promise<void> {
    this.attempted.set(true);
    if (this.issues().length || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    let r;
    try {
      r = await this.orders.createAllowance(this.order().id, {
        date: this.date(),
        reason: this.reason().trim(),
        note: this.note().trim() || undefined,
        lines: this.giving().map((x) => ({ orderLineId: x.lineId, taxable: x.taxable ?? 0 })),
      });
    } catch (e) {
      this.error.set(errorText(e));
      return;
    } finally {
      this.busy.set(false);
    }
    this.close();
    this.allowed.emit(`Đã lập phiếu giảm giá ${r.code} — công nợ phải thu giảm ${formatVnd(r.amount)}, doanh thu giảm ${formatVnd(r.taxable)} (chưa thuế).`);
  }
}
