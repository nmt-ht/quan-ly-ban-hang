import type { AuthUser } from '../auth/auth.service.js';

/**
 * Giá nhập (đơn giá đơn nhập, giá trên phiếu nhập kho, giá mua theo NCC) is for who buys, approves, prices or pays —
 * not for a role that only receives goods (Thủ kho has purchase.view and supplier.view to do its job, but none of these).
 * The frontend's seesPurchasePrices mirrors this list.
 */
export const PURCHASE_PRICE_PERMISSIONS = [
  'purchase.create', 'purchase.update', 'purchase.approve', 'stock.import_price', 'product.view_cost_price', 'debt.view',
];

export const seesPurchasePrices = (user: Pick<AuthUser, 'permissions'>) =>
  PURCHASE_PRICE_PERMISSIONS.some((p) => user.permissions.includes(p));
