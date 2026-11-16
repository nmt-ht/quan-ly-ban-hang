// Đối chiếu sao kê ngân hàng — phần tính thuần, không chạm cơ sở dữ liệu.

export interface StatementItem {
  id: string;
  date: string; // YYYY-MM-DD
  amountIn: number;
  amountOut: number;
}

export interface VoucherItem {
  id: string;
  code: string;
  date: string;
  kind: 'THU' | 'CHI';
  amount: number;
}

const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const gapDays = (a: string, b: string) => Math.abs(dayMs(a) - dayMs(b)) / 86_400_000;

/** Dòng sao kê khớp phiếu thế nào: tiền vào ↔ phiếu thu, tiền ra ↔ phiếu chi, cùng số tiền. */
export function sameMoney(line: StatementItem, v: VoucherItem): boolean {
  return v.kind === 'THU' ? line.amountIn > 0 && line.amountIn === v.amount : line.amountOut > 0 && line.amountOut === v.amount;
}

/**
 * Tự khớp: mỗi dòng sao kê (theo ngày) nhận phiếu cùng chiều, cùng số tiền, lệch ngày không quá `maxDays`; nhiều phiếu thì lấy phiếu
 * gần ngày nhất (rồi mã nhỏ nhất). Mỗi phiếu chỉ dùng một lần. Trả về các cặp (dòng sao kê, phiếu).
 */
export function autoMatch(lines: StatementItem[], vouchers: VoucherItem[], maxDays = 3): { lineId: string; voucherId: string }[] {
  const free = [...vouchers];
  const out: { lineId: string; voucherId: string }[] = [];
  for (const line of [...lines].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
    let best = -1;
    for (let i = 0; i < free.length; i++) {
      const v = free[i];
      if (!sameMoney(line, v) || gapDays(line.date, v.date) > maxDays) continue;
      if (best < 0) { best = i; continue; }
      const b = free[best];
      const gv = gapDays(line.date, v.date), gb = gapDays(line.date, b.date);
      if (gv < gb || (gv === gb && v.code < b.code)) best = i;
    }
    if (best >= 0) {
      out.push({ lineId: line.id, voucherId: free[best].id });
      free.splice(best, 1);
    }
  }
  return out;
}
