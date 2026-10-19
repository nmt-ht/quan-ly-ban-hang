# Deployment plan — Railway

The source app is already hosted on Railway (`ninhtrang-frontend-production.up.railway.app`), so this plan targets the same platform: one project with three services — Postgres, the NestJS API, and the Angular static site.

## Topology

```
Railway project "ninh-trang"
├── Postgres (plugin)                  — managed, provides DATABASE_URL
├── Service: ninh-trang-api            — backend/ (NestJS), private + public domain
└── Service: ninh-trang-frontend       — frontend/ (Angular static build), public domain
```

Keep the API and frontend as **separate Railway services** (not one combined deploy) — they scale, restart, and roll back independently, and it matches how the original app is already split (the crawled app's frontend origin had no visible API subdomain, but a Nest/Express API is a distinct deployable).

## 1. Postgres
1. In the Railway project, **New → Database → PostgreSQL**.
2. Railway auto-generates `DATABASE_URL`, `PGHOST`, etc. as service variables.

## 2. Backend service (`backend/`)
1. **New → GitHub Repo** (or `railway up` from the `backend/` directory) pointing at this repo, root directory `backend`.
2. Build: Railway auto-detects Node via Nixpacks. Add a `railway.json` or just rely on `package.json`'s `build`/`start:prod` scripts:
   - Build command: `npm run build && npm run prisma:generate`
   - Start command: `npm run prisma:deploy && npm run start:prod`
     (runs pending migrations before booting — safe for single-instance deploys; see §5 for multi-instance caveats)
3. **Variables** (Service → Variables):
   - `DATABASE_URL` → reference the Postgres plugin's `DATABASE_URL` (Railway lets you reference another service's variable directly, no copy-paste)
   - `JWT_SECRET` → generate a real random value (`openssl rand -hex 32`), never the dev default
   - `CORS_ORIGIN` → the frontend service's public URL (set after step 3 exists, then redeploy)
   - `PORT` → Railway injects this automatically; `main.ts` already reads `process.env.PORT`
4. After first deploy, run the seed once via Railway's shell (`railway run npm run prisma:seed --service ninh-trang-api`) or a one-off job — do **not** leave seeding wired into every deploy's start command, or you'll re-run upserts on every restart (harmless here since it's all `upsert`, but still avoid it once real data exists).
5. Note the generated public domain, e.g. `ninh-trang-api-production.up.railway.app`.

## 3. Frontend service (`frontend/`)
1. **New → GitHub Repo**, root directory `frontend`.
2. Build command: `npm run build` (outputs to `dist/frontend/browser` for a client-only Angular build).
3. Since this is a static SPA, serve it with a tiny static server rather than Node — either:
   - Add `"start": "npx http-server dist/frontend/browser -p $PORT -P index.html"` (SPA fallback flag `-P`/`--proxy` varies by tool; `serve -s` is simpler: `npx serve -s dist/frontend/browser -l $PORT`), or
   - Use Railway's native **static site** deploy type if available for your account, which handles SPA fallback (all routes → `index.html`) automatically. This matters because Angular's client-side router needs every deep link (`/hang-hoa`, `/don-hang/them`, ...) to resolve to `index.html` — confirmed necessary during local testing, where direct navigation to a sub-route 404'd without SPA fallback configured.
4. **Variables**: none required for a build-time-only static app; if you later inject the API URL via `environment.ts` instead of a relative `/api` path, set it as a build-time variable and reference it in `angular.json`'s fileReplacements.
5. Point the Angular app's API calls at the backend's public domain from step 2 (or put both services behind one custom domain with path-based routing, e.g. `app.ninhtrang.vn` → frontend, `app.ninhtrang.vn/api` → backend, using Railway's custom domain + a reverse proxy if you want a single origin and to avoid CORS entirely).

## 4. Environment separation
Use **separate Railway environments** (Railway supports this natively — Production / Staging tabs in the same project) rather than separate projects, so Postgres plugin config, variable references, and service topology are cloned automatically. Point CI (see §6) at whichever environment matches the branch.

## 5. Migrations in production
- Single instance: running `prisma migrate deploy` in the start command (as above) is safe — it applies pending migrations before the app binds to a port.
- If you ever scale the API to multiple instances, move `prisma migrate deploy` into Railway's **pre-deploy / release phase** (a separate one-off command Railway runs once per deploy before scaling up instances) instead of the shared start command, to avoid N instances racing to apply the same migration concurrently.

## 6. CI/CD
- Railway's GitHub integration auto-deploys on push to the tracked branch per service — no extra CI needed for basic continuous deployment.
- If you want tests to gate deploys, add a GitHub Actions workflow that runs `npm test` in both `frontend/` and `backend/` on PRs, and only let Railway auto-deploy from `main` after merge (Railway deploys independently of GitHub Actions status by default, so this is a repo branch-protection rule, not a Railway setting).

## 7. Secrets checklist before going live
- [ ] `JWT_SECRET` is a real random value, not the `.env.example` default
- [ ] Seeded admin password (`SEED_ADMIN_PASSWORD` / the `ChangeMe123!` placeholder in `prisma/seed.ts`) has been rotated via the app's own "Đặt lại mật khẩu" flow
- [ ] `CORS_ORIGIN` is scoped to the actual frontend domain(s), not `*`
- [ ] Postgres backups enabled (Railway Postgres plugin → Settings → Backups)
