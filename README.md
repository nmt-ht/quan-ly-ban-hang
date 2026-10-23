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

Phân quyền trên giao diện: the role's permissions decide which menu links, Ctrl K entries, "Thêm / Lập …" buttons and routes a user gets. One table drives all of it: `src/app/core/auth/route-access.ts`. Buttons that act in place (Duyệt, Huỷ, Xoá…) and cost-price columns are not gated yet, and the backend must still check every call.

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
