import { highlight, matchesAll, searchWords } from './report-search';

describe('tìm báo cáo', () => {
  it('tìm không dấu, mọi từ phải khớp', () => {
    const w = searchWords('  TON   kho ');
    expect(w).toEqual(['ton', 'kho']);
    expect(matchesAll(w, 'Tồn kho hiện tại', 'Số lượng và giá trị')).toBe(true);
    expect(matchesAll(searchWords('ton quy'), 'Tồn kho hiện tại', 'Số lượng')).toBe(false);
    expect(matchesAll(searchWords('thu chi'), 'Doanh thu')).toBe(false);
    expect(matchesAll(searchWords('dong tien'), 'Sổ quỹ', 'Dòng tiền vào ra')).toBe(true);
  });

  it('đánh dấu phần khớp trên chữ có dấu', () => {
    expect(highlight('Tồn kho hiện tại', searchWords('ton'))).toEqual([
      { text: 'Tồn', hit: true },
      { text: ' kho hiện tại', hit: false },
    ]);
    expect(highlight('Đơn đặt', searchWords('d'))).toEqual([
      { text: 'Đ', hit: true },
      { text: 'ơn ', hit: false },
      { text: 'đ', hit: true },
      { text: 'ặt', hit: false },
    ]);
  });

  it('nhiều từ, từ chồng nhau gộp thành một đoạn', () => {
    expect(highlight('Thu chi', searchWords('th hu chi'))).toEqual([
      { text: 'Thu', hit: true },
      { text: ' ', hit: false },
      { text: 'chi', hit: true },
    ]);
  });

  it('không có từ tìm: giữ nguyên', () => {
    expect(highlight('Sổ quỹ', [])).toEqual([{ text: 'Sổ quỹ', hit: false }]);
  });
});
