// "Chọn kỳ" presets shared by list pages. Dates are local calendar days as 'YYYY-MM-DD'
// strings so they compare directly with the ISO dates stored on records.

export type PeriodPreset =
  | 'today' | 'yesterday' | 'last7' | 'last30'
  | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth'
  | 'thisQuarter' | 'lastQuarter' | 'thisYear' | 'lastYear' | 'all';

export interface DateRange {
  from: string | null; // inclusive
  to: string | null; // inclusive
}

// Grouped exactly as the production "Chọn kỳ" menu.
export const PERIOD_GROUPS: { label: string; presets: { value: PeriodPreset; label: string }[] }[] = [
  { label: 'Ngày', presets: [
    { value: 'today', label: 'Hôm nay' },
    { value: 'yesterday', label: 'Hôm qua' },
    { value: 'last7', label: '7 ngày qua' },
    { value: 'last30', label: '30 ngày qua' },
  ] },
  { label: 'Tuần', presets: [
    { value: 'thisWeek', label: 'Tuần này' },
    { value: 'lastWeek', label: 'Tuần trước' },
  ] },
  { label: 'Tháng', presets: [
    { value: 'thisMonth', label: 'Tháng này' },
    { value: 'lastMonth', label: 'Tháng trước' },
  ] },
  { label: 'Quý', presets: [
    { value: 'thisQuarter', label: 'Quý này' },
    { value: 'lastQuarter', label: 'Quý trước' },
  ] },
  { label: 'Năm', presets: [
    { value: 'thisYear', label: 'Năm nay' },
    { value: 'lastYear', label: 'Năm trước' },
  ] },
];

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  ...PERIOD_GROUPS.flatMap((g) => g.presets),
  { value: 'all', label: 'Toàn bộ' },
];

export function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// Weeks start on Monday (Vietnamese convention).
function startOfWeek(d: Date): Date {
  const day = (d.getDay() + 6) % 7;
  return addDays(d, -day);
}

export function presetRange(preset: PeriodPreset, today = new Date()): DateRange {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const y = t.getFullYear();
  const m = t.getMonth();
  const q = Math.floor(m / 3);
  const r = (a: Date, b: Date): DateRange => ({ from: isoDay(a), to: isoDay(b) });
  switch (preset) {
    case 'today': return r(t, t);
    case 'yesterday': return r(addDays(t, -1), addDays(t, -1));
    case 'last7': return r(addDays(t, -6), t);
    case 'last30': return r(addDays(t, -29), t);
    case 'thisWeek': return r(startOfWeek(t), addDays(startOfWeek(t), 6));
    case 'lastWeek': return r(addDays(startOfWeek(t), -7), addDays(startOfWeek(t), -1));
    case 'thisMonth': return r(new Date(y, m, 1), new Date(y, m + 1, 0));
    case 'lastMonth': return r(new Date(y, m - 1, 1), new Date(y, m, 0));
    case 'thisQuarter': return r(new Date(y, q * 3, 1), new Date(y, q * 3 + 3, 0));
    case 'lastQuarter': return r(new Date(y, q * 3 - 3, 1), new Date(y, q * 3, 0));
    case 'thisYear': return r(new Date(y, 0, 1), new Date(y, 11, 31));
    case 'lastYear': return r(new Date(y - 1, 0, 1), new Date(y - 1, 11, 31));
    case 'all': return { from: null, to: null };
  }
}

export function inRange(date: string, range: DateRange): boolean {
  const d = date.slice(0, 10);
  return (!range.from || d >= range.from) && (!range.to || d <= range.to);
}

export function formatDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function rangeLabel(range: DateRange): string {
  if (!range.from && !range.to) return 'Toàn bộ';
  if (range.from === range.to && range.from) return formatDay(range.from);
  return `${range.from ? formatDay(range.from) : '…'} → ${range.to ? formatDay(range.to) : '…'}`;
}
