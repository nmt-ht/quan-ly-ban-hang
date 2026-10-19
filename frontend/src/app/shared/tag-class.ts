// CSS class of a user-colourable tag. Colours are set in Thiết lập → Màu hiển thị
// (core/services/display-colors.service.ts), which writes the matching `.tag-<group>-<key>` rule.
export function tagClass(groupId: string, key: string): string {
  return `tag tag-${groupId}-${key}`;
}
