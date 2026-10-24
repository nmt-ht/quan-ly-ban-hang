import { blendCost, unblendCost } from './inventory.service.js';

describe('giá vốn bình quân gia quyền di động', () => {
  it('nhập thêm: bình quân theo số lượng', () => {
    expect(blendCost(10, 100_000, 10, 130_000)).toBe(115_000);
    expect(blendCost(0, 0, 5, 80_000)).toBe(80_000);
  });

  it('tồn âm (xuất trước, ghi nhập sau) tính như hết hàng', () => {
    expect(blendCost(-3, 50_000, 10, 70_000)).toBe(70_000);
  });

  it('không nhập gì thì giữ nguyên', () => {
    expect(blendCost(10, 100_000, 0, 0)).toBe(100_000);
  });

  it('huỷ phiếu nhập trả bình quân về như trước khi nhập', () => {
    const avg = blendCost(10, 100_000, 10, 130_000);
    expect(unblendCost(20, avg, 10, 130_000)).toBe(100_000);
  });

  it('huỷ phiếu nhập khi không còn hàng nào khác: giữ bình quân', () => {
    expect(unblendCost(10, 100_000, 10, 100_000)).toBe(100_000);
    expect(unblendCost(4, 100_000, 10, 100_000)).toBe(100_000);
  });
});
