// Hoá đơn điện tử — the parts that need no database or network: ký hiệu, người mua, khoá chống trùng, trạng thái, and
// the neutral shape every provider adapter maps from (NĐ 123/2020 sửa đổi bởi NĐ 70/2025, TT 78/2021). EInvoiceService
// does the rest.
import type { InvoiceData, InvoiceRow } from '../sales/invoice.rules.js';

export const EINVOICE_PROVIDERS = ['NONE', 'FAKE', 'MISA'] as const;
export const EINVOICE_KINDS = ['ORIGINAL', 'ADJUST', 'REPLACE'] as const;
export type EInvoiceKind = (typeof EINVOICE_KINDS)[number];
export const EINVOICE_STATUSES = ['PENDING', 'ISSUED', 'FAILED', 'REPLACED', 'VOID'] as const;
export type EInvoiceStatus = (typeof EINVOICE_STATUSES)[number];

/** `provider` of a hoá đơn issued outside the app (on the cổng of the nhà cung cấp) whose số was only recorded here. */
export const EXTERNAL_PROVIDER = 'EXTERNAL';

/** Not FAILED and not VOID (gỡ ghi nhận): a hoá đơn that exists (or may exist). At most one per đợt / đơn / phiếu trả hàng. */
export const isLive = (status: string): boolean => status !== 'FAILED' && status !== 'VOID';

/** Số hoá đơn typed or read from a file: 1–8 digits; leading zeros do not make a different số. */
export const INVOICE_NUMBER = /^\d{1,8}$/;
export const numberKey = (n: string): string => n.replace(/^0+(?=\d)/, '');

/**
 * The reference that ties a line of the file sent to the nhà cung cấp back to what it was made from: the đơn's code for
 * a hoá đơn of the whole đơn, `code#n` for its n-th đợt giao (1 = first). It travels in a column of the Excel and comes back.
 */
export const invoiceRef = (orderCode: string, deliveryIndex: number | null): string => (deliveryIndex === null ? orderCode : `${orderCode}#${deliveryIndex}`);
export function parseInvoiceRef(ref: string): { orderCode: string; deliveryIndex: number | null } | null {
  const m = /^\s*([^#\s]+?)\s*(?:#\s*(\d{1,3}))?\s*$/.exec(ref);
  if (!m) return null;
  const index = m[2] ? Number(m[2]) : null;
  return index === 0 ? null : { orderCode: m[1].toUpperCase(), deliveryIndex: index };
}

/**
 * Ký hiệu hoá đơn (TT 78/2021, Điều 4): 6 ký tự — C (có mã của CQT) hoặc K (không mã); 2 số năm lập; một chữ loại
 * (T doanh nghiệp đăng ký, D đặc thù, L cục thuế cấp lẻ, M máy tính tiền, N/B/G/H các loại phiếu & tem vé); 2 chữ do
 * người bán tự đặt. Ký hiệu mẫu số: 1 = hoá đơn GTGT, 2 = hoá đơn bán hàng.
 */
export const SERIES = /^[CK]\d{2}[TDLMNBGH][A-Z]{2}$/;

/** Why a ký hiệu cannot be used for a hoá đơn dated `issueDate` (YYYY-MM-DD), or null. */
export function seriesIssue(series: string | null | undefined, issueDate: string): string | null {
  if (!series) return 'Chưa đặt ký hiệu hoá đơn — vào Hệ thống › Hoá đơn điện tử.';
  if (!SERIES.test(series)) return `Ký hiệu hoá đơn "${series}" không đúng dạng (ví dụ C26TAA).`;
  if (series.slice(1, 3) !== issueDate.slice(2, 4)) return `Ký hiệu ${series} là của năm 20${series.slice(1, 3)}; hoá đơn ngày ${issueDate} cần ký hiệu năm ${issueDate.slice(0, 4)}.`;
  return null;
}

export interface Buyer {
  /** Tên đơn vị (người mua là tổ chức / hộ kinh doanh), or empty. */
  companyName: string;
  /** Họ tên người mua hàng. */
  name: string;
  taxCode: string;
  /** Số định danh cá nhân (CCCD) — NĐ 70/2025 allows it in place of MST for an individual. */
  idNumber: string;
  address: string;
  email: string;
  phone: string;
}

export interface BuyerSource {
  name: string;
  companyName?: string | null;
  companyTaxCode?: string | null;
  personalTaxCode?: string | null;
  idNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

const clean = (s: string | null | undefined) => (s ?? '').trim();

/** The buyer as it goes on the hoá đơn, from the customer on file. */
export function buyerOf(c: BuyerSource): Buyer {
  const companyName = clean(c.companyName);
  return {
    companyName,
    name: clean(c.name),
    taxCode: (companyName ? clean(c.companyTaxCode) : clean(c.personalTaxCode) || clean(c.companyTaxCode)).replace(/\s+/g, ''),
    idNumber: clean(c.idNumber).replace(/\s+/g, ''),
    address: clean(c.address),
    email: clean(c.email),
    phone: clean(c.phone),
  };
}

/** MST: 10 số, or 10 số + "-" + 3 số (đơn vị phụ thuộc); 12 số = mã số thuế cá nhân từ số định danh (từ 07/2025). */
export const TAX_CODE = /^(\d{10}(-\d{3})?|\d{12})$/;
/** Số định danh cá nhân / CCCD: 12 số. */
export const ID_NUMBER = /^\d{12}$/;

/**
 * Why this buyer cannot go on a hoá đơn, or null. A tổ chức / hộ kinh doanh needs tên, MST and địa chỉ (Điều 10 NĐ 123);
 * an individual who is not in business may give only a name (or nothing — "Người mua không lấy hoá đơn").
 */
export function buyerIssue(b: Buyer): string | null {
  if (b.taxCode && !TAX_CODE.test(b.taxCode)) return `Mã số thuế người mua "${b.taxCode}" không hợp lệ (10 số, 10 số-3 số, hoặc 12 số).`;
  if (b.idNumber && !ID_NUMBER.test(b.idNumber)) return `Số định danh (CCCD) người mua "${b.idNumber}" không hợp lệ (12 số).`;
  if (b.companyName) {
    if (!b.taxCode) return `Khách ${b.companyName} là tổ chức — cần mã số thuế để xuất hoá đơn.`;
    if (!b.address) return `Khách ${b.companyName} chưa có địa chỉ — hoá đơn của tổ chức phải ghi địa chỉ người mua.`;
  }
  if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(b.email)) return `Email nhận hoá đơn "${b.email}" không hợp lệ.`;
  return null;
}

/**
 * The idempotency key the provider gets ("mã tham chiếu" / partner key): the đơn, what part of it, the kind, and the
 * attempt. A retry of the same attempt (after a timeout) sends the same key, so the provider answers with the hoá đơn
 * it may already have; only a FAILED attempt that the provider confirmed is gone moves to the next number.
 */
export function partnerKey(orderCode: string, part: { deliveryId?: string | null; returnId?: string | null; originalId?: string | null }, kind: EInvoiceKind, attempt: number): string {
  const what = part.returnId ? `R${part.returnId.slice(0, 8)}` : part.deliveryId ? `D${part.deliveryId.slice(0, 8)}` : part.originalId ? `O${part.originalId.slice(0, 8)}` : 'ALL';
  return `${orderCode}-${what}-${kind[0]}${attempt}`.slice(0, 50);
}

/** The status moves an hoá đơn may make. ISSUED is final except being replaced; FAILED may be retried (a new row). */
const MOVES: Record<EInvoiceStatus, readonly EInvoiceStatus[]> = {
  PENDING: ['PENDING', 'ISSUED', 'FAILED'],
  ISSUED: ['REPLACED', 'VOID'],
  FAILED: [],
  REPLACED: [],
  VOID: [],
};
export const canMove = (from: string, to: EInvoiceStatus): boolean => (MOVES[from as EInvoiceStatus] ?? []).includes(to);

// ---------- the neutral hoá đơn every adapter maps from ----------

/** Thuế suất on the hoá đơn: a number (0, 5, 8, 10) or KCT (không chịu thuế) / KKKNT (không kê khai, tính nộp). */
export type VatCode = '0' | '5' | '8' | '10' | 'KCT' | 'KKKNT';

export interface ProviderLine {
  no: number;
  /** 1 hàng hoá, dịch vụ · 2 khuyến mại · 3 chiết khấu thương mại · 4 ghi chú (TT 78 / QĐ 1450 TChat). */
  nature: 1 | 2 | 3 | 4;
  name: string;
  unit: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number;
  vat: VatCode | null;
}

export interface ProviderInvoice {
  key: string;
  kind: EInvoiceKind;
  templateCode: string;
  series: string;
  issueDate: string;
  buyer: Buyer;
  currency: string; // VND, USD…
  exchangeRate: number; // 1 for VND
  lines: ProviderLine[];
  groups: { vat: VatCode; taxable: number; vatAmount: number }[];
  taxable: number;
  vatAmount: number;
  total: number;
  /** Tổng tiền thanh toán bằng chữ is left to the provider; VND equivalent of a foreign-currency hoá đơn. */
  totalVnd: number;
  /** ADJUST / REPLACE: the hoá đơn it refers to, and why. */
  original?: { series: string; number: string; issueDate: string; templateCode: string; providerRef: string | null };
  reason?: string;
  /** Shown on the hoá đơn as a ghi chú (e.g. "Hàng bán bị trả lại theo phiếu TH0000012"). */
  note?: string;
}

export const MAX_LINE_NAME = 500;

/**
 * Thuế suất of a dòng as the hoá đơn shows it. The app stores only a percentage (0, 5, 8, 10) today, so KCT / KKKNT
 * never come from it yet; any other rate is refused before anything is sent.
 */
export function vatCode(rate: number | null): VatCode | null {
  if (rate === null) return null;
  const s = String(rate);
  if (s === '0' || s === '5' || s === '8' || s === '10') return s;
  throw new Error(`Thuế suất ${rate}% không dùng được trên hoá đơn (0, 5, 8, 10, KCT, KKKNT).`);
}

const NATURE: Record<InvoiceRow['kind'], ProviderLine['nature']> = { goods: 1, gift: 2, discount: 3 };

/** InvoiceData (what the screen previews) → the neutral hoá đơn an adapter sends. Amounts are in the hoá đơn's currency. */
export function toProviderInvoice(
  d: InvoiceData,
  head: Omit<ProviderInvoice, 'lines' | 'groups' | 'taxable' | 'vatAmount' | 'total' | 'totalVnd'>,
): ProviderInvoice {
  return {
    ...head,
    lines: d.rows.map((r) => ({
      no: r.no, nature: NATURE[r.kind], name: r.name.slice(0, MAX_LINE_NAME), unit: r.unit, quantity: r.quantity, unitPrice: r.unitPrice,
      amount: r.amount, vat: vatCode(r.vatRate),
    })),
    groups: d.groups.map((g) => ({ vat: vatCode(g.vatRate)!, taxable: g.taxable, vatAmount: g.vat })),
    taxable: d.taxable,
    vatAmount: d.vat,
    total: d.total,
    totalVnd: d.vndTotal ?? d.total,
  };
}
