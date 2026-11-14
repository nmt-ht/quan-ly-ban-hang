// Thuế GTGT: gom giá trị chưa thuế và thuế theo thuế suất. Dùng chung cho nhận hàng (mua vào) và bảng kê thuế.

// A type alias (not an interface) so it is assignable to Prisma's Json column.
export type TaxBucket = {
  /** Thuế suất %. -1 = không rõ thuế suất (chứng từ cũ không lưu). */
  rate: number;
  taxable: number;
  vat: number;
};

/**
 * Giá trị chưa thuế và thuế GTGT của một chứng từ, gom theo thuế suất. `total` là tổng đã tính (gồm thuế): thuế tổng =
 * total − tổng chưa thuế, nên chênh lệch làm tròn từng nhóm được dồn vào nhóm thuế suất cao nhất, và Σ thuế luôn khớp bút toán 133.
 */
export function taxBreakdownOf(lines: { goods: number; rate: number }[], total: number): TaxBucket[] {
  const byRate = new Map<number, number>();
  for (const l of lines) byRate.set(l.rate, (byRate.get(l.rate) ?? 0) + l.goods);
  const buckets: TaxBucket[] = [...byRate]
    .map(([rate, taxable]) => ({ rate, taxable, vat: Math.round((taxable * rate) / 100) }))
    .sort((a, b) => a.rate - b.rate);
  if (!buckets.length) return buckets;
  const totalVat = total - buckets.reduce((s, b) => s + b.taxable, 0);
  const diff = totalVat - buckets.reduce((s, b) => s + b.vat, 0);
  if (diff !== 0) {
    const target = [...buckets].reverse().find((b) => b.rate > 0) ?? buckets[buckets.length - 1];
    target.vat += diff;
  }
  return buckets;
}

/**
 * Tách tổng chưa thuế / thuế của một hoá đơn bán ra theo thuế suất từ các dòng của nó (hàng, chiết khấu thương mại — có dấu).
 * Dòng có thể bằng ngoại tệ nên chỉ dùng làm TỶ TRỌNG: số tiền VND lấy từ `taxable` / `vat` của hoá đơn (VND, âm khi điều chỉnh giảm).
 */
export function invoiceBuckets(lines: { amount: number; vat: string | null }[], taxable: number, vat: number): TaxBucket[] {
  const byRate = new Map<number, number>();
  for (const l of lines) if (l.vat !== null && l.vat !== undefined && !Number.isNaN(Number(l.vat))) byRate.set(Number(l.vat), (byRate.get(Number(l.vat)) ?? 0) + Number(l.amount));
  const raw = [...byRate].filter(([, a]) => a !== 0);
  const sum = raw.reduce((s, [, a]) => s + a, 0);
  if (!raw.length || sum === 0) return taxable || vat ? [{ rate: vat === 0 ? 0 : -1, taxable, vat }] : [];
  let left = taxable;
  const goods = raw.map(([rate, a], i) => {
    const part = i === raw.length - 1 ? left : Math.round((a * taxable) / sum);
    left -= part;
    return { rate, goods: part };
  });
  return taxBreakdownOf(goods, taxable + vat);
}

/** Cộng các nhóm cùng thuế suất. */
export function mergeBuckets(list: TaxBucket[][]): TaxBucket[] {
  const m = new Map<number, TaxBucket>();
  for (const b of list.flat()) {
    const x = m.get(b.rate) ?? { rate: b.rate, taxable: 0, vat: 0 };
    x.taxable += b.taxable; x.vat += b.vat;
    m.set(b.rate, x);
  }
  return [...m.values()].sort((a, b) => a.rate - b.rate);
}
