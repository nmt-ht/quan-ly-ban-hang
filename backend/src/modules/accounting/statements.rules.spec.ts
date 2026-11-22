import { MAPPED_ACCOUNTS, PositionInput, buildFinancialPosition, buildIncomeStatement, isBalanced } from './statements.rules.js';

const empty: PositionInput = { net: {}, receivable: { debit: 0, credit: 0 }, payable: { debit: 0, credit: 0 }, unclosedProfit: 0 };
const amount = (lines: { code: string; amount: number | null }[], code: string) => lines.find((l) => l.code === code)!.amount;

describe('B01b-DNN: báo cáo tình hình tài chính', () => {
  // Tiền 6.200.000 · khách nợ 1.000.000 · hàng 2.000.000 · TSCĐ 5.000.000 hao mòn 500.000 · GTGT đầu vào 100.000 · trả trước 300.000
  // Nợ: NCC 700.000 (còn khách trả trước 50.000, NCC ta trả trước 20.000) · thuế phải nộp 140.000 · lương 400.000 · BHXH 80.000
  // Vốn 5.000.000 · lãi chưa phân phối 421: 1.000.000 · lãi năm nay chưa kết chuyển 250.000.
  const input: PositionInput = {
    net: {
      '111': 4_000_000, '112': 2_200_000, '152': 1_200_000, '156': 800_000, '133': 100_000, '242': 300_000, '211': 5_000_000, '214': -500_000, '141': 30_000,
      '3331': -90_000, '3334': -50_000, '334': -400_000, '3383': -80_000, '411': -5_000_000, '421': -1_000_000,
    },
    receivable: { debit: 1_000_000, credit: 50_000 },
    payable: { debit: 20_000, credit: 700_000 },
    unclosedProfit: 0,
  };
  // Cân: mô phỏng đầy đủ bên Nợ / Có để biết số tổng.
  const assets = 6_200_000 + 1_000_000 + 20_000 + 30_000 + 2_000_000 + 100_000 + 300_000 + 4_500_000;
  const full: PositionInput = { ...input, unclosedProfit: 0 };
  // Vốn + nợ = 700.000 + 50.000 + 140.000 + 400.000 + 80.000 + 5.000.000 + 1.000.000 = 7.370.000; tài sản = 14.150.000 → chênh vì thiếu lãi:
  // dùng unclosedProfit để cân bảng trong ví dụ.
  full.unclosedProfit = assets - 7_370_000;

  it('chuyển số dư tài khoản vào chỉ tiêu, tổng theo công thức mã số', () => {
    const lines = buildFinancialPosition(full, empty);
    expect(amount(lines, '110')).toBe(6_200_000);
    expect(amount(lines, '131')).toBe(1_000_000);
    expect(amount(lines, '132')).toBe(20_000);
    expect(amount(lines, '133')).toBe(30_000); // tạm ứng
    expect(amount(lines, '141')).toBe(2_000_000);
    expect(amount(lines, '151')).toBe(100_000);
    expect(amount(lines, '152')).toBe(300_000);
    expect(amount(lines, '130')).toBe(1_050_000);
    expect(amount(lines, '100')).toBe(6_200_000 + 1_050_000 + 2_000_000 + 400_000);
    expect(amount(lines, '222')).toBe(-500_000); // (*) âm
    expect(amount(lines, '220')).toBe(4_500_000);
    expect(amount(lines, '411')).toBe(700_000);
    expect(amount(lines, '412')).toBe(50_000);
    expect(amount(lines, '413')).toBe(140_000);
    expect(amount(lines, '415')).toBe(80_000);
    expect(amount(lines, '511')).toBe(5_000_000);
    expect(amount(lines, '517')).toBe(1_000_000 + (assets - 7_370_000));
  });

  it('300 = 100 + 200, 600 = 400 + 500 và cân khi sổ cân', () => {
    const lines = buildFinancialPosition(full, empty);
    expect(amount(lines, '300')).toBe(amount(lines, '100')! + amount(lines, '200')!);
    expect(amount(lines, '600')).toBe(amount(lines, '400')! + amount(lines, '500')!);
    expect(isBalanced(lines)).toBe(true);
    expect(isBalanced(buildFinancialPosition(input, empty))).toBe(false); // thiếu lãi năm nay → lệch
  });

  it('số đầu năm tính độc lập với số cuối năm; mọi mã số đều có mặt một lần theo thứ tự mẫu', () => {
    const lines = buildFinancialPosition(full, input);
    expect(lines.find((l) => l.code === '110')).toMatchObject({ amount: 6_200_000, prior: 6_200_000 });
    expect(new Set(lines.map((l) => l.code)).size).toBe(lines.length);
    expect(lines.map((l) => l.code).slice(0, 4)).toEqual(['100', '110', '120', '121']);
    expect(lines.at(-1)!.code).toBe('600');
  });

  it('TK dùng trong sổ đều có chỉ tiêu', () => {
    expect(MAPPED_ACCOUNTS).toEqual(expect.arrayContaining(['111', '131', '331', '3334', '421']));
  });
});

describe('B02-DNN: báo cáo kết quả hoạt động kinh doanh', () => {
  const cur = { revenue: 1_500_000, deductions: 0, cogs: 400_000, financeIncome: 20_000, financeExpense: 10_000, management: 300_000, otherIncome: 50_000, otherExpense: 30_000, incomeTax: 140_000 };
  const prev = { ...cur, revenue: 1_000_000, incomeTax: 0 };

  it('tính theo công thức mã số của mẫu', () => {
    const lines = buildIncomeStatement(cur, prev);
    expect(amount(lines, '10')).toBe(1_500_000);
    expect(amount(lines, '20')).toBe(1_100_000);
    expect(amount(lines, '30')).toBe(1_100_000 + 20_000 - 10_000 - 300_000); // 810.000
    expect(amount(lines, '40')).toBe(20_000);
    expect(amount(lines, '50')).toBe(830_000);
    expect(amount(lines, '60')).toBe(690_000);
    expect(amount(lines, '23')).toBeNull(); // chi phí lãi vay chưa tách riêng
  });

  it('kỳ trước ở cột riêng', () => {
    const lines = buildIncomeStatement(cur, prev);
    expect(lines.find((l) => l.code === '01')).toMatchObject({ amount: 1_500_000, prior: 1_000_000 });
    expect(amount(lines.map((l) => ({ code: l.code, amount: l.prior })), '60')).toBe(1_000_000 - 400_000 + 20_000 - 10_000 - 300_000 + 20_000);
  });
});
