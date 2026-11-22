import { allocateCost, avgAfterCost, avgBeforeCost, splitStockCogs } from './landed-cost.rules.js';

const items = [
  { key: 'A', quantity: 10, value: 1_000_000 },
  { key: 'B', quantity: 5, value: 1_000_000 },
];
const total = (m: Map<string, number>) => [...m.values()].reduce((s, v) => s + v, 0);

describe('Phân bổ chi phí mua hàng', () => {
  it('theo giá trị: tỷ lệ với giá trị hàng nhận', () => {
    const m = allocateCost(300_000, items, 'GIA_TRI');
    expect(Object.fromEntries(m)).toEqual({ A: 150_000, B: 150_000 });
  });

  it('theo số lượng: tỷ lệ với số lượng nhận', () => {
    const m = allocateCost(300_000, items, 'SO_LUONG');
    expect(Object.fromEntries(m)).toEqual({ A: 200_000, B: 100_000 });
  });

  it('làm tròn đồng: tổng luôn đúng bằng số cần phân bổ, phần lẻ vào mục có phần dư lớn nhất', () => {
    const three = [{ key: 'x', quantity: 1, value: 1 }, { key: 'y', quantity: 1, value: 1 }, { key: 'z', quantity: 1, value: 1 }];
    const m = allocateCost(100, three, 'GIA_TRI');
    expect(total(m)).toBe(100);
    expect([...m.values()].sort((a, b) => a - b)).toEqual([33, 33, 34]);
    expect(total(allocateCost(1_000_001, items, 'GIA_TRI'))).toBe(1_000_001);
  });

  it('không có cơ sở theo giá trị (đơn giá 0) thì chia theo số lượng', () => {
    const free = [{ key: 'A', quantity: 3, value: 0 }, { key: 'B', quantity: 1, value: 0 }];
    expect(Object.fromEntries(allocateCost(400, free, 'GIA_TRI'))).toEqual({ A: 300, B: 100 });
  });

  it('không có mục hoặc số tiền 0: không phân bổ gì', () => {
    expect(allocateCost(100, [], 'GIA_TRI').size).toBe(0);
    expect(allocateCost(0, items, 'GIA_TRI').size).toBe(0);
  });
});

describe('Phần vào tồn kho và phần vào giá vốn', () => {
  it('còn đủ hàng: toàn bộ vào tồn kho', () => {
    expect(splitStockCogs(100_000, 10, 10)).toEqual({ toStock: 100_000, toCogs: 0 });
    expect(splitStockCogs(100_000, 10, 25)).toEqual({ toStock: 100_000, toCogs: 0 }); // tồn nhiều hơn số nhận của đơn
  });

  it('đã bán một phần: chia theo tỷ lệ hàng còn', () => {
    expect(splitStockCogs(100_000, 10, 6)).toEqual({ toStock: 60_000, toCogs: 40_000 });
  });

  it('hết hàng: toàn bộ vào giá vốn hàng bán', () => {
    expect(splitStockCogs(100_000, 10, 0)).toEqual({ toStock: 0, toCogs: 100_000 });
  });
});

describe('Giá bình quân sau chi phí', () => {
  it('cộng chi phí vào phần tồn, và hoàn lại khi huỷ', () => {
    expect(avgAfterCost(100_000, 10, 100_000)).toBe(110_000);
    expect(avgAfterCost(100_000, 6, 60_000)).toBe(110_000);
    expect(avgBeforeCost(110_000, 10, 100_000)).toBe(100_000);
    expect(avgBeforeCost(5_000, 10, 100_000)).toBe(0);
    expect(avgAfterCost(100_000, 0, 50_000)).toBe(100_000);
  });
});
