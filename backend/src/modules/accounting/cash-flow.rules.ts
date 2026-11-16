// Báo cáo lưu chuyển tiền tệ — phương pháp trực tiếp (mẫu B03-DNN, TT133). Phần tính thuần, không chạm cơ sở dữ liệu.
//
// Mỗi bút toán có dòng tiền (111, 112, 113) được phân loại theo TÀI KHOẢN ĐỐI ỨNG: mỗi dòng không phải tiền đóng góp
// (Có − Nợ) vào một chỉ tiêu; tổng đóng góp của bút toán đúng bằng biến động tiền của nó nên báo cáo luôn khớp số dư tiền trên sổ cái.
// Bút toán chỉ gồm các TK tiền với nhau (chuyển tiền nội bộ qua 113) có biến động tiền bằng 0 nên không vào báo cáo.

export const CASH_ACCOUNTS = ['111', '112', '113'];

export interface FlowLine {
  accountCode: string;
  debit: number;
  credit: number;
}

/** Chỉ tiêu của mẫu B03-DNN (phương pháp trực tiếp) và nhãn. */
export const FLOW_LABELS: Record<string, string> = {
  '01': 'Tiền thu từ bán hàng, cung cấp dịch vụ và doanh thu khác',
  '02': 'Tiền chi trả cho người cung cấp hàng hóa, dịch vụ',
  '03': 'Tiền chi trả cho người lao động',
  '04': 'Tiền lãi vay đã trả',
  '05': 'Thuế thu nhập doanh nghiệp đã nộp',
  '06': 'Tiền thu khác từ hoạt động kinh doanh',
  '07': 'Tiền chi khác cho hoạt động kinh doanh',
  '20': 'Lưu chuyển tiền thuần từ hoạt động kinh doanh',
  '21': 'Tiền chi để mua sắm, xây dựng TSCĐ, BĐSĐT và các tài sản dài hạn khác',
  '22': 'Tiền thu từ thanh lý, nhượng bán TSCĐ, BĐSĐT và các tài sản dài hạn khác',
  '23': 'Tiền chi cho vay, đầu tư góp vốn vào đơn vị khác',
  '24': 'Tiền thu hồi cho vay, đầu tư góp vốn vào đơn vị khác',
  '25': 'Tiền thu lãi cho vay, cổ tức và lợi nhuận được chia',
  '30': 'Lưu chuyển tiền thuần từ hoạt động đầu tư',
  '31': 'Tiền thu từ phát hành cổ phiếu, nhận vốn góp của chủ sở hữu',
  '32': 'Tiền trả lại vốn góp cho các chủ sở hữu, mua lại cổ phiếu của doanh nghiệp đã phát hành',
  '33': 'Tiền thu từ đi vay',
  '34': 'Tiền trả nợ gốc vay và nợ thuê tài chính',
  '35': 'Cổ tức, lợi nhuận đã trả cho chủ sở hữu',
  '40': 'Lưu chuyển tiền thuần từ hoạt động tài chính',
  '50': 'Lưu chuyển tiền thuần trong kỳ',
  '60': 'Tiền và tương đương tiền đầu kỳ',
  '61': 'Ảnh hưởng của thay đổi tỷ giá hối đoái quy đổi ngoại tệ',
  '70': 'Tiền và tương đương tiền cuối kỳ',
};

const OPERATING = ['01', '02', '03', '04', '05', '06', '07'];
const INVESTING = ['21', '22', '23', '24', '25'];
const FINANCING = ['31', '32', '33', '34', '35'];

/**
 * Chỉ tiêu cho một dòng đối ứng với tiền. `amount` = Có − Nợ của dòng đó: dương là tiền vào, âm là tiền ra.
 * Quy ước (người dùng nên đối chiếu): thuế GTGT nộp, bảo hiểm và thuế TNCN nộp hộ ghi vào "chi khác" (07).
 */
export function indicatorOf(account: string, amount: number): string {
  switch (account) {
    case '131': case '511': case '3387': return '01';
    case '3331': return amount > 0 ? '01' : '07';
    case '331': case '133': case '152': case '153': case '154': case '155': case '156': case '242': case '627': case '632': case '641': case '642': return '02';
    case '334': return '03';
    case '635': return '04';
    case '821': case '3334': return '05';
    case '711': return amount > 0 ? '06' : '07';
    case '811': return '07';
    case '515': return '25';
    case '211': case '214': return amount < 0 ? '21' : '22';
    case '411': return amount > 0 ? '31' : '32';
    case '421': return amount < 0 ? '35' : '06';
    case '341': return amount > 0 ? '33' : '34';
    default: return amount > 0 ? '06' : '07';
  }
}

export interface FlowResult {
  /** Tổng theo chỉ tiêu 01–07, 21–25, 31–35. */
  sums: Record<string, number>;
  /** Theo chỉ tiêu: tiền theo từng tài khoản đối ứng (để xem số này từ đâu ra). */
  detail: Record<string, Record<string, number>>;
}

/** Phân loại một loạt bút toán (mỗi bút toán là danh sách dòng). */
export function classifyEntries(entries: FlowLine[][]): FlowResult {
  const sums: Record<string, number> = {};
  const detail: Record<string, Record<string, number>> = {};
  for (const lines of entries) {
    // Bút toán không có dòng tiền, hoặc chỉ gồm các TK tiền với nhau (chuyển tiền nội bộ), không có dòng đối ứng để phân loại.
    if (!lines.some((l) => CASH_ACCOUNTS.includes(l.accountCode))) continue;
    for (const l of lines) {
      if (CASH_ACCOUNTS.includes(l.accountCode)) continue;
      const amount = l.credit - l.debit;
      if (amount === 0) continue;
      const code = indicatorOf(l.accountCode, amount);
      sums[code] = (sums[code] ?? 0) + amount;
      detail[code] ??= {};
      detail[code][l.accountCode] = (detail[code][l.accountCode] ?? 0) + amount;
    }
  }
  return { sums, detail };
}

export interface FlowItem {
  code: string;
  label: string;
  amount: number;
  total: boolean;
  detail: { account: string; amount: number }[];
}

/** Dựng báo cáo B03-DNN từ số theo chỉ tiêu và tiền đầu kỳ. */
export function buildStatement(r: FlowResult, opening: number): { items: FlowItem[]; closing: number; net: number } {
  const get = (c: string) => r.sums[c] ?? 0;
  const sum = (codes: string[]) => codes.reduce((s, c) => s + get(c), 0);
  const line = (code: string, amount: number, total = false): FlowItem => ({
    code, label: FLOW_LABELS[code], amount, total,
    detail: Object.entries(r.detail[code] ?? {}).map(([account, a]) => ({ account, amount: a })).sort((a, b) => a.account.localeCompare(b.account)),
  });
  const op = sum(OPERATING), inv = sum(INVESTING), fin = sum(FINANCING);
  const net = op + inv + fin;
  const items = [
    ...OPERATING.map((c) => line(c, get(c))), line('20', op, true),
    ...INVESTING.map((c) => line(c, get(c))), line('30', inv, true),
    ...FINANCING.map((c) => line(c, get(c))), line('40', fin, true),
    line('50', net, true), line('60', opening, true), line('61', 0, true), line('70', net + opening, true),
  ];
  return { items, closing: net + opening, net };
}
