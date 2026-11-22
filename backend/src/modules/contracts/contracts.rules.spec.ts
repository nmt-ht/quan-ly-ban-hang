import { attachIssue, closeIssue, expiryOf, partyIssue, progressOf, termsIssue } from './contracts.rules.js';

const contract = (over: Partial<Parameters<typeof attachIssue>[0]> = {}) =>
  ({ code: 'HDB0000001', kind: 'BAN', status: 'DANG_THUC_HIEN', customerId: 'c1', supplierId: null, ...over }) as Parameters<typeof attachIssue>[0];

describe('hợp đồng: đối tác và điều khoản', () => {
  it('hợp đồng bán có khách hàng, hợp đồng mua có nhà cung cấp, không bao giờ cả hai', () => {
    expect(partyIssue('BAN', 'c1', null)).toBeNull();
    expect(partyIssue('MUA', null, 's1')).toBeNull();
    expect(partyIssue('BAN', null, null)).toContain('khách hàng');
    expect(partyIssue('BAN', 'c1', 's1')).toContain('không có nhà cung cấp');
    expect(partyIssue('MUA', null, null)).toContain('nhà cung cấp');
    expect(partyIssue('MUA', 'c1', 's1')).toContain('không có khách hàng');
  });

  it('ngày hết hiệu lực không trước ngày bắt đầu; giá trị không âm', () => {
    expect(termsIssue({ startDate: '2026-01-01', endDate: '2026-12-31', value: 0 })).toBeNull();
    expect(termsIssue({ startDate: '2026-02-01', endDate: '2026-01-31' })).toContain('trước ngày bắt đầu');
    expect(termsIssue({ endDate: '2026-01-31' })).toBeNull();
    expect(termsIssue({ value: -1 })).toContain('không được âm');
  });

  it('thanh lý / huỷ: chỉ khi đang thực hiện, không trước ngày ký, không sau hôm nay', () => {
    const c = { status: 'DANG_THUC_HIEN', signedDate: '2026-03-01' } as const;
    expect(closeIssue(c, '2026-06-01', '2026-11-22')).toBeNull();
    expect(closeIssue(c, '2026-02-28', '2026-11-22')).toContain('trước ngày ký');
    expect(closeIssue(c, '2026-11-23', '2026-11-22')).toContain('sau hôm nay');
    expect(closeIssue({ ...c, status: 'DA_THANH_LY' }, '2026-06-01', '2026-11-22')).toContain('thanh lý rồi');
    expect(closeIssue({ ...c, status: 'HUY' }, '2026-06-01', '2026-11-22')).toContain('huỷ rồi');
  });
});

describe('hợp đồng: gắn đơn', () => {
  it('đúng loại, đúng đối tác, còn hiệu lực', () => {
    expect(attachIssue(contract(), 'BAN', 'c1', false)).toBeNull();
    expect(attachIssue(contract(), 'MUA', 's1', false)).toContain('hợp đồng bán, không gắn được vào đơn mua');
    expect(attachIssue(contract(), 'BAN', 'c2', false)).toContain('của khách hàng khác');
    expect(attachIssue(contract({ kind: 'MUA', customerId: null, supplierId: 's1', code: 'HDM0000001' }), 'MUA', 's2', false)).toContain('nhà cung cấp khác');
  });

  it('hợp đồng đã thanh lý / huỷ không nhận thêm đơn, nhưng đơn vốn đã gắn vẫn sửa được', () => {
    expect(attachIssue(contract({ status: 'DA_THANH_LY' }), 'BAN', 'c1', false)).toContain('đã thanh lý');
    expect(attachIssue(contract({ status: 'HUY' }), 'BAN', 'c1', false)).toContain('đã huỷ');
    expect(attachIssue(contract({ status: 'DA_THANH_LY' }), 'BAN', 'c1', true)).toBeNull();
    // đã gắn rồi vẫn phải đúng đối tác
    expect(attachIssue(contract({ status: 'DA_THANH_LY' }), 'BAN', 'c2', true)).toContain('khách hàng khác');
  });
});

describe('hợp đồng: tiến độ và hạn', () => {
  it('phần trăm giá trị đơn trên giá trị hợp đồng; vượt thì báo; không ấn định giá trị thì không có phần trăm', () => {
    expect(progressOf(100_000_000, 25_000_000)).toEqual({ percent: 25, remaining: 75_000_000, over: false });
    expect(progressOf(100_000_000, 100_000_000)).toEqual({ percent: 100, remaining: 0, over: false });
    expect(progressOf(100_000_000, 120_500_000)).toEqual({ percent: 120.5, remaining: -20_500_000, over: true });
    expect(progressOf(0, 5_000_000)).toEqual({ percent: null, remaining: null, over: false });
  });

  it('quá hạn mà chưa thanh lý; sắp hết hạn trong 30 ngày; hợp đồng đã đóng không báo', () => {
    expect(expiryOf('2026-11-21', 'DANG_THUC_HIEN', '2026-11-22')).toBe('expired');
    expect(expiryOf('2026-11-22', 'DANG_THUC_HIEN', '2026-11-22')).toBe('soon');
    expect(expiryOf('2026-12-22', 'DANG_THUC_HIEN', '2026-11-22')).toBe('soon');
    expect(expiryOf('2026-12-23', 'DANG_THUC_HIEN', '2026-11-22')).toBe('none');
    expect(expiryOf(null, 'DANG_THUC_HIEN', '2026-11-22')).toBe('none');
    expect(expiryOf('2026-01-01', 'DA_THANH_LY', '2026-11-22')).toBe('none');
  });
});
