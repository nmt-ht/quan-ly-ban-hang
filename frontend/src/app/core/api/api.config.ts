// Where the NestJS API lives. In development `ng serve` proxies /api to localhost:3000 (proxy.conf.json),
// so the browser stays same-origin and needs no CORS. A deployment serving the API elsewhere
// changes this one line.
export const API_BASE = '/api';

// Modules switch from MockDataService to the API one at a time, as their backend module lands
// (kế hoạch nối backend: Đợt 0 = auth, Đợt 1 = danh mục, …). false = keep the in-browser demo data.
export const USE_API = {
  // Real sign-in against the database. false = demo accounts from core/data/demo-data.ts, password demo1234.
  auth: true,
  // Danh mục (người dùng, chức vụ, công ty, thẻ, kho, nhóm hàng, hàng hoá, định mức, khách hàng, NCC, xe,
  // tài khoản tiền, loại thu chi) are loaded from and saved to the database. Needs `auth`.
  catalog: true,
} as const;

/** Danh mục come from the API only when sign-in does too (the calls need the token). */
export const CATALOG_FROM_API: boolean = USE_API.auth && USE_API.catalog;
