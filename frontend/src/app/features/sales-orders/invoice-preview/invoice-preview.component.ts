import { Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { SalesOrder } from '../../../core/models/domain.models';
import { DataStore } from '../../../core/services/data-store.service';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { PrintMenuComponent } from '../../../shared/print/print-menu.component';
import { vndInWords } from '../../../shared/vnd-words';
import { foreignCurrency } from '../sales-order.rules';
import { invoiceData, invoiceSources } from '../invoice.rules';

export { invoiceData, invoiceSources };
export type { InvoiceData, InvoiceRateGroup, InvoiceRow, InvoiceSource } from '../invoice.rules';

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

  readonly sources = computed(() => invoiceSources(this.order()));
  /** Đợt đang xem; null = đợt mới nhất. */
  readonly sourceKey = signal<string | null>(null);
  readonly source = computed(() => {
    const list = this.sources();
    // Mặc định: the latest hoá đơn bán, not a hoá đơn điều chỉnh (those follow the sale sources).
    return list.find((s) => s.key === this.sourceKey()) ?? list.filter((s) => !s.adjust).at(-1)!; // saleSources always gives one
  });

  readonly invoice = computed(() => {
    const products = new Map(this.data.products().map((p) => [p.id, p.name]));
    const o = this.order();
    const rate = foreignCurrency(o.currency) && (o.exchangeRate ?? 0) > 0 ? o.exchangeRate : null;
    return invoiceData(o, this.source().slices, (id) => products.get(id) ?? id, this.source().adjust ? -1 : 1, rate);
  });
  readonly multiRate = computed(() => this.invoice().groups.length > 1);
  /** Hoá đơn trước điều chỉnh: the đợt giao (or whole đơn) the hàng trả came from — the reference the adjustment names. */
  readonly adjusted = computed(() => {
    const sales = this.sources().filter((s) => !s.adjust);
    const day = this.source().date.slice(0, 10);
    return sales.filter((s) => s.date.slice(0, 10) <= day).at(-1) ?? sales[0];
  });
  readonly abs = Math.abs;

  /** Ngày lập: ngày khách nhận hàng của đợt (thời điểm chuyển giao hàng hoá), chưa giao thì ngày đặt. */
  readonly dateParts = computed(() => {
    const [y, m, d] = this.source().date.slice(0, 10).split('-');
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
    return { code, rate };
  });

  /** VND in whole đồng; nguyên tệ to the cent. */
  money(n: number | null): string {
    return n === null ? '' : n.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  }

  open(): void {
    this.sourceKey.set(null);
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
