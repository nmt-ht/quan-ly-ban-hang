import { describe, expect, it } from 'vitest';
import { taxBreakdownOf } from './purchase-order.rules.js';

describe('taxBreakdownOf', () => {
  it('gom chưa thuế và thuế theo từng thuế suất', () => {
    // 1.000.000 @10% + 500.000 @8% → công nợ 1.100.000 + 540.000 = 1.640.000
    const b = taxBreakdownOf([{ goods: 1_000_000, rate: 10 }, { goods: 500_000, rate: 8 }], 1_640_000);
    expect(b).toEqual([{ rate: 8, taxable: 500_000, vat: 40_000 }, { rate: 10, taxable: 1_000_000, vat: 100_000 }]);
  });

  it('cộng các dòng cùng thuế suất vào một nhóm', () => {
    const b = taxBreakdownOf([{ goods: 300_000, rate: 10 }, { goods: 700_000, rate: 10 }], 1_100_000);
    expect(b).toEqual([{ rate: 10, taxable: 1_000_000, vat: 100_000 }]);
  });

  it('dồn chênh lệch làm tròn vào nhóm thuế suất cao nhất để tổng thuế khớp bút toán 133', () => {
    // Công nợ lệch 1 đồng so với tổng làm tròn từng nhóm: thuế tổng = 1.640.001 − 1.500.000 = 140.001
    const b = taxBreakdownOf([{ goods: 1_000_000, rate: 10 }, { goods: 500_000, rate: 8 }], 1_640_001);
    expect(b.reduce((s, x) => s + x.vat, 0)).toBe(140_001);
    expect(b.find((x) => x.rate === 10)!.vat).toBe(100_001);
    expect(b.find((x) => x.rate === 8)!.vat).toBe(40_000);
  });

  it('thuế suất 0% không nhận chênh lệch làm tròn khi còn nhóm có thuế', () => {
    const b = taxBreakdownOf([{ goods: 200_000, rate: 0 }, { goods: 1_000_000, rate: 8 }], 1_280_001);
    expect(b.find((x) => x.rate === 0)!.vat).toBe(0);
    expect(b.find((x) => x.rate === 8)!.vat).toBe(80_001);
  });

  it('chỉ hàng 0% thì thuế bằng 0', () => {
    expect(taxBreakdownOf([{ goods: 1_000_000, rate: 0 }], 1_000_000)).toEqual([{ rate: 0, taxable: 1_000_000, vat: 0 }]);
  });

  it('không có dòng nào thì trả mảng rỗng', () => {
    expect(taxBreakdownOf([], 0)).toEqual([]);
  });
});
