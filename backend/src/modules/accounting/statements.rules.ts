// Báo cáo tài chính in theo mẫu TT133 (Thông tư 133/2016/TT-BTC): B01b-DNN Báo cáo tình hình tài chính (ngắn hạn / dài hạn)
// và B02-DNN Báo cáo kết quả hoạt động kinh doanh. Phần tính thuần, không chạm cơ sở dữ liệu (statements.rules.spec.ts).
//
// Chỉ tiêu và mã số theo mẫu đăng trên các trang hướng dẫn lập báo cáo (đối chiếu với văn bản gốc trước khi nộp cho cơ quan
// thuế). Cách chuyển số dư tài khoản vào chỉ tiêu là quy ước của phần mềm (xem MAPPED_ACCOUNTS): kế toán xác nhận.

export interface StatementLine {
  code: string;
  label: string;
  /** Cấp thụt vào: 0 = mục lớn (A, B, C, D), 1 = I, II…, 2 = 1., 2.… */
  level: number;
  bold?: boolean;
  amount: number | null;
  prior: number | null;
}

/** Số dư (Nợ − Có) theo tài khoản chi tiết, và công nợ đã tách theo đối tượng. */
export interface PositionInput {
  net: Record<string, number>;
  /** 131 theo từng khách hàng: tổng các số dư Nợ và tổng các số dư Có (khách trả trước). */
  receivable: { debit: number; credit: number };
  /** 331 theo từng nhà cung cấp: tổng các số dư Có và tổng các số dư Nợ (trả trước cho người bán). */
  payable: { debit: number; credit: number };
  /** Lãi lỗ năm nay chưa kết chuyển sang 421 (doanh thu trừ chi phí còn nằm ở các TK 5, 6, 7, 8). */
  unclosedProfit: number;
}

/** Các TK bảng cân đối mà báo cáo đã có chỉ tiêu; TK khác còn số dư thì báo là chưa phân loại. */
export const MAPPED_ACCOUNTS = [
  '111', '112', '113', '131', '133', '1381', '141', '152', '153', '154', '155', '156', '211', '214', '242',
  '331', '3331', '3334', '3335', '3381', '3382', '3383', '3384', '3385', '334', '411', '421',
];

const n = (input: PositionInput, code: string) => input.net[code] ?? 0;
const sum = (input: PositionInput, codes: string[]) => codes.reduce((s, c) => s + n(input, c), 0);

interface Def {
  code: string;
  label: string;
  level: number;
  bold?: boolean;
  /** Chỉ tiêu tổng: công thức theo mã số. */
  total?: string[];
  /** Chỉ tiêu lá: số lấy từ sổ cái. */
  value?: (i: PositionInput) => number;
  note?: string;
}

const L = (code: string, label: string, level: number, value?: Def['value']): Def => ({ code, label, level, value });
const T = (code: string, label: string, level: number, total: string[], bold = false): Def => ({ code, label, level, total, bold });

const POSITION: Def[] = [
  T('100', 'A - TÀI SẢN NGẮN HẠN', 0, ['110', '120', '130', '140', '150'], true),
  L('110', 'I. Tiền và các khoản tương đương tiền', 1, (i) => sum(i, ['111', '112', '113'])),
  T('120', 'II. Đầu tư tài chính ngắn hạn', 1, ['121', '122', '123']),
  L('121', '1. Chứng khoán kinh doanh', 2),
  L('122', '2. Dự phòng giảm giá chứng khoán kinh doanh (*)', 2),
  L('123', '3. Đầu tư nắm giữ đến ngày đáo hạn ngắn hạn', 2),
  T('130', 'III. Các khoản phải thu ngắn hạn', 1, ['131', '132', '133', '134', '135']),
  L('131', '1. Phải thu ngắn hạn của khách hàng', 2, (i) => i.receivable.debit),
  L('132', '2. Trả trước cho người bán ngắn hạn', 2, (i) => i.payable.debit),
  L('133', '3. Phải thu ngắn hạn khác', 2, (i) => n(i, '141')),
  L('134', '4. Tài sản thiếu chờ xử lý', 2, (i) => n(i, '1381')),
  L('135', '5. Dự phòng phải thu ngắn hạn khó đòi (*)', 2),
  T('140', 'IV. Hàng tồn kho', 1, ['141', '142']),
  L('141', '1. Hàng tồn kho', 2, (i) => sum(i, ['152', '153', '154', '155', '156'])),
  L('142', '2. Dự phòng giảm giá hàng tồn kho (*)', 2),
  T('150', 'V. Tài sản ngắn hạn khác', 1, ['151', '152']),
  L('151', '1. Thuế GTGT được khấu trừ', 2, (i) => n(i, '133')),
  L('152', '2. Tài sản ngắn hạn khác', 2, (i) => n(i, '242')),
  T('200', 'B - TÀI SẢN DÀI HẠN', 0, ['210', '220', '230', '240', '250', '260'], true),
  T('210', 'I. Các khoản phải thu dài hạn', 1, ['211', '212', '213', '214', '215']),
  L('211', '1. Phải thu dài hạn của khách hàng', 2),
  L('212', '2. Trả trước cho người bán dài hạn', 2),
  L('213', '3. Vốn kinh doanh ở đơn vị trực thuộc', 2),
  L('214', '4. Phải thu dài hạn khác', 2),
  L('215', '5. Dự phòng phải thu dài hạn khó đòi (*)', 2),
  T('220', 'II. Tài sản cố định', 1, ['221', '222']),
  L('221', '- Nguyên giá', 2, (i) => n(i, '211')),
  L('222', '- Giá trị hao mòn lũy kế (*)', 2, (i) => n(i, '214')),
  T('230', 'III. Bất động sản đầu tư', 1, ['231', '232']),
  L('231', '- Nguyên giá', 2),
  L('232', '- Giá trị hao mòn lũy kế (*)', 2),
  L('240', 'IV. Xây dựng cơ bản dở dang', 1),
  T('250', 'V. Đầu tư tài chính dài hạn', 1, ['251', '252', '253']),
  L('251', '1. Đầu tư góp vốn vào đơn vị khác', 2),
  L('252', '2. Dự phòng tổn thất đầu tư vào đơn vị khác (*)', 2),
  L('253', '3. Đầu tư nắm giữ đến ngày đáo hạn dài hạn', 2),
  L('260', 'VI. Tài sản dài hạn khác', 1),
  T('300', 'TỔNG CỘNG TÀI SẢN', 0, ['100', '200'], true),
  T('400', 'C - NỢ PHẢI TRẢ', 0, ['410', '420'], true),
  T('410', 'I. Nợ ngắn hạn', 1, ['411', '412', '413', '414', '415', '416', '417', '418']),
  L('411', '1. Phải trả người bán ngắn hạn', 2, (i) => i.payable.credit),
  L('412', '2. Người mua trả tiền trước ngắn hạn', 2, (i) => i.receivable.credit),
  L('413', '3. Thuế và các khoản phải nộp Nhà nước', 2, (i) => -sum(i, ['3331', '3334', '3335'])),
  L('414', '4. Phải trả người lao động', 2, (i) => -n(i, '334')),
  L('415', '5. Phải trả ngắn hạn khác', 2, (i) => -sum(i, ['3381', '3382', '3383', '3384', '3385'])),
  L('416', '6. Vay và nợ thuê tài chính ngắn hạn', 2),
  L('417', '7. Dự phòng phải trả ngắn hạn', 2),
  L('418', '8. Quỹ khen thưởng, phúc lợi', 2),
  T('420', 'II. Nợ dài hạn', 1, ['421', '422', '423', '424', '425', '426', '427']),
  L('421', '1. Phải trả người bán dài hạn', 2),
  L('422', '2. Người mua trả tiền trước dài hạn', 2),
  L('423', '3. Phải trả nội bộ về vốn kinh doanh', 2),
  L('424', '4. Phải trả dài hạn khác', 2),
  L('425', '5. Vay và nợ thuê tài chính dài hạn', 2),
  L('426', '6. Dự phòng phải trả dài hạn', 2),
  L('427', '7. Quỹ phát triển khoa học và công nghệ', 2),
  T('500', 'D - VỐN CHỦ SỞ HỮU', 0, ['511', '512', '513', '514', '515', '516', '517'], true),
  L('511', '1. Vốn góp của chủ sở hữu', 2, (i) => -n(i, '411')),
  L('512', '2. Thặng dư vốn cổ phần', 2),
  L('513', '3. Vốn khác của chủ sở hữu', 2),
  L('514', '4. Cổ phiếu quỹ (*)', 2),
  L('515', '5. Chênh lệch tỷ giá hối đoái', 2),
  L('516', '6. Các quỹ thuộc vốn chủ sở hữu', 2),
  L('517', '7. Lợi nhuận sau thuế chưa phân phối', 2, (i) => -n(i, '421') + i.unclosedProfit),
  T('600', 'TỔNG CỘNG NGUỒN VỐN', 0, ['400', '500'], true),
];

/** Tính cột số liệu của B01b-DNN: mã số → số tiền (tài sản dương, khoản giảm trừ (*) âm). */
function position(input: PositionInput): Map<string, number> {
  const values = new Map<string, number>();
  const compute = (code: string): number => {
    const known = values.get(code);
    if (known !== undefined) return known;
    const def = POSITION.find((d) => d.code === code)!;
    const v = def.total ? def.total.reduce((s, c) => s + compute(c), 0) : Math.round(def.value?.(input) ?? 0);
    values.set(code, v);
    return v;
  };
  for (const d of POSITION) compute(d.code);
  return values;
}

/** B01b-DNN: số cuối năm (`current`) và số đầu năm (`opening`). */
export function buildFinancialPosition(current: PositionInput, opening: PositionInput): StatementLine[] {
  const now = position(current);
  const before = position(opening);
  return POSITION.map((d) => ({ code: d.code, label: d.label, level: d.level, bold: d.bold, amount: now.get(d.code)!, prior: before.get(d.code)! }));
}

/** Tài sản bằng nguồn vốn (mã 300 = 600). */
export function isBalanced(lines: StatementLine[]): boolean {
  const a = lines.find((l) => l.code === '300')?.amount ?? 0;
  const r = lines.find((l) => l.code === '600')?.amount ?? 0;
  return Math.round(a - r) === 0;
}

// ---------- B02-DNN ----------

/** Phát sinh trong kỳ theo chiều tự nhiên: doanh thu (Có − Nợ), chi phí (Nợ − Có). */
export interface IncomeInput {
  revenue: number; // 511
  deductions: number; // các khoản giảm trừ doanh thu (5211, 5212, 5213)
  cogs: number; // 632
  financeIncome: number; // 515
  financeExpense: number; // 635
  management: number; // 641 + 642
  otherIncome: number; // 711
  otherExpense: number; // 811
  incomeTax: number; // 821
}

interface IncomeDef { code: string; label: string; bold?: boolean; value: (i: IncomeInput, get: (c: string) => number) => number | null }

const INCOME: IncomeDef[] = [
  { code: '01', label: '1. Doanh thu bán hàng và cung cấp dịch vụ', value: (i) => i.revenue },
  { code: '02', label: '2. Các khoản giảm trừ doanh thu', value: (i) => i.deductions },
  { code: '10', label: '3. Doanh thu thuần về bán hàng và cung cấp dịch vụ (10 = 01 - 02)', bold: true, value: (_, g) => g('01') - g('02') },
  { code: '11', label: '4. Giá vốn hàng bán', value: (i) => i.cogs },
  { code: '20', label: '5. Lợi nhuận gộp về bán hàng và cung cấp dịch vụ (20 = 10 - 11)', bold: true, value: (_, g) => g('10') - g('11') },
  { code: '21', label: '6. Doanh thu hoạt động tài chính', value: (i) => i.financeIncome },
  { code: '22', label: '7. Chi phí tài chính', value: (i) => i.financeExpense },
  { code: '23', label: '- Trong đó: Chi phí lãi vay', value: () => null },
  { code: '24', label: '8. Chi phí quản lý kinh doanh', value: (i) => i.management },
  { code: '30', label: '9. Lợi nhuận thuần từ hoạt động kinh doanh {30 = 20 + (21 - 22) - 24}', bold: true, value: (_, g) => g('20') + g('21') - g('22') - g('24') },
  { code: '31', label: '10. Thu nhập khác', value: (i) => i.otherIncome },
  { code: '32', label: '11. Chi phí khác', value: (i) => i.otherExpense },
  { code: '40', label: '12. Lợi nhuận khác (40 = 31 - 32)', bold: true, value: (_, g) => g('31') - g('32') },
  { code: '50', label: '13. Tổng lợi nhuận kế toán trước thuế (50 = 30 + 40)', bold: true, value: (_, g) => g('30') + g('40') },
  { code: '51', label: '14. Chi phí thuế thu nhập doanh nghiệp', value: (i) => i.incomeTax },
  { code: '60', label: '15. Lợi nhuận sau thuế thu nhập doanh nghiệp (60 = 50 - 51)', bold: true, value: (_, g) => g('50') - g('51') },
];

function income(input: IncomeInput): Map<string, number | null> {
  const values = new Map<string, number | null>();
  const get = (code: string): number => values.get(code) ?? 0;
  for (const d of INCOME) values.set(d.code, d.value(input, get) === null ? null : Math.round(d.value(input, get)!));
  return values;
}

/** B02-DNN: kỳ này và kỳ trước. */
export function buildIncomeStatement(current: IncomeInput, prior: IncomeInput): StatementLine[] {
  const now = income(current);
  const before = income(prior);
  return INCOME.map((d) => ({ code: d.code, label: d.label, level: 0, bold: d.bold, amount: now.get(d.code) ?? null, prior: before.get(d.code) ?? null }));
}
