import { CustomerType, Product, Promotion, PromotionKind } from '../../core/models/domain.models';

// Khuyến mãi (Pha 1.6) — pure rules shared by the Đơn hàng bán and Báo giá forms. The server stores what the form
// applied (promotionId on lines and on the order, isGift = chiết khấu 100%) but does not compute promotions itself.
//
// - Chương trình áp khi: đang chạy, ngày chứng từ trong [startDate, endDate], khách thuộc phạm vi.
// - GIAM_HANG / BAC_THANG fill chiết khấu dòng of lines not typed by hand; when several apply, the larger wins.
// - GIAM_DON fills Chiết khấu cả đơn (unless typed by hand) once tiền hàng sau chiết khấu dòng reaches the threshold.
// - TANG_HANG adds hàng tặng lines: each full buyQuantity (ĐVT chính) of the matching goods gives giftQuantity.

export const PROMOTION_KIND_LABEL: Record<PromotionKind, string> = {
  GIAM_HANG: 'Giảm giá mặt hàng',
  GIAM_DON: 'Giảm theo tổng đơn',
  BAC_THANG: 'Giảm theo số lượng',
  TANG_HANG: 'Mua hàng tặng hàng',
};

export interface PromoCustomer {
  type: CustomerType;
  priceListId?: string | null;
}

/** Chương trình đang áp cho một chứng từ ngày `day` của khách này. */
export function activePromotions(all: Promotion[], day: string, customer: PromoCustomer | undefined): Promotion[] {
  if (!customer || !day) return [];
  return all.filter((p) => {
    if (!p.isActive || p.startDate.slice(0, 10) > day || (p.endDate && p.endDate.slice(0, 10) < day)) return false;
    if (p.scope === 'LOAI_KHACH') return p.customerTypes.includes(customer.type);
    if (p.scope === 'BANG_GIA') return !!customer.priceListId && p.priceListIds.includes(customer.priceListId);
    return true;
  });
}

/** Mặt hàng thuộc chương trình: chọn theo mặt hàng hoặc nhóm hàng; cả hai trống = mọi mặt hàng. */
export function coversProduct(p: Promotion, product: Product | undefined): boolean {
  if (!product) return false;
  if (!p.productIds.length && !p.categoryIds.length) return true;
  return p.productIds.includes(product.id) || (!!product.categoryId && p.categoryIds.includes(product.categoryId));
}

export interface PricedLine {
  quantity: number; // theo ĐVT của dòng
  unitPrice: number;
  ratio: number; // ĐVT chính trong 1 ĐVT của dòng
}

const discountOf = (type: Promotion['discountType'], value: number, line: PricedLine) => {
  const gross = Math.round(line.quantity * line.unitPrice);
  const amount = type === 'PHAN_TRAM' ? Math.round((gross * value) / 100) : Math.round(value * line.quantity * line.ratio);
  return Math.min(gross, Math.max(0, amount));
};

/** Chiết khấu dòng tốt nhất từ GIAM_HANG / BAC_THANG, hoặc null khi không chương trình nào áp. */
export function lineDiscountFor(promos: Promotion[], product: Product | undefined, line: PricedLine): { amount: number; promotionId: string } | null {
  let best: { amount: number; promotionId: string } | null = null;
  const baseQty = line.quantity * line.ratio;
  for (const p of promos) {
    if (!coversProduct(p, product)) continue;
    let amount = 0;
    if (p.kind === 'GIAM_HANG') amount = discountOf(p.discountType, p.discountValue, line);
    else if (p.kind === 'BAC_THANG') {
      const tier = [...p.tiers].sort((a, b) => b.minQuantity - a.minQuantity).find((t) => baseQty >= t.minQuantity);
      if (tier) amount = discountOf(p.discountType, tier.value, line);
    }
    if (amount > 0 && (!best || amount > best.amount)) best = { amount, promotionId: p.id };
  }
  return best;
}

/** Chiết khấu cả đơn tốt nhất từ GIAM_DON; `net` = tiền hàng sau chiết khấu dòng (không tính hàng tặng). */
export function orderDiscountFor(promos: Promotion[], net: number): { amount: number; promotionId: string } | null {
  let best: { amount: number; promotionId: string } | null = null;
  for (const p of promos) {
    if (p.kind !== 'GIAM_DON' || net <= 0 || net < p.minOrderValue) continue;
    const amount = Math.min(net, p.discountType === 'PHAN_TRAM' ? Math.round((net * p.discountValue) / 100) : Math.round(p.discountValue));
    if (amount > 0 && (!best || amount > best.amount)) best = { amount, promotionId: p.id };
  }
  return best;
}

/** Hàng tặng theo TANG_HANG: cộng số lượng (ĐVT chính) các dòng mua thuộc chương trình. */
export function giftsFor(
  promos: Promotion[], lines: { productId: string; baseQuantity: number }[], product: (id: string) => Product | undefined,
): { promotionId: string; productId: string; quantity: number }[] {
  const out: { promotionId: string; productId: string; quantity: number }[] = [];
  for (const p of promos) {
    if (p.kind !== 'TANG_HANG' || !p.giftProductId || !(p.buyQuantity > 0) || !(p.giftQuantity > 0)) continue;
    const bought = lines.filter((l) => coversProduct(p, product(l.productId))).reduce((s, l) => s + l.baseQuantity, 0);
    const times = Math.floor(Math.round(bought * 10_000) / Math.round(p.buyQuantity * 10_000));
    if (times > 0) out.push({ promotionId: p.id, productId: p.giftProductId, quantity: times * p.giftQuantity });
  }
  return out;
}

/** A draft line of the order / báo giá form, as far as khuyến mãi is concerned. */
export interface PromoDraftLine {
  key: string;
  productId: string;
  unitName: string;
  quantity: number | null;
  unitPrice: number | null;
  discountRate: number | null;
  discountAmount: number | null;
  /** Chiết khấu gõ tay: khuyến mãi không ghi đè. */
  discountManual: boolean;
  promotionId: string | null;
  isGift: boolean;
}

export interface ApplyOptions<T extends PromoDraftLine> {
  enabled: boolean;
  promos: Promotion[];
  product: (id: string) => Product | undefined;
  ratio: (l: T) => number;
  /** A hàng tặng line (priced from the list, chiết khấu 100%); `previous` is the same gift before, to keep what the user set on it. */
  makeGift: (productId: string, quantity: number, promotionId: string, previous?: T) => T;
}

const rateOf = (amount: number, gross: number) => (gross && amount ? Math.round((amount / gross) * 10000) / 100 : null);

/**
 * The lines with khuyến mãi applied: chiết khấu of every line not typed by hand follows the best GIAM_HANG / BAC_THANG
 * (cleared when none applies any more), and the hàng tặng lines are rebuilt from TANG_HANG. Off → no automatic
 * chiết khấu and no hàng tặng.
 */
export function applyLinePromotions<T extends PromoDraftLine>(lines: T[], o: ApplyOptions<T>): T[] {
  const bought = lines.filter((l) => !l.isGift);
  const priced = bought.map((l) => {
    if (l.discountManual || !l.productId) return l;
    const qty = l.quantity ?? 0;
    const price = l.unitPrice ?? 0;
    const best = o.enabled && qty > 0 ? lineDiscountFor(o.promos, o.product(l.productId), { quantity: qty, unitPrice: price, ratio: o.ratio(l) }) : null;
    if (best) return { ...l, discountAmount: best.amount, discountRate: rateOf(best.amount, Math.round(qty * price)), promotionId: best.promotionId };
    return l.promotionId ? { ...l, discountAmount: null, discountRate: null, promotionId: null } : l;
  });
  if (!o.enabled) return priced;
  const gifts = giftsFor(
    o.promos,
    priced.filter((l) => l.productId && (l.quantity ?? 0) > 0).map((l) => ({ productId: l.productId, baseQuantity: (l.quantity ?? 0) * o.ratio(l) })),
    o.product,
  );
  const old = lines.filter((l) => l.isGift);
  return [...priced, ...gifts.map((g) => o.makeGift(g.productId, g.quantity, g.promotionId, old.find((x) => x.promotionId === g.promotionId && x.productId === g.productId)))];
}
