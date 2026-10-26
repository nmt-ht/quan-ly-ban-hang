import { vndInWords } from './vnd-words';

describe('vndInWords (số tiền bằng chữ trên phiếu in)', () => {
  it('đọc số thường gặp', () => {
    expect(vndInWords(0)).toBe('Không đồng');
    expect(vndInWords(1_250_000)).toBe('Một triệu hai trăm năm mươi nghìn đồng');
    expect(vndInWords(471_880)).toBe('Bốn trăm bảy mươi mốt nghìn tám trăm tám mươi đồng');
  });

  it('mười / mươi, mốt, tư, lăm, lẻ', () => {
    expect(vndInWords(10)).toBe('Mười đồng');
    expect(vndInWords(11)).toBe('Mười một đồng');
    expect(vndInWords(14)).toBe('Mười bốn đồng');
    expect(vndInWords(15)).toBe('Mười lăm đồng');
    expect(vndInWords(21)).toBe('Hai mươi mốt đồng');
    expect(vndInWords(24)).toBe('Hai mươi tư đồng');
    expect(vndInWords(25)).toBe('Hai mươi lăm đồng');
    expect(vndInWords(105)).toBe('Một trăm lẻ năm đồng');
  });

  it('nhóm giữa bằng 0 đọc "không trăm", nhóm toàn 0 bỏ qua', () => {
    expect(vndInWords(1_005_000)).toBe('Một triệu không trăm lẻ năm nghìn đồng');
    expect(vndInWords(2_000_015)).toBe('Hai triệu không trăm mười lăm đồng');
    expect(vndInWords(3_000_000_000)).toBe('Ba tỷ đồng');
  });

  it('trên tỷ: nghìn tỷ, triệu tỷ', () => {
    expect(vndInWords(1_000_000_000_000)).toBe('Một nghìn tỷ đồng');
    expect(vndInWords(1_500_000_000_000)).toBe('Một nghìn năm trăm tỷ đồng');
    expect(vndInWords(2_000_000_000_000_000)).toBe('Hai triệu tỷ đồng');
    expect(vndInWords(5_000_000_007)).toBe('Năm tỷ không trăm lẻ bảy đồng');
    expect(vndInWords(12_345_678_901)).toBe('Mười hai tỷ ba trăm bốn mươi lăm triệu sáu trăm bảy mươi tám nghìn chín trăm lẻ một đồng');
  });

  it('làm tròn tới đồng; số âm có chữ "Âm"', () => {
    expect(vndInWords(999.6)).toBe('Một nghìn đồng');
    expect(vndInWords(-1000)).toBe('Âm một nghìn đồng');
  });
});
