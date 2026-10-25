import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WarehouseVoucherType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SequenceService } from '../../prisma/sequence.service.js';
import { fromDay, toDay } from '../../common/text.js';
import { AuditService } from '../../audit/audit.service.js';
import { VoucherLookups, WarehouseVoucherPageQuery, relatedWhere, voucherPageOf, voucherWhere } from './warehouse-voucher-page.js';

const TYPE_LABEL: Record<WarehouseVoucherType, string> = { NHAP: 'phiếu nhập kho', XUAT: 'phiếu xuất kho', CHUYEN: 'phiếu chuyển kho', KIEM_KE: 'phiếu kiểm kê' };

type Tx = Prisma.TransactionClient;

export interface VoucherLineInput {
  productId: string;
  quantity: number; // ĐVT chính; kiểm kê: số thực đếm
  unitName?: string;
  unitQuantity?: number;
  unitPrice?: number; // phiếu nhập: per base unit
  /**
   * Phiếu nhập: what the goods cost per base unit when the chứng từ gốc knows it better than a price — thành phẩm =
   * vật tư đã xuất / số làm được, hàng trả về = giá vốn đã chốt khi xuất. Missing: unitPrice if > 0, else the average.
   */
  unitCost?: number;
  note?: string;
}

/** A phiếu kho to post. Source ids are set when another document (đơn nhập, đơn bán, LSX, chuyến) creates it. */
export interface VoucherInput {
  type: WarehouseVoucherType;
  date: string; // YYYY-MM-DD
  warehouseId: string;
  targetWarehouseId?: string;
  reason?: string;
  note?: string;
  lines: VoucherLineInput[];
  purchaseOrderId?: string;
  salesOrderId?: string;
  productionOrderId?: string;
  deliveryTripId?: string;
}

export const VOUCHER_PREFIX: Record<WarehouseVoucherType, string> = { NHAP: 'PNK', XUAT: 'PXK', CHUYEN: 'PCK', KIEM_KE: 'PKK' };

// Older (demo) vouchers name their source document only in the reason, as the frontend's sourceOf() reads it.
const SOURCE_IN_REASON = [/theo đơn DN\d+/, /LSX\d+/, /chuyến CH\d+/];

const round4 = (x: number) => Math.round(x * 10_000) / 10_000;

/** Bình quân gia quyền: `onHand` units at `avg`, plus `qty` at `cost`. Stock below zero counts as none. */
export function blendCost(onHand: number, avg: number, qty: number, cost: number): number {
  const base = Math.max(onHand, 0);
  return base + qty > 0 ? round4((base * avg + qty * cost) / (base + qty)) : avg;
}

/** The average once `qty` units that came in at `cost` are taken back out (huỷ phiếu nhập). */
export function unblendCost(onHand: number, avg: number, qty: number, cost: number): number {
  const rest = onHand - qty;
  if (onHand <= 0 || rest <= 0) return avg;
  return round4(Math.max(0, (onHand * avg - qty * cost) / rest));
}

const INCLUDE = {
  lines: { orderBy: { sortOrder: 'asc' } },
  createdBy: { select: { email: true } },
} as const satisfies Prisma.WarehouseVoucherInclude;

type Row = Prisma.WarehouseVoucherGetPayload<{ include: typeof INCLUDE }>;

/** The frontend's WarehouseVoucher: day-only date, creator e-mail, lines without bookkeeping columns. */
export const voucherToApi = ({ lines, createdBy, createdById: _c, date, ...v }: Row) => ({
  ...v,
  date: toDay(date)!,
  createdBy: createdBy.email,
  // unitCost is giá vốn: only reports (and roles that may see it) get it, through their own endpoints.
  lines: lines.map(({ id: _i, voucherId: _v, sortOrder: _s, unitCost: _c, ...l }) => l),
});

/** A phiếu kho without giá nhập (roles that may not see purchase prices). */
export const withoutLinePrices = <V extends { lines: { unitPrice?: unknown }[] }>(v: V): V => ({ ...v, lines: v.lines.map((l) => ({ ...l, unitPrice: null })) });

/**
 * Phiếu kho: the one place that moves stock. NHAP +, XUAT −, CHUYEN − kho xuất / + kho nhận,
 * KIEM_KE ± chênh lệch (số đếm − tồn sổ sách lúc lưu). Cancelling applies the same movement in reverse.
 * Xuất quá tồn is allowed (stock is sometimes recorded late); the screens flag it.
 */
@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly audit: AuditService,
  ) {}

  /** Mã of vouchers just posted, for the source document's Nhật ký line. */
  async codes(tx: Tx, ids: string[]): Promise<string[]> {
    if (!ids.length) return [];
    const rows = await tx.warehouseVoucher.findMany({ where: { id: { in: ids } }, select: { code: true }, orderBy: { code: 'asc' } });
    return rows.map((r) => r.code);
  }

  async stockLevels() {
    const rows = await this.prisma.stockLevel.findMany({ include: { product: { select: { minStock: true } } } });
    return rows.map(({ product, ...s }) => ({ ...s, minStock: product.minStock }));
  }

  /**
   * Phiếu kho. `since`: only those dated from then (what the app loads at sign-in, Pha 1.1). `pick`: just these, by id or
   * mã. `related`: those of one chứng từ gốc (its id, or its mã in the lý do) — for screens showing older ones.
   */
  async vouchers(since?: Date, pick?: { ids?: string[]; codes?: string[] }, related?: { id?: string; code?: string }) {
    const where: Prisma.WarehouseVoucherWhereInput = pick?.ids?.length || pick?.codes?.length
      ? { OR: [...(pick.ids?.length ? [{ id: { in: pick.ids } }] : []), ...(pick.codes?.length ? [{ code: { in: pick.codes } }] : [])] }
      : related?.id || related?.code ? relatedWhere(related.id, related.code)
      : since ? { date: { gte: since } } : {};
    const rows = await this.prisma.warehouseVoucher.findMany({ where, include: INCLUDE, orderBy: [{ date: 'desc' }, { code: 'desc' }] });
    return rows.map(voucherToApi);
  }

  /** Danh sách phiếu kho theo trang (Pha 1.1), see warehouse-voucher-page.ts. Without `prices` giá nhập is left out first. */
  async page(q: WarehouseVoucherPageQuery, prices: boolean) {
    const [rows, products, warehouses, users, po, so, lsx, trips] = await Promise.all([
      this.prisma.warehouseVoucher.findMany({ where: voucherWhere(q), include: INCLUDE }),
      this.prisma.product.findMany({ select: { id: true, code: true, name: true } }),
      this.prisma.warehouse.findMany({ select: { id: true, name: true } }),
      this.prisma.user.findMany({ select: { email: true, name: true } }),
      this.prisma.purchaseOrder.findMany({ select: { id: true, code: true } }),
      this.prisma.salesOrder.findMany({ select: { id: true, code: true } }),
      this.prisma.productionOrder.findMany({ select: { id: true, code: true } }),
      this.prisma.deliveryTrip.findMany({ select: { id: true, code: true } }),
    ]);
    const lk: VoucherLookups = {
      products: new Map(products.map((p) => [p.id, p])),
      warehouses: new Map(warehouses.map((w) => [w.id, w.name])),
      users: new Map(users.map((u) => [u.email, u.name])),
      docs: new Map([
        ...po.map((d) => [d.id, `Đơn nhập hàng ${d.code}`] as const), ...so.map((d) => [d.id, `Đơn hàng bán ${d.code}`] as const),
        ...lsx.map((d) => [d.id, `Lệnh sản xuất ${d.code}`] as const), ...trips.map((d) => [d.id, `Chuyến giao hàng ${d.code}`] as const),
      ]),
    };
    const api = rows.map(voucherToApi).map((v) => (prices ? v : withoutLinePrices(v)));
    return voucherPageOf(api, q, lk);
  }

  /** Số phiếu kho and số dòng chứng từ (đơn nhập, đơn bán, chuyến) per kho over the whole history — Thiết lập › Kho. */
  async warehouseUsage() {
    const [from, to, poLines, soLines, loads] = await Promise.all([
      this.prisma.warehouseVoucher.groupBy({ by: ['warehouseId'], _count: { _all: true } }),
      this.prisma.warehouseVoucher.groupBy({ by: ['targetWarehouseId'], where: { targetWarehouseId: { not: null } }, _count: { _all: true } }),
      this.prisma.purchaseOrderLine.groupBy({ by: ['warehouseId'], where: { warehouseId: { not: null } }, _count: { _all: true } }),
      this.prisma.salesOrderLine.groupBy({ by: ['warehouseId'], where: { warehouseId: { not: null } }, _count: { _all: true } }),
      this.prisma.deliveryTripLoad.groupBy({ by: ['warehouseId'], where: { warehouseId: { not: null } }, _count: { _all: true } }),
    ]);
    const out: Record<string, { vouchers: number; lines: number }> = {};
    const get = (id: string) => (out[id] ??= { vouchers: 0, lines: 0 });
    for (const r of from) get(r.warehouseId).vouchers += r._count._all;
    for (const r of to) if (r.targetWarehouseId) get(r.targetWarehouseId).vouchers += r._count._all;
    for (const r of [...poLines, ...soLines, ...loads]) if (r.warehouseId) get(r.warehouseId).lines += r._count._all;
    return out;
  }

  async voucher(id: string, db: Tx | PrismaService = this.prisma) {
    const v = await db.warehouseVoucher.findUnique({ where: { id }, include: INCLUDE });
    if (!v) throw new NotFoundException('Không tìm thấy phiếu kho');
    return voucherToApi(v);
  }

  /** Lập phiếu on its own (manual vouchers). Other modules call `post` inside their own transaction. */
  create(input: VoucherInput, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      // A kho put out of use takes no new phiếu lập tay (vouchers other chứng từ write keep working for old lines).
      const ids = [input.warehouseId, ...(input.type === 'CHUYEN' && input.targetWarehouseId ? [input.targetWarehouseId] : [])];
      const off = await tx.warehouse.findFirst({ where: { id: { in: ids }, isActive: false }, select: { name: true } });
      if (off) throw new BadRequestException(`Kho "${off.name}" đã ngừng dùng — chọn kho khác, hoặc dùng lại kho ở Thiết lập › Kho.`);
      return this.voucher(await this.post(tx, input, userId), tx);
    });
  }

  /** Number, store and apply one voucher; returns its id. Runs inside the caller's transaction. */
  async post(tx: Tx, input: VoucherInput, userId: string): Promise<string> {
    const { type, warehouseId } = input;
    const target = type === 'CHUYEN' ? input.targetWarehouseId : undefined;
    if (type === 'CHUYEN' && (!target || target === warehouseId)) throw new BadRequestException('Kho nhận phải khác kho xuất');
    const warehouses = await tx.warehouse.findMany({ where: { id: { in: [warehouseId, ...(target ? [target] : [])] } }, select: { id: true, name: true } });
    if (warehouses.length !== (target ? 2 : 1)) throw new BadRequestException('Kho không tồn tại');

    const lines = input.lines.filter((l) => (type === 'KIEM_KE' ? l.quantity >= 0 : l.quantity > 0));
    if (!lines.length) throw new BadRequestException('Thêm ít nhất một dòng hàng');
    const ids = lines.map((l) => l.productId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Một mặt hàng xuất hiện hai dòng — gộp lại một dòng');
    const products = await tx.product.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, type: true } });
    for (const id of ids) {
      const p = products.find((x) => x.id === id);
      if (!p) throw new BadRequestException(`Không tìm thấy hàng hoá ${id}`);
      if (p.type === 'DICH_VU') throw new BadRequestException(`${p.code} là dịch vụ — không có tồn kho`);
    }

    const costs = await this.lockedCosts(tx, ids);
    const rows = [];
    for (const [i, l] of lines.entries()) {
      const quantity = round4(l.quantity);
      let delta = quantity;
      let bookQuantity: number | null = null;
      if (type === 'KIEM_KE') {
        bookQuantity = await this.lockedStock(tx, l.productId, warehouseId);
        delta = round4(quantity - bookQuantity);
      }
      rows.push({
        productId: l.productId, quantity, delta, bookQuantity, sortOrder: i, note: l.note ?? null,
        unitName: l.unitName ?? null, unitQuantity: l.unitName ? (l.unitQuantity ?? null) : null,
        unitPrice: type === 'NHAP' ? (l.unitPrice ?? 0) : 0,
        unitCost: this.costIn(type, l, costs.get(l.productId)!, delta),
      });
    }
    await this.saveCosts(tx, costs);

    const v = await tx.warehouseVoucher.create({
      data: {
        code: await this.sequences.nextCode(VOUCHER_PREFIX[type], tx),
        type, date: fromDay(input.date)!, warehouseId, targetWarehouseId: target ?? null,
        reason: input.reason ?? null, note: input.note ?? null, createdById: userId,
        purchaseOrderId: input.purchaseOrderId ?? null, salesOrderId: input.salesOrderId ?? null,
        productionOrderId: input.productionOrderId ?? null, deliveryTripId: input.deliveryTripId ?? null,
        lines: { create: rows },
      },
    });
    await this.applyStock(tx, type, warehouseId, target, rows, 1);
    const where = warehouses.find((w) => w.id === warehouseId)?.name + (target ? ` → ${warehouses.find((w) => w.id === target)?.name}` : '');
    await this.audit.log(tx, {
      action: 'warehouse_voucher.create', entityType: 'WarehouseVoucher', entityId: v.id, entityCode: v.code,
      summary: `Lập ${TYPE_LABEL[type]} ${v.code} · ${where} · ${rows.length} dòng${input.reason ? ` · ${input.reason}` : ''}`,
    });
    return v.id;
  }

  /** Huỷ phiếu: stock goes back to before the voucher; the voucher stays, marked cancelled. */
  async cancel(id: string, reason: string | undefined) {
    return this.prisma.$transaction(async (tx) => {
      const v = await tx.warehouseVoucher.findUnique({ where: { id }, include: { lines: true } });
      if (!v) throw new NotFoundException('Không tìm thấy phiếu kho');
      if (v.isCancelled) throw new BadRequestException(`${v.code} đã huỷ rồi.`);
      const fromDocument = v.purchaseOrderId || v.salesOrderId || v.productionOrderId || v.deliveryTripId ||
        SOURCE_IN_REASON.some((re) => re.test(v.reason ?? ''));
      if (fromDocument) throw new BadRequestException('Phiếu này lập từ chứng từ khác — huỷ ở chứng từ gốc.');
      await this.reverse(tx, id, reason);
      return this.voucher(id, tx);
    });
  }

  /**
   * Undoes a voucher inside the caller's transaction (stock back to before it, the voucher kept, marked huỷ). For the
   * chứng từ gốc that wrote it — e.g. huỷ phiếu trả hàng; a voucher already huỷ is left as it is.
   */
  async reverse(tx: Tx, id: string, reason: string | undefined): Promise<void> {
    const v = await tx.warehouseVoucher.findUnique({ where: { id }, include: { lines: true } });
    if (!v) throw new NotFoundException('Không tìm thấy phiếu kho');
    if (v.isCancelled) return;
    // Giá vốn: a phiếu nhập taken back leaves the average as if it had never come in; a phiếu xuất taken back
    // returns its goods at the cost they left at. Lines older than Pha 1.3 (no unitCost) leave it alone.
    if (v.type === 'NHAP' || v.type === 'XUAT') {
      const costs = await this.lockedCosts(tx, v.lines.map((l) => l.productId));
      for (const l of v.lines) {
        const c = costs.get(l.productId)!;
        if (l.unitCost === null) continue;
        const q = l.delta.toNumber();
        const avg = v.type === 'NHAP' ? unblendCost(c.onHand, c.avg, q, l.unitCost.toNumber()) : blendCost(c.onHand, c.avg, q, l.unitCost.toNumber());
        if (avg !== c.avg) Object.assign(c, { avg, changed: true });
        c.onHand = round4(c.onHand + (v.type === 'NHAP' ? -q : q));
      }
      await this.saveCosts(tx, costs);
    }
    const lines = v.lines.map((l) => ({ productId: l.productId, delta: l.delta.toNumber() }));
    await this.applyStock(tx, v.type, v.warehouseId, v.targetWarehouseId ?? undefined, lines, -1);
    await tx.warehouseVoucher.update({ where: { id }, data: { isCancelled: true, cancelReason: reason ?? null, cancelledAt: new Date() } });
    await this.audit.log(tx, {
      action: 'warehouse_voucher.cancel', entityType: 'WarehouseVoucher', entityId: id, entityCode: v.code,
      summary: `Huỷ ${TYPE_LABEL[v.type]} ${v.code}, tồn kho trả về như trước${reason ? `: ${reason}` : ''}`,
    });
  }

  /**
   * Giá vốn đã chốt khi xuất hàng cho một chứng từ: per product, the weighted unitCost of its live phiếu xuất.
   * Lines older than Pha 1.3 count at today's average. Used to take goods back in at the cost they left at.
   */
  async issuedCost(tx: Tx, where: Prisma.WarehouseVoucherWhereInput): Promise<Map<string, number>> {
    const lines = await tx.warehouseVoucherLine.findMany({
      where: { voucher: { ...where, type: 'XUAT', isCancelled: false } },
      select: { productId: true, delta: true, unitCost: true, product: { select: { avgCost: true } } },
    });
    const sum = new Map<string, { q: number; v: number }>();
    for (const l of lines) {
      const q = l.delta.toNumber();
      const s = sum.get(l.productId) ?? { q: 0, v: 0 };
      sum.set(l.productId, { q: s.q + q, v: s.v + q * (l.unitCost ?? l.product.avgCost).toNumber() });
    }
    return new Map([...sum].filter(([, s]) => s.q > 0).map(([id, s]) => [id, round4(s.v / s.q)]));
  }

  /** Live phiếu xuất lines with their frozen cost — the reports' giá vốn hàng bán. */
  async issueCosts() {
    const lines = await this.prisma.warehouseVoucherLine.findMany({
      where: { unitCost: { not: null }, voucher: { type: 'XUAT', isCancelled: false } },
      select: {
        productId: true, delta: true, unitCost: true,
        voucher: { select: { salesOrderId: true, deliveryTripId: true, productionOrderId: true } },
      },
    });
    return lines.map((l) => ({
      ...l.voucher, productId: l.productId, quantity: l.delta.toNumber(), unitCost: l.unitCost!.toNumber(),
    }));
  }

  /** Bình quân hiện tại of every product: productId → giá vốn per base unit. */
  async averageCosts(): Promise<Record<string, number>> {
    const rows = await this.prisma.product.findMany({ select: { id: true, avgCost: true } });
    return Object.fromEntries(rows.map((r) => [r.id, r.avgCost.toNumber()]));
  }

  // The cost a line moves at. NHAP brings goods in at its own cost (and moves the average); every other line goes
  // out, across or is counted at the average, which it leaves as it is.
  private costIn(type: WarehouseVoucherType, l: VoucherLineInput, c: { onHand: number; avg: number; changed: boolean }, delta: number): number {
    if (type === 'NHAP') {
      const cost = round4(l.unitCost ?? ((l.unitPrice ?? 0) > 0 ? l.unitPrice! : c.avg));
      const avg = blendCost(c.onHand, c.avg, delta, cost);
      if (avg !== c.avg) Object.assign(c, { avg, changed: true });
      c.onHand = round4(c.onHand + delta);
      return cost;
    }
    if (type === 'XUAT') c.onHand = round4(c.onHand - delta);
    if (type === 'KIEM_KE') c.onHand = round4(c.onHand + delta);
    return c.avg;
  }

  // The products' average and total stock (every kho), rows locked so two vouchers of one product queue up.
  private async lockedCosts(tx: Tx, ids: string[]): Promise<Map<string, { onHand: number; avg: number; changed: boolean }>> {
    const unique = [...new Set(ids)];
    const rows = await tx.$queryRaw<{ id: string; avgCost: Prisma.Decimal }[]>`
      SELECT "id", "avgCost" FROM "Product" WHERE "id" IN (${Prisma.join(unique)}) ORDER BY "id" FOR UPDATE`;
    const stock = await tx.stockLevel.groupBy({ by: ['productId'], where: { productId: { in: unique } }, _sum: { quantity: true } });
    return new Map(rows.map((r) => [r.id, {
      onHand: Number(stock.find((s) => s.productId === r.id)?._sum.quantity ?? 0), avg: Number(r.avgCost), changed: false,
    }]));
  }

  private async saveCosts(tx: Tx, costs: Map<string, { avg: number; changed: boolean }>): Promise<void> {
    for (const [id, c] of costs) if (c.changed) await tx.product.update({ where: { id }, data: { avgCost: c.avg } });
  }

  // Tồn sổ sách of a kiểm kê, with the row locked so a voucher saved at the same moment waits for this one.
  private async lockedStock(tx: Tx, productId: string, warehouseId: string): Promise<number> {
    const rows = await tx.$queryRaw<{ quantity: Prisma.Decimal }[]>`
      SELECT "quantity" FROM "StockLevel" WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId} FOR UPDATE`;
    return rows[0] ? Number(rows[0].quantity) : 0;
  }

  private async applyStock(
    tx: Tx, type: WarehouseVoucherType, warehouseId: string, targetId: string | undefined,
    lines: { productId: string; delta: number }[], sign: 1 | -1,
  ): Promise<void> {
    const move = (productId: string, whId: string, change: number) =>
      tx.stockLevel.upsert({
        where: { productId_warehouseId: { productId, warehouseId: whId } },
        create: { productId, warehouseId: whId, quantity: change },
        update: { quantity: { increment: change } },
      });
    for (const l of lines) {
      const d = round4(sign * l.delta);
      if (type === 'NHAP' || type === 'KIEM_KE') await move(l.productId, warehouseId, d);
      else if (type === 'XUAT') await move(l.productId, warehouseId, -d);
      else {
        await move(l.productId, warehouseId, -d);
        if (targetId) await move(l.productId, targetId, d);
      }
    }
  }
}
