import { crc16, transferNote, vietQrPayload } from './vietqr';

describe('VietQR', () => {
  it('CRC16-CCITT (FALSE) chuẩn', () => {
    expect(crc16('123456789')).toBe('29B1');
  });

  it('mã có số tiền: dynamic (12), đủ các trường, CRC đúng', () => {
    const p = vietQrPayload({ bin: '970436', accountNumber: '0123 456 789', amount: 1_250_000, note: 'KH0000002 thanh toán công nợ' });
    expect(p.startsWith('000201010212')).toBe(true);
    expect(p).toContain('0010A000000727');
    expect(p).toContain('0006970436');
    expect(p).toContain('01100123456789');
    expect(p).toContain('0208QRIBFTTA');
    expect(p).toContain('5303704');
    expect(p).toContain('54071250000');
    expect(p).toContain('5802VN');
    expect(p).toContain('0828KH0000002 THANH TOAN CONG NO');
    expect(p.slice(-8, -4)).toBe('6304');
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
  });

  it('không số tiền: static (11), không có trường 54', () => {
    const p = vietQrPayload({ bin: '970422', accountNumber: '999' });
    expect(p.startsWith('000201010211')).toBe(true);
    expect(p).not.toContain('5406');
  });

  it('từ chối BIN hoặc số tài khoản sai', () => {
    expect(() => vietQrPayload({ bin: '97043', accountNumber: '1' })).toThrow();
    expect(() => vietQrPayload({ bin: '970436', accountNumber: '12-34' })).toThrow();
  });

  it('nội dung chuyển khoản không dấu, bỏ ký tự lạ', () => {
    expect(transferNote('Đơn DH0000110 — trả tiền!')).toBe('DON DH0000110 TRA TIEN');
  });

  /** Walks the EMV TLV tags the way a bank app does: every length must land exactly on the next tag, and on the end. */
  function tlvTags(text: string): Record<string, string> {
    const out: Record<string, string> = {};
    let i = 0;
    while (i < text.length) {
      const len = Number(text.slice(i + 2, i + 4));
      expect(Number.isInteger(len)).toBe(true);
      out[text.slice(i, i + 2)] = text.slice(i + 4, i + 4 + len);
      i += 4 + len;
    }
    expect(i).toBe(text.length);
    return out;
  }

  it('đọc lại như app ngân hàng: các trường lồng nhau đúng độ dài, BIN và số tài khoản nằm trong trường 38', () => {
    const p = vietQrPayload({ bin: '970407', accountNumber: '19036789012345', amount: 123_120, note: 'KH0000002 Trần Quốc Bảo' });
    const t = tlvTags(p);
    expect(t['00']).toBe('01');
    expect(t['01']).toBe('12');
    expect(t['53']).toBe('704');
    expect(t['54']).toBe('123120');
    expect(t['58']).toBe('VN');
    const merchant = tlvTags(t['38']);
    expect(merchant['00']).toBe('A000000727');
    expect(merchant['02']).toBe('QRIBFTTA');
    expect(tlvTags(merchant['01'])).toEqual({ '00': '970407', '01': '19036789012345' });
    expect(tlvTags(t['62'])['08']).toBe('KH0000002 TRAN QUOC BAO');
    expect(t['63']).toBe(crc16(p.slice(0, -4)));
  });
});
