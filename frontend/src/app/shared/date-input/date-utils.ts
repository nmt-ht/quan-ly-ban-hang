// Ngày dạng dd/mm/yyyy trong ô nhập; trong dữ liệu luôn là "YYYY-MM-DD" (không qua Date nên không lệch múi giờ).

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export const daysInMonth = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** "2026-11-16" → "16/11/2026"; rỗng hoặc sai dạng → "". */
export function isoToDmy(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** "16/11/2026" → "2026-11-16"; null khi chưa đủ hoặc không phải ngày có thật (30/02, 13/13…). */
export function dmyToIso(text: string): string | null {
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text.trim());
  if (!m) return null;
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
  return `${pad(y, 4)}-${pad(mo)}-${pad(d)}`;
}

/**
 * Gõ số thì tự chèn "/" sau ngày và tháng: "1611" → "16/11/", "16112026" → "16/11/2026"; chỉ giữ chữ số. `grew` = người dùng đang gõ thêm
 * (false khi xoá lùi, để dấu "/" không chặn việc xoá).
 */
export function maskDmy(raw: string, grew = true): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  const out = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter((p) => p.length).join('/');
  return grew && (digits.length === 2 || digits.length === 4) ? out + '/' : out;
}

export interface CalendarCell {
  iso: string;
  day: number;
  inMonth: boolean;
}

/** Lưới 6 tuần × 7 ngày của một tháng, thứ Hai đầu tuần (cách tính của người Việt). */
export function monthGrid(year: number, month: number): CalendarCell[] {
  const first = Date.UTC(year, month - 1, 1);
  const lead = (new Date(first).getUTCDay() + 6) % 7; // T2 = 0 … CN = 6
  const start = first - lead * 86_400_000;
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start + i * 86_400_000);
    return { iso: `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, day: d.getUTCDate(), inMonth: d.getUTCMonth() === month - 1 };
  });
}

export const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
