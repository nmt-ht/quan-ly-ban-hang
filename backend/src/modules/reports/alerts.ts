// Thông báo (the topbar bell) and the point-in-time half of Tổng quan › Cần xử lý: things that are wrong *now*,
// whatever kỳ the dashboard shows. Pure — AlertsService gathers only what the user's permissions allow.
import type { DebtRow } from '../../common/debt-rows.js';
import { formatVnd as vnd } from './report.rules.js';

export type AlertLevel = 'bad' | 'warn';
/** The dashboard area a problem belongs to (its area cards take their chip from these). */
export type AlertArea = 'sell' | 'stock' | 'purchase' | 'debt' | 'cash';

export interface Alert {
  key: string;
  level: AlertLevel;
  area: AlertArea;
  title: string;
  detail: string;
  /** The screen where it is fixed, and its filter. */
  to: string;
  query?: Record<string, string | number | boolean>;
  cta: string;
  /** Changes when the problem grows or shrinks — a "đã xem" mark only holds while it stays the same. */
  sig: string;
}

export interface AlertInput {
  today: string; // YYYY-MM-DD, Vietnam
  /** Each part is present only when the user may see it (null = leave out). */
  lateOrders: number | null;
  debt: { receivables: DebtRow[]; payables: DebtRow[] } | null;
  cashAccounts: { name: string; balance: number; isActive: boolean }[] | null;
  /** Mặt hàng (not dịch vụ, đang dùng) with minStock > 0, and their tồn across every kho. */
  belowMin: number | null;
  /** Đơn mua hàng still Nháp — waiting for "Gửi NCC", the approval step. */
  draftPurchases: number | null;
  /** Báo giá đang mở (status MOI) with a hạn hiệu lực. */
  openQuotes: { validUntil: string }[] | null;
  /** Đợt giao đã giao quá INVOICE_LATE_DAYS ngày mà chưa có hoá đơn (null = người dùng không xem hoá đơn, hoặc công ty chưa dùng hoá đơn). */
  uninvoiced?: { count: number; oldest: string } | null;
}

const DAY = 86_400_000;
const shift = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

export const QUOTE_SOON_DAYS = 3; // báo giá hết hạn trong 3 ngày tới
export const QUOTE_LAPSED_DAYS = 14; // đã hết hạn trong 14 ngày qua (older ones are history, not news)
export const PAYABLE_DUE_DAYS = 7;
export const INVOICE_LATE_DAYS = 3; // hoá đơn lập khi chuyển giao hàng hoá; quá 3 ngày chưa có là sót
export const INVOICE_LOOKBACK_DAYS = 60; // đợt giao cũ hơn thế là lịch sử, không báo

export function alerts(i: AlertInput): Alert[] {
  const out: Alert[] = [];

  if (i.lateOrders) {
    out.push({
      key: 'late', level: 'bad', area: 'sell', title: `${i.lateOrders} đơn trễ hẹn giao`,
      detail: 'Đã quá ngày khách cần hàng mà vẫn còn dòng chưa giao.', to: '/don-hang', query: { late: 1 }, cta: 'Xem chứng từ',
      sig: `late:${i.lateOrders}`,
    });
  }

  if (i.debt) {
    const ar = i.debt.receivables.filter((r) => r.overdue > 0);
    const arOverdue = ar.reduce((s, r) => s + r.overdue, 0);
    if (arOverdue > 0) {
      out.push({
        key: 'ar', level: 'bad', area: 'debt', title: `Khách nợ quá hạn ${vnd(arOverdue)}`,
        detail: `${ar.length} khách đã quá hạn thanh toán — cần nhắc nợ.`, to: '/cong-no/tuoi-no', query: { loai: 'phai-thu' },
        cta: 'Xem tuổi nợ', sig: `ar:${arOverdue}`,
      });
    }
    const apOverdue = i.debt.payables.reduce((s, r) => s + r.overdue, 0);
    const week = shift(i.today, PAYABLE_DUE_DAYS);
    const due = i.debt.payables.flatMap((r) => r.items).filter((x) => x.dueDate >= i.today && x.dueDate <= week && x.amount > 0);
    const dueSum = due.reduce((s, x) => s + x.amount, 0);
    if (apOverdue > 0) {
      out.push({
        key: 'ap', level: 'bad', area: 'debt', title: `Nợ nhà cung cấp quá hạn ${vnd(apOverdue)}`,
        detail: 'Trả chậm có thể bị siết hạn mức hoặc giao hàng.', to: '/cong-no/tuoi-no', cta: 'Xem tuổi nợ', sig: `ap:${apOverdue}`,
      });
    } else if (dueSum > 0) {
      out.push({
        key: 'ap-due', level: 'warn', area: 'debt', title: `Phải trả NCC đến hạn trong ${PAYABLE_DUE_DAYS} ngày: ${vnd(dueSum)}`,
        detail: `${due.length} khoản — chuẩn bị tiền để trả đúng hạn.`, to: '/cong-no/tuoi-no', cta: 'Xem tuổi nợ',
        sig: `ap-due:${dueSum}`,
      });
    }
  }

  const negative = (i.cashAccounts ?? []).filter((a) => a.isActive && a.balance < 0);
  if (negative.length) {
    out.push({
      key: 'neg', level: 'bad', area: 'cash', title: `Quỹ âm: ${negative.map((a) => a.name).join(', ')}`,
      detail: 'Số dư tài khoản nhỏ hơn 0 — thường do thiếu phiếu thu hoặc nhập sai.', to: '/thu-chi', cta: 'Xem thu, chi',
      sig: `neg:${negative.map((a) => `${a.name}=${a.balance}`).join('|')}`,
    });
  }

  if (i.belowMin) {
    out.push({
      key: 'min', level: 'warn', area: 'stock', title: `${i.belowMin} mặt hàng dưới tồn tối thiểu`,
      detail: 'Cần nhập hoặc sản xuất thêm để không đứt hàng.', to: '/kho/ton-kho', query: { belowMin: true }, cta: 'Xem tồn kho',
      sig: `min:${i.belowMin}`,
    });
  }

  if (i.draftPurchases) {
    out.push({
      key: 'po-draft', level: 'warn', area: 'purchase', title: `${i.draftPurchases} đơn mua hàng chờ duyệt`,
      detail: 'Đơn còn Nháp — duyệt (Gửi NCC) để nhà cung cấp giao hàng.', to: '/mua-hang', query: { status: 'NHAP' },
      cta: 'Xem đơn mua hàng', sig: `po-draft:${i.draftPurchases}`,
    });
  }

  if (i.openQuotes) {
    const soonEnd = shift(i.today, QUOTE_SOON_DAYS);
    const lapsedFrom = shift(i.today, -QUOTE_LAPSED_DAYS);
    const soon = i.openQuotes.filter((q) => q.validUntil >= i.today && q.validUntil <= soonEnd).length;
    const lapsed = i.openQuotes.filter((q) => q.validUntil < i.today && q.validUntil >= lapsedFrom).length;
    if (lapsed) {
      out.push({
        key: 'quote-lapsed', level: 'warn', area: 'sell', title: `${lapsed} báo giá đã hết hạn chưa chốt`,
        detail: `Hết hạn trong ${QUOTE_LAPSED_DAYS} ngày qua — liên hệ khách để báo lại giá, hoặc huỷ.`, to: '/bao-gia',
        query: { status: 'HET_HAN' }, cta: 'Xem báo giá', sig: `quote-lapsed:${lapsed}`,
      });
    }
    if (soon) {
      out.push({
        key: 'quote-soon', level: 'warn', area: 'sell', title: `${soon} báo giá sắp hết hạn`,
        detail: `Hết hạn trong ${QUOTE_SOON_DAYS} ngày tới — nhắc khách chốt đơn.`, to: '/bao-gia', query: { status: 'MOI' },
        cta: 'Xem báo giá', sig: `quote-soon:${soon}`,
      });
    }
  }

  if (i.uninvoiced?.count) {
    out.push({
      key: 'invoice', level: 'warn', area: 'sell', title: `${i.uninvoiced.count} đợt giao chưa có hoá đơn quá ${INVOICE_LATE_DAYS} ngày`,
      detail: `Cũ nhất giao ngày ${i.uninvoiced.oldest.split('-').reverse().join('/')} — lập hoá đơn trên cổng nhà cung cấp rồi ghi nhận số hoá đơn.`,
      to: '/hoa-don-ban', cta: 'Xem hoá đơn', sig: `invoice:${i.uninvoiced.count}:${i.uninvoiced.oldest}`,
    });
  }

  return [...out.filter((a) => a.level === 'bad'), ...out.filter((a) => a.level === 'warn')];
}
