import { Prisma } from '@prisma/client';
import { diff, normalize, vnd } from './audit.diff.js';

describe('audit diff', () => {
  it('compares only the listed fields and labels them', () => {
    const changes = diff({ name: 'A', phone: '1', updatedAt: new Date(1) }, { name: 'B', phone: '1', updatedAt: new Date(2) }, { name: 'Tên', phone: 'Điện thoại' });
    expect(changes).toEqual([{ field: 'name', label: 'Tên', from: 'A', to: 'B' }]);
  });

  it('treats null, undefined and "" as the same empty value', () => {
    expect(diff({ note: null }, { note: '' }, { note: 'Ghi chú' })).toEqual([]);
    expect(diff({}, { note: undefined }, { note: 'Ghi chú' })).toEqual([]);
  });

  it('compares Decimal with number, day dates as YYYY-MM-DD, arrays in any order', () => {
    expect(diff({ price: new Prisma.Decimal('120000') }, { price: 120000 }, { price: 'Giá' })).toEqual([]);
    expect(normalize(new Date('2026-10-22T00:00:00.000Z'))).toBe('2026-10-22');
    expect(diff({ tags: ['b', 'a'] }, { tags: ['a', 'b'] }, { tags: 'Thẻ' })).toEqual([]);
    expect(diff({ tags: ['a'] }, { tags: ['a', 'c'] }, { tags: 'Thẻ' })).toEqual([{ field: 'tags', label: 'Thẻ', from: ['a'], to: ['a', 'c'] }]);
  });

  it('skips fields the new value does not carry', () => {
    expect(diff({ name: 'A', note: 'x' }, { name: 'A' }, { name: 'Tên', note: 'Ghi chú' })).toEqual([]);
  });

  it('formats money in Vietnamese style', () => {
    expect(vnd(1250000)).toBe('1.250.000 ₫');
  });
});
