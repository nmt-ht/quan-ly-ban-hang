// Quy tắc tính lương, thuần số học, không đụng CSDL — để kiểm thử độc lập (payroll.rules.spec.ts).
// Mọi tỷ lệ, trần và biểu thuế đến từ PayrollSettings nên sửa được khi quy định đổi.

export interface TaxBracket {
  /** Cận trên của bậc theo thu nhập tính thuế tháng; null = bậc cuối, không giới hạn. */
  upTo: number | null;
  /** Thuế suất, đơn vị %. */
  rate: number;
}

export interface PayrollParams {
  bhxhEmployee: number; bhytEmployee: number; bhtnEmployee: number;
  bhxhEmployer: number; bhytEmployer: number; bhtnEmployer: number;
  kpcd: number;
  socialCap: number; unemploymentCap: number;
  personalDeduction: number; dependentDeduction: number;
  brackets: TaxBracket[];
}

export interface PayrollInput {
  baseSalary: number;
  allowance: number;
  /** Lương đóng bảo hiểm; không có thì lấy baseSalary. */
  insuranceSalary?: number | null;
  dependents: number;
  /** Thưởng / phụ cấp phát sinh trong tháng, cộng vào thu nhập tính thuế, không tính bảo hiểm. */
  adjustment?: number;
}

export interface PayrollResult {
  gross: number;
  bhxhEe: number; bhytEe: number; bhtnEe: number;
  taxable: number; pit: number; net: number;
  bhxhEr: number; bhytEr: number; bhtnEr: number; kpcd: number;
}

const r0 = (n: number) => Math.round(n);

/** Thuế luỹ tiến từng phần: mỗi bậc chỉ tính phần thu nhập rơi vào bậc đó. */
export function progressiveTax(taxable: number, brackets: TaxBracket[]): number {
  if (taxable <= 0) return 0;
  let tax = 0;
  let lower = 0;
  for (const b of brackets) {
    const upper = b.upTo ?? Infinity;
    if (taxable > lower) tax += (Math.min(taxable, upper) - lower) * (b.rate / 100);
    if (taxable <= upper) break;
    lower = upper;
  }
  return r0(tax);
}

export function computePayroll(e: PayrollInput, p: PayrollParams): PayrollResult {
  const adjustment = e.adjustment ?? 0;
  const gross = r0(e.baseSalary + e.allowance + adjustment);

  // Căn cứ đóng bảo hiểm bị chặn trên bởi trần; BHXH và BHYT chung trần, BHTN trần riêng.
  const insurance = e.insuranceSalary ?? e.baseSalary;
  const socialBase = Math.min(insurance, p.socialCap);
  const unemploymentBase = Math.min(insurance, p.unemploymentCap);

  const bhxhEe = r0((socialBase * p.bhxhEmployee) / 100);
  const bhytEe = r0((socialBase * p.bhytEmployee) / 100);
  const bhtnEe = r0((unemploymentBase * p.bhtnEmployee) / 100);
  const eeTotal = bhxhEe + bhytEe + bhtnEe;

  const taxable = Math.max(0, gross - eeTotal - p.personalDeduction - e.dependents * p.dependentDeduction);
  const pit = progressiveTax(taxable, p.brackets);

  return {
    gross, bhxhEe, bhytEe, bhtnEe, taxable, pit, net: gross - eeTotal - pit,
    bhxhEr: r0((socialBase * p.bhxhEmployer) / 100),
    bhytEr: r0((socialBase * p.bhytEmployer) / 100),
    bhtnEr: r0((unemploymentBase * p.bhtnEmployer) / 100),
    kpcd: r0((socialBase * p.kpcd) / 100),
  };
}

/** Mặc định theo quy định áp dụng cho nửa cuối 2026; doanh nghiệp tự đối chiếu và sửa ở Thiết lập lương. */
export const DEFAULT_BRACKETS: TaxBracket[] = [
  { upTo: 10_000_000, rate: 5 },
  { upTo: 30_000_000, rate: 10 },
  { upTo: 60_000_000, rate: 20 },
  { upTo: 100_000_000, rate: 30 },
  { upTo: null, rate: 35 },
];

/** TK chi phí theo bộ phận: quản lý 642, bán hàng 641, sản xuất trực tiếp 154. */
export const CENTER_ACCOUNT: Record<string, string> = { QUAN_LY: '642', BAN_HANG: '641', SAN_XUAT: '154' };
