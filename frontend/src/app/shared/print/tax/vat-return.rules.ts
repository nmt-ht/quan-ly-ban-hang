import { TaxBucket, VatSummaryView } from '../../../core/models/books-vat.models';

/** Một chỉ tiêu trên tờ khai 01/GTGT: mã số trong ngoặc vuông, tên, số tiền (null = để trống). */
export interface VatReturnLine {
  /** Mã số chỉ tiêu, ví dụ "[22]"; vắng ở dòng tiêu đề mục. */
  code?: string;
  label: string;
  /** Số tiền; null/undefined để trống. */
  value?: number | null;
  /** Dòng tiêu đề mục (I, II, III) — không có mã số và số tiền. */
  head?: boolean;
  /** In đậm (dòng tổng cộng, nghĩa vụ). */
  bold?: boolean;
}

const sumTaxable = (bs: TaxBucket[], pred: (r: number) => boolean) =>
  bs.filter((b) => pred(b.rate)).reduce((s, b) => s + b.taxable, 0);
const sumVat = (bs: TaxBucket[], pred: (r: number) => boolean) =>
  bs.filter((b) => pred(b.rate)).reduce((s, b) => s + b.vat, 0);
const isOther = (r: number) => r !== 0 && r !== 5 && r !== 10;

/**
 * Các chỉ tiêu tờ khai thuế GTGT mẫu 01/GTGT từ số liệu tổng hợp trong kỳ.
 * Thuế suất 8% và các mức khác gộp vào dòng "thuế suất khác" ([32a]/[33a]); hàng bán ra không chịu thuế ([26])
 * app không theo dõi riêng nên để 0. Số chỉ tiêu theo mẫu công khai — đối chiếu mẫu hiện hành khi nộp.
 */
export function vatReturnLines(s: VatSummaryView): VatReturnLine[] {
  const ob = s.output.buckets;
  const val0 = sumTaxable(ob, (r) => r === 0);
  const val5 = sumTaxable(ob, (r) => r === 5);
  const vat5 = sumVat(ob, (r) => r === 5);
  const val10 = sumTaxable(ob, (r) => r === 10);
  const vat10 = sumVat(ob, (r) => r === 10);
  const valOther = sumTaxable(ob, isOther);
  const vatOther = sumVat(ob, isOther);

  const soldValue = s.output.taxable; // [27]
  const outputVat = s.output.vat; // [28] = [35]
  const deductible = s.input.vat; // [25]
  const arising = outputVat - deductible; // [36] = [35] − [25]
  const totalRevenue = soldValue; // [34] = [26] + [27], [26] = 0

  return [
    { code: '[22]', label: 'Thuế GTGT còn được khấu trừ kỳ trước chuyển sang', value: s.carryForward },

    { label: 'I. HÀNG HOÁ, DỊCH VỤ MUA VÀO TRONG KỲ', head: true },
    { code: '[23]', label: 'Giá trị HHDV mua vào (chưa thuế)', value: s.input.taxable },
    { code: '[24]', label: 'Thuế GTGT của HHDV mua vào', value: s.input.vat },
    { code: '[25]', label: 'Thuế GTGT được khấu trừ kỳ này', value: deductible },

    { label: 'II. HÀNG HOÁ, DỊCH VỤ BÁN RA TRONG KỲ', head: true },
    { code: '[26]', label: 'Giá trị HHDV bán ra không chịu thuế GTGT', value: 0 },
    { code: '[27]', label: 'Giá trị HHDV bán ra chịu thuế GTGT', value: soldValue },
    { code: '[28]', label: 'Thuế GTGT của HHDV bán ra chịu thuế', value: outputVat },
    { code: '[29]', label: 'HHDV bán ra chịu thuế suất 0% (giá trị)', value: val0 },
    { code: '[30]', label: 'HHDV bán ra chịu thuế suất 5% (giá trị)', value: val5 },
    { code: '[31]', label: 'Thuế GTGT (thuế suất 5%)', value: vat5 },
    { code: '[32]', label: 'HHDV bán ra chịu thuế suất 10% (giá trị)', value: val10 },
    { code: '[33]', label: 'Thuế GTGT (thuế suất 10%)', value: vat10 },
    { code: '[32a]', label: 'HHDV bán ra chịu thuế suất khác (giá trị)', value: valOther },
    { code: '[33a]', label: 'Thuế GTGT (thuế suất khác)', value: vatOther },
    { code: '[34]', label: 'Tổng doanh thu HHDV bán ra', value: totalRevenue, bold: true },
    { code: '[35]', label: 'Tổng thuế GTGT của HHDV bán ra', value: outputVat, bold: true },

    { label: 'III. XÁC ĐỊNH NGHĨA VỤ THUẾ GTGT', head: true },
    { code: '[36]', label: 'Thuế GTGT phát sinh trong kỳ ([35] − [25])', value: arising },
    { code: '[37]', label: 'Điều chỉnh giảm thuế GTGT còn được khấu trừ của các kỳ trước', value: null },
    { code: '[38]', label: 'Điều chỉnh tăng thuế GTGT còn được khấu trừ của các kỳ trước', value: null },
    { code: '[40a]', label: 'Thuế GTGT phải nộp trong kỳ', value: s.payable, bold: true },
    { code: '[43]', label: 'Thuế GTGT còn được khấu trừ chuyển kỳ sau', value: s.carryOver, bold: true },
  ];
}
