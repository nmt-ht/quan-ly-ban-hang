import { computeCit, lossAvailable, periodEnd, periodOrder, suggestedRate } from './corporate-tax.rules.js';

const base = { addbacks: 0, deductions: 0, lossRequested: 0, rate: 20, taxPrior: 0, annual: false };

describe('thuế TNDN: tính luỹ kế', () => {
  it('lợi nhuận cộng điều chỉnh, nhân thuế suất, trừ phần đã ghi', () => {
    const r = computeCit({ ...base, accountingProfit: 600_000, addbacks: 100_000, taxPrior: 0 });
    expect(r).toMatchObject({ beforeLoss: 700_000, taxableIncome: 700_000, taxCumulative: 140_000, taxBooked: 140_000 });
    expect(computeCit({ ...base, accountingProfit: 1_100_000, addbacks: 100_000, taxPrior: 140_000 }).taxBooked).toBe(100_000);
  });

  it('lỗ trong năm: thuế bằng 0 và hoàn lại phần đã ghi (số âm)', () => {
    const r = computeCit({ ...base, accountingProfit: -400_000, addbacks: 100_000, taxPrior: 240_000, annual: true });
    expect(r).toMatchObject({ beforeLoss: -300_000, taxableIncome: 0, taxCumulative: 0, taxBooked: -240_000 });
  });

  it('chỉ trừ lỗ chuyển ở quyết toán năm, và không quá thu nhập', () => {
    expect(computeCit({ ...base, accountingProfit: 1_000_000, lossRequested: 200_000 }).lossUsed).toBe(0);
    expect(computeCit({ ...base, accountingProfit: 1_000_000, lossRequested: 200_000, annual: true })).toMatchObject({ lossUsed: 200_000, taxableIncome: 800_000, taxCumulative: 160_000 });
    expect(computeCit({ ...base, accountingProfit: 100_000, lossRequested: 900_000, annual: true })).toMatchObject({ lossUsed: 100_000, taxableIncome: 0 });
  });

  it('làm tròn đồng', () => {
    expect(computeCit({ ...base, accountingProfit: 1_001, rate: 17 }).taxCumulative).toBe(170);
  });
});

describe('thuế TNDN: lỗ chuyển 5 năm', () => {
  it('lỗ trừ dần theo thứ tự năm phát sinh và hết hạn sau 5 năm', () => {
    const past = [{ year: 2019, beforeLoss: -300_000, lossUsed: 0 }, { year: 2020, beforeLoss: 1_000_000, lossUsed: 200_000 }];
    expect(lossAvailable(2020, past.slice(0, 1))).toBe(300_000);
    expect(lossAvailable(2021, past)).toBe(100_000);
    expect(lossAvailable(2024, past)).toBe(100_000);
    expect(lossAvailable(2025, past)).toBe(0); // 2019 + 5 = 2024
  });

  it('nhiều năm lỗ: trừ năm lỗ cũ trước', () => {
    const past = [
      { year: 2019, beforeLoss: -100, lossUsed: 0 },
      { year: 2020, beforeLoss: -50, lossUsed: 0 },
      { year: 2021, beforeLoss: 500, lossUsed: 120 },
    ];
    expect(lossAvailable(2022, past)).toBe(30); // 2019 hết 100, còn lấy 20 của 2020
    expect(lossAvailable(2025, past)).toBe(30); // lỗ 2020 dùng được đến 2025
    expect(lossAvailable(2026, past)).toBe(0);
  });
});

describe('thuế TNDN: kỳ và thuế suất', () => {
  it('thứ tự và ngày cuối kỳ', () => {
    expect(periodOrder('Q2')).toBeLessThan(periodOrder('Y'));
    expect(periodEnd(2026, 'Q1')).toBe('2026-03-31');
    expect(periodEnd(2026, 'Y')).toBe('2026-12-31');
  });

  it('thuế suất gợi ý theo doanh thu từ kỳ tính thuế 2025', () => {
    expect(suggestedRate(2024, 1_000)).toBe(20);
    expect(suggestedRate(2025, 3_000_000_000)).toBe(15);
    expect(suggestedRate(2025, 3_000_000_001)).toBe(17);
    expect(suggestedRate(2026, 50_000_000_000)).toBe(17);
    expect(suggestedRate(2026, 50_000_000_001)).toBe(20);
  });
});
