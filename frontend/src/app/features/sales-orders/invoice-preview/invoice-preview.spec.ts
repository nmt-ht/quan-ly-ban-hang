import { SalesOrder, SalesOrderLine } from '../../../core/models/domain.models';
import { saleTypeIssue } from '../sales-order.rules';
import { invoiceData } from './invoice-preview.component';

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
    const inv = invoiceData(order([
      line({ productId: 'a', quantity: 2, unitPrice: 100_000, discountAmount: 20_000, vatRate: 10 }),
      line({ productId: 'b', quantity: 1, unitPrice: 50_000, vatRate: 10 }),
    ], 30_000), name);
    expect(inv.rows.map((r) => [r.no, r.name, r.amount])).toEqual([
      [1, 'A', 200_000], [2, 'B', 50_000], [3, 'Chiết khấu thương mại', -50_000],
    ]);
    expect(inv.groups).toEqual([{ vatRate: 10, taxable: 200_000, vat: 20_000 }]);
    expect(inv).toMatchObject({ taxable: 200_000, vat: 20_000, total: 220_000 });
  });

  it('nhiều thuế suất: chiết khấu tách theo thuế suất; hàng tặng không thu tiền', () => {
    const inv = invoiceData(order([
      line({ productId: 'a', quantity: 1, unitPrice: 100_000, discountAmount: 10_000, vatRate: 10 }),
      line({ productId: 'b', quantity: 1, unitPrice: 100_000, vatRate: 8 }),
      line({ productId: 'c', quantity: 3, unitPrice: 5_000, discountAmount: 15_000, isGift: true, vatRate: 10 }),
    ]), name);
    expect(inv.rows.map((r) => [r.kind, r.amount, r.vatRate])).toEqual([
      ['goods', 100_000, 10], ['goods', 100_000, 8], ['gift', 0, null], ['discount', -10_000, 10],
    ]);
    expect(inv.rows[2].name).toContain('Hàng khuyến mại không thu tiền');
    expect(inv.groups).toEqual([{ vatRate: 10, taxable: 90_000, vat: 9_000 }, { vatRate: 8, taxable: 100_000, vat: 8_000 }]);
    expect(inv.total).toBe(207_000);
  });
});

describe('saleTypeIssue (frontend, như server)', () => {
  it('xuất khẩu chỉ nhận thuế 0% và ngoại tệ có tỷ giá', () => {
    expect(saleTypeIssue({ saleType: 'XUAT_KHAU', currency: 'USD', exchangeRate: 25_400, lines: [{ vatRate: 0 }] })).toBeNull();
    expect(saleTypeIssue({ saleType: 'XUAT_KHAU', lines: [{ vatRate: 8 }] })).toMatch(/0%/);
    expect(saleTypeIssue({ saleType: 'TRONG_NUOC', currency: 'EUR', lines: [] })).toMatch(/VND/);
  });
});
