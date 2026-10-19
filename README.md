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
npm start          # http://localhost:4300 (or PORT env var)
```

Demo login: `demo@ninhtrang.local` / `demo1234` (client-only mock auth — see `src/app/core/services/auth.service.ts`). All data is in-memory (`MockDataService`); nothing persists across a page reload except the session flag.

## Backend

```bash
cd backend
cp .env.example .env      # point DATABASE_URL at a local or Railway Postgres
npm install
npm run prisma:migrate
npm run prisma:seed
npm run start:dev          # http://localhost:3000/api
```

Seeded login: `admin@ninhtrang.local` / value of `SEED_ADMIN_PASSWORD` in `.env` (defaults to `ChangeMe123!` — rotate immediately, see `docs/deployment-plan.md`).

Only `products` and `customers` are fully wired end-to-end as the reference pattern; every other module (suppliers, purchase orders, sales orders, warehouse vouchers, production orders, delivery trips, vehicles, cash vouchers, tags, users/roles) follows the same shape — see `docs/backend-plan.md` for the module template and the business rules that should drive their validation logic.

## What's not done yet
- Dữ liệu demo (giả) đã có: xem `docs/demo-data.md` (`npm run prisma:seed:demo` cho backend, `core/data/demo-data.ts` cho frontend).
- Frontend still talks to `MockDataService`, not the real API — swap each feature's data source for `HttpClient` calls once the corresponding backend module exists.
- Remaining ~18 backend modules (copy the `products`/`customers` pattern).
- Reports (`/bao-cao`) are UI-only placeholders — no aggregation queries yet.
- File exports ("Xuất Excel" buttons) are visual only.
