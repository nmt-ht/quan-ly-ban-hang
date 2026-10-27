import { vnDay } from './text.js';

describe('vnDay (ngày nghiệp vụ theo giờ Việt Nam)', () => {
  it('0h–7h sáng giờ Việt Nam đã là ngày mới, dù UTC còn ngày hôm trước', () => {
    expect(vnDay(new Date('2026-10-26T17:30:00Z'))).toBe('2026-10-27'); // 0h30 sáng 27/10
    expect(vnDay(new Date('2026-10-27T16:59:59Z'))).toBe('2026-10-27'); // 23h59 tối 27/10
    expect(vnDay(new Date('2026-12-31T17:00:00Z'))).toBe('2027-01-01'); // sang năm mới
  });
});
