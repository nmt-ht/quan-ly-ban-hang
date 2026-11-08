import { describe, expect, it } from 'vitest';
import { DEFAULT_TEMPLATES, MAIL_FIELDS, MAIL_KINDS, explainSmtpError, fill, isMailKind, parseAddresses, toHtml } from './mail.rules.js';

describe('mail rules', () => {
  it('fills placeholders; a missing value shows as … so the gap is seen before sending', () => {
    expect(fill('Kính gửi {ten_khach}, số {so_chung_tu}', { ten_khach: 'Anh Nam' })).toBe('Kính gửi Anh Nam, số …');
    expect(fill('{ten_cong_ty} · {dien_thoai}', { ten_cong_ty: 'NT' })).toBe('NT');
    expect(fill('{ten_cong_ty} · {dien_thoai}', { ten_cong_ty: 'NT', dien_thoai: '0909' })).toBe('NT · 0909');
  });

  it('every default template uses only known placeholders, for every document kind', () => {
    expect(Object.keys(DEFAULT_TEMPLATES).sort()).toEqual(Object.keys(MAIL_KINDS).sort());
    for (const t of Object.values(DEFAULT_TEMPLATES)) {
      for (const [, k] of `${t.subject} ${t.body}`.matchAll(/\{([a-z_]+)\}/g)) expect(MAIL_FIELDS).toHaveProperty(k);
    }
  });

  it('parses addresses: separators, duplicates, case; reports the bad ones', () => {
    expect(parseAddresses('A@x.vn, b@y.com; a@X.vn  nope')).toEqual({ ok: ['a@x.vn', 'b@y.com'], bad: ['nope'] });
    expect(parseAddresses(['c@d.io'])).toEqual({ ok: ['c@d.io'], bad: [] });
    expect(parseAddresses('x@y')).toEqual({ ok: [], bad: ['x@y'] });
  });

  it('kinds are a closed list', () => {
    expect(isMailKind('quotation')).toBe(true);
    expect(isMailKind('constructor')).toBe(false);
  });

  it('the HTML body is escaped and keeps paragraphs', () => {
    const html = toHtml('Chào <b>anh</b>\n\nDòng 2\nDòng 3');
    expect(html).toContain('&lt;b&gt;anh&lt;/b&gt;');
    expect(html).toContain('Dòng 2<br>Dòng 3');
    expect(html.match(/<p /g)).toHaveLength(2);
  });

  it('explains the common SMTP failures in Vietnamese', () => {
    expect(explainSmtpError({ code: 'EAUTH' })).toContain('mật khẩu ứng dụng');
    expect(explainSmtpError({ code: 'ETIMEDOUT' })).toContain('Không kết nối');
  });
});
