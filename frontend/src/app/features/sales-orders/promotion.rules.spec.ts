import { Product, Promotion } from '../../core/models/domain.models';
import { PromoDraftLine, activePromotions, applyLinePromotions, giftsFor, lineDiscountFor, orderDiscountFor } from './promotion.rules';
import { priceFor } from './sales-order.rules';

const product = (id: string, categoryId?: string): Product => ({
  id, code: id.toUpperCase(), name: id, type: 'VAT_TU', baseUnit: 'Cái', minStock: 0, vatRate: 0, warrantyMonths: 0, categoryId,
  retailPrice: 100, wholesalePrice: 80, dropshipPrice: 90, isSellable: true, isActive: true,
  unitConversions: [{ unitName: 'Bó', ratioToBaseUnit: 12, price: 0 } as Product['unitConversions'][number]],
});
const promo = (over: Partial<Promotion>): Promotion => ({
  id: 'km', code: 'KM1', name: 'KM', kind: 'GIAM_HANG', startDate: '2026-10-01', endDate: null, isActive: true, scope: 'TAT_CA',
  customerTypes: [], priceListIds: [], productIds: [], categoryIds: [], discountType: 'PHAN_TRAM', discountValue: 0, minOrderValue: 0,
  tiers: [], buyQuantity: 0, giftProductId: null, giftQuantity: 0, ...over,
});
const products = new Map([['a', product('a', 'cat1')], ['b', product('b')], ['gift', product('gift')]]);

describe('priceFor với bảng giá riêng', () => {
  it('đúng ĐVT, rồi ĐVT chính × tỷ lệ, rồi giá theo loại khách', () => {
    const p = products.get('a')!;
    expect(priceFor(p, 'SI', '', [{ productId: 'a', unitName: '', price: 70 }])).toBe(70);
    expect(priceFor(p, 'SI', 'Bó', [{ productId: 'a', unitName: '', price: 70 }])).toBe(840);
    expect(priceFor(p, 'SI', 'Bó', [{ productId: 'a', unitName: 'Bó', price: 800 }])).toBe(800);
    expect(priceFor(p, 'SI', '', [{ productId: 'b', unitName: '', price: 1 }])).toBe(80);
  });
});

describe('activePromotions', () => {
  const customer = { type: 'SI' as const, priceListId: 'pl1' };
  it('theo ngày, trạng thái và phạm vi khách', () => {
    const all = [
      promo({ id: 'on' }),
      promo({ id: 'off', isActive: false }),
      promo({ id: 'future', startDate: '2026-11-01' }),
      promo({ id: 'ended', endDate: '2026-10-10' }),
      promo({ id: 'si', scope: 'LOAI_KHACH', customerTypes: ['SI'] }),
      promo({ id: 'le', scope: 'LOAI_KHACH', customerTypes: ['LE'] }),
      promo({ id: 'pl1', scope: 'BANG_GIA', priceListIds: ['pl1'] }),
      promo({ id: 'pl2', scope: 'BANG_GIA', priceListIds: ['pl2'] }),
    ];
    expect(activePromotions(all, '2026-10-24', customer).map((p) => p.id)).toEqual(['on', 'si', 'pl1']);
    expect(activePromotions(all, '2026-10-24', undefined)).toEqual([]);
  });
});

describe('lineDiscountFor', () => {
  const line = { quantity: 10, unitPrice: 100, ratio: 1 };
  it('GIAM_HANG theo % hoặc số tiền mỗi ĐVT chính; lấy mức lớn nhất; theo nhóm hàng', () => {
    const promos = [
      promo({ id: 'pct', discountValue: 10 }),
      promo({ id: 'vnd', discountType: 'SO_TIEN', discountValue: 15, categoryIds: ['cat1'] }),
    ];
    expect(lineDiscountFor(promos, products.get('a'), line)).toEqual({ amount: 150, promotionId: 'vnd' });
    expect(lineDiscountFor(promos, products.get('b'), line)).toEqual({ amount: 100, promotionId: 'pct' });
    // 1 Bó = 12 Cái: 15 đ × 12 × 1 bó
    expect(lineDiscountFor(promos, products.get('a'), { quantity: 1, unitPrice: 1200, ratio: 12 })?.amount).toBe(180);
  });

  it('BAC_THANG lấy bậc cao nhất đã đạt (số lượng theo ĐVT chính)', () => {
    const tiers = [promo({ id: 't', kind: 'BAC_THANG', tiers: [{ minQuantity: 5, value: 5 }, { minQuantity: 20, value: 10 }] })];
    expect(lineDiscountFor(tiers, products.get('a'), { quantity: 4, unitPrice: 100, ratio: 1 })).toBeNull();
    expect(lineDiscountFor(tiers, products.get('a'), { quantity: 10, unitPrice: 100, ratio: 1 })?.amount).toBe(50);
    expect(lineDiscountFor(tiers, products.get('a'), { quantity: 2, unitPrice: 1200, ratio: 12 })?.amount).toBe(240); // 24 cái → 10%
  });

  it('không vượt thành tiền', () => {
    expect(lineDiscountFor([promo({ discountType: 'SO_TIEN', discountValue: 500 })], products.get('a'), line)?.amount).toBe(1000);
  });
});

describe('orderDiscountFor', () => {
  it('GIAM_DON khi đạt ngưỡng; % hoặc số tiền; lấy mức lớn nhất', () => {
    const promos = [
      promo({ id: 'p5', kind: 'GIAM_DON', minOrderValue: 1000, discountValue: 5 }),
      promo({ id: 'v100', kind: 'GIAM_DON', minOrderValue: 3000, discountType: 'SO_TIEN', discountValue: 100 }),
    ];
    expect(orderDiscountFor(promos, 999)).toBeNull();
    expect(orderDiscountFor(promos, 1000)).toEqual({ amount: 50, promotionId: 'p5' });
    expect(orderDiscountFor(promos, 3000)).toEqual({ amount: 150, promotionId: 'p5' });
    expect(orderDiscountFor([promos[1]], 3000)).toEqual({ amount: 100, promotionId: 'v100' });
  });
});

describe('giftsFor', () => {
  it('mỗi đủ X (ĐVT chính) của hàng thuộc chương trình tặng Y', () => {
    const p = [promo({ id: 'g', kind: 'TANG_HANG', productIds: ['a'], buyQuantity: 10, giftProductId: 'gift', giftQuantity: 1 })];
    const get = (id: string) => products.get(id);
    expect(giftsFor(p, [{ productId: 'a', baseQuantity: 9 }], get)).toEqual([]);
    expect(giftsFor(p, [{ productId: 'a', baseQuantity: 6 }, { productId: 'a', baseQuantity: 18 }, { productId: 'b', baseQuantity: 50 }], get))
      .toEqual([{ promotionId: 'g', productId: 'gift', quantity: 2 }]);
  });
});

describe('applyLinePromotions', () => {
  const draft = (over: Partial<PromoDraftLine>): PromoDraftLine => ({
    productId: 'a', unitName: '', quantity: 10, unitPrice: 100, discountRate: null, discountAmount: null,
    discountManual: false, promotionId: null, isGift: false, ...over, key: over.key ?? Math.random().toString(),
  });
  const promos = [
    promo({ id: 'pct', discountValue: 10 }),
    promo({ id: 'g', kind: 'TANG_HANG', productIds: ['a'], buyQuantity: 10, giftProductId: 'gift', giftQuantity: 1 }),
  ];
  const opts = {
    enabled: true, promos, product: (id: string) => products.get(id), ratio: () => 1,
    makeGift: (productId: string, quantity: number, promotionId: string, previous?: PromoDraftLine) =>
      draft({ key: previous?.key, productId, quantity, unitPrice: 100, discountAmount: 100 * quantity, discountRate: 100, promotionId, isGift: true, discountManual: true }),
  };

  it('điền chiết khấu, giữ số gõ tay, dựng lại hàng tặng', () => {
    const out = applyLinePromotions([draft({}), draft({ productId: 'b', discountManual: true, discountAmount: 7 })], opts);
    expect(out[0]).toMatchObject({ discountAmount: 100, discountRate: 10, promotionId: 'pct' });
    expect(out[1]).toMatchObject({ discountAmount: 7, promotionId: null });
    expect(out[2]).toMatchObject({ productId: 'gift', quantity: 1, isGift: true, promotionId: 'g' });
    // Số lượng giảm dưới ngưỡng: hàng tặng biến mất, key của dòng tặng cũ được giữ khi còn.
    const again = applyLinePromotions(out, opts);
    expect(again[2].key).toBe(out[2].key);
    expect(applyLinePromotions([{ ...out[0], quantity: 5 }, out[2]], opts).some((l) => l.isGift)).toBe(false);
  });

  it('tắt khuyến mãi: bỏ chiết khấu tự động và hàng tặng', () => {
    const on = applyLinePromotions([draft({})], opts);
    const off = applyLinePromotions(on, { ...opts, enabled: false });
    expect(off).toHaveLength(1);
    expect(off[0]).toMatchObject({ discountAmount: null, promotionId: null });
  });
});
