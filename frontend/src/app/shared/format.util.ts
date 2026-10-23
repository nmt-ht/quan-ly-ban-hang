const MINUS = '−'; // U+2212: wider and easier to see than a hyphen

export function formatVnd(amount: number): string {
  const text = Math.abs(amount).toLocaleString('vi-VN') + '₫';
  return amount < 0 ? MINUS + text : text;
}

/** Số lượng (tồn, chênh lệch) — "1.234,5" / "−2", true minus like money. */
export function formatQty(n: number): string {
  const text = Math.abs(n).toLocaleString('vi-VN');
  return n < 0 ? MINUS + text : text;
}

/** "+3" / "−2" — chênh lệch kiểm kê, số tăng/giảm. */
export function formatQtySigned(n: number): string {
  return (n > 0 ? '+' : '') + formatQty(n);
}

/** "+5.000.000₫" / "−430.000₫" — for money flows (thu/chi, phát sinh tăng/giảm). */
export function formatVndSigned(amount: number): string {
  return (amount > 0 ? '+' : '') + formatVnd(amount);
}

/**
 * Colour class for a signed amount (styles.scss): money in / increase → .amt-pos (green),
 * money out / below zero → .amt-neg (red). `flow: false` (a balance) only marks negatives.
 */
export function amountTone(amount: number | null | undefined, flow = true): string {
  if (!amount) return '';
  if (amount < 0) return 'amt-neg';
  return flow ? 'amt-pos' : '';
}

// Lowercase + strip Vietnamese diacritics so "khung nhom" matches "Khung nhôm".
export function foldVi(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

/** dd/mm/yyyy hh:mm, local time. */
export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : iso.replace('T', ' '));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
