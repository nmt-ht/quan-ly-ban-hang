# Backend plan — NestJS + PostgreSQL

## Stack
- **NestJS 12** (ESM/NodeNext — note all relative imports need a `.js` suffix, e.g. `import { X } from './x.service.js'`, even though the source file is `x.service.ts`)
- **Prisma** ORM against **PostgreSQL**
- **JWT** auth (`@nestjs/jwt` + `passport-jwt`), permissions baked into the token at login
- **class-validator** / **class-transformer** for request DTOs

## Why this pairing
TypeScript end-to-end (shared mental model with the Angular frontend), Prisma gives a typed client and a migration history that maps directly onto the relational structure this app needs (orders → lines → stock movements → ledgers), and Postgres handles the numeric/decimal precision money and quantities need.

## What's scaffolded
```
backend/
  prisma/
    schema.prisma      — full data model (24 tables) mirroring frontend/src/app/core/models/domain.models.ts
    seed.ts             — seeds permission catalog, 7 roles, warehouses, categories, cash accounts, 1 admin user
  src/
    prisma/             — PrismaService + global PrismaModule
    auth/                — login, JWT strategy, @RequirePermissions() decorator + PermissionsGuard
    modules/
      products/          — full CRUD reference module (controller/service/dto)
      customers/          — full CRUD reference module, same pattern
    app.module.ts, main.ts
```

Only **products** and **customers** are fully implemented as the reference pattern. Every other module in the sitemap (suppliers, purchase orders, sales orders, warehouse vouchers, production orders, delivery trips, vehicles, cash vouchers, tags, users/roles) follows the *identical* shape:

```
modules/<name>/
  dto/create-<name>.dto.ts   — class-validator DTO
  dto/update-<name>.dto.ts   — PartialType(Create...)
  <name>.service.ts           — Prisma calls (findAll/findOne/create/update/deactivate)
  <name>.controller.ts        — @UseGuards(JwtAuthGuard, PermissionsGuard) + @RequirePermissions('<module>.<action>')
  <name>.module.ts
```

Copy the products module as the template — swap the Prisma model, DTO fields, and permission codes (the full permission catalog is in `prisma/seed.ts` and `frontend/src/app/core/services/mock-data.service.ts`).

## Auth model
- `POST /api/auth/login` → verifies bcrypt password hash, returns a JWT whose payload embeds `roleId`, `roleName`, and the **flat list of permission codes** for that role.
- `PermissionsGuard` reads `@RequirePermissions('product.create')` off the route and checks it against the JWT's embedded permission list — no DB hit per request.
- **Trade-off**: changing a role's permissions doesn't take effect for already-issued tokens until the user re-logs in (12h expiry). Acceptable for a small team; if it isn't, swap the guard to look up permissions from the DB by `roleId` on each request instead.

## Business rules to implement as you build out each module
These came directly from the crawl of the source app and should drive validation/service logic, not just UI copy:

1. **Revenue/AR recognition**: `SalesOrderLine.receivedQuantity` (not `quantity`) is what should post to the customer's accounts-receivable ledger and revenue reports — only recognize on actual delivery/receipt, matching "Doanh thu ghi nhận khi khách THỰC NHẬN hàng" from the source app. A partial delivery pro-rates the order-level discount by the ratio of received value to ordered value.
2. **Production order BOM snapshot**: when a `ProductionOrder` is created from a `SalesOrder` line, copy the current `BomLine` rows for that product into `ProductionOrder.bomSnapshot` (JSON) rather than referencing `BomLine` live — later BOM edits must not retroactively change orders already in flight.
3. **Pricing tiers**: `Product.retailPrice` / `wholesalePrice` / `dropshipPrice` auto-select based on `Customer.type`, but the resolved price is copied onto `SalesOrderLine.unitPrice` at order-creation time and never recalculated from the product afterward.
4. **Cost-price visibility**: `product.view_cost_price` is a separate permission from `product.view` — cost/purchase price fields should be stripped from API responses server-side (not just hidden in the UI) for roles lacking it (Sale, Thủ kho).
5. **Product deactivation is soft**: `product.delete` / `customer.delete` / `supplier.delete` mean "ngừng kinh doanh / ngừng theo dõi / ngừng hợp tác" — set `isActive = false`, never a hard delete, since historical orders reference these rows.
6. **Warehouse voucher types**: `NHAP` / `XUAT` / `CHUYEN` / `KIEM_KE` each have different required fields (`CHUYEN` needs `targetWarehouseId`; `KIEM_KE` reconciles counted vs. system quantity) — model as one table with a discriminator (already done in the schema) but validate per-type in the DTO/service.
7. **Stock quantities always normalize to `Product.baseUnit`**; `UnitConversion` rows are display/order-entry convenience only.

## Next implementation steps
1. `npm install` in `backend/` (already scaffolded — see package.json).
2. Copy `.env.example` to `.env`, point `DATABASE_URL` at a local or Railway Postgres instance.
3. `npm run prisma:migrate` — creates the schema and prompts for a migration name.
4. `npm run prisma:seed` — seeds roles/permissions/lookups/admin user.
5. `npm run start:dev` — API on `http://localhost:3000/api`.
6. Build out the remaining modules following the products/customers pattern, wiring each into `app.module.ts`.
7. Point the Angular `AuthService`/feature services at the real endpoints instead of the in-memory `MockDataService` (see `docs/frontend-integration.md` — TODO once modules are built).
