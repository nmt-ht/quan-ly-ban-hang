import { Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { SalesOrder } from '../../../core/models/domain.models';
import { DataStore } from '../../../core/services/data-store.service';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { PrintMenuComponent } from '../../../shared/print/print-menu.component';
import { vndInWords } from '../../../shared/vnd-words';
import { foreignCurrency, orderTotals } from '../sales-order.rules';

/** One row of the goods table: hàng hoá, hàng khuyến mại or a chiết khấu thương mại row (negative). */
export interface InvoiceRow {
  no: number;
  name: string;
  unit: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number;
  vatRate: number | null;
  kind: 'goods' | 'gift' | 'discount';
}

/** Tổng hợp theo một thuế suất. */
export interface InvoiceRateGroup {
  vatRate: number;
  taxable: number;
  vat: number;
}

export interface InvoiceData {
  rows: InvoiceRow[];
  groups: InvoiceRateGroup[];
  taxable: number;
  vat: number;
  total: number;
}

/**
 * Hoá đơn GTGT dựng từ đơn bán (như MISA dựng hoá đơn từ chứng từ bán hàng): thành tiền = SL × đơn giá chưa thuế;
 * chiết khấu (dòng + cả đơn) ghi thành dòng "Chiết khấu thương mại" âm theo từng thuế suất; hàng tặng ghi số lượng,
 * thành tiền 0. Tiền thuế lấy đúng số trên đơn, nên tổng thanh toán khớp đơn.
 */
export function invoiceData(o: SalesOrder, productName: (id: string) => string): InvoiceData {
  const t = orderTotals(o.lines, o.discountAmount);
  const rows: InvoiceRow[] = [];
  const groups = new Map<number, InvoiceRateGroup & { discount: number }>();
  o.lines.forEach((l, i) => {
    const c = t.lines[i];
    const size = l.length && l.width ? ` (${l.length}×${l.width} cm)` : '';
    const name = productName(l.productId) + size;
    if (l.isGift) {
      rows.push({ no: 0, name: `${name} (Hàng khuyến mại không thu tiền)`, unit: l.unit, quantity: l.quantity, unitPrice: null, amount: 0, vatRate: null, kind: 'gift' });
      return;
    }
    const rate = l.vatRate ?? 0;
    rows.push({ no: 0, name, unit: l.unit, quantity: l.quantity, unitPrice: l.unitPrice, amount: c.gross, vatRate: rate, kind: 'goods' });
    const g = groups.get(rate) ?? { vatRate: rate, taxable: 0, vat: 0, discount: 0 };
    g.taxable += c.taxable;
    g.vat += c.vat;
    g.discount += c.lineDiscount + c.orderDiscount;
    groups.set(rate, g);
  });
  const sorted = [...groups.values()].sort((a, b) => b.vatRate - a.vatRate);
  for (const g of sorted) {
    if (!g.discount) continue;
    const name = sorted.length > 1 ? `Chiết khấu thương mại (hàng thuế suất ${g.vatRate}%)` : 'Chiết khấu thương mại';
    rows.push({ no: 0, name, unit: '', quantity: null, unitPrice: null, amount: -g.discount, vatRate: g.vatRate, kind: 'discount' });
  }
  rows.forEach((r, i) => (r.no = i + 1));
  return {
    rows,
    groups: sorted.map(({ vatRate, taxable, vat }) => ({ vatRate, taxable, vat })),
    taxable: t.lines.reduce((s, c) => s + c.taxable, 0),
    vat: t.vat,
    total: t.total,
  };
}

// "Xem trước hoá đơn" của đơn bán: hoá đơn GTGT (mẫu số 1) theo Nghị định 123/2020 và Thông tư 78/2021, dựng từ đơn và
// thông tin công ty. Chỉ để xem / in thử — không phát hành, không gọi dịch vụ hoá đơn điện tử: chưa có ký hiệu đăng ký,
// số hoá đơn, mã của cơ quan thuế hay chữ ký số. Đơn xuất khẩu ghi thêm tiếng Anh trong ngoặc và tỷ giá quy đổi.
// In: (printing) báo màn hình đơn hàng ẩn bản in đơn trong lúc in hoá đơn.
@Component({
  selector: 'app-invoice-preview',
  standalone: true,
  imports: [NgTemplateOutlet, NavIconComponent, PrintMenuComponent],
  templateUrl: './invoice-preview.component.html',
  styleUrl: './invoice-preview.component.scss',
})
export class InvoicePreviewComponent {
  private readonly data = inject(DataStore);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly order = input.required<SalesOrder>();
  readonly printing = output<boolean>();
  readonly printNow = signal(false);

  readonly company = computed(() => this.data.companyInfo());
  readonly customer = computed(() => this.data.customers().find((c) => c.id === this.order().customerId));
  readonly exportSale = computed(() => this.order().saleType === 'XUAT_KHAU');
  readonly words = vndInWords;

  readonly invoice = computed(() => {
    const products = new Map(this.data.products().map((p) => [p.id, p.name]));
    return invoiceData(this.order(), (id) => products.get(id) ?? id);
  });
  readonly multiRate = computed(() => this.invoice().groups.length > 1);

  /** Ngày lập: ngày khách nhận hàng (thời điểm chuyển giao hàng hoá), chưa giao thì ngày đặt. */
  readonly dateParts = computed(() => {
    const [y, m, d] = (this.order().deliveredDate ?? this.order().orderDate).slice(0, 10).split('-');
    return { d, m, y };
  });
  /** Mẫu số 1 = hoá đơn GTGT; C = có mã của cơ quan thuế; 2 số cuối của năm; T = doanh nghiệp đăng ký dùng. */
  readonly serial = computed(() => `1C${this.dateParts().y.slice(2)}T··`);

  readonly buyer = computed(() => {
    const o = this.order();
    const c = this.customer();
    const address = [...(c?.addresses ?? [])].sort((a, b) => Number(b.isDefault) - Number(a.isDefault))[0]?.address;
    const company = c?.companyName?.trim();
    return {
      person: company ? o.recipientName || '' : c?.name ?? '',
      company: company ?? '',
      taxCode: c?.companyTaxCode || c?.personalTaxCode || '',
      idNumber: company ? '' : c?.idNumber ?? '',
      address: address || o.deliveryAddress || '',
    };
  });

  /** Hình thức thanh toán: theo tài khoản "Thu tiền ngay"; chưa định thì TM/CK như mẫu MISA. */
  readonly payment = computed(() => {
    const id = this.order().payNowAccountId;
    const a = id ? this.data.cashAccounts().find((x) => x.id === id) : undefined;
    return a ? (a.type === 'NGAN_HANG' ? 'Chuyển khoản' : 'Tiền mặt') : 'TM/CK';
  });

  /** Tài khoản ngân hàng của người bán in trên hoá đơn: tài khoản mặc định, không thì tài khoản ngân hàng đầu tiên. */
  readonly sellerBank = computed(() => {
    const banks = this.data.cashAccounts().filter((a) => a.type === 'NGAN_HANG' && a.isActive !== false && a.accountNumber);
    const a = banks.find((x) => x.isDefault) ?? banks[0];
    return a ? `${a.accountNumber}${a.bankName ? ' — ' + a.bankName : ''}` : '';
  });

  /** Thu bằng ngoại tệ: tỷ giá và tổng thanh toán quy đổi. */
  readonly foreign = computed(() => {
    const o = this.order();
    const code = foreignCurrency(o.currency);
    const rate = o.exchangeRate ?? 0;
    if (!code || rate <= 0) return null;
    const amount = this.invoice().total / rate;
    return { code, rate, amount: amount.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) };
  });

  money(n: number | null): string {
    return n === null ? '' : n.toLocaleString('vi-VN');
  }

  open(): void {
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  beforePrint(): void {
    this.printNow.set(true);
    this.printing.emit(true);
  }

  afterPrint(): void {
    this.printNow.set(false);
    this.printing.emit(false);
  }
}
