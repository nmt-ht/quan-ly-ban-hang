// Small helpers shared by the danh mục modules.

/** Lower-case, no Vietnamese accents, single spaces: "Kho  Thành phẩm" and "kho thanh pham" compare equal. */
export function foldVi(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Trimmed text, or null when empty — what an optional column should store. */
export function blank(s: string | null | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

/** "YYYY-MM-DD" for a @db.Date column (stored at UTC midnight); null stays null. */
export function toDay(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** "YYYY-MM-DD" from the API → Date at UTC midnight for a @db.Date column. */
export function fromDay(s: string | null | undefined): Date | null {
  return s ? new Date(`${s.slice(0, 10)}T00:00:00Z`) : null;
}

const VN_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' });

/**
 * Ngày nghiệp vụ "YYYY-MM-DD" theo giờ Việt Nam. The server runs on UTC, where 0h–7h sáng giờ Việt Nam is still the day
 * before — every "hôm nay" of a chứng từ (ngày xuất kho, chốt giao, phiếu thu tự lập, khoá sổ) comes from here.
 */
export function vnDay(at: Date = new Date()): string {
  return VN_DAY.format(at);
}
