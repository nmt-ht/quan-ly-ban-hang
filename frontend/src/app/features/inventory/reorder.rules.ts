import { Product, PurchaseOrder, StockLevel, Supplier, SupplierProduct } from '../../core/models/domain.models';
import { lineRemaining } from '../purchase-orders/purchase-order.rules';

const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** One mặt hàng under its tồn tối thiểu, and what to buy to get it back there. All quantities in ĐVT chính. */
export interface ReorderLine {
  product: Product;
  onHand: number; // tồn mọi kho
  min: number; // tồn tối thiểu
  /** Already ordered and not yet received — đơn nhập Nháp, Đã gửi NCC, Nhận một phần. */
  ordered: number;
  /** Số nên đặt thêm: lên lại mức tối thiểu, làm tròn lên; 0 = đơn đang về đã đủ bù. */
  suggest: number;
  /** NCC gợi ý: giá rẻ nhất trong danh mục NCC, else the one last bought from; '' = chưa rõ. */
  supplierId: string;
  /** Giá mua theo ĐVT chính from that NCC (danh mục, else lần mua gần nhất); 0 = chưa có. */
  price: number;
}

export interface ReorderInput {
  products: Product[];
  stockLevels: StockLevel[];
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  supplierProducts: SupplierProduct[];
}

/**
 * Cảnh báo tồn tối thiểu (Pha 1.8): vật tư đang dùng có tồn tối thiểu mà tồn mọi kho thấp hơn. Thành phẩm are made,
 * not bought (Lệnh sản xuất), so they are left out here — Tồn kho still flags them. Đơn nhập not yet received count as
 * on the way, Nháp included, so a suggestion is never made twice.
 */
export function reorderLines(d: ReorderInput): ReorderLine[] {
  const onHand = new Map<string, number>();
  for (const s of d.stockLevels) onHand.set(s.productId, r4((onHand.get(s.productId) ?? 0) + s.quantity));
  const ordered = new Map<string, number>();
  const lastBuy = new Map<string, { date: string; supplierId: string; price: number }>();
  for (const o of d.purchaseOrders) {
    if (o.status === 'HUY') continue;
    const open = o.status === 'NHAP' || o.status === 'DA_GUI_NCC' || o.status === 'NHAN_MOT_PHAN';
    for (const l of o.lines) {
      const ratio = l.ratioToBase ?? 1;
      if (open) ordered.set(l.productId, r4((ordered.get(l.productId) ?? 0) + lineRemaining(l) * ratio));
      const cur = lastBuy.get(l.productId);
      if (!cur || o.date > cur.date) lastBuy.set(l.productId, { date: o.date, supplierId: o.supplierId, price: Math.round(l.unitPrice / ratio) });
    }
  }
  const active = new Set(d.suppliers.filter((s) => s.isActive).map((s) => s.id));
  const cheapest = new Map<string, SupplierProduct>();
  for (const c of d.supplierProducts) {
    if (!active.has(c.supplierId)) continue;
    const cur = cheapest.get(c.productId);
    if (!cur || (c.purchasePrice > 0 && (cur.purchasePrice <= 0 || c.purchasePrice < cur.purchasePrice))) cheapest.set(c.productId, c);
  }

  return d.products
    .filter((p) => p.isActive && p.type === 'VAT_TU' && p.minStock > 0 && (onHand.get(p.id) ?? 0) < p.minStock)
    .map((p) => {
      const have = onHand.get(p.id) ?? 0;
      const coming = ordered.get(p.id) ?? 0;
      const listed = cheapest.get(p.id);
      const last = lastBuy.get(p.id);
      const supplierId = listed?.supplierId ?? (last && active.has(last.supplierId) ? last.supplierId : '');
      const price = listed?.purchasePrice ?? (last?.supplierId === supplierId ? last.price : 0);
      return {
        product: p, onHand: have, min: p.minStock, ordered: coming,
        suggest: Math.max(0, Math.ceil(r4(p.minStock - Math.max(have, 0) - coming))),
        supplierId, price,
      };
    })
    .sort((a, b) => a.product.code.localeCompare(b.product.code));
}

/** What /mua-hang/them reads from history.state to start a đơn nhập with these lines. */
export interface ReorderDraft {
  reorder: { productId: string; quantity: number }[];
}
