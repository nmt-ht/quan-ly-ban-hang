import { TagColorKey } from '../core/models/domain.models';

// The 12 colours of production's "Thêm thẻ" dialog. Each is only a hue: lightness and chroma come
// from the --tag-* tokens (styles.scss › .tag), so every colour is readable in light and dark mode.
export const TAG_COLORS: { key: TagColorKey; label: string; hue: number | null }[] = [
  { key: 'gray', label: 'Xám', hue: null },
  { key: 'red', label: 'Đỏ', hue: 25 },
  { key: 'orange', label: 'Cam', hue: 50 },
  { key: 'amber', label: 'Hổ phách', hue: 75 },
  { key: 'lime', label: 'Xanh chanh', hue: 125 },
  { key: 'emerald', label: 'Xanh ngọc', hue: 160 },
  { key: 'teal', label: 'Xanh mòng két', hue: 185 },
  { key: 'cyan', label: 'Xanh lơ', hue: 215 },
  { key: 'blue', label: 'Xanh dương', hue: 250 },
  { key: 'indigo', label: 'Chàm', hue: 275 },
  { key: 'violet', label: 'Tím', hue: 300 },
  { key: 'pink', label: 'Hồng', hue: 350 },
];

export const DEFAULT_TAG_COLOR: TagColorKey = 'blue';

/** Inline custom properties for a `.tag` chip of this colour. */
export function tagStyle(color: TagColorKey | undefined): Record<string, string> {
  const c = TAG_COLORS.find((x) => x.key === (color ?? DEFAULT_TAG_COLOR)) ?? TAG_COLORS[8];
  return c.hue === null ? { '--tag-h': '250', '--tag-c': '0' } : { '--tag-h': String(c.hue), '--tag-c': '1' };
}
