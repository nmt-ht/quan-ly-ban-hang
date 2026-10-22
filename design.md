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

## Dashboard (Tổng quan)
- Order is the message: **Cần xử lý** (problems, worst first) → 4 headline numbers → trend (revenue chart, top
  products) → **Tình hình từng mảng** (one card per area). A reader should know *where* the problem is without
  reading a number.
- Problems come from ONE list (`issues` in dashboard.component.ts). Each issue = level · title (what + amount) ·
  one-sentence detail (why it matters) · area · link that opens the screen where it is fixed. Level is shown as a
  word AND a colour: **Nghiêm trọng** (damage done / overdue: late orders, overdue receivables or payables,
  below-cost lines, negative gross profit, negative cash account) and **Theo dõi** (about to happen / worth a look:
  payables due ≤ 7 days, margin −5 pts, discount ≥ 10 %, revenue −20 %, lost customers, below min stock, spending
  > income). Plain progress counts (waiting for production, shipping, waiting for goods) are NOT problems.
- Area cards take their chip (Ổn / Cần theo dõi / Có vấn đề) from the same list, so the two can never disagree.
  Rows that are a problem turn danger / warning colour; everything else stays ink. No decoration without a meaning.
- Headline numbers carry a delta line coloured good / bad (success / danger tokens) and a muted note line; a number
  the reader should act on links to the report or ledger behind it.
- New check = push one `Issue` in `issues()`; no template change.

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
- `/bao-cao` is a **hub**: "Tìm báo cáo…" box, then the 8 groups (icon + one-line description) as card grids; every
  card = report name + one-sentence summary. Not-built reports stay visible as dashed cards tagged "Sắp có" — never
  hide them. `/bao-cao?name=<slug>` is one report in a **frame**: breadcrumb "Báo cáo › Nhóm", h1 = report name, the
  report list on the left (≤ 900 px: a select), the report in a `.card` on the right. Slugs are production's.
- Reports are **declarations**, not components: `features/reports/defs/*.defs.ts` export `ReportDef`
  (`slug, label, group, summary, kind, groups?, notes?, run(env, {range, group})`) registered in
  `report.registry.ts`; `run` returns `{ columns, rows, totals?, kpis?, chart?, emptyHint? }`. A new report = one def.
  `kind`: `period` (has the kỳ filter), `snapshot` (as of now), `custom` (own component — Doanh thu),
  `link` (points at an existing page — Số dư công nợ, Tuổi nợ), `soon`.
- `app-table-report` draws every table report: Xuất Excel (top right) · filters bar (Cách nhóm, Chọn kỳ, search) ·
  KPI strip (3–4 tiles, sub-line explains) · top-10 bar chart · sortable table (click header: desc → asc → off) with a
  sticky header, numeric columns right-aligned + `nowrap`, a TỔNG CỘNG footer that re-sums when you search ·
  "Hiện thêm 100 dòng" paging · definition notes. Default kỳ = Tháng này, end date capped at today.
- Report numbers must tie to each other and to the ledgers (Doanh thu = Chiết khấu + Lãi gộp over all time = receivedValue;
  Sổ quỹ = Thu chi). Anything estimated (giá vốn) is labelled "ước tính" in the notes.
- Deep links keep the slug and may add `ngay=N` (open on "last N days"), e.g. the dashboard's Khách ngừng mua tile.

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

## Excel exports
- File name = Vietnamese title with diacritics + export date and time: `Đơn hàng bán - 22-10-2026 14h35.xlsx`.
  Always build it with `exportFileName(title)` (shared/excel.util.ts) — never hand-write a slug or `todayStamp`.
  Reports are titled "Báo cáo <tên báo cáo>"; a ledger names its partner ("Sổ công nợ NCC0000001").
- Import templates (`Mẫu nhập hàng hoá.xlsx`) are not exports and carry no timestamp.

## Exports

### tokens.css
`frontend/src/tokens.css` (loaded via `@use 'tokens'` in `styles.scss`).
