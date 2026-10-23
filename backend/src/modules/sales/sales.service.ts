import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, SalesOrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SequenceService } from '../../prisma/sequence.service.js';
import { InventoryService, VoucherLineInput } from '../inventory/inventory.service.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { fromDay, toDay } from '../../common/text.js';
import { CASH_INCLUDE, cashToApi } from '../cash/cash-voucher.mapper.js';
import { AuditService } from '../../audit/audit.service.js';
import { diff, vnd } from '../../audit/audit.diff.js';
import {
  LsxState, PriceSource, STATUS_LABEL, SaleLine, canCancel, canClose, canDeliver, canEdit, deriveStatus, lineDiscount, lineRemaining,
  linesNeedingLsx, orderTotals, priceFor, receivedValueOf, round4,
} from './sales-order.rules.js';

type Tx = Prisma.TransactionClient;

const FINISHED_GOODS_WAREHOUSE = 'wh-thanhpham';

export interface SaleLineInput {
  id?: string;
  productId: string;
  unit: string;
  unitName?: string;
  ratioToBase?: number;
  quantity: number;
  unitPrice: number;
  discountRate?: number;
  discountAmount?: number;
  vatRate?: number;
  warehouseId?: string;
  length?: number;
  width?: number;
  note?: string;
}

export interface SalesOrderInput {
  customerId: string;
  recipientName?: string;
  recipientPhone?: string;
  deliveryAddress?: string;
  description?: string;
  source?: string;
  tagIds: string[];
  orderDate: string;
  neededByDate?: string;
  salesRep?: string; // e-mail of the người bán, as the frontend keeps it
  discountAmount: number;
  payNowAccountId?: string;
  lines: SaleLineInput[];
  updatedAt?: string;
}

export interface DeliveryInput {
  date: string;
  note?: string;
  items: { lineIndex: number; quantity: number; warehouseId?: string }[];
}

const ORDER_INCLUDE = {
  lines: { orderBy: { sortOrder: 'asc' } },
  tags: { select: { tagId: true } },
  createdBy: { select: { email: true } },
  salesRep: { select: { email: true } },
  deliveryTripOrders: { select: { tripId: true, trip: { select: { date: true } } } },
} as const satisfies Prisma.SalesOrderInclude;

const LSX_INCLUDE = { createdBy: { select: { email: true } } } as const satisfies Prisma.ProductionOrderInclude;

const ORDER_FIELDS = {
  customer: 'Khách hàng', recipientName: 'Người nhận', recipientPhone: 'Điện thoại nhận', deliveryAddress: 'Địa chỉ giao',
  description: 'Diễn giải', source: 'Nguồn đơn', orderDate: 'Ngày đặt', neededByDate: 'Ngày cần giao', salesRep: 'Người bán',
  discountAmount: 'Chiết khấu cả đơn', payNow: 'Thu tiền ngay', tags: 'Thẻ', lines: 'Dòng hàng',
};

/** The parts of an order the Sửa đơn diff compares, before names are looked up. */
interface OrderShape {
  customerId: string; recipientName: string | null; recipientPhone: string | null; deliveryAddress: string | null;
  description: string | null; source: string | null; orderDate: Date | null; neededByDate: Date | null;
  discountAmount: unknown; payNowAccountId: string | null; salesRepId: string | null; tagIds: string[];
  lines: { productId: string; quantity: unknown; unitName: string | null; unit: string; unitPrice: unknown; discountAmount: unknown; vatRate: unknown; length?: unknown; width?: unknown }[];
}

type OrderRow = Prisma.SalesOrderGetPayload<{ include: typeof ORDER_INCLUDE }>;
type LineRow = OrderRow['lines'][number];
type LsxRow = Prisma.ProductionOrderGetPayload<{ include: typeof LSX_INCLUDE }>;

const saleLine = (l: LineRow): SaleLine => ({
  productId: l.productId, quantity: l.quantity.toNumber(), unitPrice: l.unitPrice.toNumber(), discountRate: l.discountRate?.toNumber() ?? null,
  discountAmount: l.discountAmount.toNumber(), vatRate: l.vatRate.toNumber(), receivedQuantity: l.receivedQuantity.toNumber(), ratioToBase: l.ratioToBase.toNumber(),
});

/** The frontend's SalesOrder: day-only dates, e-mails for people, tagIds, totals derived from the lines. */
export function orderToApi(o: OrderRow) {
  const { lines, tags, createdBy, createdById: _c, salesRep, salesRepId: _r, deliveryTripOrders, orderDate, neededByDate, dueDate, deliveredDate, closedDate, ...rest } = o;
  const nums = lines.map(saleLine);
  const discount = o.discountAmount.toNumber();
  const t = orderTotals(nums, discount);
  const lastTrip = [...deliveryTripOrders].sort((a, b) => b.trip.date.getTime() - a.trip.date.getTime())[0];
  return {
    ...rest,
    orderDate: toDay(orderDate)!, neededByDate: toDay(neededByDate), dueDate: toDay(dueDate), deliveredDate: toDay(deliveredDate), closedDate: toDay(closedDate),
    tagIds: tags.map((x) => x.tagId),
    salesRep: salesRep?.email ?? '',
    createdBy: createdBy.email,
    tripId: lastTrip?.tripId ?? null,
    totalGoods: t.goods, totalOrder: t.total, vatAmount: t.vat, receivedValue: receivedValueOf(nums, discount),
    lines: lines.map(({ orderId: _o, sortOrder: _s, ...l }, i) => ({ ...l, lineTotal: t.lines[i].gross })),
  };
}

/** The frontend's ProductionOrder (createdDate is the day it was made). */
export function lsxToApi({ createdBy, createdById: _c, createdAt, startDate, completeDate, ...x }: LsxRow) {
  return { ...x, createdAt, createdDate: toDay(createdAt)!, startDate: toDay(startDate), completeDate: toDay(completeDate), createdBy: createdBy?.email ?? null };
}

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
  ) {}

  /** An order with names instead of ids, lines as "SP0000003 × 2 m² (120×80) @ 150.000 ₫ · CK 5.000 ₫ · VAT 8%". */
  private async described(tx: Tx, o: OrderShape) {
    const [customer, rep, account, tags, products] = await Promise.all([
      tx.customer.findUnique({ where: { id: o.customerId }, select: { code: true, name: true } }),
      o.salesRepId ? tx.user.findUnique({ where: { id: o.salesRepId }, select: { name: true } }) : null,
      o.payNowAccountId ? tx.cashAccount.findUnique({ where: { id: o.payNowAccountId }, select: { name: true } }) : null,
      o.tagIds.length ? tx.tag.findMany({ where: { id: { in: o.tagIds } }, select: { name: true } }) : [],
      tx.product.findMany({ where: { id: { in: o.lines.map((l) => l.productId) } }, select: { id: true, code: true } }),
    ]);
    const code = new Map(products.map((p) => [p.id, p.code]));
    return {
      ...o,
      customer: customer ? `${customer.code} · ${customer.name}` : o.customerId,
      salesRep: rep?.name ?? null,
      payNow: account?.name ?? null,
      tags: tags.map((t) => t.name),
      lines: o.lines.map((l) => {
        const size = l.length && l.width ? ` (${Number(l.length)}×${Number(l.width)})` : '';
        const ck = Number(l.discountAmount) ? ` · CK ${vnd(l.discountAmount)}` : '';
        return `${code.get(l.productId) ?? l.productId} × ${Number(l.quantity)} ${l.unitName ?? l.unit}${size} @ ${vnd(l.unitPrice)}${ck} · VAT ${Number(l.vatRate)}%`;
      }),
    };
  }

  private async logLsx(tx: Tx, x: { id: string; code: string }, action: string, summary: string, orderCode: string, related: string[] = []) {
    await this.audit.log(tx, { action, entityType: 'ProductionOrder', entityId: x.id, entityCode: x.code, summary, related: [orderCode, ...related] });
  }

  // ---------- đọc ----------

  /**
   * "Xem đơn của mọi người bán": a seller (order.create) without order.view_all sees only the orders
   * they sell or made. Roles that do not sell (Thủ kho, giao hàng) see every order: they ship them.
   */
  visibleTo(user: AuthUser): Prisma.SalesOrderWhereInput {
    const perms = user.permissions;
    if (perms.includes('order.view_all') || !perms.includes('order.create')) return {};
    return { OR: [{ salesRepId: user.id }, { createdById: user.id }] };
  }

  async orders(user: AuthUser) {
    const rows = await this.prisma.salesOrder.findMany({ where: this.visibleTo(user), include: ORDER_INCLUDE, orderBy: [{ orderDate: 'desc' }, { code: 'desc' }] });
    return rows.map(orderToApi);
  }

  /** Every order, whoever sells it — for báo cáo and tổng quan, which only show totals. */
  async allOrders() {
    const rows = await this.prisma.salesOrder.findMany({ include: ORDER_INCLUDE, orderBy: [{ orderDate: 'desc' }, { code: 'desc' }] });
    return rows.map(orderToApi);
  }

  async orderFor(id: string, user: AuthUser) {
    const o = await this.prisma.salesOrder.findFirst({ where: { id, ...this.visibleTo(user) }, include: ORDER_INCLUDE });
    if (!o) throw new NotFoundException('Không tìm thấy đơn hàng');
    return orderToApi(o);
  }

  async order(id: string, db: Tx | PrismaService = this.prisma) {
    const o = await db.salesOrder.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!o) throw new NotFoundException('Không tìm thấy đơn hàng');
    return orderToApi(o);
  }

  async productionOrders() {
    const rows = await this.prisma.productionOrder.findMany({ include: LSX_INCLUDE, orderBy: [{ createdAt: 'desc' }, { code: 'desc' }] });
    return rows.map(lsxToApi);
  }

  private async lsx(id: string, db: Tx | PrismaService = this.prisma) {
    const x = await db.productionOrder.findUnique({ where: { id }, include: LSX_INCLUDE });
    if (!x) throw new NotFoundException('Không tìm thấy lệnh sản xuất');
    return lsxToApi(x);
  }

  // ---------- đơn hàng ----------

  create(input: SalesOrderInput, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const refs = await this.checkInput(tx, input, user, []);
      const lines = lineRows(input.lines);
      const status = deriveStatus({ status: 'CHO_SAN_XUAT', lines: lines.map(rowToSaleLine), receivedValue: 0 }, [], refs.isTp);
      const o = await tx.salesOrder.create({
        data: {
          ...headerFields(input), code: await this.sequences.nextCode('DH', tx), status, salesRepId: refs.salesRepId, createdById: user.id,
          tags: { create: [...new Set(input.tagIds)].map((tagId) => ({ tagId })) },
          lines: { create: lines },
        },
      });
      const saved = await this.order(o.id, tx);
      const customer = await tx.customer.findUnique({ where: { id: input.customerId }, select: { code: true, name: true } });
      await this.audit.log(tx, {
        action: 'sales_order.create', entityType: 'SalesOrder', entityId: o.id, entityCode: o.code,
        summary: `Lập đơn hàng bán ${o.code} · ${customer?.code} ${customer?.name} · ${lines.length} dòng · ${vnd(saved.totalOrder)}`
          + (input.payNowAccountId ? ' · thu tiền ngay' : ''),
        related: customer ? [customer.code] : undefined,
      });
      return saved;
    });
  }

  /** Before production starts and before any delivery. Draft lệnh sản xuất follow the thành phẩm lines. */
  update(id: string, input: SalesOrderInput, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const o = await this.locked(tx, id);
      if (input.updatedAt && new Date(input.updatedAt).getTime() !== o.updatedAt.getTime()) {
        throw new ConflictException(`${o.code} vừa được người khác lưu — tải lại để xem bản mới rồi sửa tiếp.`);
      }
      const lsx = await tx.productionOrder.findMany({ where: { sourceOrderId: id } });
      if (!canEdit(this.state(o), lsx)) throw new BadRequestException('Đơn đã sản xuất hoặc đã giao, không sửa được.');
      const refs = await this.checkInput(tx, input, user, o.lines);
      const lines = lineRows(input.lines);
      const before = await this.described(tx, { ...o, tagIds: o.tags.map((t) => t.tagId) });

      // Lệnh SX còn nháp đi theo dòng thành phẩm: dòng bị bỏ thì huỷ lệnh, đổi số lượng thì cập nhật lệnh.
      const baseQty = new Map<string, number>();
      for (const l of lines) if (refs.isTp(l.productId)) baseQty.set(l.productId, round4((baseQty.get(l.productId) ?? 0) + l.quantity * l.ratioToBase));
      for (const x of lsx.filter((p) => p.status === 'NHAP')) {
        const q = baseQty.get(x.productId);
        await tx.productionOrder.update({ where: { id: x.id }, data: q ? { quantity: q } : { status: 'HUY', cancelReason: 'Dòng hàng đã bỏ khỏi đơn' } });
        if (!q) await this.logLsx(tx, x, 'production_order.cancel', `Huỷ lệnh sản xuất ${x.code}: dòng hàng đã bỏ khỏi đơn ${o.code}`, o.code);
        else if (q !== x.quantity.toNumber()) {
          await this.logLsx(tx, x, 'production_order.update', `Đổi số lượng lệnh ${x.code} từ ${x.quantity.toNumber()} thành ${q} theo đơn ${o.code}`, o.code);
        }
      }

      await tx.salesOrderLine.deleteMany({ where: { orderId: id } });
      await tx.salesOrderTag.deleteMany({ where: { orderId: id } });
      await tx.salesOrder.update({
        where: { id },
        data: {
          ...headerFields(input), salesRepId: refs.salesRepId,
          tags: { create: [...new Set(input.tagIds)].map((tagId) => ({ tagId })) },
          lines: { create: lines },
        },
      });
      await this.refreshStatus(tx, id);
      const after = await this.described(tx, { ...headerFields(input), salesRepId: refs.salesRepId, tagIds: [...new Set(input.tagIds)], lines });
      await this.audit.log(tx, {
        action: 'sales_order.update', entityType: 'SalesOrder', entityId: id, entityCode: o.code, summary: `Sửa đơn hàng bán ${o.code}`,
        changes: diff(before, after, ORDER_FIELDS),
      });
      return this.order(id, tx);
    });
  }

  cancel(id: string, reason: string | undefined) {
    return this.prisma.$transaction(async (tx) => {
      const o = await this.locked(tx, id);
      if (!canCancel(this.state(o))) throw new BadRequestException(`Đơn ${STATUS_LABEL[o.status].toLowerCase()} — không huỷ được.`);
      const open = await tx.productionOrder.findMany({ where: { sourceOrderId: id, status: { in: ['NHAP', 'DANG_SAN_XUAT'] } } });
      await tx.productionOrder.updateMany({
        where: { id: { in: open.map((x) => x.id) } },
        data: { status: 'HUY', cancelReason: `Huỷ theo đơn ${o.code}` },
      });
      for (const x of open) await this.logLsx(tx, x, 'production_order.cancel', `Huỷ lệnh sản xuất ${x.code} theo đơn ${o.code}`, o.code);
      await tx.salesOrder.update({ where: { id }, data: { status: 'HUY', cancelReason: reason ?? null } });
      await this.audit.log(tx, {
        action: 'sales_order.cancel', entityType: 'SalesOrder', entityId: id, entityCode: o.code,
        summary: `Huỷ đơn hàng bán ${o.code}${reason ? `: ${reason}` : ''}${open.length ? ` (kèm ${open.length} lệnh sản xuất)` : ''}`,
        related: open.map((x) => x.code),
      });
      return this.order(id, tx);
    });
  }

  /** Kết thúc đơn: the customer will not take the rest — stays Giao một phần, no more deliveries. */
  close(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const o = await this.locked(tx, id);
      if (!canClose(this.state(o))) throw new BadRequestException('Chỉ kết thúc được đơn đang giao một phần.');
      await tx.salesOrder.update({ where: { id }, data: { closedDate: fromDay(new Date().toISOString()) } });
      await this.audit.log(tx, {
        action: 'sales_order.close', entityType: 'SalesOrder', entityId: id, entityCode: o.code,
        summary: `Kết thúc đơn ${o.code}: khách không lấy phần còn lại`,
      });
      return this.order(id, tx);
    });
  }

  /**
   * Giao hàng: what the customer actually takes (all or part). One phiếu xuất kho per kho through
   * InventoryService (dịch vụ không xuất kho); công nợ phải thu = receivedValue. With "Thu tiền ngay"
   * a phiếu thu for exactly the newly received value is made, settled against this order.
   */
  deliver(id: string, input: DeliveryInput, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const o = await this.locked(tx, id);
      if (!canDeliver(this.state(o))) throw new BadRequestException('Đơn này không ở trạng thái giao hàng được.');
      const types = await this.productTypes(tx, o.lines.map((l) => l.productId));
      const nums = o.lines.map(saleLine);
      const before = receivedValueOf(nums, o.discountAmount.toNumber());

      const byWarehouse = new Map<string, Map<string, number>>();
      let moved = false;
      for (const it of input.items) {
        const line = nums[it.lineIndex];
        if (!line) throw new BadRequestException(`Dòng ${it.lineIndex + 1} không có trong đơn.`);
        const qty = Math.min(it.quantity, lineRemaining(line));
        if (qty <= 0) continue;
        line.receivedQuantity = round4(line.receivedQuantity + qty);
        moved = true;
        if (types.get(line.productId) !== 'DICH_VU' && it.warehouseId) {
          const m = byWarehouse.get(it.warehouseId) ?? new Map<string, number>();
          m.set(line.productId, round4((m.get(line.productId) ?? 0) + qty * line.ratioToBase));
          byWarehouse.set(it.warehouseId, m);
        }
      }
      if (!moved) throw new BadRequestException('Không có số lượng nào để giao — các dòng đã giao đủ hoặc số giao bằng 0.');

      const voucherIds: string[] = [];
      for (const [warehouseId, m] of byWarehouse) {
        voucherIds.push(await this.inventory.post(tx, {
          type: 'XUAT', date: input.date, warehouseId, salesOrderId: o.id,
          reason: `Xuất kho giao đơn ${o.code}${input.note ? ` — ${input.note}` : ''}`,
          lines: [...m].map(([productId, quantity]) => ({ productId, quantity })),
        }, user.id));
      }
      for (const [i, l] of o.lines.entries()) {
        if (nums[i].receivedQuantity !== l.receivedQuantity.toNumber()) {
          await tx.salesOrderLine.update({ where: { id: l.id }, data: { receivedQuantity: nums[i].receivedQuantity } });
        }
      }
      await tx.salesOrder.update({ where: { id }, data: { deliveredDate: fromDay(input.date), dueDate: null } });
      const status = await this.refreshStatus(tx, id);

      const delta = receivedValueOf(nums, o.discountAmount.toNumber()) - before;
      const { receipts } = await this.syncPayNow(tx, o, delta, input.date, user.id);
      await this.audit.log(tx, {
        action: 'sales_order.deliver', entityType: 'SalesOrder', entityId: id, entityCode: o.code,
        summary: `Giao hàng đơn ${o.code}: khách nhận ${vnd(delta)} · ${STATUS_LABEL[status]}`
          + (receipts.length ? ` · thu tiền ngay ${receipts.map((r) => r.code).join(', ')}` : ' · ghi công nợ phải thu')
          + (input.note ? ` · ${input.note}` : ''),
        related: [...(await this.inventory.codes(tx, voucherIds)), ...receipts.map((r) => r.code)],
      });
      return { order: await this.order(id, tx), receipts };
    });
  }

  /**
   * "Thu tiền ngay": the customer received more → a phiếu thu for exactly that value, đối trừ thẳng vào
   * đơn này. Received less (bỏ chốt giao on a chuyến) → the latest automatic phiếu thu that fit are
   * cancelled so công nợ matches again. Returns the new receipts and the ids of the cancelled ones.
   */
  async syncPayNow(
    tx: Tx, o: { code: string; customerId: string; payNowAccountId: string | null; status: SalesOrderStatus }, delta: number, date: string, userId: string,
  ) {
    const none = { receipts: [] as ReturnType<typeof cashToApi>[], cancelled: [] as string[] };
    if (!o.payNowAccountId || o.status === 'HUY' || !delta) return none;
    const marker = `Thu tiền ngay đơn ${o.code}`;
    if (delta > 0) {
      const v = await tx.cashVoucher.create({
        data: {
          code: await this.sequences.nextCode('PT', tx), date: fromDay(date)!, kind: 'THU', category: 'Thu tiền khách hàng',
          partnerType: 'KHACH_HANG', customerId: o.customerId, accountId: o.payNowAccountId, amount: delta, settledAmount: delta,
          description: marker, createdById: userId, allocations: { create: [{ ref: o.code, amount: delta }] },
        },
        include: CASH_INCLUDE,
      });
      const account = await tx.cashAccount.findUnique({ where: { id: o.payNowAccountId }, select: { name: true } });
      await this.audit.log(tx, {
        action: 'cash_voucher.create', entityType: 'CashVoucher', entityId: v.id, entityCode: v.code,
        summary: `Tự lập phiếu thu ${v.code}: ${vnd(delta)} · ${marker} · ${account?.name ?? ''}`, related: [o.code],
      });
      return { ...none, receipts: [cashToApi(v)] };
    }
    let left = -delta;
    const auto = await tx.cashVoucher.findMany({ where: { isCancelled: false, description: marker }, orderBy: { createdAt: 'desc' } });
    for (const v of auto) {
      const amount = v.amount.toNumber();
      if (left <= 0 || amount > left) continue;
      await tx.cashVoucher.update({ where: { id: v.id }, data: { isCancelled: true, cancelReason: 'Khách bỏ nhận hàng — huỷ phiếu thu tự lập', cancelledAt: new Date() } });
      await this.audit.log(tx, {
        action: 'cash_voucher.cancel', entityType: 'CashVoucher', entityId: v.id, entityCode: v.code,
        summary: `Tự huỷ phiếu thu ${v.code} (${vnd(amount)}): khách bỏ nhận hàng đơn ${o.code}`, related: [o.code],
      });
      none.cancelled.push(v.id);
      left -= amount;
    }
    return none;
  }

  // ---------- lệnh sản xuất ----------

  /** One lệnh sản xuất (Nháp) per thành phẩm line that has none yet, with the định mức as it is now. */
  createProductionOrders(orderId: string, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const o = await this.locked(tx, orderId);
      const types = await this.productTypes(tx, o.lines.map((l) => l.productId));
      const isTp = (p: string) => types.get(p) === 'THANH_PHAM';
      const lsx = await tx.productionOrder.findMany({ where: { sourceOrderId: orderId } });
      const idx = linesNeedingLsx(this.state(o), lsx, isTp);
      if (!idx.length) throw new BadRequestException('Mọi dòng thành phẩm đã có lệnh sản xuất.');
      const ids: string[] = [];
      for (const i of idx) {
        const l = o.lines[i];
        const bom = await tx.bomLine.findMany({ where: { finishedProductId: l.productId }, select: { componentId: true, quantityPerUnit: true } });
        const x = await tx.productionOrder.create({
          data: {
            code: await this.sequences.nextCode('LSX', tx), sourceOrderId: orderId, productId: l.productId,
            quantity: round4(l.quantity.toNumber() * l.ratioToBase.toNumber()), status: 'NHAP', createdById: user.id,
            bomSnapshot: bom.map((b) => ({ componentId: b.componentId, quantityPerUnit: b.quantityPerUnit.toNumber() })),
          },
        });
        ids.push(x.id);
        await this.logLsx(tx, x, 'production_order.create',
          `Lập lệnh sản xuất ${x.code} từ đơn ${o.code}: ${x.quantity.toNumber()} · định mức ${bom.length} vật tư`, o.code);
      }
      await this.refreshStatus(tx, orderId);
      const created = await tx.productionOrder.findMany({ where: { id: { in: ids } }, include: LSX_INCLUDE, orderBy: { code: 'asc' } });
      return { created: created.map(lsxToApi), order: await this.order(orderId, tx) };
    });
  }

  /** Bắt đầu sản xuất: xuất vật tư theo định mức, mỗi vật tư từ kho ngầm định của nó. */
  startProduction(lsxId: string, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const x = await this.lockedLsx(tx, lsxId);
      if (x.status !== 'NHAP') throw new BadRequestException('Chỉ bắt đầu được lệnh đang ở trạng thái Nháp.');
      const today = new Date().toISOString().slice(0, 10);
      const bom = await this.bomOf(tx, x);
      const components = await tx.product.findMany({ where: { id: { in: bom.map((b) => b.componentId) } }, select: { id: true, type: true, defaultWarehouseId: true } });
      const fallback = (await tx.warehouse.findFirst({ orderBy: { name: 'asc' }, select: { id: true } }))?.id;
      const byWarehouse = new Map<string, Map<string, number>>();
      for (const b of bom) {
        const p = components.find((c) => c.id === b.componentId);
        if (!p || p.type === 'DICH_VU') continue;
        const wh = p.defaultWarehouseId ?? fallback;
        if (!wh) throw new BadRequestException('Chưa có kho nào để xuất vật tư.');
        const m = byWarehouse.get(wh) ?? new Map<string, number>();
        m.set(b.componentId, round4((m.get(b.componentId) ?? 0) + b.quantityPerUnit * x.quantity.toNumber()));
        byWarehouse.set(wh, m);
      }
      const voucherIds: string[] = [];
      for (const [warehouseId, m] of byWarehouse) {
        voucherIds.push(await this.inventory.post(tx, {
          type: 'XUAT', date: today, warehouseId, productionOrderId: x.id, reason: `Xuất vật tư cho ${x.code}`,
          lines: [...m].map(([productId, quantity]): VoucherLineInput => ({ productId, quantity })),
        }, user.id));
      }
      await tx.productionOrder.update({ where: { id: x.id }, data: { status: 'DANG_SAN_XUAT', startDate: fromDay(today) } });
      await this.refreshStatus(tx, x.sourceOrderId);
      const codes = await this.inventory.codes(tx, voucherIds);
      await this.logLsx(tx, x, 'production_order.start',
        `Bắt đầu sản xuất ${x.code}${codes.length ? `, xuất vật tư ${codes.join(', ')}` : ' (không có vật tư để xuất)'}`,
        await this.orderCode(tx, x.sourceOrderId), codes);
      return { productionOrder: await this.lsx(x.id, tx), order: await this.order(x.sourceOrderId, tx) };
    });
  }

  /** Nghiệm thu: nhập số thực làm được vào Kho thành phẩm (hàng hỏng làm số này nhỏ hơn số lệnh). */
  completeProduction(lsxId: string, produced: number | undefined, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const x = await this.lockedLsx(tx, lsxId);
      if (x.status !== 'DANG_SAN_XUAT') throw new BadRequestException('Chỉ nghiệm thu được lệnh đang sản xuất.');
      const qty = round4(Math.max(0, produced ?? x.quantity.toNumber()));
      const today = new Date().toISOString().slice(0, 10);
      let voucherId: string | null = null;
      if (qty > 0) {
        const target = (await tx.warehouse.findUnique({ where: { id: FINISHED_GOODS_WAREHOUSE } }))?.id
          ?? (await tx.product.findUnique({ where: { id: x.productId } }))?.defaultWarehouseId;
        if (!target) throw new BadRequestException('Chưa có Kho thành phẩm để nhập.');
        voucherId = await this.inventory.post(tx, {
          type: 'NHAP', date: today, warehouseId: target, productionOrderId: x.id, reason: `Nhập thành phẩm từ xưởng: ${x.code}`,
          lines: [{ productId: x.productId, quantity: qty }],
        }, user.id);
      }
      await tx.productionOrder.update({ where: { id: x.id }, data: { status: 'HOAN_TAT', completeDate: fromDay(today), producedQuantity: qty } });
      await this.refreshStatus(tx, x.sourceOrderId);
      const codes = await this.inventory.codes(tx, voucherId ? [voucherId] : []);
      const ordered = x.quantity.toNumber();
      await this.logLsx(tx, x, 'production_order.complete',
        `Nghiệm thu ${x.code}: làm được ${qty} / ${ordered}${qty < ordered ? ` (hỏng ${round4(ordered - qty)})` : ''}${codes.length ? `, nhập kho ${codes[0]}` : ''}`,
        await this.orderCode(tx, x.sourceOrderId), codes);
      return { productionOrder: await this.lsx(x.id, tx), order: await this.order(x.sourceOrderId, tx) };
    });
  }

  /** Huỷ lệnh (Nháp hoặc Đang sản xuất). Vật tư đã xuất không tự nhập lại — lập phiếu nhập nếu còn dùng được. */
  cancelProduction(lsxId: string, reason: string | undefined) {
    return this.prisma.$transaction(async (tx) => {
      const x = await this.lockedLsx(tx, lsxId);
      if (x.status !== 'NHAP' && x.status !== 'DANG_SAN_XUAT') throw new BadRequestException('Lệnh này đã xong hoặc đã huỷ.');
      await tx.productionOrder.update({ where: { id: x.id }, data: { status: 'HUY', cancelReason: reason ?? null } });
      await this.refreshStatus(tx, x.sourceOrderId);
      await this.logLsx(tx, x, 'production_order.cancel',
        `Huỷ lệnh sản xuất ${x.code}${x.status === 'DANG_SAN_XUAT' ? ' đang chạy (vật tư đã xuất không tự nhập lại)' : ''}${reason ? `: ${reason}` : ''}`,
        await this.orderCode(tx, x.sourceOrderId));
      return { productionOrder: await this.lsx(x.id, tx), order: await this.order(x.sourceOrderId, tx) };
    });
  }

  // ---------- helpers ----------

  private state(o: { status: SalesOrderStatus; lines: LineRow[] | Prisma.SalesOrderLineGetPayload<object>[]; discountAmount: Prisma.Decimal; closedDate: Date | null }) {
    const lines = (o.lines as LineRow[]).map(saleLine);
    return { status: o.status, lines, receivedValue: receivedValueOf(lines, o.discountAmount.toNumber()), closedDate: o.closedDate };
  }

  /** Status follows giao hàng and sản xuất; stored so lists can filter on it. */
  private async refreshStatus(tx: Tx, orderId: string): Promise<SalesOrderStatus> {
    const o = await tx.salesOrder.findUniqueOrThrow({ where: { id: orderId }, include: { lines: { orderBy: { sortOrder: 'asc' } } } });
    const lsx = await tx.productionOrder.findMany({ where: { sourceOrderId: orderId }, select: { productId: true, status: true } });
    const types = await this.productTypes(tx, o.lines.map((l) => l.productId));
    const status = deriveStatus(this.state(o), lsx as LsxState[], (p) => types.get(p) === 'THANH_PHAM');
    if (status !== o.status) await tx.salesOrder.update({ where: { id: orderId }, data: { status } });
    return status;
  }

  private async orderCode(tx: Tx, id: string): Promise<string> {
    return (await tx.salesOrder.findUniqueOrThrow({ where: { id }, select: { code: true } })).code;
  }

  private async productTypes(tx: Tx, ids: string[]) {
    const rows = await tx.product.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, type: true } });
    return new Map(rows.map((p) => [p.id, p.type]));
  }

  private async bomOf(tx: Tx, x: { productId: string; bomSnapshot: Prisma.JsonValue }) {
    const snap = Array.isArray(x.bomSnapshot) ? (x.bomSnapshot as { componentId: string; quantityPerUnit: number }[]) : [];
    if (snap.length) return snap.map((b) => ({ componentId: b.componentId, quantityPerUnit: Number(b.quantityPerUnit) }));
    const bom = await tx.bomLine.findMany({ where: { finishedProductId: x.productId } });
    return bom.map((b) => ({ componentId: b.componentId, quantityPerUnit: b.quantityPerUnit.toNumber() }));
  }

  // The order row is locked for the rest of the transaction: two deliveries at once cannot both pass.
  async locked(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "SalesOrder" WHERE "id" = ${id} FOR UPDATE`;
    const o = await tx.salesOrder.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!o) throw new NotFoundException('Không tìm thấy đơn hàng');
    return o;
  }

  private async lockedLsx(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "ProductionOrder" WHERE "id" = ${id} FOR UPDATE`;
    const x = await tx.productionOrder.findUnique({ where: { id } });
    if (!x) throw new NotFoundException('Không tìm thấy lệnh sản xuất');
    await tx.$queryRaw`SELECT "id" FROM "SalesOrder" WHERE "id" = ${x.sourceOrderId} FOR UPDATE`;
    return x;
  }

  /**
   * Customer, products, người bán, tài khoản thu tiền ngay must exist. Without order.update_price
   * each line keeps the list price for the customer type (or the price it already had on the order).
   */
  private async checkInput(tx: Tx, input: SalesOrderInput, user: AuthUser, existing: LineRow[]) {
    const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) throw new BadRequestException('Khách hàng không tồn tại');
    const ids = [...new Set(input.lines.map((l) => l.productId))];
    const products = await tx.product.findMany({ where: { id: { in: ids } }, include: { unitConversions: true } });
    if (products.length !== ids.length) throw new BadRequestException('Có mặt hàng không tồn tại');
    const byId = new Map(products.map((p) => [p.id, p]));

    if (!user.permissions.includes('order.update_price')) {
      for (const [i, l] of input.lines.entries()) {
        const p = byId.get(l.productId)!;
        const source: PriceSource = {
          type: p.type, retailPrice: p.retailPrice.toNumber(), wholesalePrice: p.wholesalePrice.toNumber(), dropshipPrice: p.dropshipPrice.toNumber(),
          unitConversions: p.unitConversions.map((u) => ({
            unitName: u.unitName, ratioToBaseUnit: u.ratioToBaseUnit.toNumber(), price: u.price.toNumber(),
            wholesalePrice: u.wholesalePrice?.toNumber() ?? null, dropshipPrice: u.dropshipPrice?.toNumber() ?? null,
          })),
        };
        const listed = priceFor(source, customer.type, l.unitName);
        const kept = existing.some((e) => e.productId === l.productId && (e.unitName ?? '') === (l.unitName ?? '') && e.unitPrice.toNumber() === l.unitPrice);
        if (l.unitPrice !== listed && !kept) throw new ForbiddenException(`Dòng ${i + 1}: chức vụ của bạn chưa có quyền sửa đơn giá trên đơn.`);
      }
    }

    let salesRepId: string | null = null;
    if (input.salesRep) {
      const rep = await tx.user.findUnique({ where: { email: input.salesRep.toLowerCase() } });
      if (!rep) throw new BadRequestException('Người bán không tồn tại');
      salesRepId = rep.id;
    }
    if (input.payNowAccountId && !(await tx.cashAccount.findUnique({ where: { id: input.payNowAccountId } }))) {
      throw new BadRequestException('Tài khoản thu tiền ngay không tồn tại');
    }
    return { salesRepId, isTp: (p: string) => byId.get(p)?.type === 'THANH_PHAM' };
  }
}

function headerFields(input: SalesOrderInput) {
  return {
    customerId: input.customerId, recipientName: input.recipientName ?? null, recipientPhone: input.recipientPhone ?? null,
    deliveryAddress: input.deliveryAddress ?? null, description: input.description ?? null, source: input.source ?? null,
    orderDate: fromDay(input.orderDate)!, neededByDate: fromDay(input.neededByDate), discountAmount: input.discountAmount || 0,
    payNowAccountId: input.payNowAccountId ?? null,
  };
}

/** Lines as stored: the chiết khấu dòng is kept as an amount (from the rate when only a rate is given). */
function lineRows(lines: SaleLineInput[]) {
  return lines.map((l, i) => {
    const base: SaleLine = {
      productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, discountRate: l.discountRate ?? null,
      discountAmount: l.discountAmount ?? null, vatRate: l.vatRate ?? 0, receivedQuantity: 0, ratioToBase: l.ratioToBase ?? 1,
    };
    return {
      id: l.id ?? randomUUID(), productId: l.productId, unit: l.unit, unitName: l.unitName ?? null, ratioToBase: base.ratioToBase,
      quantity: l.quantity, unitPrice: l.unitPrice, discountRate: l.discountRate ?? null, discountAmount: lineDiscount(base),
      vatRate: base.vatRate, warehouseId: l.warehouseId ?? null, length: l.length ?? null, width: l.width ?? null, note: l.note ?? null,
      receivedQuantity: 0, sortOrder: i,
    };
  });
}

function rowToSaleLine(r: ReturnType<typeof lineRows>[number]): SaleLine {
  return {
    productId: r.productId, quantity: r.quantity, unitPrice: r.unitPrice, discountRate: r.discountRate, discountAmount: r.discountAmount,
    vatRate: r.vatRate, receivedQuantity: 0, ratioToBase: r.ratioToBase,
  };
}
