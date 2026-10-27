import { describe as describeUnit, normalize, priceFor, pricesBelowFloor, ratioFor } from './unit-conversion';

describe('đơn vị quy đổi', () => {
  it('tỷ lệ về ĐVT chính: × giữ số, ÷ là nghịch đảo, + / − giữ 1:1', () => {
    expect(ratioFor('MUL', 12)).toBe(12);
    expect(ratioFor('DIV', 10)).toBe(0.1);
    expect(ratioFor('DIV', 0)).toBe(0);
    expect(ratioFor('ADD', 5000)).toBe(1);
    expect(ratioFor('SUB', 5000)).toBe(1);
  });

  it('giá một ĐVT quy đổi từ giá ĐVT chính, làm tròn đồng, không âm', () => {
    expect(priceFor('MUL', 12, 1500)).toBe(18000);
    expect(priceFor('DIV', 3, 1000)).toBe(333);
    expect(priceFor('DIV', 0, 1000)).toBe(0);
    expect(priceFor('ADD', 5000, 20000)).toBe(25000);
    expect(priceFor('SUB', 5000, 3000)).toBe(0);
  });

  it('câu mô tả hiện trên form', () => {
    expect(describeUnit('MUL', 12, 'bó', 'cái')).toBe('1 bó = 12 cái');
    expect(describeUnit('DIV', 10, 'lạng', 'kg')).toBe('10 lạng = 1 kg');
    expect(describeUnit('ADD', 5000, 'hộp', 'cái')).toBe('1 hộp = 1 cái, giá cộng thêm 5.000₫');
    expect(describeUnit('SUB', 2000, 'hộp', 'cái')).toBe('1 hộp = 1 cái, giá bớt 2.000₫');
    expect(describeUnit('MUL', 0, 'bó', 'cái')).toBe(''); // chưa nhập tỷ lệ
    expect(describeUnit('MUL', 2, ' ', '')).toBe('1 đơn vị = 2 đơn vị chính');
  });

  it('normalize: dòng cũ thiếu phép tính / giá sỉ / giá dropship được điền theo giá ĐVT chính', () => {
    expect(normalize({ unitName: 'Bó', ratioToBaseUnit: 12, price: 1100 }, { wholesalePrice: 80, dropshipPrice: 90 })).toEqual({
      unitName: 'Bó', operation: 'MUL', factor: 12, ratioToBaseUnit: 12, price: 1100, wholesalePrice: 960, dropshipPrice: 1080,
    });
    expect(normalize({ unitName: 'Hộp', operation: 'ADD', factor: 500, ratioToBaseUnit: 1, price: 1500, wholesalePrice: 1200 }, { wholesalePrice: 800, dropshipPrice: 900 }))
      .toMatchObject({ wholesalePrice: 1200, dropshipPrice: 1400 });
  });
});

describe('giá niêm yết thấp hơn giá bán tối thiểu', () => {
  const base = { retailPrice: 120_000, wholesalePrice: 102_000, dropshipPrice: 0 };
  const bo = { unitName: 'Bó', ratioToBaseUnit: 12, price: 1_400_000, wholesalePrice: 1_300_000, dropshipPrice: 0 };

  it('báo giá sỉ thấp hơn giá sàn; giá 0 (chưa đặt) và giá sàn 0 không xét', () => {
    expect(pricesBelowFloor(110_000, base, [])).toEqual(['Giá sỉ 102.000₫ thấp hơn giá tối thiểu 110.000₫']);
    expect(pricesBelowFloor(0, base, [])).toEqual([]);
    expect(pricesBelowFloor(100_000, base, [])).toEqual([]);
  });

  it('ĐVT quy đổi so với giá sàn × tỷ lệ', () => {
    expect(pricesBelowFloor(110_000, { ...base, wholesalePrice: 110_000 }, [bo])).toEqual([
      'Giá sỉ (Bó) 1.300.000₫ thấp hơn giá tối thiểu 1.320.000₫',
    ]);
  });
});
