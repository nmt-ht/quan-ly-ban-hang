import { describeUrl, seal, TENANT_CODE, tenantDbName, unseal, withDatabase } from './secret-box.js';
import { temporaryPassword } from './tenants.service.js';
import { totpCode, verifyTotp } from './totp.js';

// RFC 6238 appendix B, SHA-1: secret "12345678901234567890" (base32 below), 8-digit codes cut to 6.
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('Mã xác thực TOTP', () => {
  it('khớp vector chuẩn RFC 6238', () => {
    expect(totpCode(RFC_SECRET, Math.floor(59 / 30))).toBe('287082');
    expect(totpCode(RFC_SECRET, Math.floor(1111111109 / 30))).toBe('081804');
    expect(totpCode(RFC_SECRET, Math.floor(2000000000 / 30))).toBe('279037');
  });

  it('nhận mã lệch một bước (đồng hồ điện thoại chậm), từ chối mã cũ hơn', () => {
    const at = 1111111109_000;
    const step = Math.floor(1111111109 / 30);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 1), at)).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, '081 804', at)).toBe(step);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 2), at)).toBeNull();
    expect(verifyTotp(RFC_SECRET, '12345', at)).toBeNull();
  });
});

describe('Nền tảng', () => {
  beforeAll(() => {
    process.env.PLATFORM_SECRET = 'unit-test-platform-secret-0123456789';
  });

  it('mã hoá chuỗi kết nối, không đọc được khi bị sửa', () => {
    const url = 'postgresql://u:p@host/db?sslmode=require';
    const box = seal(url);
    expect(box).not.toContain('host');
    expect(unseal(box)).toBe(url);
    const tampered = Buffer.from(box, 'base64');
    tampered[tampered.length - 1] ^= 1;
    expect(() => unseal(tampered.toString('base64'))).toThrow();
  });

  it('mã doanh nghiệp, tên database, đổi database giữ tham số', () => {
    expect(['abc', 'ninh-trang', 'a1b2c3'].every((c) => TENANT_CODE.test(c))).toBe(true);
    expect(['ab', '1abc', 'Ninh', 'ninh_trang', 'ninh trang', 'a'.repeat(31)].some((c) => TENANT_CODE.test(c))).toBe(false);
    expect(tenantDbName('ninh-trang')).toBe('nt_ninh_trang');
    expect(withDatabase('postgresql://u:p@h:5432/main?sslmode=require', 'nt_x')).toBe('postgresql://u:p@h:5432/nt_x?sslmode=require');
    expect(describeUrl('postgresql://u:secret@h:5432/nt_x')).toBe('h/nt_x');
  });

  it('mật khẩu tạm 12 ký tự, có chữ và số, không có ký tự dễ nhầm', () => {
    for (let i = 0; i < 200; i++) {
      const p = temporaryPassword();
      expect(p).toMatch(/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z2-9]{12}$/);
      expect(p).not.toMatch(/[01OlI]/);
    }
  });
});
