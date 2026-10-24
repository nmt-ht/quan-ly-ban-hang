/**
 * Giá nhập (đơn giá đơn nhập, giá trên phiếu nhập kho, giá mua theo NCC) — same rule as the server's
 * common/purchase-prices.ts, which leaves these prices out (null) for everyone else.
 */
export const PURCHASE_PRICE_PERMISSIONS = [
  'purchase.create', 'purchase.update', 'purchase.approve', 'stock.import_price', 'product.view_cost_price', 'debt.view',
];

export const seesPurchasePrices = (can: (code: string) => boolean) => PURCHASE_PRICE_PERMISSIONS.some((p) => can(p));
