import { ExportDatum } from '../../core/models/einvoice.models';
import { SheetRow } from '../../shared/excel.util';
import { detectColumns, exportRows, extractRef, importRows, parseNumber, splitSerial } from './einvoice-file';

const buyer = { companyName: 'Cty A', name: 'Anh Nam', taxCode: '0101234567', idNumber: '', address: 'Hà Nội', email: '', phone: '' };
const datum = (ref: string, total: number): ExportDatum => ({
  orderId: 'o', ref, orderCode: ref.split('#')[0],
  invoice: {
    issueDate: '2026-11-05', buyer, taxable: 300_000, vatAmount: 30_000, total,
    lines: [
      { no: 1, nature: 1, name: 'Sơn A', unit: 'Thùng', quantity: 3, unitPrice: 100_000, amount: 300_000, vat: '10' },
      { no: 2, nature: 2, name: 'Quà', unit: 'Cái', quantity: 1, unitPrice: 0, amount: 0 },
      { no: 3, nature: 3, name: 'Chiết khấu', unit: '', amount: -10_000, vat: '10' },
    ],
  },
});

describe('file hoá đơn trao đổi với cổng', () => {
  it('xuất: một dòng một dòng hàng, hoá đơn chung số thứ tự, thuế từng dòng làm tròn', () => {
    const rows = exportRows([datum('DH0000001#1', 330_000), { orderId: 'x', error: 'lỗi' }, datum('DH0000002', 330_000)]);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toEqual(['DH0000001#1', 1, '05/11/2026', 'Anh Nam', 'Cty A', '0101234567', 'Hà Nội', '', 'Sơn A', 'Hàng hoá, dịch vụ', 'Thùng', 3, 100_000, 300_000, 10, 30_000]);
    expect(rows[1].slice(8, 10)).toEqual(['Quà', 'Khuyến mại']);
    expect(rows[1][14]).toBe('');
    expect(rows[2].slice(9, 16)).toEqual(['Chiết khấu thương mại', '', null, null, -10_000, 10, -1_000]);
    expect(rows[3][1]).toBe(2); // hoá đơn thứ hai (dòng lỗi không tính số thứ tự)
  });

  it('nhận cột theo tiêu đề thường gặp của cổng', () => {
    expect(detectColumns(['ngay hoa don', 'ky hieu', 'so hoa don', 'dien giai', 'tong tien'])).toEqual({ ref: 'dien giai', series: 'ky hieu', number: 'so hoa don', date: 'ngay hoa don' });
    expect(detectColumns(['ma tham chieu', 'so', 'ngay'])).toEqual({ ref: 'ma tham chieu', series: undefined, number: 'so', date: 'ngay' });
    expect(detectColumns(['abc'])).toEqual({ ref: undefined, series: undefined, number: undefined, date: undefined });
  });

  it('lấy mã tham chiếu trong ô văn bản; tách ký hiệu; đọc số hoá đơn', () => {
    expect(extractRef('Hàng bán DH0000012#2 ngày 05/11')).toBe('DH0000012#2');
    expect(extractRef('DH0000012')).toBe('DH0000012');
    expect(extractRef('Bán lẻ ngày 5')).toBe('');
    expect(splitSerial('1C26TAA')).toEqual({ templateCode: '1', series: 'C26TAA' });
    expect(splitSerial('c26taa')).toEqual({ series: 'C26TAA' });
    expect(splitSerial('xyz')).toEqual({});
    expect(parseNumber(101)).toBe('101');
    expect(parseNumber('0000101')).toBe('0000101');
    expect(parseNumber('123456789')).toBe('');
    expect(parseNumber('1a')).toBe('');
  });

  it('nhập về: bỏ dòng không có mã tham chiếu; nêu dòng thiếu số hoặc ngày', () => {
    const row = (rowNumber: number, v: Record<string, string | number | Date | null>): SheetRow => ({ rowNumber, cells: new Map(Object.entries(v)) });
    const map = { ref: 'dien giai', series: 'ky hieu', number: 'so hoa don', date: 'ngay hoa don' };
    const parsed = importRows([
      row(2, { 'dien giai': 'DH0000001#1', 'ky hieu': '1C26TAA', 'so hoa don': 101, 'ngay hoa don': '05/11/2026' }),
      row(3, { 'dien giai': 'Bán lẻ', 'ky hieu': '1C26TAA', 'so hoa don': 102, 'ngay hoa don': '05/11/2026' }),
      row(4, { 'dien giai': 'DH0000002', 'ky hieu': 'C26TAA', 'so hoa don': 'x', 'ngay hoa don': '05/11/2026' }),
      row(5, { 'dien giai': 'DH0000003', 'ky hieu': 'C26TAA', 'so hoa don': '0000104', 'ngay hoa don': 'hôm qua' }),
      row(6, { 'dien giai': 'DH0000004', 'ky hieu': '', 'so hoa don': '0000105', 'ngay hoa don': new Date('2026-11-06T00:00:00Z') }),
    ], map);
    expect(parsed.rows).toEqual([
      { ref: 'DH0000001#1', number: '101', issueDate: '2026-11-05', series: 'C26TAA', templateCode: '1' },
      { ref: 'DH0000004', number: '0000105', issueDate: '2026-11-06' },
    ]);
    expect(parsed.problems).toEqual(['Dòng 4: số hoá đơn không đọc được.', 'Dòng 5: ngày hoá đơn không đọc được.']);
  });
});
