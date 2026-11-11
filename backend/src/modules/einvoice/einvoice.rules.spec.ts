import { describe, expect, it } from 'vitest';
import { invoiceData } from '../sales/invoice.rules.js';
import { buyerIssue, buyerOf, canMove, isLive, partnerKey, seriesIssue, toProviderInvoice, vatCode } from './einvoice.rules.js';

describe('hoá đơn điện tử: quy tắc', () => {
  it('ký hiệu: đúng dạng, đúng năm của ngày lập', () => {
    expect(seriesIssue('C26TAA', '2026-11-11')).toBeNull();
    expect(seriesIssue('K26TNT', '2026-01-02')).toBeNull();
    expect(seriesIssue('C25TAA', '2026-01-02')).toContain('năm 2026');
    expect(seriesIssue('C26XAA', '2026-01-02')).toContain('không đúng dạng');
    expect(seriesIssue('c26taa', '2026-01-02')).toContain('không đúng dạng');
    expect(seriesIssue(null, '2026-01-02')).toContain('Chưa đặt');
  });

  it('người mua: tổ chức cần MST và địa chỉ; cá nhân không cần; định dạng MST / CCCD', () => {
    const org = buyerOf({ name: 'Anh Nam', companyName: 'Cty A', companyTaxCode: ' 0101234567 ', address: 'Hà Nội' });
    expect(org.taxCode).toBe('0101234567');
    expect(buyerIssue(org)).toBeNull();
    expect(buyerIssue({ ...org, taxCode: '' })).toContain('cần mã số thuế');
    expect(buyerIssue({ ...org, address: '' })).toContain('địa chỉ');
    expect(buyerIssue({ ...org, taxCode: '0101234567-001' })).toBeNull();
    expect(buyerIssue({ ...org, taxCode: '12345' })).toContain('không hợp lệ');
    const person = buyerOf({ name: 'Chị Lan', personalTaxCode: '', idNumber: '001203004005' });
    expect(buyerIssue(person)).toBeNull();
    expect(buyerIssue({ ...person, idNumber: '123' })).toContain('CCCD');
    expect(buyerIssue(buyerOf({ name: '' }))).toBeNull();
    expect(buyerIssue({ ...person, email: 'x@y' })).toContain('Email');
  });

  it('khoá chống trùng: ổn định theo đơn / phần / loại / lần, khác nhau giữa các phần', () => {
    const a = partnerKey('DH0000012', { deliveryId: 'aaaaaaaa-1111' }, 'ORIGINAL', 1);
    expect(a).toBe('DH0000012-Daaaaaaaa-O1');
    expect(partnerKey('DH0000012', { deliveryId: 'aaaaaaaa-1111' }, 'ORIGINAL', 1)).toBe(a);
    expect(partnerKey('DH0000012', { deliveryId: 'aaaaaaaa-1111' }, 'ORIGINAL', 2)).not.toBe(a);
    expect(partnerKey('DH0000012', {}, 'ORIGINAL', 1)).toBe('DH0000012-ALL-O1');
    expect(partnerKey('DH0000012', { returnId: 'bbbbbbbb-2' }, 'ADJUST', 1)).toBe('DH0000012-Rbbbbbbbb-A1');
  });

  it('trạng thái: đã phát hành chỉ có thể bị thay thế; lỗi không còn sống', () => {
    expect(canMove('PENDING', 'ISSUED')).toBe(true);
    expect(canMove('PENDING', 'FAILED')).toBe(true);
    expect(canMove('ISSUED', 'FAILED')).toBe(false);
    expect(canMove('ISSUED', 'REPLACED')).toBe(true);
    expect(canMove('FAILED', 'ISSUED')).toBe(false);
    expect(isLive('FAILED')).toBe(false);
    expect(isLive('ISSUED')).toBe(true);
    expect(isLive('PENDING')).toBe(true);
  });

  it('thuế suất: chỉ 0, 5, 8, 10', () => {
    expect(vatCode(8)).toBe('8');
    expect(vatCode(null)).toBeNull();
    expect(() => vatCode(7)).toThrow('7%');
  });

  it('dựng hoá đơn gửi nhà cung cấp: hàng, khuyến mại, chiết khấu; tổng khớp bản xem trước', () => {
    const line = (id: string, over: object) => ({
      id, productId: id, unit: 'Cái', quantity: 2, unitPrice: 100_000, vatRate: 10, receivedQuantity: 2, ratioToBase: 1, ...over,
    });
    const order = { lines: [line('a', { discountAmount: 10_000 }), line('b', { isGift: true, unitPrice: 0 }), line('c', { vatRate: 8 })], discountAmount: 0 };
    const d = invoiceData(order, [0, 1, 2].map((index) => ({ index, before: 0, quantity: 2 })), (id) => `Hàng ${id}`);
    const p = toProviderInvoice(d, {
      key: 'k', kind: 'ORIGINAL', templateCode: '1', series: 'C26TAA', issueDate: '2026-11-11', currency: 'VND', exchangeRate: 1,
      buyer: buyerOf({ name: 'Khách' }),
    });
    expect(p.lines.map((l) => [l.nature, l.vat, l.amount])).toEqual([[1, '10', 200_000], [2, null, 0], [1, '8', 200_000], [3, '10', -10_000]]);
    expect(p.total).toBe(d.total);
    expect(p.totalVnd).toBe(d.total);
    expect(p.groups).toEqual([{ vat: '10', taxable: 190_000, vatAmount: 19_000 }, { vat: '8', taxable: 200_000, vatAmount: 16_000 }]);
  });
});
