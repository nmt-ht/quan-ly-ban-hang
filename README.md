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

Sign-in goes to the backend (`POST /api/auth/login`), so start the backend first. Which modules use the API instead of the in-browser demo data is set in `src/app/core/api/api.config.ts` (`USE_API`); today `auth`, `catalog` (danh mục) and `inventory` (tồn kho, phiếu kho) are on. Set `auth` to `false` to run the frontend alone on the in-browser demo data, with the demo accounts below and the password `demo1234`.

Demo accounts (after `prisma:seed:demo` with `DEMO_USER_PASSWORD=demo1234`, or in demo mode): `quan.ly@ninhtrang.local` (Quản lý), `ke.toan@ninhtrang.local` (Kế toán), `sale1@ninhtrang.local` (Sale), `thu.kho@ninhtrang.local` (Thủ kho). `admin@ninhtrang.local` (CEO) keeps the password from `SEED_ADMIN_PASSWORD`. The login screen never shows these. Danh mục (người dùng, chức vụ, công ty, thẻ, kho, nhóm hàng, hàng hoá, định mức, khách hàng, NCC, xe, tài khoản tiền, loại thu chi) are read from and saved to the database: `core/api/catalog-loader.service.ts` loads them into `MockDataService`'s signals after sign-in, and each feature service saves through `core/api/api.service.ts`. Tồn kho and phiếu kho lập tay (nhập, xuất, chuyển, kiểm kê, huỷ) go through the API too. Documents (đơn hàng, chuyến, lệnh sản xuất, phiếu thu chi…) are still in-memory until their module moves to the API — including the phiếu kho they create, so those stock moves last until a reload.

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

Still to come: purchase orders, sales orders, production orders, delivery trips, cash vouchers, reports.

## What's not done yet
- Dữ liệu demo (giả) đã có: xem `docs/demo-data.md` (`npm run prisma:seed:demo` cho backend, `core/data/demo-data.ts` cho frontend).
- Documents still live in `MockDataService` (Đợt 3–6 of the backend plan): mua hàng, bán hàng + sản xuất, giao hàng, thu chi & công nợ.
- Product photos and the company logo are stored as data: URLs in the database until file uploads exist.
- Reports (`/bao-cao`) are UI-only placeholders — no aggregation queries yet.
- "Xuất Excel" đã chạy ở Đơn hàng bán (tạo file phía trình duyệt bằng ExcelJS, tên file theo `exportFileName`); các danh sách khác chưa có nút xuất.
