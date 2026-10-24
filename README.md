# Ninh Trang ERP — rebuild scaffold

An Angular + NestJS rebuild of the Ninh Trang business-management app, covering inventory, purchasing, sales, delivery, production, cash flow, and RBAC user management for a frame/glass manufacturing & trading business.

## Structure

```
ninh-trang-erp/
  frontend/    — Angular 22 app (every screen reads and writes through the API)
  backend/     — NestJS 12 + Prisma + PostgreSQL: auth, RBAC, every business module, reports, audit log
  render.yaml  — Render Blueprint (free web service; database on Neon)
  docs/
    atlas/                 — one Word document per screen
    bao-gia/               — features & quotation document
```

## Deploy (Render + Neon, free)

One Render web service builds the Angular app and serves it from the NestJS API (`backend/src/main.ts` serves `frontend/dist/frontend/browser` and sends `index.html` for client routes), so screens and `/api` share one address. The database is a free Neon PostgreSQL.

1. Neon: create a project (region Singapore), copy the **direct** connection string (`…neon.tech/neondb?sslmode=require`).
2. Render: New › Blueprint › this repository. Fill `DATABASE_URL` (from Neon), `SEED_ADMIN_PASSWORD` (≥ 10 characters) and `DEMO_USER_PASSWORD` (≥ 8); `JWT_SECRET` is generated.
3. Every start runs `npm run start:render`: `prisma migrate deploy`, then `prisma/bootstrap.ts` seeds only if the database has no user (with `SEED_DEMO=true` also the demo data), then the app with `NODE_ENV=production`, which refuses to start without a real `JWT_SECRET`.

The free instance sleeps after 15 minutes without traffic; the first request after that waits about a minute. Pushing to `master` redeploys.

## Frontend

```bash
cd frontend
npm start          # http://localhost:4300 (or PORT env var); /api is proxied to localhost:3000 (proxy.conf.json)
```

Sign-in goes to the backend (`POST /api/auth/login`), so start the backend first. Every screen reads from and saves to the database through the API; there is no in-browser demo mode.

Demo accounts (after `prisma:seed:demo` with `DEMO_USER_PASSWORD=demo1234`): `quan.ly@ninhtrang.local` (Quản lý), `ke.toan@ninhtrang.local` (Kế toán), `sale1@ninhtrang.local` (Sale), `thu.kho@ninhtrang.local` (Thủ kho). `admin@ninhtrang.local` (CEO) keeps the password from `SEED_ADMIN_PASSWORD`. The login screen never shows these. Danh mục (người dùng, chức vụ, công ty, thẻ, kho, nhóm hàng, hàng hoá, định mức, khách hàng, NCC, xe, tài khoản tiền, loại thu chi) are read from and saved to the database: `core/api/catalog-loader.service.ts` loads them into `DataStore`'s signals (`core/services/data-store.service.ts`) after sign-in, and each feature service saves through `core/api/api.service.ts`. Tồn kho and phiếu kho lập tay (nhập, xuất, chuyển, kiểm kê, huỷ) go through the API too. Đơn nhập hàng too, and its nhận hàng writes the phiếu nhập kho on the server. Đơn hàng bán and lệnh sản xuất too: giao hàng, bắt đầu sản xuất and nghiệm thu write their phiếu kho on the server, and "Thu tiền ngay" its phiếu thu. Chuyến giao hàng too (xuất kho, chốt giao, nhập trả về on the server). Phiếu thu chi too (lập, huỷ, đối trừ chọn tay / tự động); số dư quỹ comes from the server. Công nợ phải thu / phải trả on screen are read from `GET /api/receivables` and `GET /api/payables` (DebtService), and read again whenever an order, phiếu thu chi, khách hàng or NCC changes; roles without `debt.view` see none.

Phân quyền trên giao diện: the role's permissions decide which menu links, Ctrl K entries, "Thêm / Lập …" buttons and routes a user gets. One table drives all of it: `src/app/core/auth/route-access.ts`. Buttons that act in place (Duyệt, Huỷ, Xoá…) are not gated yet, and the backend must still check every call. Giá vốn and giá trị tồn are different: the server computes them (`GET /api/product-costs`, needs `product.view_cost_price` or `stock.view_value`) and the screens hide them without those rights.

Version: the sidebar shows `v<version>` from `package.json` under the name. `npm start` / `npm run build` regenerate the git-ignored `src/app/version.ts` via `scripts/write-version.mjs`. Bump the number for a release in `frontend/` with `npm version patch --no-git-tag-version` (fixes), `minor` (new features) or `major`. The sidebar mark shows the company logo once one is uploaded in Thiết lập › Thông tin công ty, else "NT".

Fonts are self-hosted from `@fontsource/be-vietnam-pro` and `@fontsource/jetbrains-mono` (wired in `angular.json`), so the app works offline / behind a firewall.

## Backend

```bash
cd backend
cp .env.example .env      # point DATABASE_URL at a local or Railway Postgres
npm install
npx prisma dev --name ninhtrang --detach   # local Postgres without Docker; put its TCP URL (port 51214) in DATABASE_URL
npm run prisma:migrate
npm run prisma:seed
DEMO_USER_PASSWORD=demo1234 npm run prisma:seed:demo   # optional demo data
npm run start:dev          # http://localhost:3000/api
```

API conventions (Đợt 0): Decimal columns come back as JSON numbers (`common/decimal.interceptor.ts`); document codes come from `prisma/sequence.service.ts` (atomic, synced with existing codes on boot); duplicate / missing / referenced rows answer 409 / 404 / 409 with a Vietnamese message (`common/prisma-exception.filter.ts`); `GET /api/auth/me` returns the user and the role's permissions, read from the database on every request, so role edits and locked accounts apply at once. Date-only fields are `@db.Date`: send them as `YYYY-MM-DD`.

Seeded login: `admin@ninhtrang.local` / value of `SEED_ADMIN_PASSWORD` in `.env` (defaults to `ChangeMe123!` locally — never on a server: `prisma/bootstrap.ts` refuses it).

Wired end to end (Đợt 1): users, roles, company, tags, warehouses, categories, products (+ units, images, import, định mức), customers (+ addresses, tags), suppliers (+ danh mục hàng theo NCC), vehicles, cash accounts, cash categories — under `src/modules/`. Danh mục reads are open to every signed-in user (other screens show those names); writes need the matching permission. Full user accounts need `user.view`, roles need `position.view` or `user.view`, supplier purchase prices need `supplier.view`.

Kho (Đợt 2): `src/modules/inventory/` — `InventoryService.post()` is the only code that changes `StockLevel` (NHAP +, XUAT −, CHUYEN −/+, KIEM_KE ± the difference to the book stock read under a row lock); cancelling reverses it, and a voucher made by another document can only be cancelled there. Xuất quá tồn is allowed and flagged, as before. Each kind of phiếu needs its own permission; without `stock.import_price` the purchase price of a phiếu nhập is dropped (and the frontend hides the column). Later modules call `post()` inside their own transaction.

```bash
npm run test:e2e   # needs the seeded local DB; suites run one after another and clean up after themselves
```

Mua hàng (Đợt 3): `src/modules/purchasing/` — đơn nhập hàng (lập, sửa khi Nháp, gửi NCC = `purchase.approve`, nhận hàng = `purchase.receive`, hoàn tất, huỷ khi chưa nhận gì). Nhận hàng locks the order row, caps each line at what is left, and posts one phiếu nhập kho per kho through `InventoryService.post()` in the same transaction, with the purchase price per base unit. Totals are derived from the lines, never stored. Editing sends the `updatedAt` it loaded; a stale copy gets 409 "vừa được người khác lưu". `GET /api/payables` (`debt.view`) computes công nợ phải trả with the same đối trừ as the frontend (`src/common/settle.ts`).

Bán hàng & sản xuất (Đợt 4): `src/modules/sales/` — đơn hàng bán (lập, sửa trước khi sản xuất/giao, huỷ, kết thúc đơn, giao hàng) and lệnh sản xuất (lập từ đơn với định mức chụp lại, bắt đầu = xuất vật tư từ kho ngầm định, nghiệm thu = nhập số đạt vào Kho thành phẩm, huỷ). Totals and status are derived with the same rules as the frontend (`sales-order.rules.ts`); the order row is locked during each step. Without `order.update_price` a line must keep the list price for the customer type. `GET /api/receivables` (`debt.view`) computes công nợ phải thu. A seller (`order.create`) without `order.view_all` only gets the orders they sell or made; roles that do not sell (Thủ kho, giao hàng) see all of them, since they ship them.

Trả hàng bán (Pha 1.5): `src/modules/sales/returns.ts` — `POST /api/sales-orders/:id/returns` (`order.return`: CEO, Quản lý, Kế toán) takes back part of what the customer RECEIVED (≤ đã nhận − đã trả). One phiếu `TH…` per return: the goods go back into a kho through a phiếu "Nhập trả về" (`InventoryService.post`), the value — the returned share of each line's total, VAT included, after chiết khấu — lowers the order's công nợ (an đối trừ in `GET /api/receivables`) and doanh thu on the return's date (negative revenue lines with `returnCode`). `POST …/returns/:returnId/cancel` undoes the phiếu kho; the phiếu stays, marked huỷ. Bỏ chốt giao is refused while the order has a live return. Money already paid back to the customer is a phiếu chi, as before.

Báo giá (Pha 1.4): `src/modules/sales/quotations.ts` — `GET/POST /api/quotations`, `PUT /api/quotations/:id`, `POST …/:id/cancel` (quyền `quote.view` / `quote.create` / `quote.update` / `quote.cancel`: CEO, Quản lý, Sale; Kế toán chỉ xem). Báo giá `BG…` có cùng dòng hàng, đơn giá theo bảng giá của loại khách, chiết khấu và thuế như đơn bán, nhưng không trừ kho, không ghi công nợ, không xét hạn mức. Trạng thái lưu: Mới / Đã lập đơn / Huỷ; "Hết hạn" chỉ suy ra từ `validUntil` trên màn hình. Lập đơn: màn `/bao-gia/:id` mở `/don-hang/them-moi?quoteId=…` điền sẵn; `POST /api/sales-orders` với `quotationId` khoá báo giá, bắt buộc cùng khách, giữ đơn giá báo (kể cả với người không có `order.update_price`), rồi chuyển báo giá sang Đã lập đơn và nối `Quotation.orderId` (đơn trả về `quotationCode`). Người bán không có `order.view_all` chỉ thấy báo giá mình lập hoặc đứng tên. Migration `20261024130000_p1_4_quotations`.

Bảng giá & khuyến mãi (Pha 1.6): `src/modules/pricing/pricing.module.ts`. **Bảng giá riêng** (`/api/price-lists`, lập/sửa cần `pricelist.manage`): giá theo mặt hàng + ĐVT, gán cho khách bằng `Customer.priceListId`. Giá trên dòng (`priceFor`, giống nhau ở `backend/src/modules/sales/sales-order.rules.ts` và frontend `sales-order.rules.ts`): giá bảng đúng ĐVT → giá ĐVT chính của bảng × tỷ lệ → giá lẻ/sỉ/dropship như cũ; bảng ngừng dùng thì bỏ qua. Server kiểm tra đơn giá với bảng giá của khách cho người không có `order.update_price`. **Khuyến mãi** KM… (`/api/promotions`, lập/sửa/dừng cần `promotion.manage`; CEO, Quản lý): `GIAM_HANG` (giảm % hoặc số tiền mỗi ĐVT chính), `GIAM_DON` (đơn từ ngưỡng giảm % / số tiền), `BAC_THANG` (bậc số lượng theo ĐVT chính), `TANG_HANG` (mỗi đủ X tặng Y); phạm vi mọi khách / theo loại khách / theo bảng giá; áp theo ngày chứng từ. Form đơn hàng và báo giá tính khuyến mãi (`features/sales-orders/promotion.rules.ts`): tự điền chiết khấu dòng và chiết khấu cả đơn (trừ chỗ gõ tay), dựng lại dòng hàng tặng, công tắc "Áp khuyến mãi". Server không tính lại khuyến mãi: chỉ lưu `promotionId` trên dòng / đơn / báo giá và ép dòng `isGift` về chiết khấu 100% (thành tiền 0, vẫn xuất kho khi giao). Migration `20261024140000_p1_6_price_lists_promotions`.

Nhập Excel có xem trước (Pha 1.9): `src/common/import.ts` — `runImport` chạy mỗi dòng trong một savepoint (dòng lỗi rollback riêng, ghi lý do, dòng khác vẫn vào) và `dryRun: true` rollback cả giao dịch nên xem trước đúng như khi lưu (quyền, độ dài, trùng…) mà không đổi gì; trả `{ rows: [{ row, action: create|update|unchanged|error, code, name, changes, errors }] }`. `POST /api/customers/import`, `POST /api/suppliers/import` (màn hình gửi ô thô theo khoá cột, máy chủ đọc và kiểm tra: có mã → cập nhật, ô trống giữ nguyên; không mã → thêm mới; trùng điện thoại / MST với bản ghi đã có bị chặn), `POST /api/products/import` (trình duyệt vẫn đọc file như trước, máy chủ kiểm tra từng dòng bằng `CreateProductDto`). Mỗi lần nhập thật ghi một dòng nhật ký tổng (`customer.import`…), từng bản ghi ghi như sửa trên form; chạy thử đánh dấu `AuditContext.readOnly`. Giao diện: `shared/import/` (`ExcelImportDialogComponent`, `ImportPreviewComponent`), nút "Nhập Excel" ở Khách hàng và Nhà cung cấp.

Pha 2 — VietQR, thông báo công nợ, nhắc nợ: **VietQR** tạo ngay trên trình duyệt theo chuẩn NAPAS/EMVCo (`frontend/src/app/shared/vietqr/vietqr.ts`, CRC16-CCITT; ảnh bằng gói `qrcode`, không gọi dịch vụ ngoài) từ `CashAccount.bankBin` (mã BIN 6 số, chọn ngân hàng ở Thu chi › Tài khoản tiền) + số tài khoản + số tiền + nội dung `KH… TT CONG NO`. **Thông báo công nợ** (Sổ chi tiết công nợ phải thu › "Thông báo công nợ"): in các chứng từ còn nợ, hạn, quá hạn, số cần thanh toán, bằng chữ và mã QR. **Nhắc nợ** (`/cong-no/nhac-no`; `src/modules/sales/reminders.ts`, `GET/POST /api/debt-reminders`, ghi cần `debt.remind`: CEO, Quản lý, Kế toán): khách quá hạn / đến hạn trong 7 ngày, tin soạn sẵn (sao chép, mở Zalo, gọi, SMS, email) kèm QR, ghi nhận kênh, ghi chú, hẹn trả; số nợ lúc nhắc lấy từ `ReceivablesService`. Gửi tự động (SMS brandname / Zalo OA) và hoá đơn điện tử chưa làm. Migration `20261024150000_p2_vietqr_debt_reminders`.

Giá vốn (Pha 1.3): bình quân gia quyền di động per mặt hàng (mọi kho), kept in `Product.avgCost` by `InventoryService.post` / `reverse` under a row lock. A phiếu nhập moves the average (its own cost: `unitCost` from the chứng từ gốc, else `unitPrice`, else the average); every other line goes out, across or is counted at the average. Each line stores the cost it moved at (`WarehouseVoucherLine.unitCost`) — giá vốn chốt lúc xuất. Hàng trả về (phiếu trả hàng, xe về kho) goes back in at the cost it left at; thành phẩm come in at vật tư đã xuất ÷ số làm được; huỷ a phiếu nhập takes its goods back out of the average. Lãi gộp, hàng bán dưới giá vốn and Tổng quan use the frozen cost of each order's phiếu xuất (or its chuyến's); `GET /api/product-costs` returns today's average. `avgCost` and `unitCost` never go out with products or phiếu kho. Migration `20261024120000_p1_3_moving_average_cost` starts the average from the old estimate (giá nhập gần nhất, định mức).

Tồn tối thiểu (Pha 1.8): Tồn kho shows "Gợi ý đơn nhập" when vật tư are under their tồn tối thiểu and the đơn nhập on the way (Nháp included) do not cover it (`features/inventory/reorder.rules.ts`). The dialog groups them by nhà cung cấp (cheapest in the NCC's danh mục, else the last one bought from), suggests tối thiểu − tồn − đang về rounded up, and opens a new đơn nhập with the picked lines (`history.state.reorder`) — nothing is saved until Lập đơn. `/kho/ton-kho?belowMin=true&reorder=1` opens it directly.

In ấn (Pha 1.10): every printout is `<app-print-document>`; `<app-print-menu kind="…">` prints it on A4, A5 or a K80 thermal roll (the paper is remembered per kind of document in the browser). Đơn hàng bán, phiếu giao hàng, phiếu thu/chi and phiếu kho offer all three; đơn nhập hàng and phiếu soạn hàng A4/A5; báo cáo stay A4. Layout rules: `design.md` › Print.

Giao hàng (Đợt 5): `src/modules/delivery/` — chuyến (lập, xếp đơn, xuất kho một lượt, chốt giao / bỏ chốt từng đơn, xe về kho nhập lại hàng khách không nhận, hoàn tất, huỷ khi chưa xuất, chi phí chuyến). Loads and chốt giao are stored per order line; totals are derived. Chốt giao moves the order (Giao một phần / Hoàn thành / Trả toàn bộ) and makes the "Thu tiền ngay" phiếu thu; bỏ chốt cancels it again. Each step answers the chuyến and the orders it touched.

Thu chi (Đợt 6): `src/modules/cash/` — phiếu thu / phiếu chi (lập = `voucher.create_receipt` / `voucher.create_payment`, huỷ = `voucher.cancel`; huỷ keeps the phiếu, marked huỷ). A phiếu tied to a khách hàng / NCC settles their công nợ: "Chọn tay" allocations must name that partner's own documents and may not exceed the phiếu; the rest goes to the earliest due khoản when công nợ is read. Số dư quỹ is not stored: each tài khoản tiền's balance = số dư đầu kỳ + thu − chi of the phiếu chưa huỷ (migration `dot6_derived_cash_balance` moved the old stored balances into số dư đầu kỳ).

Màu hiển thị (Đợt 8): one set per company on the `CompanyInfo` row — `GET /api/company/display-colors` for every signed-in user, `PUT` (the whole set; only changed colours are stored) needs `company.update`.

Nhật ký hoạt động (Đợt 9): `src/audit/`. Every write logs one line through `AuditService.log(tx, …)` inside its own transaction (who, what, which record, a Vietnamese summary, changed fields with labels, related document codes, IP, request id); sign-in and failed sign-in are logged too. The `AuditLog` table is append-only: triggers refuse UPDATE, DELETE and TRUNCATE (migration `dot9_audit_log`, which also turned the creation / cancellation of existing documents into their first history lines). Safety net: `AuditContextInterceptor` records an `api.unaudited` line (and warns) for any successful POST/PUT/PATCH/DELETE that logged nothing, and `test/audit-coverage.setup.ts` fails every e2e file that produced one — a new write endpoint must call `audit.log`. Read: `GET /api/audit-logs` (needs `audit.view`; filters `from`, `to`, `userId`, `entityType`, `action` prefix, `q`, keyset `before`) for Thiết lập › Nhật ký hoạt động, and `GET /api/audit-logs/entity/:type/:id?code=` for the Nhật ký tab of a record (its view right is enough; lines of other records that name its code show to those who may open them).

Still to come: reports.

## What's not done yet
- Dữ liệu demo (giả): `npm run prisma:seed:demo` nạp vào database (dữ liệu sinh bởi `node tools/gen-demo-data.mjs` → `backend/prisma/demo-data.json`).
- Product photos and the company logo are stored as data: URLs in the database until file uploads exist.
- Reports (`/bao-cao`) are UI-only placeholders — no aggregation queries yet.
- "Xuất Excel" đã chạy ở Đơn hàng bán (tạo file phía trình duyệt bằng ExcelJS, tên file theo `exportFileName`); các danh sách khác chưa có nút xuất.

## Vận hành

- **CI**: `.github/workflows/ci.yml` chạy lint, unit, e2e (PostgreSQL thật) và build cho mỗi push / pull request. Bật Render › Auto-Deploy › "After CI checks pass" để chỉ deploy khi xanh.
- **Sao lưu**: `.github/workflows/backup-db.yml` sao lưu Neon mỗi ngày, khôi phục thử, mã hoá rồi lưu 30 ngày. Cần secret `BACKUP_DATABASE_URL` và `BACKUP_PASSPHRASE`; cách khôi phục ở `tools/backup/README.md`.
- **Kiểm tra sống**: `GET /api/health` (200 khi app và DB trả lời, 503 khi không) — Render dùng làm health check; có thể trỏ UptimeRobot vào đây. Mỗi phản hồi có `X-Request-Id`, cùng mã đó nằm trong Nhật ký hoạt động và log lỗi.
- **Báo lỗi (tuỳ chọn)**: đặt `SENTRY_DSN` (server) và `SENTRY_FRONTEND_DSN` (trình duyệt); bỏ trống là tắt.
- **Bảo mật đăng nhập**: giới hạn thử mật khẩu (`LOGIN_LIMIT_IP`, `LOGIN_LIMIT_ACCOUNT`), header bảo mật + CSP (helmet), người dùng tự đổi mật khẩu ở menu tài khoản; tài khoản do quản trị cấp phải đổi mật khẩu ở lần đăng nhập đầu.
