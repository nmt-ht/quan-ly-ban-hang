import { foreignCurrency, priceFor, saleTypeIssue } from './sales-order.rules.js';

const product = {
  id: 'p1', type: 'VAT_TU' as const, retailPrice: 100, wholesalePrice: 80, dropshipPrice: 90,
  unitConversions: [{ unitName: 'Bó', ratioToBaseUnit: 12, price: 1100, wholesalePrice: 900, dropshipPrice: null }],
};

describe('priceFor (bảng giá riêng, Pha 1.6)', () => {
  it('không có bảng giá: theo loại khách và giá riêng của ĐVT quy đổi', () => {
    expect(priceFor(product, 'LE', '')).toBe(100);
    expect(priceFor(product, 'SI', 'Bó')).toBe(900);
    expect(priceFor(product, 'DROPSHIP', 'Bó')).toBe(1080); // không có giá riêng → 90 × 12
  });

  it('bảng giá có đúng ĐVT thì dùng giá đó', () => {
    const list = [{ productId: 'p1', unitName: '', price: 70 }, { productId: 'p1', unitName: 'Bó', price: 800 }];
    expect(priceFor(product, 'SI', '', list)).toBe(70);
    expect(priceFor(product, 'SI', 'Bó', list)).toBe(800);
  });

  it('bảng giá chỉ có ĐVT chính: ĐVT quy đổi = giá đó × tỷ lệ', () => {
    expect(priceFor(product, 'LE', 'Bó', [{ productId: 'p1', unitName: '', price: 75 }])).toBe(900);
  });

  it('mặt hàng không có trong bảng giá: về giá theo loại khách', () => {
    expect(priceFor(product, 'SI', '', [{ productId: 'other', unitName: '', price: 1 }])).toBe(80);
  });
});

describe('saleTypeIssue (bán trong nước / xuất khẩu, as MISA)', () => {
  const lines = (...rates: number[]) => rates.map((vatRate) => ({ vatRate }));

  it('mặc định trong nước: thuế suất tuỳ dòng, thu bằng VND', () => {
    expect(saleTypeIssue({ lines: lines(10, 8, 0) })).toBeNull();
    expect(saleTypeIssue({ saleType: 'TRONG_NUOC', currency: 'VND', lines: lines(10) })).toBeNull();
  });

  it('trong nước không ghi ngoại tệ, tỷ giá', () => {
    expect(saleTypeIssue({ saleType: 'TRONG_NUOC', currency: 'USD', exchangeRate: 25_000, lines: lines(10) })).toMatch(/VND/);
    expect(saleTypeIssue({ saleType: 'TRONG_NUOC', exchangeRate: 25_000, lines: lines(10) })).toMatch(/VND/);
  });

  it('xuất khẩu: mọi dòng thuế GTGT 0%', () => {
    expect(saleTypeIssue({ saleType: 'XUAT_KHAU', lines: lines(0, 0) })).toBeNull();
    expect(saleTypeIssue({ saleType: 'XUAT_KHAU', lines: lines(0, 10) })).toBe('Dòng 2: hàng xuất khẩu chịu thuế GTGT 0%.');
  });

  it('xuất khẩu thu ngoại tệ phải có tỷ giá; tỷ giá phải đi với loại tiền', () => {
    expect(saleTypeIssue({ saleType: 'XUAT_KHAU', currency: 'USD', exchangeRate: 25_400, lines: lines(0) })).toBeNull();
    expect(saleTypeIssue({ saleType: 'XUAT_KHAU', currency: 'usd', lines: lines(0) })).toMatch(/tỷ giá quy đổi USD/);
    expect(saleTypeIssue({ saleType: 'XUAT_KHAU', exchangeRate: 25_400, lines: lines(0) })).toMatch(/Chọn loại tiền/);
  });

  it('VND không phải ngoại tệ', () => {
    expect(foreignCurrency(' vnd ')).toBeNull();
    expect(foreignCurrency('eur')).toBe('EUR');
  });
});
