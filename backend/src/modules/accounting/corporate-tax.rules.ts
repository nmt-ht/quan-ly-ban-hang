// Quy tắc tính thuế TNDN, không đụng database nên kiểm thử được trực tiếp (corporate-tax.rules.spec.ts).

export const CIT_PERIODS = ['Q1', 'Q2', 'Q3', 'Q4', 'Y'] as const;
export type CitPeriod = (typeof CIT_PERIODS)[number];

/** Thứ tự các kỳ trong năm: Q1 < Q2 < Q3 < Q4 < quyết toán năm. */
export const periodOrder = (p: string): number => CIT_PERIODS.indexOf(p as CitPeriod);

export const PERIOD_LABEL: Record<CitPeriod, string> = { Q1: 'Quý I', Q2: 'Quý II', Q3: 'Quý III', Q4: 'Quý IV', Y: 'Quyết toán năm' };

/** Ngày cuối kỳ (YYYY-MM-DD). */
export function periodEnd(year: number, period: CitPeriod): string {
  const end: Record<CitPeriod, string> = { Q1: '03-31', Q2: '06-30', Q3: '09-30', Q4: '12-31', Y: '12-31' };
  return `${year}-${end[period]}`;
}

/**
 * Thuế suất gợi ý theo doanh thu cả năm. Từ kỳ tính thuế 2025 (Luật Thuế TNDN số 67/2025/QH15): doanh thu năm không quá 3 tỷ
 * đồng 15%, trên 3 đến 50 tỷ 17%, còn lại 20%. Trước 2025 là 20%. Chỉ là gợi ý để điền sẵn: kế toán xác nhận và sửa được.
 */
export function suggestedRate(year: number, revenue: number): number {
  if (year < 2025) return 20;
  if (revenue <= 3_000_000_000) return 15;
  if (revenue <= 50_000_000_000) return 17;
  return 20;
}

export interface CitInput {
  /** Lợi nhuận kế toán trước thuế luỹ kế từ đầu năm (chưa kể 821). */
  accountingProfit: number;
  addbacks: number;
  deductions: number;
  /** Lỗ chuyển muốn trừ (chỉ quyết toán năm). */
  lossRequested: number;
  rate: number;
  /** Đã ghi các kỳ trước trong năm. */
  taxPrior: number;
  annual: boolean;
}

export interface CitResult {
  /** Lợi nhuận kế toán ± điều chỉnh, trước khi chuyển lỗ. Âm là lỗ trong năm. */
  beforeLoss: number;
  lossUsed: number;
  taxableIncome: number;
  taxCumulative: number;
  taxBooked: number;
}

const r0 = (n: number) => Math.round(n);

export function computeCit(i: CitInput): CitResult {
  const beforeLoss = r0(i.accountingProfit + i.addbacks - i.deductions);
  // Lỗ chỉ trừ được vào thu nhập dương, và chỉ ở quyết toán năm.
  const lossUsed = i.annual ? Math.max(0, Math.min(r0(i.lossRequested), beforeLoss)) : 0;
  const taxableIncome = Math.max(0, beforeLoss - lossUsed);
  const taxCumulative = r0((taxableIncome * i.rate) / 100);
  return { beforeLoss, lossUsed, taxableIncome, taxCumulative, taxBooked: taxCumulative - r0(i.taxPrior) };
}

export interface PastYear {
  year: number;
  /** Lợi nhuận kế toán ± điều chỉnh của năm đó, trước chuyển lỗ (âm = lỗ). */
  beforeLoss: number;
  lossUsed: number;
}

/**
 * Lỗ còn chuyển được sang `year`: lỗ của một năm trừ dần vào thu nhập các năm sau, theo thứ tự năm phát sinh, và hết hạn sau
 * 5 năm liên tục kể từ năm tiếp theo (lỗ năm k dùng được ở các năm k+1 … k+5). `past` là các năm đã quyết toán trước `year`.
 */
export function lossAvailable(year: number, past: PastYear[]): number {
  const pool: { year: number; left: number }[] = [];
  for (const y of [...past].filter((p) => p.year < year).sort((a, b) => a.year - b.year)) {
    let use = y.lossUsed;
    for (const p of pool) {
      if (p.year < y.year - 5 || use <= 0) continue;
      const take = Math.min(p.left, use);
      p.left -= take;
      use -= take;
    }
    if (y.beforeLoss < 0) pool.push({ year: y.year, left: -y.beforeLoss });
  }
  return pool.filter((p) => p.year >= year - 5).reduce((s, p) => s + p.left, 0);
}
