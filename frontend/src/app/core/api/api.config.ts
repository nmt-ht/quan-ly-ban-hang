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
  // Tồn kho and phiếu kho (lập, huỷ). Phiếu that other documents create (nhận hàng, giao hàng, sản xuất)
  // stay in the browser until those modules move (Đợt 3–5). Needs `auth`.
  inventory: true,
  // Đơn nhập hàng (lập, sửa, gửi NCC, nhận hàng, hoàn tất, huỷ). Nhận hàng writes its phiếu nhập kho on
  // the server. Needs `auth` and `inventory`.
  purchasing: true,
  // Đơn hàng bán (lập, sửa, huỷ, kết thúc, giao hàng + thu tiền ngay) and lệnh sản xuất (lập, bắt đầu,
  // nghiệm thu, huỷ); their phiếu kho are written on the server. Chuyến giao hàng still changes orders
  // in the browser until Đợt 5. Needs `auth` and `inventory`.
  sales: true,
  // Chuyến giao hàng (lập, xếp đơn, xuất kho, chốt giao / bỏ chốt, xe về kho, hoàn tất, huỷ, chi phí).
  // Needs `sales`.
  delivery: true,
  // Phiếu thu chi (lập, huỷ, đối trừ chọn tay / tự động); số dư quỹ is computed by the server from the
  // phiếu, and công nợ phải thu / phải trả are read from /receivables and /payables.
  // Needs `sales` and `purchasing`.
  cash: true,
} as const;

/** Danh mục come from the API only when sign-in does too (the calls need the token). */
export const CATALOG_FROM_API: boolean = USE_API.auth && USE_API.catalog;

/** Tồn kho and phiếu kho come from the API (Đợt 2). */
export const INVENTORY_FROM_API: boolean = USE_API.auth && USE_API.inventory;

/** Đơn nhập hàng come from the API (Đợt 3). */
export const PURCHASING_FROM_API: boolean = INVENTORY_FROM_API && USE_API.purchasing;

/** Đơn hàng bán and lệnh sản xuất come from the API (Đợt 4). */
export const SALES_FROM_API: boolean = INVENTORY_FROM_API && USE_API.sales;

/** Chuyến giao hàng come from the API (Đợt 5). */
export const DELIVERY_FROM_API: boolean = SALES_FROM_API && USE_API.delivery;

/** Phiếu thu chi, số dư quỹ and công nợ come from the API (Đợt 6). */
export const CASH_FROM_API: boolean = SALES_FROM_API && PURCHASING_FROM_API && USE_API.cash;
