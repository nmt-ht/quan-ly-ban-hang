import { describe, expect, it } from 'vitest';
import { DEFAULT_BRACKETS, PayrollParams, computePayroll, progressiveTax } from './payroll.rules.js';

const params: PayrollParams = {
  bhxhEmployee: 8, bhytEmployee: 1.5, bhtnEmployee: 1,
  bhxhEmployer: 17.5, bhytEmployer: 3, bhtnEmployer: 1, kpcd: 2,
  socialCap: 50_600_000, unemploymentCap: 106_200_000,
  personalDeduction: 15_500_000, dependentDeduction: 6_200_000,
  brackets: DEFAULT_BRACKETS,
};

describe('progressiveTax', () => {
  it('không đóng thuế khi thu nhập tính thuế bằng 0 hoặc âm', () => {
    expect(progressiveTax(0, DEFAULT_BRACKETS)).toBe(0);
    expect(progressiveTax(-5_000_000, DEFAULT_BRACKETS)).toBe(0);
  });
  it('chỉ chạm bậc 1: 8 triệu × 5%', () => {
    expect(progressiveTax(8_000_000, DEFAULT_BRACKETS)).toBe(400_000);
  });
  it('đúng biên bậc: 10 triệu × 5%', () => {
    expect(progressiveTax(10_000_000, DEFAULT_BRACKETS)).toBe(500_000);
  });
  it('luỹ tiến từng phần qua hai bậc: 10tr×5% + 1,35tr×10%', () => {
    expect(progressiveTax(11_350_000, DEFAULT_BRACKETS)).toBe(635_000);
  });
  it('qua cả 5 bậc: 120 triệu', () => {
    // 10tr×5% + 20tr×10% + 30tr×20% + 40tr×30% + 20tr×35%
    expect(progressiveTax(120_000_000, DEFAULT_BRACKETS)).toBe(500_000 + 2_000_000 + 6_000_000 + 12_000_000 + 7_000_000);
  });
});

describe('computePayroll', () => {
  it('lương 30 triệu, không người phụ thuộc', () => {
    const r = computePayroll({ baseSalary: 30_000_000, allowance: 0, dependents: 0 }, params);
    expect(r.bhxhEe).toBe(2_400_000);
    expect(r.bhytEe).toBe(450_000);
    expect(r.bhtnEe).toBe(300_000);
    expect(r.taxable).toBe(30_000_000 - 3_150_000 - 15_500_000); // 11.350.000
    expect(r.pit).toBe(635_000);
    expect(r.net).toBe(30_000_000 - 3_150_000 - 635_000);
    expect(r.bhxhEr).toBe(5_250_000);
    expect(r.bhytEr).toBe(900_000);
    expect(r.bhtnEr).toBe(300_000);
    expect(r.kpcd).toBe(600_000);
  });

  it('thu nhập dưới ngưỡng giảm trừ thì không đóng thuế', () => {
    const r = computePayroll({ baseSalary: 12_000_000, allowance: 0, dependents: 0 }, params);
    expect(r.taxable).toBe(0);
    expect(r.pit).toBe(0);
    expect(r.net).toBe(12_000_000 - 1_260_000);
  });

  it('một người phụ thuộc giảm đúng 6,2 triệu thu nhập tính thuế', () => {
    const none = computePayroll({ baseSalary: 30_000_000, allowance: 0, dependents: 0 }, params);
    const one = computePayroll({ baseSalary: 30_000_000, allowance: 0, dependents: 1 }, params);
    expect(none.taxable - one.taxable).toBe(6_200_000);
    expect(one.pit).toBe(257_500); // 5,15tr × 5%
  });

  it('giảm trừ vượt thu nhập thì thu nhập tính thuế dừng ở 0, không âm', () => {
    // 30tr − 3,15tr bảo hiểm − 15,5tr − 2×6,2tr = −1,05tr
    const two = computePayroll({ baseSalary: 30_000_000, allowance: 0, dependents: 2 }, params);
    expect(two.taxable).toBe(0);
    expect(two.pit).toBe(0);
  });

  it('lương vượt trần: BHXH, BHYT tính trên trần; BHTN tính trên lương khi dưới trần BHTN', () => {
    const r = computePayroll({ baseSalary: 80_000_000, allowance: 0, dependents: 0 }, params);
    expect(r.bhxhEe).toBe(4_048_000); // 50,6tr × 8%
    expect(r.bhytEe).toBe(759_000); // 50,6tr × 1,5%
    expect(r.bhtnEe).toBe(800_000); // 80tr × 1%, dưới trần BHTN 106,2tr
  });

  it('lương vượt cả trần BHTN thì BHTN dừng ở trần', () => {
    const r = computePayroll({ baseSalary: 150_000_000, allowance: 0, dependents: 0 }, params);
    expect(r.bhtnEe).toBe(1_062_000); // 106,2tr × 1%
  });

  it('phụ cấp và điều chỉnh tính thuế nhưng không tính bảo hiểm', () => {
    const base = computePayroll({ baseSalary: 20_000_000, allowance: 0, dependents: 0 }, params);
    const plus = computePayroll({ baseSalary: 20_000_000, allowance: 2_000_000, dependents: 0, adjustment: 3_000_000 }, params);
    expect(plus.gross).toBe(25_000_000);
    expect(plus.bhxhEe).toBe(base.bhxhEe);
    expect(plus.bhtnEe).toBe(base.bhtnEe);
    expect(plus.taxable - base.taxable).toBe(5_000_000);
  });

  it('lương đóng bảo hiểm riêng thay cho lương cơ bản', () => {
    const r = computePayroll({ baseSalary: 30_000_000, allowance: 0, insuranceSalary: 10_000_000, dependents: 0 }, params);
    expect(r.bhxhEe).toBe(800_000);
    expect(r.bhxhEr).toBe(1_750_000);
  });

  it('thực lĩnh + khấu trừ luôn bằng tổng thu nhập', () => {
    const r = computePayroll({ baseSalary: 47_300_000, allowance: 1_234_567, dependents: 1, adjustment: 999_999 }, params);
    expect(r.net + r.bhxhEe + r.bhytEe + r.bhtnEe + r.pit).toBe(r.gross);
  });
});
