// Chi phí mua hàng phân bổ vào giá nhập (as MISA): vận chuyển, bốc xếp, bảo hiểm… của một đơn nhập cộng vào giá trị hàng đã
// nhận. Phần thuần, không chạm cơ sở dữ liệu (landed-cost.rules.spec.ts).

export type AllocationBasis = 'GIA_TRI' | 'SO_LUONG';

export interface AllocItem {
  key: string;
  /** Số lượng nhận, quy về ĐVT chính (trừ phần đã trả lại NCC). */
  quantity: number;
  /** Giá trị hàng nhận chưa thuế (số lượng × đơn giá). */
  value: number;
}

/**
 * Chia `total` đồng theo giá trị hoặc số lượng hàng, làm tròn đồng và dồn phần lẻ cho các mục có phần dư lớn nhất để tổng
 * đúng bằng `total`. Không có mục nào có cơ sở chia (tổng cơ sở bằng 0) thì chia đều theo số lượng.
 */
export function allocateCost(total: number, items: AllocItem[], basis: AllocationBasis): Map<string, number> {
  const out = new Map<string, number>();
  if (!items.length || total <= 0) return out;
  const weight = (i: AllocItem) => (basis === 'GIA_TRI' ? i.value : i.quantity);
  let sum = items.reduce((s, i) => s + Math.max(0, weight(i)), 0);
  const w = sum > 0 ? weight : (i: AllocItem) => Math.max(0, i.quantity);
  if (sum <= 0) sum = items.reduce((s, i) => s + w(i), 0);
  if (sum <= 0) {
    // Không còn cơ sở nào: chia đều.
    items.forEach((i) => out.set(i.key, 0));
    let left = total;
    items.forEach((i, idx) => {
      const share = Math.floor(left / (items.length - idx));
      out.set(i.key, share);
      left -= share;
    });
    return out;
  }
  const exact = items.map((i) => ({ key: i.key, exact: (total * Math.max(0, w(i))) / sum }));
  let given = 0;
  for (const e of exact) {
    const floor = Math.floor(e.exact);
    out.set(e.key, floor);
    given += floor;
  }
  const order = [...exact].sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)));
  for (let k = 0; k < total - given; k++) out.set(order[k % order.length].key, out.get(order[k % order.length].key)! + 1);
  return out;
}

/**
 * Phần chi phí của một mặt hàng đi vào tồn kho và phần đi vào giá vốn hàng bán: hàng đã bán hết thì phần chi phí của nó là chi
 * phí của hàng đã bán (TK 632). `received` = số lượng nhận của đơn, `onHand` = tồn hiện có của mặt hàng (mọi kho).
 */
export function splitStockCogs(amount: number, received: number, onHand: number): { toStock: number; toCogs: number } {
  if (amount <= 0 || received <= 0 || onHand <= 0) return { toStock: 0, toCogs: Math.max(0, amount) };
  const share = Math.min(1, onHand / received);
  const toStock = Math.round(amount * share);
  return { toStock, toCogs: amount - toStock };
}

const round4 = (x: number) => Math.round(x * 10_000) / 10_000;

/** Giá bình quân sau khi cộng `toStock` đồng chi phí vào `onHand` đơn vị đang tồn. */
export function avgAfterCost(avg: number, onHand: number, toStock: number): number {
  if (onHand <= 0 || toStock <= 0) return avg;
  return round4(avg + toStock / onHand);
}

/** Hoàn lại khi huỷ: bớt phần chi phí đã cộng, không xuống dưới 0. */
export function avgBeforeCost(avg: number, onHand: number, toStock: number): number {
  if (onHand <= 0 || toStock <= 0) return avg;
  return round4(Math.max(0, avg - toStock / onHand));
}
