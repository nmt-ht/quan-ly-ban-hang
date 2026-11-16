import { describe, expect, it } from 'vitest';
import { COUNT_CATEGORY_NAMES, resolutionOptions, resolutionPlan } from './cash-count.rules.js';

describe('kiểm kê quỹ: xử lý chênh lệch', () => {
  it('thiếu quỹ là phiếu chi, thừa quỹ là phiếu thu; chờ xử lý vào 1381 / 3381, tính ngay vào 811 / 711', () => {
    expect(resolutionPlan(-100_000, 'CHO_XU_LY')).toMatchObject({ kind: 'CHI', account: '1381', category: 'Thiếu quỹ chờ xử lý' });
    expect(resolutionPlan(-100_000, 'TINH_VAO_KET_QUA')).toMatchObject({ kind: 'CHI', account: '811' });
    expect(resolutionPlan(50_000, 'CHO_XU_LY')).toMatchObject({ kind: 'THU', account: '3381', category: 'Thừa quỹ chờ giải quyết' });
    expect(resolutionPlan(50_000, 'TINH_VAO_KET_QUA')).toMatchObject({ kind: 'THU', account: '711' });
  });

  it('khớp thì không có gì để xử lý', () => {
    expect(resolutionPlan(0, 'CHO_XU_LY')).toBeNull();
    expect(resolutionOptions(0)).toEqual([]);
    expect(resolutionOptions(-1).map((o) => o.option)).toEqual(['CHO_XU_LY', 'TINH_VAO_KET_QUA']);
  });

  it('bốn loại thu chi hệ thống đều có tên riêng', () => {
    expect(COUNT_CATEGORY_NAMES.size).toBe(4);
  });
});
