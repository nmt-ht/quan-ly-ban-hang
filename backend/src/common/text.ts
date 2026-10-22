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
