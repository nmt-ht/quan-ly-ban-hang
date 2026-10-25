// Khuyến mãi (Pha 1.6) — the same rules as the frontend's features/sales-orders/promotion.rules.ts. The forms fill the
// chiết khấu and hàng tặng; the server uses these to check that a role without order.discount gave no more than the
// running chương trình allow.
import { CustomerType, Prisma } from '@prisma/client';

export interface PromoRule {
  id: string;
  kind: 'GIAM_HANG' | 'GIAM_DON' | 'BAC_THANG' | 'TANG_HANG';
  scope: 'TAT_CA' | 'LOAI_KHACH' | 'BANG_GIA';
  customerTypes: CustomerType[];
  priceListIds: string[];
  productIds: string[];
  categoryIds: string[];
  discountType: 'PHAN_TRAM' | 'SO_TIEN';
  discountValue: number;
  minOrderValue: number;
  tiers: { minQuantity: number; value: number }[];
  buyQuantity: number;
  giftProductId: string | null;
  giftQuantity: number;
}

type PromotionRow = Prisma.PromotionGetPayload<object>;

export function toRule(p: PromotionRow): PromoRule {
  const tiers = Array.isArray(p.tiers) ? (p.tiers as { minQuantity: unknown; value: unknown }[]) : [];
  return {
    id: p.id, kind: p.kind, scope: p.scope, customerTypes: p.customerTypes, priceListIds: p.priceListIds, productIds: p.productIds,
    categoryIds: p.categoryIds, discountType: p.discountType as PromoRule['discountType'], discountValue: p.discountValue.toNumber(),
    minOrderValue: p.minOrderValue.toNumber(), tiers: tiers.map((t) => ({ minQuantity: Number(t.minQuantity), value: Number(t.value) })),
    buyQuantity: p.buyQuantity.toNumber(), giftProductId: p.giftProductId, giftQuantity: p.giftQuantity.toNumber(),
  };
}

/** Chương trình in force on `day` (startDate ≤ day ≤ endDate, đang chạy) for this khách. */
export function activeWhere(day: Date): Prisma.PromotionWhereInput {
  return { isActive: true, startDate: { lte: day }, OR: [{ endDate: null }, { endDate: { gte: day } }] };
}

export function forCustomer(promos: PromoRule[], customer: { type: CustomerType; priceListId: string | null }): PromoRule[] {
  return promos.filter((p) =>
    p.scope === 'LOAI_KHACH' ? p.customerTypes.includes(customer.type)
      : p.scope === 'BANG_GIA' ? !!customer.priceListId && p.priceListIds.includes(customer.priceListId)
      : true);
}

/** Mặt hàng thuộc chương trình: chọn theo mặt hàng hoặc nhóm hàng; cả hai trống = mọi mặt hàng. */
export function coversProduct(p: PromoRule, product: { id: string; categoryId: string | null } | undefined): boolean {
  if (!product) return false;
  if (!p.productIds.length && !p.categoryIds.length) return true;
  return p.productIds.includes(product.id) || (!!product.categoryId && p.categoryIds.includes(product.categoryId));
}

interface PricedLine {
  quantity: number; // theo ĐVT của dòng
  unitPrice: number;
  ratio: number; // ĐVT chính trong 1 ĐVT của dòng
}

const discountOf = (type: PromoRule['discountType'], value: number, line: PricedLine) => {
  const gross = Math.round(line.quantity * line.unitPrice);
  const amount = type === 'PHAN_TRAM' ? Math.round((gross * value) / 100) : Math.round(value * line.quantity * line.ratio);
  return Math.min(gross, Math.max(0, amount));
};

/** Chiết khấu dòng lớn nhất mà GIAM_HANG / BAC_THANG cho phép (0 khi không chương trình nào áp). */
export function lineDiscountFor(promos: PromoRule[], product: { id: string; categoryId: string | null } | undefined, line: PricedLine): number {
  let best = 0;
  const baseQty = line.quantity * line.ratio;
  for (const p of promos) {
    if (!coversProduct(p, product)) continue;
    let amount = 0;
    if (p.kind === 'GIAM_HANG') amount = discountOf(p.discountType, p.discountValue, line);
    else if (p.kind === 'BAC_THANG') {
      const tier = [...p.tiers].sort((a, b) => b.minQuantity - a.minQuantity).find((t) => baseQty >= t.minQuantity);
      if (tier) amount = discountOf(p.discountType, tier.value, line);
    }
    best = Math.max(best, amount);
  }
  return best;
}

/** Chiết khấu cả đơn lớn nhất từ GIAM_DON; `net` = tiền hàng sau chiết khấu dòng (không tính hàng tặng). */
export function orderDiscountFor(promos: PromoRule[], net: number): number {
  let best = 0;
  for (const p of promos) {
    if (p.kind !== 'GIAM_DON' || net <= 0 || net < p.minOrderValue) continue;
    best = Math.max(best, Math.min(net, p.discountType === 'PHAN_TRAM' ? Math.round((net * p.discountValue) / 100) : Math.round(p.discountValue)));
  }
  return best;
}

/** Hàng tặng TANG_HANG cho phép, theo mặt hàng tặng: ĐVT chính. */
export function giftsFor(
  promos: PromoRule[], lines: { productId: string; baseQuantity: number }[], product: (id: string) => { id: string; categoryId: string | null } | undefined,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of promos) {
    if (p.kind !== 'TANG_HANG' || !p.giftProductId || !(p.buyQuantity > 0) || !(p.giftQuantity > 0)) continue;
    const bought = lines.filter((l) => coversProduct(p, product(l.productId))).reduce((s, l) => s + l.baseQuantity, 0);
    const times = Math.floor(Math.round(bought * 10_000) / Math.round(p.buyQuantity * 10_000));
    if (times > 0) out.set(p.giftProductId, (out.get(p.giftProductId) ?? 0) + times * p.giftQuantity);
  }
  return out;
}
