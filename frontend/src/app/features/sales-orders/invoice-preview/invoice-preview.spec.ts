import { SalesOrder, SalesOrderLine } from '../../../core/models/domain.models';
import { deliverySlices, orderTotals, orderedSlices, receivedValueOf, saleTypeIssue } from '../sales-order.rules';
import { invoiceData, invoiceSources } from './invoice-preview.component';

const line = (over: Partial<SalesOrderLine>): SalesOrderLine => ({
  id: over.productId ?? 'l', productId: 'p', unit: 'Cái', quantity: 1, unitPrice: 0, lineTotal: 0, vatRate: 0, ...over,
});
const order = (lines: SalesOrderLine[], discountAmount = 0): SalesOrder => ({
  id: 'o', code: 'DH0000001', customerId: 'kh', tagIds: [], orderDate: '2026-10-26', status: 'CHO_GIAO_HANG', lines, discountAmount,
  totalGoods: 0, totalOrder: 0, salesRep: '', createdBy: '', receivedValue: 0,
});
const name = (id: string) => id.toUpperCase();

describe('invoiceData (xem trước hoá đơn GTGT)', () => {
  it('một thuế suất: thành tiền = SL × đơn giá, chiết khấu thành một dòng âm, tổng khớp đơn', () => {
    const o = order([
      line({ productId: 'a', quantity: 2, unitPrice: 100_000, discountAmount: 20_000, vatRate: 10 }),
      line({ productId: 'b', quantity: 1, unitPrice: 50_000, vatRate: 10 }),
    ], 30_000);
    const inv = invoiceData(o, orderedSlices(o), name);
    expect(inv.rows.map((r) => [r.no, r.name, r.amount])).toEqual([
      [1, 'A', 200_000], [2, 'B', 50_000], [3, 'Chiết khấu thương mại', -50_000],
    ]);
    expect(inv.groups).toEqual([{ vatRate: 10, taxable: 200_000, vat: 20_000 }]);
    expect(inv).toMatchObject({ taxable: 200_000, vat: 20_000, total: 220_000 });
  });

  it('nhiều thuế suất: chiết khấu tách theo thuế suất; hàng tặng không thu tiền', () => {
    const o = order([
      line({ productId: 'a', quantity: 1, unitPrice: 100_000, discountAmount: 10_000, vatRate: 10 }),
      line({ productId: 'b', quantity: 1, unitPrice: 100_000, vatRate: 8 }),
      line({ productId: 'c', quantity: 3, unitPrice: 5_000, discountAmount: 15_000, isGift: true, vatRate: 10 }),
    ]);
    const inv = invoiceData(o, orderedSlices(o), name);
    expect(inv.rows.map((r) => [r.kind, r.amount, r.vatRate])).toEqual([
      ['goods', 100_000, 10], ['goods', 100_000, 8], ['gift', 0, null], ['discount', -10_000, 10],
    ]);
    expect(inv.rows[2].name).toContain('Hàng khuyến mại không thu tiền');
    expect(inv.groups).toEqual([{ vatRate: 10, taxable: 90_000, vat: 9_000 }, { vatRate: 8, taxable: 100_000, vat: 8_000 }]);
    expect(inv.total).toBe(207_000);
  });
});

describe('hoá đơn theo đợt giao', () => {
  // 3 × 33.333 (CK dòng 1.000) và 1 × 50.001, chiết khấu cả đơn 7.777: số lẻ để thấy cách làm tròn.
  const lines = [
    line({ id: 'la', productId: 'a', quantity: 3, unitPrice: 33_333, discountAmount: 1_000, vatRate: 10 }),
    line({ id: 'lb', productId: 'b', quantity: 1, unitPrice: 50_001, vatRate: 8 }),
  ];
  // Giá trị khách nhận khi đã nhận (a, b) — what the server stored as each đợt's amount.
  const valueAt = (a: number, b: number) =>
    receivedValueOf({ discountAmount: 7_777, lines: [{ ...lines[0], receivedQuantity: a }, { ...lines[1], receivedQuantity: b }] });
  const delivered = (deliveries: SalesOrder['deliveries']): SalesOrder => ({
    ...order([{ ...lines[0], receivedQuantity: 3 }, { ...lines[1], receivedQuantity: 1 }], 7_777), deliveries,
  });

  it('mỗi đợt một hoá đơn, đúng số tiền đợt đã ghi công nợ; các đợt cộng lại bằng cả đơn', () => {
    const o = delivered([
      { id: 'd1', date: '2026-10-20', amount: valueAt(1, 1), lines: [{ orderLineId: 'la', quantity: 1 }, { orderLineId: 'lb', quantity: 1 }] },
      { id: 'd2', date: '2026-10-22', amount: valueAt(3, 1) - valueAt(1, 1), lines: [{ orderLineId: 'la', quantity: 2 }] },
    ]);
    const [i1, i2] = ['d1', 'd2'].map((id) => invoiceData(o, deliverySlices(o, id), name));
    expect(i1.total).toBe(o.deliveries![0].amount);
    expect(i2.total).toBe(o.deliveries![1].amount);
    expect(i2.rows.filter((r) => r.kind === 'goods').map((r) => [r.name, r.quantity])).toEqual([['A', 2]]);
    const whole = orderTotals(o.lines, o.discountAmount);
    expect(i1.total + i2.total).toBe(whole.total);
    expect(i1.vat + i2.vat).toBe(whole.vat);
    expect(i1.taxable + i2.taxable).toBe(whole.lines.reduce((s, c) => s + c.taxable, 0));
  });

  it('đợt cũ chưa có chi tiết dòng không làm lệch đợt sau', () => {
    const o = delivered([
      { id: 'old', date: '2026-10-20', amount: valueAt(1, 1), lines: [] },
      { id: 'd2', date: '2026-10-22', amount: valueAt(3, 1) - valueAt(1, 1), lines: [{ orderLineId: 'la', quantity: 2 }] },
    ]);
    expect(deliverySlices(o, 'd2')).toEqual([{ index: 0, before: 1, quantity: 2 }]);
    expect(invoiceData(o, deliverySlices(o, 'd2'), name).total).toBe(o.deliveries![1].amount);
    const sources = invoiceSources(o);
    expect(sources.map((s) => [s.key, s.date])).toEqual([['d2', '2026-10-22']]);
    expect(sources[0].label.startsWith('Đợt 2 · 22/10/2026')).toBe(true);
  });

  it('chưa có đợt chi tiết: hàng đã giao gộp một hoá đơn; chưa giao thì theo số đặt', () => {
    expect(invoiceSources(delivered([]))[0]).toMatchObject({ key: 'received' });
    expect(invoiceSources(order(lines, 7_777))[0]).toMatchObject({ key: 'ordered', date: '2026-10-26' });
  });
});

describe('saleTypeIssue (frontend, như server)', () => {
  it('xuất khẩu chỉ nhận thuế 0% và ngoại tệ có tỷ giá', () => {
    expect(saleTypeIssue({ saleType: 'XUAT_KHAU', currency: 'USD', exchangeRate: 25_400, lines: [{ vatRate: 0 }] })).toBeNull();
    expect(saleTypeIssue({ saleType: 'XUAT_KHAU', lines: [{ vatRate: 8 }] })).toMatch(/0%/);
    expect(saleTypeIssue({ saleType: 'TRONG_NUOC', currency: 'EUR', lines: [] })).toMatch(/VND/);
  });
});
