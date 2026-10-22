import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SequenceService } from '../../prisma/sequence.service.js';
import { InventoryService, VoucherLineInput } from '../inventory/inventory.service.js';
import { fromDay, toDay } from '../../common/text.js';
import {
  LineNumbers, STATUS_LABEL, canCancel, canComplete, canEdit, canReceive, canSend, receivedValueOf, round4, statusAfterReceipt,
  totalValueOf,
} from './purchase-order.rules.js';

type Tx = Prisma.TransactionClient;

export interface OrderLineInput {
  productId: string;
  quantity: number; // in unitName
  unitPrice: number; // per unitName
  unitName?: string;
  ratioToBase?: number;
  vatRate?: number;
  warehouseId?: string;
}

export interface OrderInput {
  supplierId: string;
  date: string; // YYYY-MM-DD
  note?: string;
  lines: OrderLineInput[];
  /** The updatedAt the editor loaded; a different one on the server means someone else saved first. */
  updatedAt?: string;
}

export interface ReceiptInput {
  date: string;
  note?: string;
  items: { lineIndex: number; quantity: number; warehouseId: string }[];
}

const INCLUDE = {
  lines: { orderBy: { sortOrder: 'asc' } },
  createdBy: { select: { email: true } },
} as const satisfies Prisma.PurchaseOrderInclude;

type Row = Prisma.PurchaseOrderGetPayload<{ include: typeof INCLUDE }>;

const numbers = (l: Row['lines'][number]): LineNumbers => ({
  quantity: l.quantity.toNumber(), unitPrice: l.unitPrice.toNumber(), receivedQuantity: l.receivedQuantity.toNumber(), vatRate: l.vatRate.toNumber(),
});

/** The frontend's PurchaseOrder: day-only dates, creator e-mail, totals derived from the lines. */
export function orderToApi({ lines, createdBy, createdById: _c, date, sentDate, receivedDate, ...o }: Row) {
  const nums = lines.map(numbers);
  return {
    ...o,
    date: toDay(date)!,
    sentDate: toDay(sentDate),
    receivedDate: toDay(receivedDate),
    createdBy: createdBy.email,
    totalValue: totalValueOf(nums),
    receivedValue: receivedValueOf(nums),
    lines: lines.map(({ id: _i, orderId: _o, sortOrder: _s, ...l }) => l),
  };
}

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly inventory: InventoryService,
  ) {}

  async findAll() {
    const rows = await this.prisma.purchaseOrder.findMany({ include: INCLUDE, orderBy: [{ date: 'desc' }, { code: 'desc' }] });
    return rows.map(orderToApi);
  }

  async findOne(id: string, db: Tx | PrismaService = this.prisma) {
    const o = await db.purchaseOrder.findUnique({ where: { id }, include: INCLUDE });
    if (!o) throw new NotFoundException('Không tìm thấy đơn nhập');
    return orderToApi(o);
  }

  create(input: OrderInput, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.checkRefs(tx, input);
      const o = await tx.purchaseOrder.create({
        data: {
          code: await this.sequences.nextCode('DN', tx),
          supplierId: input.supplierId, date: fromDay(input.date)!, note: input.note ?? null, status: 'NHAP', createdById: userId,
          lines: { create: lineRows(input.lines) },
        },
      });
      return this.findOne(o.id, tx);
    });
  }

  /** Only a Nháp order can be edited; the lines are replaced as a whole. */
  update(id: string, input: OrderInput) {
    return this.prisma.$transaction(async (tx) => {
      const o = await this.locked(tx, id);
      if (input.updatedAt && new Date(input.updatedAt).getTime() !== o.updatedAt.getTime()) {
        throw new ConflictException(`${o.code} vừa được người khác lưu — tải lại để xem bản mới rồi sửa tiếp.`);
      }
      if (!canEdit(o.status)) throw new BadRequestException('Chỉ sửa được đơn ở trạng thái Nháp.');
      await this.checkRefs(tx, input);
      await tx.purchaseOrderLine.deleteMany({ where: { orderId: id } });
      await tx.purchaseOrder.update({
        where: { id },
        data: { supplierId: input.supplierId, date: fromDay(input.date)!, note: input.note ?? null, lines: { create: lineRows(input.lines) } },
      });
      return this.findOne(id, tx);
    });
  }

  send(id: string) {
    return this.transition(id, canSend, { status: 'DA_GUI_NCC', sentDate: fromDay(new Date().toISOString())! });
  }

  complete(id: string) {
    return this.transition(id, canComplete, { status: 'HOAN_TAT' });
  }

  cancel(id: string, reason: string | undefined) {
    return this.prisma.$transaction(async (tx) => {
      const o = await this.locked(tx, id);
      const received = receivedValueOf(o.lines.map(numbers));
      if (!canCancel(o.status, received)) {
        throw new BadRequestException(received ? 'Đơn đã nhận hàng — không huỷ được (đã có tồn kho và công nợ).' : `Đơn ${STATUS_LABEL[o.status].toLowerCase()} không huỷ được.`);
      }
      await tx.purchaseOrder.update({ where: { id }, data: { status: 'HUY', cancelReason: reason ?? null } });
      return this.findOne(id, tx);
    });
  }

  /**
   * Nhận hàng: one phiếu nhập kho per warehouse (through InventoryService, same transaction), received
   * quantities raised (never past the ordered quantity), status recomputed. receivedValue — and with it
   * công nợ phải trả — follows from the lines. Dịch vụ lines are received without a phiếu kho.
   */
  receive(id: string, input: ReceiptInput, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const o = await this.locked(tx, id);
      if (!canReceive(o.status)) throw new BadRequestException('Đơn này không ở trạng thái nhận hàng được.');
      const products = new Map(
        (await tx.product.findMany({ where: { id: { in: o.lines.map((l) => l.productId) } }, select: { id: true, type: true } })).map((p) => [p.id, p.type]),
      );

      const received = o.lines.map((l) => l.receivedQuantity.toNumber());
      const byWarehouse = new Map<string, Map<string, { quantity: number; value: number }>>();
      for (const it of input.items) {
        const line = o.lines[it.lineIndex];
        if (!line) throw new BadRequestException(`Dòng ${it.lineIndex + 1} không có trong đơn.`);
        const qty = Math.min(it.quantity, round4(line.quantity.toNumber() - received[it.lineIndex]));
        if (qty <= 0) continue;
        received[it.lineIndex] = round4(received[it.lineIndex] + qty);
        if (products.get(line.productId) === 'DICH_VU') continue;
        const base = round4(qty * line.ratioToBase.toNumber());
        const perWarehouse = byWarehouse.get(it.warehouseId) ?? new Map();
        const prev = perWarehouse.get(line.productId) ?? { quantity: 0, value: 0 };
        perWarehouse.set(line.productId, { quantity: round4(prev.quantity + base), value: prev.value + qty * line.unitPrice.toNumber() });
        byWarehouse.set(it.warehouseId, perWarehouse);
      }
      if (received.every((q, i) => q === o.lines[i].receivedQuantity.toNumber())) {
        throw new BadRequestException('Không có số lượng nào để nhận — các dòng đã nhận đủ hoặc số nhận bằng 0.');
      }

      for (const [warehouseId, items] of byWarehouse) {
        const lines: VoucherLineInput[] = [...items].map(([productId, x]) => ({
          productId, quantity: x.quantity, unitPrice: x.quantity ? Math.round(x.value / x.quantity) : 0, // giá nhập per base unit
        }));
        await this.inventory.post(tx, {
          type: 'NHAP', date: input.date, warehouseId, lines, purchaseOrderId: o.id,
          reason: `Nhập hàng theo đơn ${o.code}${input.note ? ` — ${input.note}` : ''}`,
        }, userId);
      }

      for (const [i, l] of o.lines.entries()) {
        if (received[i] !== l.receivedQuantity.toNumber()) {
          await tx.purchaseOrderLine.update({ where: { id: l.id }, data: { receivedQuantity: received[i] } });
        }
      }
      const status = statusAfterReceipt(o.lines.map((l, i) => ({ ...numbers(l), receivedQuantity: received[i] })));
      await tx.purchaseOrder.update({ where: { id }, data: { status, receivedDate: fromDay(input.date) } });
      return this.findOne(id, tx);
    });
  }

  private async transition(id: string, allowed: (s: PurchaseOrderStatus) => boolean, data: Prisma.PurchaseOrderUpdateInput) {
    return this.prisma.$transaction(async (tx) => {
      const o = await this.locked(tx, id);
      if (!allowed(o.status)) throw new BadRequestException(`Đơn đang ở trạng thái ${STATUS_LABEL[o.status]} — không làm được thao tác này.`);
      await tx.purchaseOrder.update({ where: { id }, data });
      return this.findOne(id, tx);
    });
  }

  // The order row is locked for the rest of the transaction: two "Nhận hàng" at once cannot both pass.
  private async locked(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "PurchaseOrder" WHERE "id" = ${id} FOR UPDATE`;
    const o = await tx.purchaseOrder.findUnique({ where: { id }, include: { lines: { orderBy: { sortOrder: 'asc' } } } });
    if (!o) throw new NotFoundException('Không tìm thấy đơn nhập');
    return o;
  }

  private async checkRefs(tx: Tx, input: OrderInput) {
    const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId } });
    if (!supplier) throw new BadRequestException('Nhà cung cấp không tồn tại');
    if (!input.lines.length) throw new BadRequestException('Thêm ít nhất một dòng hàng');
    const ids = [...new Set(input.lines.map((l) => l.productId))];
    if ((await tx.product.count({ where: { id: { in: ids } } })) !== ids.length) throw new BadRequestException('Có mặt hàng không tồn tại');
  }
}

function lineRows(lines: OrderLineInput[]) {
  return lines.map((l, i) => ({
    productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, receivedQuantity: 0, unitName: l.unitName ?? null,
    ratioToBase: l.ratioToBase ?? 1, vatRate: l.vatRate ?? 0, warehouseId: l.warehouseId ?? null, sortOrder: i,
  }));
}
