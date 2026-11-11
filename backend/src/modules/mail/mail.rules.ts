// Email gửi đi — the parts that need no database or network: which documents can be emailed, their default
// templates, filling {placeholders}, checking addresses, and the plain → HTML body. MailService does the rest.

/** The documents an email can be about, and the permission that must already let the user see that document. */
export const MAIL_KINDS = {
  quotation: { label: 'Báo giá', permission: 'quote.view' },
  sales_order: { label: 'Chứng từ bán hàng', permission: 'order.view' },
  purchase_order: { label: 'Đơn mua hàng', permission: 'purchase.view' },
  cash_receipt: { label: 'Phiếu thu', permission: 'voucher.view' },
  debt_reminder: { label: 'Nhắc nợ / Thông báo công nợ', permission: 'debt.remind' },
  debt_reconcile: { label: 'Biên bản đối chiếu công nợ', permission: 'debt.view' },
} as const;

export type MailKind = keyof typeof MAIL_KINDS;
export const isMailKind = (k: string): k is MailKind => Object.prototype.hasOwnProperty.call(MAIL_KINDS, k);

/** The {placeholders} each template may use. The screen that composes the email supplies their values. */
export const MAIL_FIELDS: Record<string, string> = {
  ten_khach: 'Tên khách hàng / nhà cung cấp',
  so_chung_tu: 'Số chứng từ',
  ngay: 'Ngày chứng từ',
  tong_tien: 'Tổng tiền',
  han: 'Hạn (hiệu lực / thanh toán)',
  so_du: 'Số dư công nợ',
  ten_cong_ty: 'Tên doanh nghiệp',
  dien_thoai: 'Điện thoại doanh nghiệp',
  nguoi_gui: 'Người gửi',
};

const SIGN = '\n\nTrân trọng,\n{nguoi_gui}\n{ten_cong_ty} · {dien_thoai}';

export const DEFAULT_TEMPLATES: Record<MailKind, { subject: string; body: string }> = {
  quotation: {
    subject: 'Báo giá {so_chung_tu} — {ten_cong_ty}',
    body: 'Kính gửi {ten_khach},\n\n{ten_cong_ty} xin gửi Quý khách báo giá số {so_chung_tu} ngày {ngay}, tổng giá trị {tong_tien}. Báo giá có hiệu lực đến {han}.\n\nChi tiết xin xem file đính kèm. Quý khách cần điều chỉnh gì xin trả lời email này.' + SIGN,
  },
  sales_order: {
    subject: 'Phiếu xuất kho bán hàng {so_chung_tu} — {ten_cong_ty}',
    body: 'Kính gửi {ten_khach},\n\n{ten_cong_ty} xin gửi Quý khách phiếu xuất kho bán hàng số {so_chung_tu} ngày {ngay}, tổng giá trị {tong_tien}.\n\nChi tiết xin xem file đính kèm.' + SIGN,
  },
  purchase_order: {
    subject: 'Đơn mua hàng {so_chung_tu} — {ten_cong_ty}',
    body: 'Kính gửi {ten_khach},\n\n{ten_cong_ty} gửi Quý công ty đơn mua hàng số {so_chung_tu} ngày {ngay}, tổng giá trị {tong_tien}.\n\nXin xác nhận đơn và ngày giao hàng bằng cách trả lời email này. Chi tiết xem file đính kèm.' + SIGN,
  },
  cash_receipt: {
    subject: 'Phiếu thu {so_chung_tu} — {ten_cong_ty}',
    body: 'Kính gửi {ten_khach},\n\n{ten_cong_ty} xác nhận đã nhận {tong_tien} ngày {ngay} (phiếu thu số {so_chung_tu}). Xin cảm ơn Quý khách.' + SIGN,
  },
  debt_reminder: {
    subject: 'Thông báo công nợ — {ten_cong_ty}',
    body: 'Kính gửi {ten_khach},\n\n{ten_cong_ty} xin thông báo công nợ của Quý khách tính đến ngày {ngay} là {so_du}, hạn thanh toán {han}.\n\nMong Quý khách sắp xếp thanh toán. Nếu đã thanh toán, xin bỏ qua thông báo này.' + SIGN,
  },
  debt_reconcile: {
    subject: 'Biên bản đối chiếu công nợ đến ngày {ngay} — {ten_cong_ty}',
    body: 'Kính gửi {ten_khach},\n\n{ten_cong_ty} gửi Quý khách biên bản đối chiếu công nợ đến ngày {ngay}, số dư {so_du}.\n\nXin Quý khách kiểm tra, ký xác nhận và gửi lại. Nếu có chênh lệch xin trả lời email này.' + SIGN,
  },
};

const EMAIL = /^[^\s@<>(),;:"[\]]+@[^\s@<>(),;:"[\]]+\.[^\s@<>(),;:"[\]]{2,}$/;
export const isEmail = (s: string): boolean => EMAIL.test(s) && s.length <= 254;

/** "a@x.vn, b@y.vn; c@z.vn" or a list → distinct, trimmed, lower-cased addresses, plus the ones that are not valid. */
export function parseAddresses(input: string | string[] | undefined): { ok: string[]; bad: string[] } {
  const parts = (Array.isArray(input) ? input : (input ?? '').split(/[,;\s]+/)).map((s) => s.trim()).filter(Boolean);
  const ok: string[] = [];
  const bad: string[] = [];
  for (const p of parts) {
    const v = p.toLowerCase();
    if (!isEmail(v)) bad.push(p);
    else if (!ok.includes(v)) ok.push(v);
  }
  return { ok, bad };
}

export const MAX_RECIPIENTS = 10; // to + cc together: a document goes to a few people, never a mailing list
export const MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024;

/** The plain body as simple HTML: escaped, paragraphs kept, links left as text. */
export function toHtml(text: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const paras = esc.split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px">${p.replace(/\n/g, '<br>')}</p>`);
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1a1a1a">${paras.join('')}</div>`;
}

/** Ready-made SMTP servers for the settings form (the user can still type any other). */
export const SMTP_PRESETS = [
  { key: 'gmail', label: 'Gmail / Google Workspace', host: 'smtp.gmail.com', port: 587, secure: false, hint: 'Bật xác minh 2 bước rồi tạo "Mật khẩu ứng dụng" ở myaccount.google.com › Bảo mật.' },
  { key: 'outlook', label: 'Outlook / Microsoft 365', host: 'smtp.office365.com', port: 587, secure: false, hint: 'Quản trị viên phải bật "Authenticated SMTP" cho hộp thư này.' },
  { key: 'zoho', label: 'Zoho Mail', host: 'smtp.zoho.com', port: 465, secure: true, hint: 'Dùng mật khẩu ứng dụng nếu đã bật xác minh 2 bước.' },
  { key: 'yandex', label: 'Yandex', host: 'smtp.yandex.com', port: 465, secure: true, hint: 'Tạo mật khẩu ứng dụng cho Mail.' },
] as const;

/** The ports mail providers submit on. Any other port is refused, so the settings form cannot probe other services. */
export const SMTP_PORTS = [25, 465, 587, 2465, 2525, 2587] as const;
export const isSmtpPort = (port: number): boolean => (SMTP_PORTS as readonly number[]).includes(port);

/**
 * An address on this server's own network (loopback, private, link-local, CGNAT, cloud metadata, multicast…): an SMTP
 * host that resolves to one is refused, so a company's settings cannot reach into the platform's internal services.
 */
export function isPrivateAddress(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, '');
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0 && c === 0) || (a === 198 && (b === 18 || b === 19));
  }
  // IPv6: unspecified, loopback, unique-local fc00::/7, link-local fe80::/10, and any other IPv4-mapped form.
  return v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith('::ffff:');
}

/** A short Vietnamese reason for a failed send — the SMTP errors people actually hit. */
export function explainSmtpError(e: unknown): string {
  const err = e as { code?: string; responseCode?: number; message?: string };
  const msg = err?.message ?? String(e);
  if (err?.code === 'EAUTH' || err?.responseCode === 535) return 'Máy chủ email từ chối đăng nhập — kiểm tra tài khoản và mật khẩu ứng dụng.';
  if (err?.code === 'ECONNECTION' || err?.code === 'ETIMEDOUT' || err?.code === 'ESOCKET' || err?.code === 'EDNS')
    return 'Không kết nối được máy chủ email — kiểm tra máy chủ, cổng và kiểu bảo mật (465 = SSL, 587 = STARTTLS).';
  if (err?.responseCode === 550 || err?.responseCode === 553) return 'Máy chủ email từ chối người nhận hoặc địa chỉ gửi: ' + msg;
  if (err?.code === 'EENVELOPE') return 'Địa chỉ người nhận không hợp lệ.';
  return msg.slice(0, 300);
}
