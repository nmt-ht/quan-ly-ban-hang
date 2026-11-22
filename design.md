# Design — Ninh Trang ERP

A locked design system for the Ninh Trang ERP frontend (`frontend/`). Every page
redesign reads this file before emitting code. Do not regenerate per page —
extend or amend this file when the system needs to grow.

Codename: **Sổ cái** (ledger) — ledger paper, moss ink, dense. Since 22/11/2026 (Hallmark redesign): **one accent on every
page** — moss. (From 25/10 to 22/11/2026 each phân hệ wore its own hue; that was taken out, see "One accent" below.)

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
  one data surface (table, form cards, or a report under its group tabs).
- Dashboard: Workbench with stacked sections, ordered by what the reader must do first (see
  "Dashboard (Tổng quan)" below); the single "needs action" block carries a 3 px ink left rule.
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
- `--color-accent`       oklch(40% 0.09 158) — moss
- `--color-accent-ink`   oklch(98.5% 0.006 90)
- `--color-focus`        oklch(48% 0.11 158)

Dark mode (`body.dark-theme`) keeps every hue; only lightness and chroma move.
Status colours (danger / success / warning / info) each have a text + tint
pair; all pairs verified ≥ 5.5:1 light, ≥ 5.1:1 dark.
Status hues: danger 16 (crimson) · warning 84–88 (golden amber) · success 144 · info 239.

Axes: light / geometric-sans / chromatic-moss.

### Colour rules (best-practice pass, 08/11/2026)
- **Every token sits inside sRGB.** Pick L and H first, then the highest chroma that still fits sRGB — never more.
  An out-of-gamut value renders clipped on ordinary screens and more saturated on P3 screens (MacBook, iPhone), so
  the same moss looked different per device and the computed contrast was not what people saw. That pass lowered
  chroma on 18 values (brand moss 0.11 → 0.097, stock orange, cash teal, several tints and dark focus rings);
  L and H did not move, and every contrast pair still passes.
- **Inactive content is never faded with `opacity`.** A ngừng dùng record is still content people read: it gets a
  dashed edge (the same language as an off toggle), a quiet fill and `--color-muted` text, which stays ≥ 4.5:1;
  0.6 opacity put it under 3:1. The words "Ngừng dùng" are always printed too. Opacity stays only on disabled
  controls (`.btn:disabled`, a dead nav arrow), which WCAG exempts.
- **Fixed light / dark anchors.** `--light-surface`, `--dark-surface`, `--dark-muted` hold the raw values; the modes
  point at them, and so does anything that must show one mode whatever the theme (logo tile, the side-by-side
  preview in Màu hiển thị). No raw colour outside tokens.css — except the print papers (black on white by design).
- **Windows high-contrast.** `@media (forced-colors: active)` (end of styles.scss): every state that lives only in
  a tint (active menu item, selected tab / segment, pressed toggle, palette row) takes `Highlight` / `HighlightText`;
  small swatches whose colour is the meaning (aging dots, Màu hiển thị swatches) opt out with `forced-color-adjust`.
  A new tint-only state must be added to that list.
- **The accent is never mistaken for a status.** Moss (hue 158) and success green (144) are close in hue, so they are told
  apart by what they do, not by hue alone: the accent fills actions, selected states and focus; success only ever appears
  as a text + tint pair next to a word or an icon ("Đã thu", ✓), never as a button or a selected row. Danger is crimson
  (16), warning golden amber (84–88), info blue (239); dark mode spreads them by lightness (moss 68 %, success 80 %).
- **Browser chrome follows the theme.** ThemeService writes `--color-paper` (as hex) into `<meta name="theme-color">`;
  index.html carries the light paper for first paint.

### One accent (since 22/11/2026)
Every page, in every phân hệ, uses the same moss accent (`--color-accent`, `-hover`, `-tint`, `--color-focus`; light
oklch(40% 0.09 158), dark oklch(68% 0.11 158)). There is no per-module remapping: the `data-module` attribute,
`moduleOf()`, the `--mod-*` tokens and `ModuleKey` are gone, and a new menu group or report group names nothing but its label.

Where the accent shows (≤ 5 % of a viewport): primary buttons, links, the selected menu item (tint + 3 px bar), selected
tabs / segments, focus rings, the 3 px edge along the top of the topbar and the progress streak under it. Where it does
**not**: menu icons (muted, ink on hover), figure tiles of `dl.list-totals` (neutral paper, status tint only for a
problem), icon tiles in Báo cáo and Thông báo (neutral paper), the Tổng quan area panels (no coloured rule or heading).
Charts keep to the one hue: series differ by lightness, never by a second colour (`--chart-1` moss, `--chart-2` neutral
grey, `--chart-3` ink line; dark mode mirrors them). Status colours (danger / success / warning / info) keep their
meaning everywhere. User-chosen tag colours (Màu hiển thị) are data, not theme, and stay as picked.

## Typography
- Display: Be Vietnam Pro 600, tracking -0.01em, roman only (no italic headings)
- Body: Be Vietnam Pro 400 (same weight in dark mode — the font is static, 350 is not available)
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
- `--radius-control` 8 px (buttons, inputs, badges) — softened from 6 px with the phân hệ colours
- `--radius-card` 12 px (from 8 px)
- Hairline 1 px borders define surfaces. One shadow only (`--shadow-pop`): floating menus and panels.

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

## Naming (MISA, since 08/11/2026)
Phân hệ and screen names follow MISA so staff who know MISA find things where they expect them. Menu, page titles,
breadcrumbs, tab titles, permissions, nhật ký, command palette, prints and Excel exports all use these names; URLs did
not change (`/don-hang`, `/thiet-lap/...` stay as they were).

| Was | Now (MISA) |
|---|---|
| Nghiệp vụ (group) | Kho |
| Dòng tiền (group) | Quỹ & ngân hàng — "Dòng tiền" stays as the dashboard / report analysis name |
| Thiết lập (group) | split: **Danh mục** (Kho, Nhóm VTHH, Thẻ đánh dấu) · **Hệ thống** (the rest) |
| Hàng hoá / Danh mục hàng hoá | Vật tư hàng hoá (the catalogue; goods-line columns stay "Hàng hoá") |
| Phiếu kho | Nhập, xuất kho (the screen) · chứng từ kho (one document; still phiếu nhập / xuất kho) |
| Đơn nhập hàng | Đơn mua hàng |
| Đơn hàng bán / đơn hàng | Chứng từ bán hàng ("đơn" alone stays as the short form in prose); its printout is titled **PHIẾU XUẤT KHO BÁN HÀNG** |
| Bảng giá | Chính sách giá |
| Khuyến mãi | Chương trình khuyến mại (the legal term is khuyến **mại**) |
| Phiếu thu chi | Thu, chi tiền (the screen) · phiếu thu, chi (documents) |
| Tuổi nợ | Phân tích tuổi nợ |
| Nhóm hàng | Nhóm VTHH (page title: Nhóm vật tư, hàng hoá, dịch vụ) |
| Thông tin công ty | Thông tin doanh nghiệp |
| Người dùng | Quản lý người dùng (screen); "người dùng" in prose |
| Chức vụ & phân quyền / chức vụ | Vai trò và quyền hạn / vai trò |
| Nhật ký hoạt động | Nhật ký truy cập |

Kept on purpose: the product Excel import template (sheet "Hàng hoá", column "Nhóm hàng") so old files still import;
the customer import reads both "Chính sách giá" and the old "Bảng giá" header (`ImportColumn.aliases`). Text the
backend writes (error messages, seeded role descriptions, nhật ký lines) still uses the old words until the server
is renamed too. A new screen takes its MISA name first; when MISA has none (Chuyến giao hàng, Danh mục xe, Thẻ
đánh dấu, Nhắc nợ, Màu hiển thị) keep a plain Vietnamese noun phrase in the same style.

## Navigation
N3 side-rail (232 px, collapsible to 64 px). Active item = the accent tint + 3 px
bar. Folding a group is instant (a height is never animated). Under 768 px the rail becomes an off-canvas drawer opened by the
"Menu" button (Esc / scrim closes).

Icons: one hand-drawn set in `frontend/src/app/layout/nav-icon/` — 24 px grid,
1.75 stroke, round caps/joins, `currentColor`, rendered at 18 px. In the menu icons are
muted (hover: ink; the active item's icon takes the accent). Collapsed rail shows icon only; the label
stays as the accessible name + `title`. Add new icons to that component — never
mix in a second icon library or emoji.

**One icon per menu item, never shared** (reviewed 08/11/2026). The list, by phân hệ:
Tổng quan `dashboard` · Báo cáo `report` ·
Kho: Vật tư hàng hoá `product` · Tồn kho `stock` · Nhập, xuất kho `arrows-inout` · Lệnh sản xuất `factory` ·
Mua hàng: Nhà cung cấp `supplier` (storefront) · Đơn mua hàng `cart` · Công nợ phải trả `ledger-out` ·
Bán hàng: Khách hàng `customers` · Báo giá `voucher` · Chính sách giá `tag` · Chương trình khuyến mại `percent` ·
Chứng từ bán hàng `receipt` · Chuyến giao hàng `truck` · Danh mục xe `car` · Công nợ phải thu `ledger-in` · Nhắc nợ `bell` ·
Quỹ & ngân hàng: Thu, chi tiền `cash` · Phân tích tuổi nợ `hourglass` ·
Danh mục: Kho `warehouse` · Nhóm VTHH `folder` · Thẻ đánh dấu `bookmark` ·
Hệ thống: Thông tin doanh nghiệp `company` (office block) · Quản lý người dùng `user` · Vai trò và quyền hạn `shield` ·
Màu hiển thị `palette` · Nhật ký truy cập `history`.
A button elsewhere that opens one of these screens uses the same icon. Before adding a menu item, check its icon is not
already taken and that its silhouette does not read like a neighbour's (four tiles = Tổng quan only; a pitched roof =
Kho only).

## Forms
- **Dates are dd/mm/yyyy, in Vietnamese, everywhere.** Never `<input type="date">` / `type="month"`: the browser draws those in its own language (mm/dd/yyyy, "Jan Feb", "This month"). A date field is `<input appDate [(ngModel)]>` (shared/date-input: typing digits inserts the "/", clicking opens a Vietnamese calendar, Monday first, Hôm nay / Xoá; the value stays `YYYY-MM-DD`; `[min]`/`[max]` grey out days). A month is `<app-month-picker>` (Tháng 1–12 + năm, value `YYYY-MM`); a date range is `<app-period-filter>`.
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
- **Divide the rows before filtering them** (`shared/list-divide`: `app-list-tabs` + `app-list-rail`, styles in
  `.list-divided` / `.list-split` / `.ld-*`). The fixed axis is a tab strip above the list (`.detail-tabs` look,
  `aria-pressed`, each tab with its count); the physical or user-made axis is a rail beside it (13.5 rem, sticky under
  the topbar): "Tất cả …" first, every entry with its count (empty ones stay, muted, so the rail never jumps). The open
  entry reads like the sidebar's active link (accent tint + 2 px bar). Tab counts honour the open rail entry and vice
  versa; both follow the other filters. Both live in the address (`syncSliceToUrl`). Under 52 rem (container) the tabs
  scroll sideways in one row and the rail becomes a row of chips. A totals strip never repeats a count the tabs show.
  | Page | Tabs | Rail |
  | --- | --- | --- |
  | Hàng hoá | Tính chất (?tc=) | Nhóm hàng + Chưa phân nhóm (?nhom=) |
  | Tồn kho | Tính chất, no Dịch vụ (?tc=) | Kho (?kho=) — counts use the list's own rules per kho |
  | Phiếu kho | Loại phiếu (?loai=) | Kho (?kho=) — a chuyển kho counts in both |
  | Lệnh sản xuất | Trạng thái, lifecycle order (?tt=) | — none: Thành phẩm is a searchable multi-select (?tp=id,id) |
  **A rail is only for a bounded, curated axis** (Kho, Nhóm hàng — tens, not thousands). An open-ended axis (thành phẩm,
  khách hàng, nhà cung cấp) is a searchable `app-filter-multi-select` with counts in the filter bar, and the table keeps
  the full width. A rail with more than 12 entries shows its own search box ("Tất cả" and the open entry always stay);
  a rail whose entries the user manages ends with a quiet link to that page (`.ld-manage`, e.g. "Quản lý nhóm hàng").
- **Every grid with a Mã column opens sorted by Mã, ascending** (numeric-aware compare). A page with a "Sắp xếp" select
  defaults the select to "Mã tăng dần" (added where missing); a page without one uses it as its base order. Exceptions
  where time order *is* the content: Lịch sử nhập xuất (running stock), sổ công nợ, tuổi nợ, voucher lines (entry order),
  report tables (their own definition, e.g. "quay chậm nhất lên đầu").
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
- Every grid keeps the row's identity in view: `table[appFrozenCols]` (shared/frozen-cols.directive.ts) freezes the
  leading columns while the grid scrolls sideways. `app-data-table` and report tables freeze the leading run of
  `image · code · name · plateNumber` (max 3) on their own; hand-written grids pass a count (voucher lines: # + Hàng
  hoá). The frozen block ends in a hairline, a 2 px `--color-rule-strong` edge once scrolled. A cell spanning several
  columns (Cộng, "no rows") never freezes. Phones (≤ 40rem) keep only the first column.
- Body rows alternate surface / `--color-row-alt` (zero-specificity rule in styles.scss, so hover, an editing row and
  footers keep their fills). Inserted rows (opened detail, period heading, no-match) do not count, and a sticky cell
  follows its row's stripe.
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
- Storage: a company setting on the server (`GET/PUT /api/company/display-colors`,
  `CompanyInfo.tagColors`); everyone reads it, changing needs `company.update`.

## Lifecycle steps (thanh các bước) — `app-status-steps`
- For a document that moves through a fixed sequence. On the record page of: Chuyến giao hàng (Gom đơn → Xuất kho & chốt giao → Xe về kho → Hoàn tất),
  Đơn bán (Lên đơn → Sản xuất, only when it has thành phẩm → Giao hàng → Hoàn thành), Đơn mua (Nháp → Gửi NCC → Nhận hàng → Hoàn tất), Lệnh sản xuất
  (Nháp → Đang sản xuất → Hoàn tất). Báo giá has only two states and stays a badge. The sequence and the status → step mapping live in each
  document's `*.rules.ts` (`salesOrderSteps`, `purchaseOrderSteps`, `productionSteps`, `tripSteps`), tested there; a partial state (giao một phần,
  nhận một phần) is a short `hint` after the current label. It sits in the header card, above the explanatory note, for an existing record only. One
  component, never a hand-made list: `<app-status-steps [steps]="…" ariaLabel="…" />`, steps built with `stepsAt(labels, indexOfCurrent, finished)`.
- A numbered round marker per step, joined by a line. **Done**: filled moss marker with a tick, the line after it moss. **Current**: moss ring on a
  moss tint with a soft outer ring, the label bold ink. **To do**: hollow grey marker with its number, muted label, grey line. A stopped document
  (Huỷ) shows every step as to-do. It is an indicator, not a control — no hover, no click.
- Wide container: a row (the line fills what the label leaves). Under 40 rem **of its own container**, not of the screen: a column with the line
  running down between markers. Labels never wrap in the row.
- Read aloud as an ordered list; the current step has `aria-current="step"` and every label ends with a hidden "— đã xong / đang ở bước này /
  chưa tới", so the state is never carried by colour alone.
- Status *badges* (`.badge` + `tagClass`) stay the way to show one status in a list or a title bar; steps are for the "where in the process" strip
  on a record page.

## Topbar
- Right side = the **Thông báo bell**, then one account menu (`layout/account-menu`, WAI-ARIA menu button):
  avatar initials + name/role (avatar only on mobile) → header (name, email,
  role) · Giao diện (Sáng / Tối / Theo hệ thống, `menuitemradio`) · separator ·
  Đăng xuất (danger, last). Nothing else goes there.

## Thông báo (the topbar bell)
- **What it lists:** things wrong *right now*, whatever kỳ Tổng quan shows — rules in `backend/src/modules/reports/alerts.ts`
  (tested in alerts.spec.ts), served by `GET /api/alerts`. Nghiêm trọng: đơn trễ hẹn giao · khách nợ quá hạn · nợ NCC
  quá hạn · quỹ âm. Theo dõi: phải trả NCC đến hạn ≤ 7 ngày · mặt hàng dưới tồn tối thiểu · đơn mua hàng chờ duyệt (Nháp)
  · báo giá sắp hết hạn (≤ 3 ngày) · báo giá đã hết hạn chưa chốt (trong 14 ngày qua).
- **Not news:** doanh thu giảm, tỷ suất / chiết khấu, chi vượt thu, khách ngừng mua — analysis of a kỳ; they stay on
  Tổng quan only.
- **One list.** Tổng quan › Cần xử lý shows these same alerts (AlertsService) plus its kỳ-based checks, so the bell and
  the dashboard never disagree. A new point-in-time check = one rule in alerts.ts (+ a test); the dashboard picks it up.
- **Per user.** Each check runs only when the user holds the permission of the screen that fixes it (order.view,
  debt.view, voucher.view, stock.view, purchase.approve, quote.view; a seller without order.view_all counts only their
  own đơn / báo giá), and the client drops anything `canVisit` refuses.
- **Freshness.** Read on sign-in, every 5 minutes, and on navigation / refocus when a minute has passed; opening the bell
  re-reads too.
- **Đã đọc, one by one.** Nothing is marked by just opening the bell. An alert is read when the user opens it (clicks
  its row) or presses its ✓ (a sibling button, not inside the link; focus moves on to the next row). **Đã đọc tất cả**
  (header bar, link-style, disabled when nothing is unread) marks the rest and focus lands on "Xem tất cả". Marks are
  per user, per browser (`nt.alerts.seen.<userId>`), pruned to the alerts still listed. Each alert has a `sig` that
  changes with its size (12 → 13 đơn trễ), so a grown problem is unread again; a fixed one simply disappears.
- **Two tabs** (segmented): **Chưa đọc · n** — opens here while anything is unread, and a read row leaves it — and
  **Tất cả · m**, where read rows stay (no dot, no fill, title in ink-2 / 500) until the problem is fixed. All read =
  "Đã đọc hết" + "Xem tất cả". The bell's count is the unread count (99+).
- **Why it stays short.** One alert is one *kind* of problem with its count ("12 đơn trễ hẹn giao" → the late-order
  list), not one per document, so even a bad day is under ten rows; the list itself is the per-document view.
- **Look** (redesigned 08/11/2026). Trigger: a 40 px icon button (`bell`, ink-2); the count shows only unseen alerts —
  warning fill, danger once one of them is Nghiêm trọng, always a number (9+). Panel (25 rem, `--shadow-pop`):
  header = "Thông báo" · "Cập nhật HH:mm" · reload icon (disabled while reading). Body is **grouped by level**: a group
  head says the word once with its dot and count ("● Nghiêm trọng 3", danger / warning text) — no chip on every row.
  Row = **the icon of the screen it opens, on neutral paper** (`menuEntryOf(url)` in nav-items.ts, so it matches
  the left menu: tuổi nợ → hourglass, tồn kho → layers) · title (13 px / 600) · why (muted, ≤ 2 lines)
  · chevron · ✓ while unread; the action word is read to screen readers only. Unread rows carry an **ink** dot and a
  paper fill (never the page accent: moss / orange would read as ổn / cảnh báo). Footer: one link to Tổng
  quan. States: loading = three still placeholder rows (no shimmer) · error = alert icon + reason + Thử lại · clear =
  success tick + what the bell watches for.
- **Phones (≤ 40 rem):** the panel is `position: fixed` under the topbar, 8 px from both edges — anchored to the bell it
  ran 36 px off the left edge at 320 px.
- **Links land filtered:** `/don-hang?late=1`, `/kho/ton-kho?belowMin=true`, `/cong-no/tuoi-no?loai=phai-thu`,
  `/mua-hang?status=NHAP`, `/bao-gia?status=MOI|HET_HAN`. A row pointing at the page already open reloads it so the
  new filter applies.
- **Not yet:** email / Zalo / push when the app is closed — needs a scheduled job on the server.
- Theme is a personal preference (`core/services/theme.service.ts`, saved per
  browser, follows the OS when "Theo hệ thống").

## Permission screens (reference: Chức vụ & phân quyền)
- Master-detail Workbench: chức vụ cards on the left (initials avatar, name, "N người · x/98 quyền", thin
  coverage bar; active = moss border + tint), detail on the right. Under 1100 px the list becomes a
  horizontal strip above the detail.
- Detail top = summary card (avatar, name, mô tả, Sửa / Ngừng dùng) with three stats: Người dùng (initials
  chips linking to the profile), Quyền đã cấp (x/98 + bar), Nhóm chức năng (n/23).
- Permissions are read by **area tabs** (Bán hàng · Mua hàng · Hàng hoá & kho · Sản xuất · Tiền & công nợ ·
  Báo cáo · Hệ thống), each with its x/y count. A group is one row: chevron + name + count, a level pill
  (Không có quyền · Chỉ xem · Đầy đủ · Tuỳ chỉnh) and a `.segmented` control **Không / Chỉ xem / Đầy đủ**;
  the chevron opens single permissions for fine tuning. Searching shows matching groups across all tabs.
- Never show technical permission codes (`position.delete` …) to customers — labels only.
- Edits are a draft: sticky `.form-actions-bar` "Có thay đổi chưa lưu: thêm N, bỏ M quyền" → Lưu phân
  quyền / Huỷ thay đổi; switching chức vụ with a draft asks to keep or discard. "Lấy quyền từ chức vụ…"
  fills the draft from another chức vụ. CEO (hệ thống) is read-only. Roles are switched off, never deleted.
- Code: `role.rules.ts` (areas, levels, default grants), `role.service.ts` (writes), catalog in
  `core/data/permission-catalog.ts`.

## Display colours (reference: Màu hiển thị)
- Same master-detail shape as Chức vụ & phân quyền: groups of labels on the left (name, "N đã đổi" chip,
  a dot per value in its current colour), detail on the right; under 1100 px the list is a strip above.
- Detail head shows the **whole group on a light and a dark ground side by side** (`.preview-light` /
  `.preview-dark` force the paper tokens whatever theme is on), so palette harmony is judged at a glance.
- One row per value: badge + colour name ("· đã đổi" when it differs from the default), 12 swatches
  (`role=radio`, ring on the chosen one) and "Tuỳ chỉnh sắc độ" which opens a hue slider with a rainbow
  track (one open at a time). "Khôi phục mặc định" per group and "Khôi phục tất cả mặc định" in the header.
- Colours are hues only; lightness / chroma stay fixed tokens so every choice keeps its contrast.

## Search, quick create & density (usability layer)
- **Tìm hoặc tạo nhanh** (`layout/command-palette`; Ctrl K, or "/" outside a field; topbar
  button "Tìm hoặc tạo nhanh…", icon-only 44 px on phones): one native `<dialog>` with a
  WAI-ARIA combobox + listbox. Empty query = "Tạo mới" (đơn bán, đơn nhập, phiếu thu/chi,
  phiếu nhập/xuất kho, khách, hàng hoá, NCC) then "Đi tới" (every menu page). Typing searches
  code, name, phone, plate number across đơn bán, khách, hàng hoá, NCC, đơn nhập, phiếu kho,
  lệnh SX, chuyến, xe, phiếu thu chi (diacritic-insensitive, all words must match, 5 per group,
  code matches first). ↑↓ move, Enter opens, Esc closes. State via `CommandPaletteService`.
  New searchable entity = add one `rec(...)` line in the component.
- **Mật độ hiển thị** (account menu, saved per browser like the theme; `DensityService` →
  `body[data-density]`): Gọn (default, 36 px controls, 13 px text) · Vừa (40 px, 14 px) ·
  Rộng (44 px, 15 px). Everything reads `--control-h`, `--row-h` and the `--text-*` scale from
  tokens.css, so a new screen follows with no extra CSS — never hard-code a control height.
- Phones: dashboard KPI cards go one per row under 480 px so figures are never clipped.
- **Chọn từ danh sách dài** (khách hàng, nhà cung cấp, đối tượng thu chi, người dùng, mặt hàng của báo cáo, ngân
  hàng): `app-search-select` — reads like a select, opens a panel with a search box (mã, tên, số điện thoại…, no
  diacritics needed, every word must match), ↑↓ Enter Esc, at most 80 rows drawn ("còn N kết quả — gõ thêm"), so
  1 000+ rows stay quick. Options are `SearchOption` (code · label · hint · extra search words); `emptyLabel` adds a
  "Tất cả / Chưa chọn" row. Short fixed lists (loại, trạng thái, thuế, kho, tài khoản tiền) stay native `<select>`.
- **Order**: every pick list is ascending — mã tăng dần for coded records (numeric-aware), A → Z for names.
  CatalogLoader stores khách, NCC, kho, xe and bảng giá already sorted; option builders sort their own lists.
- **Thanh lọc** is one step lower than forms (`--filter-h`: 32 / 36 / 40 px by density; the bar sets `--control-h`
  for everything inside it) and the search box shrinks first (14–22 rem) so the filters stay on one line.
- **Lọc theo cột** (data-table `filterable`): the filter row is hidden until "Lọc cột" in the actions header cell
  opens it; it stays open while a column filter is set. Tables without an actions column keep the row.

## Loading (khởi động, tải danh mục, mở trang)
- **One spinner everywhere** (`.nt-spinner` in styles.scss): a 44 px ring, 3 px hairline track (`--color-rule`) and a moss arc turning at 0.8 s linear, `transform` only. Reduced motion: it stops turning and breathes (opacity 1 → 0.35, 1.6 s). Forced colours: GrayText track, Highlight arc. A bar is never used for loading.
- **Full-page veil while a page opens** (`.page-loading`, shell): from the start of a navigation, and while the GET calls the new page makes as it opens (the first 700 ms after it opens; `PageLoadingService` + `pageLoadingInterceptor`) are still out, the whole window is covered by the paper colour at 88 % with the spinner and "Đang tải trang…" centred. It appears only after 150 ms (quick pages never flash), stays at least 350 ms once shown, blocks clicks on a half-drawn page, and gives up after 20 s. Reads that start later — a refresh, a filter, a poll, a button — are not the page loading and never raise it; they keep their own in-page state.
- Two screens, one look — ledger paper (page ground with faint 32 px ruled lines), a centred surface card: brand mark
  (logo, else the monogram on an ink tile) → company name (20 px, 600) → one muted line → the spinner →
  muted step line.
- **Boot splash** (`src/index.html`, inside `<app-root>`): shown from the first byte until Angular replaces it;
  colours are tokens.css values written out (the stylesheet may not be applied yet); an inline script applies the
  remembered theme (`nt.theme`) and brand (`nt.brand`: name, monogram, icon). Spinner; breathes under reduced
  motion. CSP allows it by hash (backend `common/security.ts` hashes every inline script of the built index.html).
- **Màn đang tải** (`layout/loading-screen`, shown by the root while `CatalogLoader.status()` is loading): spinner with
  `CatalogLoader.progress` as the step named ("Đang tải: Đơn hàng bán và lệnh sản xuất · 3/7"); after 8 s a
  warning-tint note says the connection is slow. A new load step = one entry in `LOAD_STEPS` + one `step(i)` call.

## Errors (lỗi): say what happened, what to do, and who fixes it
- **Five kinds** (`ApiError.kind`, `core/api/api.service.ts › describeHttpError`), each with its own wording:
  - *business* (400 / 404 / 409 / 413 / 429…): the server's own sentence is shown as written (it names the field or the rule); an English
    Nest default ("Bad Request", "Not Found"…) is never shown, it is replaced by a Vietnamese instruction ("Kiểm tra lại các ô đã nhập…",
    "Tải lại trang…").
  - *permission* (403): the sentence naming the missing right, plus "Nhờ quản trị viên cấp quyền…".
  - *session* (401 with no sentence of its own): the interceptor has already sent the person to the sign-in page; no banner.
  - *network* (no answer, or a gateway page instead of our JSON): "Kiểm tra mạng… Nếu mạng bình thường mà vẫn lỗi, báo bộ phận IT kiểm tra."
  - *system* (5xx, or any fault the person cannot fix): says it is not the person's mistake, tells them to **báo bộ phận IT kiểm tra**,
    and prints the **mã lỗi** (the server's `X-Request-Id`, the same id as in the server log and Sentry) and the time.
- **Server**: `common/all-exceptions.filter.ts` answers every error as `{ statusCode, message, error }`; an unexpected exception is a generic
  500 ("Lỗi hệ thống, chưa xử lý được yêu cầu.") with `requestId`; stack traces and connection strings never leave the server.
- **On the page**: every save / load that fails shows `errorText(e)` in its `.notice.is-error`, so the wording above is the same everywhere.
- **Nothing caught** (a template that threw, a promise nobody awaited, a page's code that did not load): `ErrorNoticeService` +
  `layout/error-banner` — a banner fixed at the bottom (danger tint, 4 px left rule, above the page-loading veil), title "Lỗi hệ thống" or
  "Không tải được trang", the instruction, the code with a copy button and "Tải lại trang". The code is `LOI-…` for an error that never reached
  the server (also tagged on the Sentry report). Browser noise (ResizeObserver, aborted requests) is ignored; the same message repeating within
  5 s shows once.

## Quick-create from a picker (thêm nhanh khách hàng / nhà cung cấp)
- On a document screen (đơn bán, báo giá, đơn mua, hoá đơn mua, phiếu thu / chi) the customer or supplier picker ends with a **"+ Thêm … mới"** row
  (`app-search-select [createLabel] (create)`): a text-button in the moss accent under a hairline, not an option — it shows only for someone who holds
  `customer.create` / `supplier.create`. Click it, or ArrowDown past the last option and Enter. What was typed in the search box rides along
  as the new name, and the row stays reachable when nothing matches.
- It opens a small modal (`shared/quick-create`, shell like `rg-dialog` but 34 rem, two columns, one on a phone): tên (required), điện thoại,
  loại khách (customers) or địa chỉ (suppliers), mã số thuế, số ngày nợ, địa chỉ giao hàng. Nothing else — the rest is completed later on the
  full form. Same rules as the full form: a duplicate name / phone only warns, a supplier tax code already in use blocks. Enter in a field saves.
- "Lưu và chọn" saves through the normal create API (the server issues the code), the new record goes into the DataStore and the document selects
  it at once; a refusal from the server stays inside the dialog as a `.notice.is-error`.

## Dashboard (Tổng quan)
- Order (redesigned 25/10/2026 from the user's reference): header with a date chip → period tabs (Tháng này · Quý
  này · Năm nay · Tất cả, segmented, plus the period filter for any other range) → **hero band** → 4 sparkline cards →
  **Cần xử lý** → 12-month chart + cơ cấu tồn kho → daily revenue + bán chạy → **Tình hình từng mảng**.
- Hero band — the one place the page leaves the paper: a deep-moss gradient (`--hero-1` → `--hero-2`, light ink
  `--hero-ink` / `--hero-muted` ≥ 7:1, dark-mode steps in tokens.css). Left: eyebrow "Doanh thu · kỳ", the figure
  (fluid 28–40 px mono), one comparison chip (status tints), three stats, Lập đơn hàng (light solid) + Lập phiếu thu
  (ghost). Middle: doanh thu 12 tháng as a line in an inset panel (hover tooltip, last point ringed, peak in the head).
  Right: ring "% mặt hàng đủ tồn an toàn" (moss ≥ 80 %, warning ≥ 50 %, danger below) linking to Tồn kho. Stacks to
  two columns < 1180 px and one < 640 px.
- Sparkline cards (`.db-card`): tinted icon in the series colour → label → comparison chip right → the period's
  figure → one context line → a bleed-to-edge 12-month area spark. Cards a role may not see (nhập hàng without
  giá nhập, lãi gộp without report.view_profit) are left out; the grid refills.
- Chart colours are `--chart-1` moss (doanh thu) · `--chart-2` blue (nhập hàng) · `--chart-3` amber (lãi gộp line),
  validated all-pairs in light and dark (dataviz validator). One money axis only; bars 2 px apart, rounded at the data
  end; a legend over every multi-series chart and a visually-hidden table under it (wrap the table in a
  `div.visually-hidden` — a table ignores overflow and would widen the page). Cơ cấu tồn kho uses one hue (magnitude).
- A reader should still know *where* the problem is without reading a number: Cần xử lý keeps its ink rule.
- Problems come from ONE list (`issues` in dashboard.component.ts). Each issue = level · title (what + amount) ·
  one-sentence detail (why it matters) · area · link that opens the screen where it is fixed. Level is shown as a
  word AND a colour: **Nghiêm trọng** (damage done / overdue: late orders, overdue receivables or payables,
  below-cost lines, negative gross profit, negative cash account) and **Theo dõi** (about to happen / worth a look:
  payables due ≤ 7 days, margin −5 pts, discount ≥ 10 %, revenue −20 %, lost customers, below min stock, spending
  > income). Plain progress counts (waiting for production, shipping, waiting for goods) are NOT problems.
- Area cards take their chip (Ổn / Cần theo dõi / Có vấn đề) from the same list, so the two can never disagree.
  Rows that are a problem turn danger / warning colour; everything else stays ink. No decoration without a meaning.
- Area card anatomy: title + chip (dot + word) → **one headline figure** (20 px mono, muted label after it) →
  detail rows → one "Xem …" link pinned to the foot. A card that is warn / bad also carries a 3 px top rule in that
  colour. Detail rows are whole-row links (label ink-2, value ink, `›` at the end, paper-2 on hover); a problem row
  gets a dot before its label plus the coloured value — never colour alone. Công nợ shows Phải thu and Phải trả side
  by side; Dòng tiền compares thu and chi as two bars on one scale.
- Area grid: cards in a row share one height (no ragged holes). < 720 px one column · 720–1359 px two columns with
  Công nợ full width · ≥ 1360 px three cards then Công nợ + Dòng tiền (Dòng tiền full width when công nợ is hidden).
- Headline number tile: label (ink-2, `›` at the right — the whole tile opens the report / ledger behind it) →
  figure (24 px mono) → **one comparison chip** (success / danger tint + arrow or word; neutral paper-2 when flat)
  followed by muted context → note pinned to the foot above a hairline, so the notes line up across the row. Each
  tile says one thing: phải trả NCC lives in the Công nợ card, not under "Khách còn nợ". Lãi gộp compares tỷ suất
  in percentage points ("▲ +3,7 điểm"). Text pieces sit in their own spans inside a flex row — never rely on a
  space between an element and an `@if` block (Angular drops it).
- Revenue chart: four plain figures first (Tổng kỳ · Trung bình / ngày · Cao nhất + its day · Ngày có doanh thu), so
  reading it never depends on hover. Axis top is rounded to a "nice" number (1 · 1.2 · 1.5 · 2 · 2.5 · 3 · 4 · 5 · 6 ·
  8 × 10ⁿ) with gridlines at top / half / 0 labelled compactly (12 tr, 850 k); a zero day draws no bar; a dashed
  average line appears once ≥ 2 days have sales. ≤ 8 x labels, every other one hidden when the plot is < 28 rem
  wide (container query). Hover shows date + amount just above the bar, opening inward at the edges; the same data
  sits in a visually-hidden table for screen readers (the drawn chart is `aria-hidden`).
- Bán chạy: rank disc (first one moss-tinted) → product name on its own line (full width, wraps, never truncated) →
  qty · share on the left with the amount right → share bar. No link-coloured names; the name links on hover.
- New check = push one `Issue` in `issues()`; no template change.

## Totals strip (`dl.list-totals`)
- The few numbers over a list (or inside a record tab) are small tiles: label on top (12 px muted), the number
  under it (16 px, 600), on neutral paper (`--color-paper-2`). Mark a problem number with `.text-warning` / `.text-danger` on its `dd` and the tile turns
  tinted with a dot before the label — no per-page CSS. Inside a card the tiles sit on paper. Phones: two per row.

## Nhật ký on a record page
- `app-audit-history` always sits in `section.card.history-card` (padded). On a page section it gets an
  `h2.history-title` "Nhật ký" over a hairline; inside a "Nhật ký" tab the heading is left out (the tab names it).
  Never put it in a `.voucher-grid-card` — that card is padding 0 so tables run edge to edge.
- A title or note placed straight inside a `.voucher-grid-card` (`.form-section-title`, `.form-note`) gets the
  card's inner spacing back from `shared/voucher/voucher.scss`; don't hand-pad it per page.

## Nhật ký hoạt động
- Always a real table (never cards). Every row shows the exact moment to the second in giờ Việt Nam
  (`dd/mm/yyyy` over a bold `HH:mm:ss`, then "x phút / giờ trước" within a day) — Asia/Ho_Chi_Minh regardless of
  the viewer's clock, same as the server's day filters. Excel export carries the same stamp.
- Columns: Thời điểm · Người thực hiện (+ IP) · Thao tác (badge) · Đối tượng (type + code link) · Nội dung · ⌄.
  On a narrow list (container query on the card) Thao tác + Đối tượng, then Người thực hiện, fold into the Nội dung
  cell. Folded columns keep zero-width cells (never `display: none` on a cell) so the detail row's colspan matches.
- Click a row (or ⌄) to open the record under it: thời điểm with time zone, người, IP, thao tác + action code,
  đối tượng, chứng từ kèm, mã yêu cầu + dòng #, and a Trường · Trước · Sau table of changes.

## Toggle filters (bộ lọc bật / tắt)
- Anything in a filters bar that switches ONE condition on or off ("Chỉ quá hạn", "Chỉ đối tác còn nợ", "Dưới tồn tối thiểu",
  "Hiện phiếu đã huỷ") is a `.filter-toggle` `<button aria-pressed>`: a **pill with a tick box in front**. It must not look like a
  button (buttons do something; this only narrows the list) and must not look like a text field.
- Off = dashed outline, empty box, muted text. On = solid accent outline, tinted fill, accent text, ticked box. State is the box +
  outline + weight — never colour alone. Wording says what you get when it is on ("Chỉ …", "Hiện …"), never "Lọc …".
- Choosing one of several views (Lưới / Bảng, Không / Chỉ xem / Đầy đủ) is `.segmented`, not this. Cards that filter (tuổi nợ buckets,
  tài khoản quỹ) keep their own card style.
- **Position: always the LAST controls of the filters bar** — after search, dropdowns, period and the sort select, before "Xoá bộ lọc". Put them at the end of the markup too (not just visually) so tab order matches.
- Markup: `<button type="button" class="filter-toggle" [attr.aria-pressed]="flag()" (click)="flag.set(!flag())">Chỉ quá hạn</button>`
  (an extra `btn` class is harmless). No per-screen CSS.

## Placeholders
- A placeholder must fit its field at 375 px: ≤ ~38 characters in a search box, ≤ ~18 in a narrow table cell. Name the 3–4 things you can search by ("Tìm mã đơn, khách, người nhận, mặt hàng…"), never a sentence. Use "…" (one character), not "...".
- Search boxes in a filters bar are 22rem wide; global CSS ends an over-long placeholder with an ellipsis, but treat that as a safety net, not a layout.

## Reports (reference: Báo cáo)
- `/bao-cao` is an **index**, read top-down by how often a report is needed: (1) title + "N báo cáo trong M nhóm" left,
  the search box right on the same line (full row on a phone) — magnifier inside, a "/" key hint (clear button while
  typing); "/" anywhere on the hub focuses it (the hub catches the key before the app-wide palette), diacritic-
  insensitive, every word must match name or summary, hits marked with the warning tint, Enter opens the first hit,
  Esc clears; no hit = "Không tìm thấy báo cáo" + a hint ("ton kho") + the Hay dùng reports as pills + Xoá tìm kiếm.
  (2) "Xem gần đây": one quiet line of pill links (last 4 opened in this browser, `nt.reportsRecent`). (3) "Hay dùng"
  (`FEATURED_REPORTS` in the registry: Doanh thu, Lãi gộp, Tồn kho hiện tại, Tuổi nợ, Sổ quỹ): cards with a 40 px icon
  neutral tile, name + group; 2 across on a phone, 3 on a tablet, 5 wide. Both hidden while
  searching. (4) "Tất cả báo cáo": an even grid of group cards (container queries on the page width: 1 → 2 → 3 → 4
  columns; cards on one row share its height). A group card: small icon tile + name + count pill over a hairline, then its reports as whole-row links ≥ 48 px tall — report icon
  (`reportIcon`, muted) · name 600 sm over a one-line muted xs summary (ellipsis; full text in `title`, two lines while
  searching) · chevron; hover = paper-2 fill, name/icon/chevron in the accent. Only reports the role may open are
  listed (group permission) and empty groups go. Not-built reports stay listed last, quieter, tagged "Sắp có".
- `/bao-cao?name=<slug>` is one report in a **frame** of four layers, each said once: (1) title block — breadcrumb
  "Báo cáo › Nhóm", h1 = report name, the report's one-sentence summary; (2) the reports of the same group as an
  underline tab row (scrolls sideways on a phone, the open tab is scrolled into view; its line is the only rule under
  the title); (3) the report's toolbar; (4) the numbers. One way to move between reports (tabs + breadcrumb) — no
  "Đổi báo cáo" select, no second list beside the report. Slugs are production's.
- Report parts (`.rp-*` in styles.scss, shared by both report components) sit straight on the page — never a card
  around cards: toolbar = filters left, Xuất Excel far right · one muted range line "Số liệu từ … đến …" (the period
  control can show a whole month that is not over) · KPI strip = one surface split by hairlines · chart card ·
  table card · "Cách tính số liệu" folded in a `<details>` at the end.
- Reports are **declarations**, not components: `features/reports/defs/*.defs.ts` export `ReportDef`
  (`slug, label, group, summary, kind, groups?, notes?, run(env, {range, group})`) registered in
  `report.registry.ts`; `run` returns `{ columns, rows, totals?, kpis?, chart?, emptyHint? }`. A new report = one def.
  `kind`: `period` (has the kỳ filter), `snapshot` (as of now), `custom` (own component — Doanh thu),
  `link` (points at an existing page — Số dư công nợ, Tuổi nợ), `soon`.
- `app-table-report` draws every table report: toolbar (Cách nhóm, Chọn kỳ, search · Xuất Excel) · range line ·
  KPI strip (3–4 figures, sub-line explains) · top-10 bar chart · sortable table (click header: desc → asc → off) with a
  sticky header, numeric columns right-aligned + `nowrap`, a TỔNG CỘNG footer that re-sums when you search ·
  "Hiện thêm 100 dòng" paging · definition notes. Default kỳ = Tháng này, end date capped at today.
- The report table lives in `.rp-grid`: a panel at most one screen tall (`max(22rem, 100dvh − 8rem)`) that scrolls
  both ways, so the column headings (sticky top), TỔNG CỘNG (sticky bottom), Mã / Tên (frozen) and the sideways
  scrollbar are always in view. Inside it: names that open a record stay **ink** (accent + underline only on hover — a
  column of green links spends the whole accent budget); codes (`code · voucher · order`) in mono xs `--color-ink-2`;
  a numeric 0 is `--color-muted` so the rows that moved stand out.
- Report numbers must tie to each other and to the ledgers (Doanh thu = Chiết khấu + Lãi gộp over all time = receivedValue;
  Sổ quỹ = Thu chi). Anything estimated (giá vốn) is labelled "ước tính" in the notes.
- Deep links keep the slug and may add `ngay=N` (open on "last N days"), e.g. the dashboard's Khách ngừng mua tile.

## Thiết lập › Nhóm hàng (reference for plain name lists)
- One paragraph says where the *system's* axis lives (Tính chất: fixed, it decides stock, định mức, code prefix) and what
  the page is for. Table: name · Mặt hàng (link to `/hang-hoa?nhom=`) · count per Tính chất · Đổi tên / Xoá; a
  "Chưa phân nhóm" footer row. Actions follow the role (`category.create|update|delete`).
- **Deleting is how two groups merge**: a nhóm with products opens the confirm strip with "Chuyển N mặt hàng sang [nhóm |
  Không thuộc nhóm nào]" — the button stays disabled until a target is chosen. The server moves the products in the same
  transaction and writes one Nhật ký line per moved product (Nhóm hàng: A → B) plus the `category.delete` line.
- `.confirm-strip` is global (styles.scss), shared by vouchers and settings lists.
- **Thiết lập › Kho** is a full record (migration `dot10_warehouse_details`): Mã kho `KHO0000001` (sequence, auto),
  tên, địa chỉ, điện thoại, **thủ kho**, ghi chú, Đang dùng / Ngừng dùng. The Thủ kho picker lists only active users
  whose chức vụ does warehouse work (lập phiếu nhập / xuất / chuyển, điều chỉnh tồn, kiểm kê — `KEEPER_PERMISSIONS`,
  served by `GET /warehouses/manager-candidates`, checked again on save), shown "Tên — Chức vụ"; a current thủ kho who
  no longer qualifies stays, flagged "không còn quyền kho". List: Mã · Tên · Thủ kho · Địa chỉ
  (one line) · Mặt hàng còn tồn · Giá trị tồn · Phiếu kho · Trạng thái (business-status colours); Mã tăng dần; a new kho
  opens on its page. **Detail page** `/thiet-lap/kho/:id` like the other records: Lập phiếu nhập / Kiểm kê (`?kho=`
  pre-fills the voucher), Ngừng dùng / Dùng lại, Xoá (only never used), Sửa; tabs Thông tin chung · Tồn kho · Phiếu kho
  (50 rows + a link to the full filtered list) · Nhật ký. One Thêm / Sửa dialog (`app-warehouse-form-dialog`) serves both.
- **Ngừng dùng ≠ delete**: a kho with history is never deleted. A ngừng dùng kho is left out of every chứng từ picker
  (`| pickable: current` keeps an old choice visible) and the server refuses it on a phiếu lập tay; filters still list
  it, its tồn and phiếu stay readable. Fallback kho (none given) prefers đang dùng ones. Unknown facts (e.g. when an old
  kho was created) are left out, never filled with the migration date.

## Sidebar groups (menu trái)
- Each group heading (Nghiệp vụ, Mua hàng, …) is a button with a chevron that folds its links (`aria-expanded`,
  `aria-controls`, height animated with `grid-template-rows`, folded links are `inert`). The ungrouped top links never fold.
- Folded groups are remembered per browser (`nt.navClosed`, a list of group labels). Navigating to a page inside a folded
  group unfolds it, so the active link is never hidden. The icon-only rail has no headings, so every link shows there.

## Print (phiếu in) — one paper for the whole system
- Every printout is `<app-print-document>` (`shared/print/print-document.component.ts`) + the global
  stylesheet `shared/print/print.scss`. A screen never styles paper itself: it wraps its screen UI in
  `.screen-only` and puts the document next to it; the component is `.print-only`.
- Layout, top to bottom: **letterhead** (`app-company-letterhead`: logo, tên công ty, then labelled lines
  Địa chỉ / Mã số thuế / Điện thoại / Email / Website) with the **Số** and an optional stamp ("ĐÃ HUỶ") on
  the right, a 1.5 pt rule · centred **title** (16 pt caps) with "Ngày … tháng … năm …" (or a `sub` line for
  reports) · **information block** (`dl.pd-meta`, 2 columns, `.wide` spans both; or `dl.pd-form` fill-in
  rows with dotted rules for phiếu thu / chi) · **table** (`table.pd-table`: STT first, shaded header,
  numbers `.r` right + tabular, `tfoot` / `.sum` rows shaded) · **totals** (`.pd-totals`, last row `.grand`
  with a double rule) + `.pd-words` "Bằng chữ" for money documents · **signatures** (`[signers]`, 2–5 columns,
  "(Ký, họ tên)", maker's name printed under the space) · **footer** "In lúc … · người in" + company, and
  "Trang x / y" from `@page`.
- A4 portrait, margins 14/12/16/16 mm; wide tables use `[landscape]="true"` (named page `wide`). Several
  documents in one print (phiếu giao hàng per đơn) use `[pageBreak]`.
- Paper is always white with black ink — print tokens `--pr-*` are fixed, dark mode never leaks into paper.
- Printouts today: phiếu nhập / xuất / chuyển / kiểm kê kho · phiếu thu · phiếu chi · đơn hàng bán · đơn nhập
  hàng · phiếu soạn hàng · phiếu giao hàng · biên bản đối chiếu công nợ · báo cáo tuổi nợ. A new printout =
  one `<app-print-document>`; nothing else to style.
- The same letterhead is the live preview in Thiết lập › Thông tin công ty.
- **Paper (Pha 1.10).** The print button is `<app-print-menu kind="…" [papers]>`: a split button "In · A5" — one click
  prints on the paper last used for that kind of document (`nt.print.paper.<kind>`), the arrow opens A4 / A5 / K80
  with a one-line hint each. Screens that print one of several documents show it in `(prepare)` and hide it in `(done)`.
  `PrintService` puts the paper on `<html data-paper>` for one print; print.scss sends the body to the named page
  `a5` / `k80` and lays the same document out for it. The paper rules live outside `@media print` (the documents
  are `.print-only`, so the screen never shows them) because the K80 roll is measured on screen with them.
  - **A5**: every column stays; type 9 pt (table 8 pt), title 13 pt, tighter meta and signatures. `.a5-hide` drops a column.
  - **K80** (80 mm roll, 72 mm printable): a till receipt — centred letterhead and number, one-column meta, dashed
    rules instead of boxes, no STT; columns marked `.k80-hide` drop out (mã hàng, ĐVT, chiết khấu, thuế, đơn giá
    trên phiếu kho). Two signatures: the `PrintSigner`s marked `k80` (else the first and last). The page is exactly
    as long as the content, so the printer cuts after the last line; several documents follow each other on the
    roll parted by a dashed cut line. No "Trang x / y".
  - Which paper: đơn hàng bán, phiếu giao hàng, phiếu thu / chi, phiếu kho → A4 · A5 · K80; đơn nhập hàng, phiếu
    soạn hàng → A4 · A5; báo cáo, biên bản đối chiếu → A4 only (plain button).

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
- Trả hàng (Pha 1.5): "Nhận hàng trả lại" in the action bar once the customer has received something
  (`order.return`). The dialog reuses the Nhận hàng layout: ngày trả, kho nhập lại (pickable), lý do (required,
  datalist of common reasons), ghi chú; rows = đã nhận · đã trả · còn trả được · trả lần này · giá trị; the footer
  says how much công nợ goes down. A **Trả hàng** tab (count of live phiếu) lists the phiếu: số, ngày, hàng trả
  ("SP001 × 4"), lý do, phiếu nhập kho, giảm công nợ, trạng thái, "Huỷ phiếu" behind a confirm strip with a
  reason. A cancelled phiếu stays in the list, muted, its amount struck out. The Công nợ tab shows "Hàng trả lại"
  apart from "Đã thu".
- MISA parity on Đơn hàng bán (and the pattern for later vouchers): a **Thu tiền bar** above the header card (segmented Chưa thu tiền / Thu tiền ngay + account select; view mode shows it as a pill); a **Tham chiếu** row at the end of the header grid linking the related chuyến / phiếu xuất / lệnh SX / phiếu thu (every related document links back); a **Giá vốn tab** next to the goods tab (giá vốn, doanh thu thuần, lãi gộp, tỷ suất, always labelled "ước tính"); **‹ n/N ›** in the left of the sticky action bar to step to the previous / next chứng từ.
- Giá vốn wording (Pha 1.3): "giá vốn bình quân" for today's figure (Tồn kho, giá trị tồn, tab Giá vốn of an
  order), "giá vốn hàng bán" / "giá vốn chốt" for what a delivered order cost (Lãi gộp, Tổng quan). "Ước tính" is
  left only where it still is one (chi phí vật tư of a lệnh sản xuất from định mức × today's cost).
- Gợi ý lập đơn nhập (Pha 1.8): Tồn kho header button "Gợi ý đơn nhập n" (cart icon, count of vật tư still to
  order) opens a dialog in the Nhận hàng layout: one block per nhà cung cấp (A → Z, "Chưa rõ nhà cung cấp" last)
  with "Lập đơn nhập (n dòng)"; rows = chọn · vật tư · tồn · tối thiểu · đang về · đặt thêm (+ ĐVT chính) · NCC
  (select, moving the row re-groups it and takes that NCC's catalogue price) · giá mua. Rows already covered by
  đơn đang về stay listed, muted, unticked. The đơn nhập opens prefilled with a notice and counts as unsaved.
- Never show a customer *type* (Lẻ / Sỉ / Dropship) next to a *tag* (Khách quen…) without a label: the type lives in "Loại khách · bảng giá", the tag in "Thẻ đánh dấu", and the chip beside the name says only the payment term.
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

## Sổ sách (Kế toán) and Quỹ pages — reference: Sổ chi tiết tài khoản, Kiểm kê quỹ
Synchronised 16/11/2026 (Hallmark redesign, app scope). **Every page under Kế toán** (tổng quan, nhật ký, sổ chi tiết, sổ cái,
tổng hợp công nợ, cân đối phát sinh, cân đối kế toán, kết quả kinh doanh, lưu chuyển tiền tệ, thuế GTGT, hệ thống tài khoản,
số dư đầu kỳ, nhập bút toán, nhân viên, lương, tài sản cố định, công cụ dụng cụ, giá thành), the Quỹ pages (kiểm kê quỹ,
đối chiếu ngân hàng, chuyển tiền nội bộ) and the two hoá đơn pages (hoá đơn bán ra, hoá đơn mua dịch vụ) follow the same Workbench
frame as every list and report; no raw px, no `style=""`, no colour outside tokens. A report by year (cân đối, KQKD, sổ cái, số dư đầu kỳ)
puts one `.year-input` in the filters bar; an entry grid (nhập bút toán, hoá đơn mua, số dư đầu kỳ, lương) is `.line-table.book-table`.
- **Frame, top-down:** page header (title + one-sentence subtitle left; Xuất Excel / primary verb with its icon right) →
  `.filters-bar` (a `.segmented` for the one-of-few choice such as Phải thu / Phải trả or Tháng / Quý, the
  `app-period-filter` "Chọn kỳ" for any date range, selects with `aria-label`, `.filter-toggle` last) → `.rp-range` line when
  the range is not obvious → `dl.list-totals` (the 2–4 figures that matter) → one data surface.
- **Sổ sách tables** (`.book-table` in styles.scss, inside `.rp-surface.rp-grid` for long ledgers or `.rp-surface.book-wrap` for a few
  rows): numbers right-aligned in mono (`.r.num`), a zero shown as a muted "—", codes mono xs (`.code`), opening balance /
  section heading / subtotal as shaded rows (`.book-open`, `.book-head`, `.book-sum`; `.book-sub` indents a line under a
  heading), totals in a `tfoot` that stays in view, an empty ledger says so in one row (`.book-none`). Two-line headings
  (Dư đầu kỳ › Nợ | Có) use `colspan` + a second `tr`; the second line sticks under the first.
- **Small statements** (thuế phải nộp, đối chiếu sổ cái, số dư sổ sách và sao kê) are a `.section-bare` heading over a
  `.book-wrap` surface, never a card around a table. A negative or unexplained figure is `.amt-neg` (sign printed, never colour alone).
- **Record lists** (biên bản kiểm kê, chuyển tiền) use `app-data-table`: codes with copy, money right-aligned, status as a
  badge, text actions in the sticky actions cell (`.btn.row-act-btn` in `.row-actions`; destructive = `.btn-danger-ghost`).
  "Hiện … đã huỷ" and "Chỉ … chưa xử lý" are `.filter-toggle`s; cancelled rows are hidden by default and shown muted by the badge, never by opacity.
- **Create / resolve / cancel forms** open as a `.card.section-block` above the list: `h2.form-section-title`, `.field` labels above
  inputs with `.required-mark`, `.form-grid` / `.form-grid-3`, VND amounts with `appMoney`, a validation line (`.hint.text-danger`)
  only after the first save attempt, then primary + "Bỏ qua". A destructive step asks for its reason in the same card ("Xác nhận huỷ").
- **One tone of success:** a saved action reports in a dismissible `.notice` (`.notice-x`); errors in `.notice.is-error`.
- A new accounting page uses these parts; it adds a class to styles.scss only when none of them fits.

## What pages MUST share
- The brand from Thông tin công ty (`BrandService`): short company name (legal form such as "Công ty TNHH"
  dropped, full name on hover), logo tile or the initials ink mark ("NT"). The same name ends every tab title
  ("Hàng hoá · Ninh Trang") and the tab icon is the logo on a light rounded tile (monogram SVG without one). Saving
  the company changes them at once; the last brand is remembered per browser for the login page.
- Moss accent, used ≤ 5 % per viewport: active nav, primary button, links,
  focus, chart bars.
- Be Vietnam Pro + JetBrains Mono.
- Page header pattern and button shapes above.
- Legacy `--nt-*` variables stay as aliases of the tokens (see
  `frontend/src/styles.scss`) — new code uses `--color-*` directly.

## What pages MAY differ on
- Table vs form vs report (group tabs + full-width card) layout inside the Workbench frame.
- Per-column mono via `DataTableColumn.mono`.

## Email gửi đi (as MISA, since 08/11/2026)
- **How it sends** (Hệ thống › Email gửi đi, `/thiet-lap/email`, company.update):
  - **Email riêng của doanh nghiệp** (recommended, MISA's way): the company's own mailbox over SMTP — presets for Gmail /
    Google Workspace, Outlook / Microsoft 365, Zoho, Yandex (host, port, SSL/STARTTLS filled in; hint on app passwords).
    Customers see the company's real address, replies come back to it, Gmail / Outlook keep a copy in Đã gửi.
  - **Hệ thống gửi hộ** (only when the server sets `MAIL_SYSTEM_URL` + `MAIL_SYSTEM_FROM`): the platform's transactional
    SMTP sends From "<Tên công ty>" <no-reply@platform domain> with Reply-To the company's email. Never the company's
    address in From through someone else's server — DMARC would fail and the email would land in spam.
  - **Tắt** (default).
- **Security.** The SMTP password is write-only: sealed with AES-256-GCM (key from `MAIL_SECRET`, else PLATFORM_SECRET,
  else JWT_SECRET), never returned; the screen only says "đã lưu". Changing the transport clears "đã gửi thử". Each user
  sends at most 40 emails / 10 minutes; ≤ 10 recipients per email; attachment must be a real PDF ≤ 6 MB.
- **Permissions.** `email.send` (new; given to CEO, Quản lý and every role that lập báo giá / đơn / phiếu thu or nhắc
  nợ) plus the document's own view permission (quote.view, order.view, purchase.view, voucher.view, debt.remind /
  debt.view). Settings and templates: company.update.
- **Templates** per document (Báo giá · Chứng từ bán hàng · Đơn mua hàng · Phiếu thu · Nhắc nợ / Thông báo công nợ ·
  Biên bản đối chiếu): subject + plain body with {placeholders} (ten_khach, so_chung_tu, ngay, tong_tien, han, so_du,
  ten_cong_ty, dien_thoai, nguoi_gui). A missing value shows as "…" so the gap is seen before sending; an optional
  " · {x}" tail (the signature's phone) drops out. Defaults live in backend `modules/mail/mail.rules.ts`.
- **Gửi email** button sits beside In on every document (`shared/email-compose`): Đến filled from the partner's email,
  CC, Tiêu đề / Nội dung from the template (editable), "Đính kèm <file>.pdf" = the document's own A4 printout
  (`shared/print/print-pdf.ts`: the print-only sheet laid out off-screen, html2canvas-pro → jsPDF, page numbers), and
  "Đã gửi trước đây" for that document. Not set up → a warning with "Thiết lập ngay" (or who to ask). Sent → the dialog
  closes and the page's quiet notice says to whom. Nhắc nợ sends the reminder text as edited, then stays open to
  "Ghi nhận đã nhắc" (kênh Email chosen).
- **Lưu vết.** Every email, sent or failed, is a row in EmailLog (who, when, to / cc, subject, attachment, error) and a
  line in Nhật ký truy cập; the settings page lists the latest 200; optional BCC to an archive mailbox.
- **Not yet:** scheduled / bulk sending (nhắc nợ hàng loạt), open tracking, a customer link to view the document online.

## Excel exports
- File name = Vietnamese title with diacritics + export date and time: `Đơn hàng bán - 22-10-2026 14h35.xlsx`.
  Always build it with `exportFileName(title)` (shared/excel.util.ts) — never hand-write a slug or `todayStamp`.
  Reports are titled "Báo cáo <tên báo cáo>"; a ledger names its partner ("Sổ công nợ NCC0000001").
- Import templates (`Mẫu nhập hàng hoá.xlsx`) are not exports and carry no timestamp.

## Exports

### tokens.css
`frontend/src/tokens.css` (loaded via `@use 'tokens'` in `styles.scss`).
