import { autoAllocate, categoryHint } from './cash-voucher.rules';

describe('autoAllocate (đối trừ tự động: khoản cũ trước)', () => {
  const items = [{ ref: 'DH1', amount: 300 }, { ref: 'DH2', amount: 500 }, { ref: 'DH3', amount: 200 }];

  it('trả hết khoản cũ rồi mới sang khoản sau', () => {
    expect([...autoAllocate(items, 600)]).toEqual([['DH1', 300], ['DH2', 300]]);
  });

  it('tiền nhiều hơn nợ: trả đủ mọi khoản, phần dư không gán vào đâu', () => {
    expect([...autoAllocate(items, 5000)]).toEqual([['DH1', 300], ['DH2', 500], ['DH3', 200]]);
  });

  it('số tiền 0 hoặc âm không đối trừ khoản nào', () => {
    expect(autoAllocate(items, 0).size).toBe(0);
    expect(autoAllocate(items, -100).size).toBe(0);
  });
});

describe('categoryHint', () => {
  it('nói rõ loại thu chi có làm giảm công nợ hay không', () => {
    expect(categoryHint({ partnerType: 'KHACH_HANG' })).toContain('khách hàng');
    expect(categoryHint({ partnerType: 'NHA_CUNG_CAP' })).toContain('nhà cung cấp');
    expect(categoryHint({ partnerType: 'KHAC' })).toContain('chỉ ghi sổ quỹ');
  });
});
