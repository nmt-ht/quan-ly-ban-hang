# Ninh Trang ERP — rebuild scaffold

An Angular + NestJS rebuild of the Ninh Trang business-management app, covering inventory, purchasing, sales, delivery, production, cash flow, and RBAC user management for a frame/glass manufacturing & trading business.

## Structure

```
ninh-trang-erp/
  frontend/    — Angular 22 app, all 20 pages from the source sitemap, mock in-memory data
  backend/     — NestJS 12 + Prisma + PostgreSQL, auth + RBAC + 2 reference CRUD modules
  docs/
    backend-plan.md        — backend architecture, module pattern, business rules to enforce
    deployment-plan.md     — Railway deployment topology and checklist
```

## Frontend

```bash
cd frontend
npm start          # http://localhost:4300 (or PORT env var); /api is proxied to localhost:3000 (proxy.conf.json)
```

Sign-in goes to the backend (`POST /api/auth/login`), so start the backend first. Which modules use the API instead of the in-browser demo data is set in `src/app/core/api/api.config.ts` (`USE_API`); today `auth`, `catalog` (danh mục), `inventory` (tồn kho, phiếu kho), `purchasing` (đơn nhập hàng), `sales` (đơn hàng bán, lệnh sản xuất), `delivery` (chuyến giao hàng) and `cash` (phiếu thu chi, công nợ) are on. Set `auth` to `false` to run the frontend alone on the in-browser demo data, with the demo accounts below and the password `demo1234`.

Demo accounts (after `prisma:seed:demo` with `DEMO_USER_PASSWORD=demo1234`, or in demo mode): `quan.ly@ninhtrang.local` (Quản lý), `ke.toan@ninhtrang.local` (Kế toán), `sale1@ninhtrang.local` (Sale), `thu.kho@ninhtrang.local` (Thủ kho). `admin@ninhtrang.local` (CEO) keeps the password from `SEED_ADMIN_PASSWORD`. The login screen never shows these. Danh mục (người dùng, chức vụ, công ty, thẻ, kho, nhóm hàng, hàng hoá, định mức, khách hàng, NCC, xe, tài khoản tiền, loại thu chi) are read from and saved to the database: `core/api/catalog-loader.service.ts` loads them into `MockDataService`'s signals after sign-in, and each feature service saves through `core/api/api.service.ts`. Tồn kho and phiếu kho lập tay (nhập, xuất, chuyển, kiểm kê, huỷ) go through the API too. Đơn nhập hàng too, and its nhận hàng writes the phiếu nhập kho on the server. Đơn hàng bán and lệnh sản xuất too: giao hàng, bắt đầu sản xuất and nghiệm thu write their phiếu kho on the server, and "Thu tiền ngay" its phiếu thu. Chuyến giao hàng too (xuất kho, chốt giao, nhập trả về on the server). Phiếu thu chi too (lập, huỷ, đối trừ chọn tay / tự động); số dư quỹ comes from the server. Công nợ phải thu / phải trả on screen are read from `GET /api/receivables` and `GET /api/payables` (DebtService), and read again whenever an order, phiếu thu chi, khách hàng or NCC changes; roles without `debt.view` see none.

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

Seeded login: `admin@ninhtrang.local` / value of `SEED_ADMIN_PASSWORD` in `.env` (defaults to `ChangeMe123!` — rotate immediately, see `docs/deployment-plan.md`).

Wired end to end (Đợt 1): users, roles, company, tags, warehouses, categories, products (+ units, images, import, định mức), customers (+ addresses, tags), suppliers (+ danh mục hàng theo NCC), vehicles, cash accounts, cash categories — under `src/modules/`. Danh mục reads are open to every signed-in user (other screens show those names); writes need the matching permission. Full user accounts need `user.view`, roles need `position.view` or `user.view`, supplier purchase prices need `supplier.view`.

Kho (Đợt 2): `src/modules/inventory/` — `InventoryService.post()` is the only code that changes `StockLevel` (NHAP +, XUAT −, CHUYEN −/+, KIEM_KE ± the difference to the book stock read under a row lock); cancelling reverses it, and a voucher made by another document can only be cancelled there. Xuất quá tồn is allowed and flagged, as before. Each kind of phiếu needs its own permission; without `stock.import_price` the purchase price of a phiếu nhập is dropped (and the frontend hides the column). Later modules call `post()` inside their own transaction.

```bash
npm run test:e2e   # needs the seeded local DB; suites run one after another and clean up after themselves
```

Mua hàng (Đợt 3): `src/modules/purchasing/` — đơn nhập hàng (lập, sửa khi Nháp, gửi NCC = `purchase.approve`, nhận hàng = `purchase.receive`, hoàn tất, huỷ khi chưa nhận gì). Nhận hàng locks the order row, caps each line at what is left, and posts one phiếu nhập kho per kho through `InventoryService.post()` in the same transaction, with the purchase price per base unit. Totals are derived from the lines, never stored. Editing sends the `updatedAt` it loaded; a stale copy gets 409 "vừa được người khác lưu". `GET /api/payables` (`debt.view`) computes công nợ phải trả with the same đối trừ as the frontend (`src/common/settle.ts`).

Bán hàng & sản xuất (Đợt 4): `src/modules/sales/` — đơn hàng bán (lập, sửa trước khi sản xuất/giao, huỷ, kết thúc đơn, giao hàng) and lệnh sản xuất (lập từ đơn với định mức chụp lại, bắt đầu = xuất vật tư từ kho ngầm định, nghiệm thu = nhập số đạt vào Kho thành phẩm, huỷ). Totals and status are derived with the same rules as the frontend (`sales-order.rules.ts`); the order row is locked during each step. Without `order.update_price` a line must keep the list price for the customer type. `GET /api/receivables` (`debt.view`) computes công nợ phải thu. A seller (`order.create`) without `order.view_all` only gets the orders they sell or made; roles that do not sell (Thủ kho, giao hàng) see all of them, since they ship them.

Giao hàng (Đợt 5): `src/modules/delivery/` — chuyến (lập, xếp đơn, xuất kho một lượt, chốt giao / bỏ chốt từng đơn, xe về kho nhập lại hàng khách không nhận, hoàn tất, huỷ khi chưa xuất, chi phí chuyến). Loads and chốt giao are stored per order line; totals are derived. Chốt giao moves the order (Giao một phần / Hoàn thành / Trả toàn bộ) and makes the "Thu tiền ngay" phiếu thu; bỏ chốt cancels it again. Each step answers the chuyến and the orders it touched.

Thu chi (Đợt 6): `src/modules/cash/` — phiếu thu / phiếu chi (lập = `voucher.create_receipt` / `voucher.create_payment`, huỷ = `voucher.cancel`; huỷ keeps the phiếu, marked huỷ). A phiếu tied to a khách hàng / NCC settles their công nợ: "Chọn tay" allocations must name that partner's own documents and may not exceed the phiếu; the rest goes to the earliest due khoản when công nợ is read. Số dư quỹ is not stored: each tài khoản tiền's balance = số dư đầu kỳ + thu − chi of the phiếu chưa huỷ (migration `dot6_derived_cash_balance` moved the old stored balances into số dư đầu kỳ).

Still to come: reports.

## What's not done yet
- Dữ liệu demo (giả) đã có: xem `docs/demo-data.md` (`npm run prisma:seed:demo` cho backend, `core/data/demo-data.ts` cho frontend).
- Product photos and the company logo are stored as data: URLs in the database until file uploads exist.
- Reports (`/bao-cao`) are UI-only placeholders — no aggregation queries yet.
- "Xuất Excel" đã chạy ở Đơn hàng bán (tạo file phía trình duyệt bằng ExcelJS, tên file theo `exportFileName`); các danh sách khác chưa có nút xuất.
