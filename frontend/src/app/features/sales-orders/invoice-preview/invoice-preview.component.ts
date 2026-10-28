import { Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { SalesOrder } from '../../../core/models/domain.models';
import { DataStore } from '../../../core/services/data-store.service';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { PrintMenuComponent } from '../../../shared/print/print-menu.component';
import { vndInWords } from '../../../shared/vnd-words';
import { LineSlice, deliverySlices, foreignCurrency, orderedSlices, receivedSlices, sliceCalc } from '../sales-order.rules';

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
  /** Hoá đơn bằng ngoại tệ: every số tiền above is nguyên tệ; this is the tổng thanh toán quy đổi ra VND. */
  vndTotal?: number;
}

/**
 * Hoá đơn GTGT dựng từ đơn bán (như MISA dựng hoá đơn từ chứng từ bán hàng): `slices` là phần của từng dòng trên hoá
 * đơn — một đợt giao (thời điểm chuyển giao hàng hoá, NĐ 123), hoặc cả đơn khi chưa giao. Thành tiền = SL × đơn giá
 * chưa thuế; chiết khấu (dòng + cả đơn) ghi thành dòng "Chiết khấu thương mại" âm theo từng thuế suất; hàng tặng ghi
 * số lượng, thành tiền 0. Tiền thuế lấy đúng phần của đơn, nên tổng thanh toán khớp số tiền đợt đã ghi công nợ.
 * `sign` -1: hoá đơn điều chỉnh giảm (hàng trả lại) — every số lượng and số tiền negative, as the điều chỉnh is shown.
 */
export function invoiceData(
  o: SalesOrder, slices: LineSlice[], productName: (id: string) => string, sign: 1 | -1 = 1, fxRate?: number | null,
): InvoiceData {
  const calc = sliceCalc(o, slices).map((c) => ({
    gross: sign * c.gross, lineDiscount: sign * c.lineDiscount, orderDiscount: sign * c.orderDiscount, taxable: sign * c.taxable, vat: sign * c.vat, total: sign * c.total,
  }));
  const rows: InvoiceRow[] = [];
  const groups = new Map<number, InvoiceRateGroup & { discount: number }>();
  slices.forEach((s, i) => {
    const l = o.lines[s.index];
    const c = calc[i];
    const size = l.length && l.width ? ` (${l.length}×${l.width} cm)` : '';
    const name = productName(l.productId) + size;
    if (l.isGift) {
      rows.push({ no: 0, name: `${name} (Hàng khuyến mại không thu tiền)`, unit: l.unit, quantity: sign * s.quantity, unitPrice: null, amount: 0, vatRate: null, kind: 'gift' });
      return;
    }
    const rate = l.vatRate ?? 0;
    rows.push({ no: 0, name, unit: l.unit, quantity: sign * s.quantity, unitPrice: l.unitPrice, amount: c.gross, vatRate: rate, kind: 'goods' });
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
  const data: InvoiceData = {
    rows,
    groups: sorted.map(({ vatRate, taxable, vat }) => ({ vatRate, taxable, vat })),
    taxable: calc.reduce((s, c) => s + c.taxable, 0),
    vat: calc.reduce((s, c) => s + c.vat, 0),
    total: calc.reduce((s, c) => s + c.total, 0),
  };
  return fxRate ? inForeignCurrency(o, slices, data, fxRate) : data;
}

/**
 * Hoá đơn của đơn thu bằng ngoại tệ (as MISA): đơn giá in nguyên tệ (as typed on the dòng, else VND ÷ tỷ giá), every
 * số tiền in nguyên tệ to the cent, and the tổng thanh toán quy đổi ra VND kept beside it.
 */
function inForeignCurrency(o: SalesOrder, slices: LineSlice[], d: InvoiceData, rate: number): InvoiceData {
  const fx = (n: number) => Math.round((n / rate) * 100) / 100;
  let goods = 0;
  return {
    rows: d.rows.map((r) => {
      if (r.kind === 'discount') return { ...r, amount: fx(r.amount) };
      const l = o.lines[slices[goods++].index]; // goods and gift rows follow the slices, in order
      if (r.kind === 'gift') return r;
      const unitPrice = l.unitPriceFx ?? fx(l.unitPrice);
      return { ...r, unitPrice, amount: Math.round((r.quantity ?? 0) * unitPrice * 100) / 100 };
    }),
    groups: d.groups.map((g) => ({ ...g, taxable: fx(g.taxable), vat: fx(g.vat) })),
    taxable: fx(d.taxable), vat: fx(d.vat), total: fx(d.total), vndTotal: d.total,
  };
}

/** Một hoá đơn có thể dựng từ đơn: một đợt giao, hàng đã giao gộp lại, cả đơn theo số đặt, hoặc một phiếu trả hàng. */
export interface InvoiceSource {
  key: string;
  label: string;
  date: string; // ngày lập: ngày khách nhận hàng của đợt; chưa giao thì ngày đặt; trả hàng thì ngày trả
  slices: LineSlice[];
  /** Hoá đơn điều chỉnh giảm cho hàng khách trả lại (phiếu TH…): số âm, ghi lý do và chứng từ gốc. */
  adjust?: { code: string; reason: string };
}

const dmy = (d: string) => d.slice(0, 10).split('-').reverse().join('/');

/**
 * Mỗi đợt giao có chi tiết dòng là một hoá đơn. Đơn chỉ có đợt ghi trước khi có chi tiết: hàng đã giao gộp một hoá
 * đơn, ngày giao gần nhất. Chưa giao: cả đơn theo số đặt, ngày đặt.
 */
export function invoiceSources(o: SalesOrder): InvoiceSource[] {
  return [...saleSources(o), ...returnSources(o)];
}

/**
 * Hàng trả lại giảm doanh thu và thuế đã kê khai: a hoá đơn điều chỉnh giảm per phiếu trả hàng chưa huỷ (NĐ 123, sửa
 * đổi bởi NĐ 70/2025), dated the ngày trả. Its tiền equal the phiếu's giá trị (phần của từng dòng theo số trả).
 */
function returnSources(o: SalesOrder): InvoiceSource[] {
  return (o.returns ?? []).filter((r) => !r.isCancelled).map((r) => ({
    key: r.id, label: `Điều chỉnh giảm · ${r.code} · ${dmy(r.date)} · −${r.amount.toLocaleString('vi-VN')} ₫`, date: r.date,
    slices: r.lines.flatMap((x) => {
      const index = o.lines.findIndex((l) => l.id === x.orderLineId);
      return index < 0 || !(x.quantity > 0) ? [] : [{ index, before: 0, quantity: x.quantity }];
    }),
    adjust: { code: r.code, reason: r.reason },
  }));
}

function saleSources(o: SalesOrder): InvoiceSource[] {
  const all = o.deliveries ?? [];
  const detailed = all.flatMap((d, i) =>
    d.lines.length
      ? [{ key: d.id, label: `Đợt ${i + 1} · ${dmy(d.date)} · ${d.amount.toLocaleString('vi-VN')} ₫`, date: d.date, slices: deliverySlices(o, d.id) }]
      : [],
  );
  if (detailed.length) return detailed;
  const received = receivedSlices(o);
  if (received.length) return [{ key: 'received', label: 'Hàng đã giao', date: o.deliveredDate ?? o.orderDate, slices: received }];
  return [{ key: 'ordered', label: 'Theo số đặt (đơn chưa giao)', date: o.orderDate, slices: orderedSlices(o) }];
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

  readonly sources = computed(() => invoiceSources(this.order()));
  /** Đợt đang xem; null = đợt mới nhất. */
  readonly sourceKey = signal<string | null>(null);
  readonly source = computed(() => {
    const list = this.sources();
    return list.find((s) => s.key === this.sourceKey()) ?? list[list.length - 1];
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
    return sales.filter((s) => s.date <= this.source().date).at(-1) ?? sales[0];
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
