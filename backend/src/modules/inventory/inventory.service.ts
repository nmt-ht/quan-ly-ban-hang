import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WarehouseVoucherType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SequenceService } from '../../prisma/sequence.service.js';
import { fromDay, toDay } from '../../common/text.js';
import { AuditService } from '../../audit/audit.service.js';

const TYPE_LABEL: Record<WarehouseVoucherType, string> = { NHAP: 'phiếu nhập kho', XUAT: 'phiếu xuất kho', CHUYEN: 'phiếu chuyển kho', KIEM_KE: 'phiếu kiểm kê' };

type Tx = Prisma.TransactionClient;

export interface VoucherLineInput {
  productId: string;
  quantity: number; // ĐVT chính; kiểm kê: số thực đếm
  unitName?: string;
  unitQuantity?: number;
  unitPrice?: number; // phiếu nhập: per base unit
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
  lines: lines.map(({ id: _i, voucherId: _v, sortOrder: _s, ...l }) => l),
});

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

  async vouchers() {
    const rows = await this.prisma.warehouseVoucher.findMany({ include: INCLUDE, orderBy: [{ date: 'desc' }, { code: 'desc' }] });
    return rows.map(voucherToApi);
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
      });
    }

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
      const lines = v.lines.map((l) => ({ productId: l.productId, delta: l.delta.toNumber() }));
      await this.applyStock(tx, v.type, v.warehouseId, v.targetWarehouseId ?? undefined, lines, -1);
      await tx.warehouseVoucher.update({ where: { id }, data: { isCancelled: true, cancelReason: reason ?? null, cancelledAt: new Date() } });
      await this.audit.log(tx, {
        action: 'warehouse_voucher.cancel', entityType: 'WarehouseVoucher', entityId: id, entityCode: v.code,
        summary: `Huỷ ${TYPE_LABEL[v.type]} ${v.code}, tồn kho trả về như trước${reason ? `: ${reason}` : ''}`,
      });
      return this.voucher(id, tx);
    });
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
