# Design — Ninh Trang ERP

A locked design system for the Ninh Trang ERP frontend (`frontend/`). Every page
redesign reads this file before emitting code. Do not regenerate per page —
extend or amend this file when the system needs to grow.

Codename: **Sổ cái** (ledger) — ledger paper, moss ink, dense.

## Audience · use · tone
- **Audience** — office, sales, warehouse and accounting staff at Ninh Trang who
  live in the app all day; Vietnamese UI only.
- **Use** — find a record, read numbers, act on it (lập đơn, xuất kho, thu chi).
- **Tone** — utilitarian, calm, precise. Numbers first; nothing decorative.

## Genre
modern-minimal (ERP / B2B app)

## Macrostructure family
- App pages (every route under the shell): **Workbench** — page header
  (title + count/date left, actions right, hairline under), filters bar, then
  one data surface (table, form cards, or report rail + panel).
- Dashboard: Workbench with stacked sections; the single "needs action" block
  carries a 3 px ink left rule.
- Marketing / content pages: none yet. Add a family here before building one.

## Theme
Source of truth: `frontend/src/tokens.css`. Light values:

- `--color-paper`        oklch(97.6% 0.008 90)
- `--color-surface`      oklch(99.3% 0.004 90)
- `--color-paper-2`      oklch(95.2% 0.010 90)
- `--color-rule`         oklch(89% 0.010 95)
- `--color-rule-strong`  oklch(62% 0.014 100) — control boundaries, ≥ 3:1
- `--color-muted`        oklch(47% 0.014 110) — ≥ 4.5:1 on paper
- `--color-ink`          oklch(22% 0.015 160)
- `--color-ink-2`        oklch(31% 0.014 150)
- `--color-accent`       oklch(43% 0.11 160) — moss
- `--color-accent-ink`   oklch(98.5% 0.006 90)
- `--color-focus`        oklch(50% 0.14 160)

Dark mode (`body.dark-theme`) keeps every hue; only lightness and chroma move.
Status colours (danger / success / warning / info) each have a text + tint
pair; all pairs verified ≥ 5.4:1 light, ≥ 5.6:1 dark.

Axes: light / geometric-sans / chromatic-moss.

## Typography
- Display: Be Vietnam Pro 600, tracking -0.01em, roman only (no italic headings)
- Body: Be Vietnam Pro 400 (350 in dark mode)
- Mono: JetBrains Mono 400/500 — order/tax/plate codes, amounts, stat values,
  dates in charts. Falls back to Be Vietnam Pro for `₫`.
- Scale: 11 · 12 · 13 (tables, controls) · 14 (body) · 16 (card heading) ·
  20 (stat value) · 24 (page title).
- Money is always `tabular-nums`, right-aligned in tables.
- Signed money (format.util): negatives use a true minus "−" (U+2212), never a
  hyphen. Flows (thu/chi, phát sinh tăng/giảm, Thu − Chi) show "+" / "−" and
  `.amt-pos` (success green) / `.amt-neg` (danger red). Balances stay ink when
  positive and only turn `.amt-neg` when below zero (e.g. trả trước). Colour is
  never the only cue — the sign is always printed. In tables use the column
  option `tone` (+ `toneFlow: false` for balances).

## Spacing
4-point named scale in `tokens.css` (`--space-3xs` 4px → `--space-xl` 48px).
Pages use named tokens, never raw px.

## Density
Compact: controls and table rows 36 px; nav links 30 px (44 px on touch
widths); table text 13 px.

## Shape
- `--radius-control` 6 px (buttons, inputs, badges)
- `--radius-card` 8 px
- Hairline 1 px borders define surfaces. One shadow only: dropdown menus.

## Motion
- Easings: `--ease-out` cubic-bezier(0.16, 1, 0.3, 1), `--ease-in`, `--ease-in-out`.
- Durations: 140 ms (state changes), 220 ms (drawer).
- Reveal pattern: none — the app is composed, not animated.
- Reduced motion: transitions collapse to ~0 ms.

## Microinteractions stance
- Silent success; no celebratory toasts.
- Hover only under `@media (hover: hover)`; pressed = 1 px down.
- `:focus-visible` ring 2 px `--color-focus`, offset 2 px, never animated.
- Disabled = 0.5 opacity + `not-allowed`.

## CTA voice
- Primary: solid moss fill, 6 px radius, verb-first label ("Lập đơn hàng").
  One primary per page header.
- Secondary: surface fill + `--color-rule-strong` border, same shape.
- Inline actions: `.link-btn` — accent text, underline on hover.
- No emoji or pictographs in labels or headings.

## Navigation
N3 side-rail (232 px, collapsible to 64 px). Active item = accent tint + 2 px
accent bar. Under 768 px the rail becomes an off-canvas drawer opened by the
"Menu" button (Esc / scrim closes).

Icons: one hand-drawn set in `frontend/src/app/layout/nav-icon/` — 24 px grid,
1.75 stroke, round caps/joins, `currentColor`, rendered at 18 px. Muted at rest,
ink on hover, accent when active. Collapsed rail shows icon only; the label
stays as the accessible name + `title`. Add new icons to that component — never
mix in a second icon library or emoji.

## Forms
- Labels above inputs, sentence case, 13 px / 500.
- Required fields: `<span class="required-mark">*</span>` after the label text,
  coloured `--color-danger`.
- Money inputs: `<input type="text" appMoney>` (shared/money-input.directive) —
  groups thousands as you type ("100.000"), keeps the caret, control value is a
  plain number; right-aligned mono.
- Fields that a choice removes are not just hidden: a dashed `.form-note`
  says why (e.g. "Không theo dõi tồn kho nên không có Kho ngầm định…").
- Product form by Tính chất (rules in features/products/product-type-rules.ts):
  Vật tư = everything; Thành phẩm = Cách tính (m² / mét dài) fixes the unit,
  no stock fields, no Đơn vị quy đổi; Dịch vụ = no stock fields.
- Repeating rows (e.g. Đơn vị quy đổi): each row is a bordered paper well with
  its own labels and a trash icon button at the end; section header carries the
  add button and any bulk action.

## List pages (reference: Danh mục hàng hoá)
- Header actions carry an icon + verb label: Xuất Excel (download), Lưới/Bảng
  `.segmented` toggle (remembered per browser), Nhập … (upload), primary
  "Thêm …" (plus). One primary button per header.
- Filter bar: search · `app-filter-multi-select` (checkbox dropdown, optional
  search + counts) · native selects · `.filter-toggle` buttons
  (`aria-pressed`, pressed = ink fill) · sort select. Active filters repeat as
  `.filter-chip`s with × and "Xoá tất cả bộ lọc".
- Table (`app-data-table`): codes in mono with `copy: true`; badge columns via
  `badge`; per-column filter row (`filterable`) — text = diacritic-insensitive
  contains, number = `100 · >100 · <=5 · 10-20`, badge = select. Column
  filters, like every other filter, run before pagination.
- Row actions: icon-only Xem chi tiết (eye) / Sửa (pencil), sticky right,
  each with `aria-label` + `title`.
- Grid view: `.product-card` tiles, same actions.
- `app-pagination` under the list: range "1–20 / 27", pages, 20/50/100 per
  page; any filter/sort change returns to page 1.
- Import: native `<dialog>` — template download, file pick, preview counts +
  per-row errors, then confirm. Bad rows are skipped; result shows in a quiet
  `.notice` line. Excel files are generated/parsed client-side with ExcelJS
  (lazy-loaded).

## Status & category colours (user-configurable)
- Users pick them in **Thiết lập → Màu hiển thị**: a hue per item (12 swatches +
  slider) or Xám. Lightness/chroma are fixed tokens (`--tag-*-light/-dark` in
  tokens.css), so every hue is ≥ 5.4:1 light / ≥ 7.3:1 dark text-on-tint.
- Code: groups + defaults in `core/services/display-colors.service.ts`; it writes
  `.tag-<group>-<key> { --tag-h; --tag-c }` rules; `.tag` in styles.scss turns
  them into colours. Badge = `class="badge"` + `tagClass(group, key)`
  (shared/tag-class.ts); helpers per entity live in shared/status-labels.ts.
- Defaults: Vật tư 250 · Thành phẩm 50 · Dịch vụ 330; Đang kinh doanh 150,
  Ngừng/Huỷ = Xám. Moss (accent) is never a tag colour by default.
- New status sets: add a group to TAG_GROUPS, then use `tagClass` — no CSS.
- Storage: localStorage for now; move to a company setting (backend) with the
  `company.update` permission.

## Topbar
- Right side = one account menu (`layout/account-menu`, WAI-ARIA menu button):
  avatar initials + name/role (avatar only on mobile) → header (name, email,
  role) · Giao diện (Sáng / Tối / Theo hệ thống, `menuitemradio`) · separator ·
  Đăng xuất (danger, last). No loose buttons next to it.
- Theme is a personal preference (`core/services/theme.service.ts`, saved per
  browser, follows the OS when "Theo hệ thống").

## Voucher screens (chứng từ, MISA-style) — reference: Đơn nhập hàng
- The product is being remade to work like MISA. Business documents (đơn nhập,
  later đơn bán, phiếu kho, phiếu thu chi) use ONE screen for lập / xem / sửa:
  title bar (back · "Loại chứng từ SỐ" · copy · status badge) → header card
  (4-col field grid; read-only values on paper-2 wells; right panel = status
  box + big "Tổng tiền thanh toán") → tabs (lines · related vouchers) →
  editable goods grid (#, hàng hoá picker, kho, ĐVT, SL, đơn giá, thành tiền,
  % thuế, tiền thuế; "Cộng" row; paginated) → totals footer (Tổng tiền hàng /
  Thuế GTGT / Tổng tiền thanh toán) → sticky action bar (left: first missing
  thing; right: actions allowed by status).
- No accounting-account columns (no chart of accounts yet).
- Styles live in `shared/voucher/voucher.scss`; a voucher adds only its own
  extras (e.g. Đơn hàng bán: Tỷ lệ CK % / Tiền CK, Dài × Rộng for thành phẩm,
  Ghi chú per line, "Chiết khấu cả đơn" input in the totals footer).
- Đơn hàng bán: header adds Bảng giá áp dụng (by loại khách) and Hạn thanh
  toán; hand-typed prices carry a small warning dot and are not re-priced when
  the customer changes. Status actions in the bar: Lập lệnh sản xuất →
  Giao hàng (dialog, like Nhận hàng) → Lập phiếu thu / Kết thúc đơn.
- Product choice uses `app-product-picker` (search, VT/SP/DV tag, code, stock).

## Detail pages
- Header (title, code + copy, type/status badges, Sửa) then `role=tablist`
  tabs; the tab is kept in `?tab=`. Tabs appear only when they apply to the
  record (e.g. no Tồn kho / Lịch sử for Dịch vụ).
- Codes in lists link to their detail page (`.code-link`).
- Partner pages (reference: Nhà cung cấp): header actions = Danh sách · verb
  for the next document ("Lập đơn nhập", carries `?ncc=` to pre-fill) ·
  status switch ("Ngừng hợp tác" as `.btn-danger-ghost`, "Hợp tác lại") ·
  primary Sửa. Status switches are not deletes; a quiet `.notice` says what
  still happens (open orders keep receiving). Overview tab = field list left,
  Công nợ panel right; Công nợ tab = open items with due/overdue + payments.

## Debt pages (công nợ) — reference: Công nợ phải trả
- List: totals line (Tổng · quá hạn · trả trước) + `.aging-strip` (stacked bar,
  green → red by tuổi nợ) above the table; "Chỉ đối tác còn nợ" on by default.
- Sổ chi tiết = same route with `?partnerId=`: big Số dư (all history), facts,
  period filter → Số dư đầu kỳ / Cộng phát sinh / Số dư cuối kỳ rows; columns
  Phát sinh tăng · giảm · Đã đối trừ · Còn lại · Hạn / tình trạng · Số dư.
- Numbers come only from `DebtService` (one settle engine: chọn tay first, then
  oldest due first); pages never re-derive balances.
- Biên bản đối chiếu prints from the same data (`.print-only` block).
- Vouchers opened from a page carry `?back=` and return there with a notice.

## Record forms (thêm / sửa danh mục) — reference: Nhà cung cấp
- One component for `/x/them` and `/x/:id/sua`; breadcrumb "Danh sách / MÃ / Sửa".
- System code shown first as a locked field ("Tự sinh khi lưu" on create).
- Inline messages under the field: `.hint.text-danger` blocks saving
  (format, duplicate tax code); `.hint.text-warning` only warns (same name).
- Sticky `.form-actions-bar`: left hint ("Điền thông tin rồi bấm Lưu" /
  "Còn thông tin chưa hợp lệ"), right Huỷ + primary ("Tạo …" / "Lưu thay đổi").
  On a failed save, focus moves to the first invalid field.
- After saving, go to the detail page with a `history.state.notice`.

## What pages MUST share
- The `NT` ink mark + "Ninh Trang" wordmark.
- Moss accent, used ≤ 5 % per viewport: active nav, primary button, links,
  focus, chart bars.
- Be Vietnam Pro + JetBrains Mono.
- Page header pattern and button shapes above.
- Legacy `--nt-*` variables stay as aliases of the tokens (see
  `frontend/src/styles.scss`) — new code uses `--color-*` directly.

## What pages MAY differ on
- Table vs form vs report-rail layout inside the Workbench frame.
- Per-column mono via `DataTableColumn.mono`.

## Exports

### tokens.css
`frontend/src/tokens.css` (loaded via `@use 'tokens'` in `styles.scss`).
