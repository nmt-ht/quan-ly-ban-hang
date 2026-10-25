import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryTripStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SequenceService } from '../../prisma/sequence.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { SalesService } from '../sales/sales.service.js';
import { SaleLine, deriveStatus, lineRemaining, orderTotals, receivedValueOf, round4 } from '../sales/sales-order.rules.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { fromDay, toDay } from '../../common/text.js';
import { AuditService } from '../../audit/audit.service.js';
import { assertOpenPeriod } from '../../common/period-lock.js';
import { diff, vnd } from '../../audit/audit.diff.js';

const STATUS_AFTER: Record<string, string> = { HOAN_THANH: 'nhận đủ', GIAO_MOT_PHAN: 'nhận một phần', TRA_TOAN_BO: 'không nhận gì' };

type Tx = Prisma.TransactionClient;

// Chuyến giao hàng: Đang gom đơn → (xuất kho một lượt) Đã xuất kho → (chốt giao từng đơn) → (xe về kho:
// nhập lại hàng khách không nhận) Xe đã về kho → Hoàn tất. Huỷ chỉ khi chưa xuất kho. Same rules as the
// frontend's features/delivery-trips/delivery-trip.rules.ts.
const ACTIVE: DeliveryTripStatus[] = ['GOM_DON', 'DA_XUAT_KHO'];
const FINISHED_GOODS_WAREHOUSE = 'wh-thanhpham';

export interface TripHeaderInput {
  date: string;
  vehicleId?: string; // empty = xe thuê ngoài
  plateNumber?: string;
  driverName?: string;
  driverPhone?: string;
  note?: string;
}

export interface TripCostsInput {
  fuel: number;
  toll: number;
  other: number;
  note?: string;
}

const TRIP_INCLUDE = {
  orders: { orderBy: { sortOrder: 'asc' } },
  loads: { include: { orderLine: { select: { orderId: true, sortOrder: true } } } },
  createdBy: { select: { email: true } },
} as const satisfies Prisma.DeliveryTripInclude;

type TripRow = Prisma.DeliveryTripGetPayload<{ include: typeof TRIP_INCLUDE }>;
type OrderWithLines = Prisma.SalesOrderGetPayload<{ include: { lines: { orderBy: { sortOrder: 'asc' } } } }>;

const saleLine = (l: OrderWithLines['lines'][number]): SaleLine => ({
  productId: l.productId, quantity: l.quantity.toNumber(), unitPrice: l.unitPrice.toNumber(), discountRate: l.discountRate?.toNumber() ?? null,
  discountAmount: l.discountAmount.toNumber(), vatRate: l.vatRate.toNumber(), receivedQuantity: l.receivedQuantity.toNumber(), ratioToBase: l.ratioToBase.toNumber(),
});

/** Phải thu for one unit of each line (after chiết khấu, VAT included). */
function unitValues(o: OrderWithLines): number[] {
  const lines = o.lines.map(saleLine);
  const t = orderTotals(lines, o.discountAmount.toNumber());
  return lines.map((l, i) => (l.quantity > 0 ? t.lines[i].total / l.quantity : 0));
}

/** The frontend's DeliveryTrip: orderIds, loads and confirmations by line index, costs, derived totals. */
function tripToApi(t: TripRow, orders: Map<string, OrderWithLines>) {
  const { orders: links, loads: rows, createdBy, createdById: _c, fuelCost, tollCost, otherCost, costNote, date, ...rest } = t;
  const loads = rows.map((l) => ({
    orderId: l.orderLine.orderId, lineIndex: l.orderLine.sortOrder, productId: l.productId, quantity: l.quantity.toNumber(),
    warehouseId: l.warehouseId ?? undefined, received: l.receivedQuantity?.toNumber(),
  }));
  const confirmations = links.filter((x) => x.confirmedAt).map((x) => ({
    orderId: x.orderId, confirmedAt: x.confirmedAt!, note: x.confirmNote ?? undefined,
    lines: loads.filter((l) => l.orderId === x.orderId).map((l) => ({ lineIndex: l.lineIndex, received: l.received ?? 0 })),
  }));
  let totalValue = 0;
  let receivedValue = 0;
  if (loads.length) {
    for (const l of loads) totalValue += l.quantity * (unitValues(orders.get(l.orderId)!)[l.lineIndex] ?? 0);
  } else {
    for (const x of links) {
      const o = orders.get(x.orderId)!;
      const v = unitValues(o);
      totalValue += o.lines.map(saleLine).reduce((s, l, i) => s + lineRemaining(l) * v[i], 0);
    }
  }
  for (const c of confirmations) {
    const v = unitValues(orders.get(c.orderId)!);
    for (const r of c.lines) receivedValue += r.received * (v[r.lineIndex] ?? 0);
  }
  return {
    ...rest,
    date: toDay(date)!,
    createdBy: createdBy?.email ?? null,
    orderIds: links.map((x) => x.orderId),
    costs: { fuel: fuelCost, toll: tollCost, other: otherCost, note: costNote },
    loads: loads.map(({ received: _r, ...l }) => l),
    confirmations,
    confirmedCount: confirmations.length,
    totalValue: Math.round(totalValue),
    receivedValue: Math.round(receivedValue),
  };
}

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly inventory: InventoryService,
    private readonly sales: SalesService,
    private readonly audit: AuditService,
  ) {}

  /** One Nhật ký line on the chuyến; `related` (order and voucher codes) shows it on those documents too. */
  private log(tx: Tx, t: { id: string; code: string }, action: string, summary: string, related: string[] = [], changes?: ReturnType<typeof diff>) {
    return this.audit.log(tx, { action, entityType: 'DeliveryTrip', entityId: t.id, entityCode: t.code, summary, related, changes });
  }

  async trips() {
    const rows = await this.prisma.deliveryTrip.findMany({ include: TRIP_INCLUDE, orderBy: [{ date: 'desc' }, { code: 'desc' }] });
    const orders = await this.ordersOf(this.prisma, rows.flatMap((t) => t.orders.map((x) => x.orderId)));
    return rows.map((t) => tripToApi(t, orders));
  }

  async trip(id: string, db: Tx | PrismaService = this.prisma) {
    const t = await db.deliveryTrip.findUnique({ where: { id }, include: TRIP_INCLUDE });
    if (!t) throw new NotFoundException('Không tìm thấy chuyến giao hàng');
    return tripToApi(t, await this.ordersOf(db, t.orders.map((x) => x.orderId)));
  }

  create(h: TripHeaderInput, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const t = await tx.deliveryTrip.create({
        data: { ...(await this.header(tx, h)), code: await this.sequences.nextCode('CH', tx), status: 'GOM_DON', createdById: user.id },
      });
      await this.log(tx, t, 'delivery_trip.create', `Tạo chuyến giao hàng ${t.code} · ${t.plateNumber ?? 'chưa chọn xe'}${t.driverName ? ` · ${t.driverName}` : ''}`);
      return this.trip(t.id, tx);
    });
  }

  updateHeader(id: string, h: TripHeaderInput) {
    return this.step(id, ['GOM_DON', 'DA_XUAT_KHO'], 'Chuyến đã về kho — không sửa thông tin xe được.', async (tx, t) => {
      const data = await this.header(tx, h);
      await tx.deliveryTrip.update({ where: { id }, data });
      await this.log(tx, t, 'delivery_trip.update', `Sửa thông tin chuyến ${t.code}`, [], diff(t, data, {
        date: 'Ngày chuyến', plateNumber: 'Biển số', driverName: 'Tài xế', driverPhone: 'Điện thoại tài xế', note: 'Ghi chú',
      }));
    });
  }

  saveCosts(id: string, c: TripCostsInput) {
    return this.step(id, ['GOM_DON', 'DA_XUAT_KHO', 'XE_VE_KHO', 'HOAN_TAT'], 'Chuyến đã huỷ.', async (tx, t) => {
      const data = { fuelCost: c.fuel || 0, tollCost: c.toll || 0, otherCost: c.other || 0, costNote: c.note ?? null };
      await tx.deliveryTrip.update({ where: { id }, data });
      await this.log(tx, t, 'delivery_trip.costs', `Ghi chi phí chuyến ${t.code}: ${vnd(data.fuelCost + data.tollCost + data.otherCost)}`, [], diff(t, data, {
        fuelCost: 'Tiền dầu', tollCost: 'Cầu đường bến bãi', otherCost: 'Chi phí khác', costNote: 'Ghi chú chi phí',
      }));
    });
  }

  // ---------- xếp đơn ----------

  /** Orders that can still go out (còn hàng phải giao, chưa kết thúc, not on another running chuyến) are added. */
  addOrders(id: string, orderIds: string[]) {
    return this.step(id, ['GOM_DON'], 'Chỉ xếp đơn khi chuyến đang gom đơn.', async (tx, t) => {
      let n = t.orders.length;
      const added: string[] = [];
      for (const orderId of [...new Set(orderIds)]) {
        if (t.orders.some((x) => x.orderId === orderId)) continue;
        const o = await this.sales.locked(tx, orderId);
        const lines = o.lines.map(saleLine);
        if ((o.status !== 'CHO_GIAO_HANG' && o.status !== 'GIAO_MOT_PHAN') || o.closedDate || !lines.some((l) => lineRemaining(l) > 0)) continue;
        const busy = await tx.deliveryTripOrder.count({ where: { orderId, trip: { status: { in: ACTIVE } } } });
        if (busy) continue;
        await tx.deliveryTripOrder.create({ data: { tripId: id, orderId, sortOrder: n++ } });
        added.push(o.code);
      }
      if (!added.length) throw new BadRequestException('Không có đơn nào xếp được — đơn phải chờ giao, còn hàng và chưa nằm trên chuyến khác.');
      await this.log(tx, t, 'delivery_trip.add_orders', `Xếp ${added.length} đơn lên chuyến ${t.code}: ${added.join(', ')}`, added);
    });
  }

  removeOrder(id: string, orderId: string) {
    return this.step(id, ['GOM_DON'], 'Chỉ bỏ đơn khi chuyến đang gom đơn.', async (tx, t) => {
      const { count } = await tx.deliveryTripOrder.deleteMany({ where: { tripId: id, orderId } });
      const code = (await tx.salesOrder.findUnique({ where: { id: orderId }, select: { code: true } }))?.code ?? orderId;
      await this.log(tx, t, 'delivery_trip.remove_order', count ? `Bỏ đơn ${code} khỏi chuyến ${t.code}` : `Đơn ${code} không có trên chuyến ${t.code}`, [code]);
    });
  }

  // ---------- xuất kho một lượt ----------

  /** Everything still to deliver goes on the truck; one phiếu xuất kho per kho; the orders become Đang giao. */
  ship(id: string, user: AuthUser) {
    return this.step(id, ['GOM_DON'], 'Chuyến đã xuất kho.', async (tx, t) => {
      if (!t.orders.length) throw new BadRequestException('Chuyến chưa có đơn nào.');
      const today = new Date().toISOString().slice(0, 10);
      const fallback = (await tx.warehouse.findFirst({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }], select: { id: true } }))?.id;
      const byWarehouse = new Map<string, Map<string, number>>();
      const orderCodes: string[] = [];
      for (const link of t.orders) {
        const o = await this.sales.locked(tx, link.orderId);
        // Only goods still owed leave the kho: a đơn huỷ or kết thúc since it was xếp lên xe must come off the chuyến first.
        if (o.status === 'HUY' || o.closedDate) {
          throw new BadRequestException(`Đơn ${o.code} đã ${o.status === 'HUY' ? 'huỷ' : 'kết thúc'} — bỏ đơn khỏi chuyến rồi xuất kho.`);
        }
        orderCodes.push(o.code);
        const products = new Map((await tx.product.findMany({ where: { id: { in: o.lines.map((l) => l.productId) } } })).map((p) => [p.id, p]));
        for (const line of o.lines) {
          const q = lineRemaining(saleLine(line));
          if (q <= 0) continue;
          const p = products.get(line.productId)!;
          const wh = p.type === 'DICH_VU' ? null
            : line.warehouseId ?? p.defaultWarehouseId ?? (p.type === 'THANH_PHAM' ? FINISHED_GOODS_WAREHOUSE : null) ?? fallback ?? null;
          await tx.deliveryTripLoad.create({ data: { tripId: id, orderLineId: line.id, productId: line.productId, warehouseId: wh, quantity: q } });
          if (wh) {
            const m = byWarehouse.get(wh) ?? new Map<string, number>();
            m.set(line.productId, round4((m.get(line.productId) ?? 0) + q * line.ratioToBase.toNumber()));
            byWarehouse.set(wh, m);
          }
        }
        await tx.salesOrder.update({ where: { id: o.id }, data: { status: 'DANG_GIAO' } });
      }
      const voucherIds: string[] = [];
      for (const [warehouseId, m] of byWarehouse) {
        voucherIds.push(await this.inventory.post(tx, {
          type: 'XUAT', date: today, warehouseId, deliveryTripId: id, reason: `Xuất kho giao hàng — chuyến ${t.code}`,
          lines: [...m].map(([productId, quantity]) => ({ productId, quantity })),
        }, user.id));
      }
      await tx.deliveryTrip.update({ where: { id }, data: { status: 'DA_XUAT_KHO', shippedAt: new Date() } });
      const codes = await this.inventory.codes(tx, voucherIds);
      await this.log(tx, t, 'delivery_trip.ship', `Xuất kho chuyến ${t.code}: ${orderCodes.length} đơn chuyển sang Đang giao${codes.length ? ` · ${codes.join(', ')}` : ''}`,
        [...orderCodes, ...codes]);
    });
  }

  // ---------- chốt giao ----------

  /**
   * Chốt số khách thực nhận từng dòng (≤ số đã xếp lên xe). Công nợ phải thu follows; with "Thu tiền
   * ngay" the phiếu thu is made here. Nothing received at all → Trả toàn bộ.
   */
  confirm(id: string, orderId: string, lines: { lineIndex: number; received: number }[], note: string | undefined, user: AuthUser) {
    return this.step(id, ['DA_XUAT_KHO'], 'Chỉ chốt giao khi chuyến đã xuất kho.', async (tx, t) => {
      this.assertDriver(t, user);
      const link = t.orders.find((x) => x.orderId === orderId);
      if (!link) throw new BadRequestException('Đơn không nằm trên chuyến này.');
      if (link.confirmedAt) throw new BadRequestException('Đơn này đã chốt giao.');
      await assertOpenPeriod(tx, new Date().toISOString().slice(0, 10), 'Chốt giao');
      const o = await this.sales.locked(tx, orderId);
      if (o.status === 'HUY') throw new BadRequestException(`Đơn ${o.code} đã huỷ — không chốt giao được.`);
      const today = new Date().toISOString().slice(0, 10);
      const before = receivedValueOf(o.lines.map(saleLine), o.discountAmount.toNumber());
      for (const load of t.loads.filter((l) => l.orderLine.orderId === orderId)) {
        const asked = lines.find((x) => x.lineIndex === load.orderLine.sortOrder)?.received ?? 0;
        // No more than went on the truck, nor than the line still owes.
        const owed = lineRemaining(saleLine(o.lines.find((x) => x.id === load.orderLineId)!));
        const received = Math.min(Math.max(0, round4(asked)), load.quantity.toNumber(), owed);
        await tx.deliveryTripLoad.update({ where: { id: load.id }, data: { receivedQuantity: received } });
        if (received > 0) await tx.salesOrderLine.update({ where: { id: load.orderLineId }, data: { receivedQuantity: { increment: received } } });
      }
      await tx.deliveryTripOrder.update({ where: { tripId_orderId: { tripId: id, orderId } }, data: { confirmedAt: new Date(), confirmNote: note ?? null } });
      const receipts = (await this.afterReceipt(tx, orderId, before, today, user, false)) as Awaited<ReturnType<SalesService['syncPayNow']>>['receipts'];
      const after = (await this.ordersOf(tx, [orderId])).get(orderId)!;
      const got = receivedValueOf(after.lines.map(saleLine), after.discountAmount.toNumber()) - before;
      // One đợt công nợ for what the customer took off this chuyến.
      if (got > 0) await tx.salesOrderDelivery.create({ data: { orderId, date: fromDay(today)!, amount: got, tripId: id } });
      await this.log(tx, t, 'delivery_trip.confirm',
        `Chốt giao đơn ${o.code} trên chuyến ${t.code}: khách ${STATUS_AFTER[after.status] ?? 'nhận'} (${vnd(got)})`
          + (receipts.length ? ` · thu tiền ngay ${receipts.map((r) => r.code).join(', ')}` : '') + (note ? ` · ${note}` : ''),
        [o.code, ...receipts.map((r) => r.code)]);
      return { receipts };
    });
  }

  /** Bỏ chốt (before the truck is back): the received quantities are taken back, the order is Đang giao again. */
  unconfirm(id: string, orderId: string, user: AuthUser) {
    return this.step(id, ['DA_XUAT_KHO'], 'Chỉ bỏ chốt khi xe chưa về kho.', async (tx, t) => {
      this.assertDriver(t, user);
      const link = t.orders.find((x) => x.orderId === orderId);
      if (!link?.confirmedAt) throw new BadRequestException('Đơn này chưa chốt giao.');
      // Hàng khách đã trả lại phải còn nằm trong số đã nhận — bỏ chốt sau đó sẽ làm số trả lớn hơn số nhận.
      const returned = await tx.salesReturn.findFirst({ where: { orderId, isCancelled: false }, select: { code: true } });
      if (returned) throw new BadRequestException(`Đơn đã có phiếu trả hàng ${returned.code} — huỷ phiếu trả trước khi bỏ chốt giao.`);
      const o = await this.sales.locked(tx, orderId);
      const before = receivedValueOf(o.lines.map(saleLine), o.discountAmount.toNumber());
      for (const load of t.loads.filter((l) => l.orderLine.orderId === orderId)) {
        const got = load.receivedQuantity?.toNumber() ?? 0;
        if (got > 0) await tx.salesOrderLine.update({ where: { id: load.orderLineId }, data: { receivedQuantity: { decrement: got } } });
        await tx.deliveryTripLoad.update({ where: { id: load.id }, data: { receivedQuantity: null } });
      }
      await tx.deliveryTripOrder.update({ where: { tripId_orderId: { tripId: id, orderId } }, data: { confirmedAt: null, confirmNote: null } });
      await tx.salesOrderDelivery.deleteMany({ where: { orderId, tripId: id } });
      const cancelled = (await this.afterReceipt(tx, orderId, before, new Date().toISOString().slice(0, 10), user, true)) as string[];
      const voided = cancelled.length ? (await tx.cashVoucher.findMany({ where: { id: { in: cancelled } }, select: { code: true } })).map((v) => v.code) : [];
      const after = (await this.ordersOf(tx, [orderId])).get(orderId)!;
      const back = before - receivedValueOf(after.lines.map(saleLine), after.discountAmount.toNumber());
      await this.log(tx, t, 'delivery_trip.unconfirm',
        `Bỏ chốt giao đơn ${o.code} trên chuyến ${t.code}: bớt ${vnd(back)} công nợ, đơn về Đang giao`
          + (voided.length ? ` · huỷ phiếu thu ${voided.join(', ')}` : ''),
        [o.code, ...voided]);
      return { cancelledReceipts: cancelled };
    });
  }

  // Status, ngày giao and thu tiền ngay after a chốt / bỏ chốt.
  private async afterReceipt(tx: Tx, orderId: string, before: number, today: string, user: AuthUser, undo: boolean) {
    const o = (await this.ordersOf(tx, [orderId])).get(orderId)!;
    const lines = o.lines.map(saleLine);
    const anyReceived = lines.some((l) => l.receivedQuantity > 0);
    let status = o.status;
    if (undo) status = 'DANG_GIAO'; // the goods are still on the truck, even if an earlier chuyến delivered part
    else if (anyReceived) status = deriveStatus({ status: 'DANG_GIAO', lines, receivedValue: 1 }, [], () => false);
    else status = 'TRA_TOAN_BO';
    await tx.salesOrder.update({ where: { id: orderId }, data: { status, deliveredDate: anyReceived ? fromDay(today) : null, dueDate: null } });
    const delta = receivedValueOf(lines, o.discountAmount.toNumber()) - before;
    const r = await this.sales.syncPayNow(tx, { ...o, status }, delta, today, user.id);
    return undo ? r.cancelled : r.receipts;
  }

  // ---------- xe về kho / hoàn tất / huỷ ----------

  /** Hàng khách không nhận được nhập lại đúng kho đã xuất (phiếu "Nhập trả về"). */
  returnToWarehouse(id: string, user: AuthUser) {
    return this.step(id, ['DA_XUAT_KHO'], 'Chuyến chưa xuất kho hoặc đã về kho.', async (tx, t) => {
      if (t.orders.some((x) => !x.confirmedAt)) throw new BadRequestException('Còn đơn chưa chốt giao.');
      const orders = await this.ordersOf(tx, t.orders.map((x) => x.orderId));
      const byWarehouse = new Map<string, Map<string, number>>();
      const refs = new Set<string>();
      for (const l of t.loads) {
        if (!l.warehouseId) continue;
        const back = round4(l.quantity.toNumber() - (l.receivedQuantity?.toNumber() ?? 0));
        if (back <= 0) continue;
        const o = orders.get(l.orderLine.orderId)!;
        const ratio = o.lines.find((x) => x.id === l.orderLineId)!.ratioToBase.toNumber();
        const m = byWarehouse.get(l.warehouseId) ?? new Map<string, number>();
        m.set(l.productId, round4((m.get(l.productId) ?? 0) + back * ratio));
        byWarehouse.set(l.warehouseId, m);
        refs.add(o.code);
      }
      const today = new Date().toISOString().slice(0, 10);
      const voucherIds: string[] = [];
      const issued = byWarehouse.size ? await this.inventory.issuedCost(tx, { deliveryTripId: id }) : new Map<string, number>();
      for (const [warehouseId, m] of byWarehouse) {
        voucherIds.push(await this.inventory.post(tx, {
          type: 'NHAP', date: today, warehouseId, deliveryTripId: id, reason: `Nhập trả về — chuyến ${t.code} (${[...refs].join(', ')})`,
          // Hàng mang về goes back in at the giá vốn it left the kho at.
          lines: [...m].map(([productId, quantity]) => ({ productId, quantity, unitCost: issued.get(productId) })),
        }, user.id));
      }
      await tx.deliveryTrip.update({ where: { id }, data: { status: 'XE_VE_KHO', returnedAt: new Date() } });
      const codes = await this.inventory.codes(tx, voucherIds);
      await this.log(tx, t, 'delivery_trip.return',
        `Xe về kho, chuyến ${t.code}: ${codes.length ? `nhập lại hàng khách không nhận (${codes.join(', ')})` : 'khách nhận đủ, không có hàng nhập lại'}`,
        [...refs, ...codes]);
    });
  }

  complete(id: string) {
    return this.step(id, ['XE_VE_KHO'], 'Chỉ hoàn tất khi xe đã về kho.', async (tx, t) => {
      await tx.deliveryTrip.update({ where: { id }, data: { status: 'HOAN_TAT', completedAt: new Date() } });
      await this.log(tx, t, 'delivery_trip.complete', `Hoàn tất chuyến ${t.code}`);
    });
  }

  cancel(id: string, reason: string | undefined) {
    return this.step(id, ['GOM_DON'], 'Chuyến đã xuất kho — không huỷ được.', async (tx, t) => {
      const codes = (await tx.salesOrder.findMany({ where: { id: { in: t.orders.map((x) => x.orderId) } }, select: { code: true } })).map((o) => o.code);
      await tx.deliveryTripOrder.deleteMany({ where: { tripId: id } });
      await tx.deliveryTrip.update({ where: { id }, data: { status: 'HUY', cancelReason: reason ?? null } });
      await this.log(tx, t, 'delivery_trip.cancel',
        `Huỷ chuyến ${t.code}${codes.length ? `, giải phóng ${codes.length} đơn` : ''}${reason ? `: ${reason}` : ''}`, codes);
    });
  }

  // ---------- helpers ----------

  /** Chốt giao: the tài xế named on the chuyến, or whoever điều phối chuyến (trip.update). */
  private assertDriver(t: { code: string; driverName: string | null }, user: AuthUser): void {
    if (user.permissions.includes('trip.update')) return;
    const same = (a: string, b: string) => a.trim().localeCompare(b.trim(), 'vi', { sensitivity: 'base' }) === 0;
    if (!t.driverName || !same(t.driverName, user.name)) {
      throw new ForbiddenException(`Chỉ tài xế của chuyến ${t.code}${t.driverName ? ` (${t.driverName})` : ''} hoặc người điều phối mới chốt giao được.`);
    }
  }

  /** Lock the trip, check its status, run the change, answer the trip (plus what the change returns). */
  private step<R extends object | void>(id: string, allowed: DeliveryTripStatus[], refusal: string, change: (tx: Tx, t: TripRow) => Promise<R>) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "DeliveryTrip" WHERE "id" = ${id} FOR UPDATE`;
      const t = await tx.deliveryTrip.findUnique({ where: { id }, include: TRIP_INCLUDE });
      if (!t) throw new NotFoundException('Không tìm thấy chuyến giao hàng');
      if (!allowed.includes(t.status)) throw new BadRequestException(refusal);
      const extra = await change(tx, t);
      const trip = await this.trip(id, tx);
      const orders = await Promise.all(trip.orderIds.concat(t.orders.map((x) => x.orderId)).filter((v, i, a) => a.indexOf(v) === i).map((oid) => this.sales.order(oid, tx)));
      return { trip, orders, ...(extra ?? {}) };
    }, { timeout: 30_000 });
  }

  private async header(tx: Tx, h: TripHeaderInput) {
    const v = h.vehicleId ? await tx.vehicle.findUnique({ where: { id: h.vehicleId } }) : null;
    if (h.vehicleId && !v) throw new BadRequestException('Xe không tồn tại');
    return {
      date: fromDay(h.date)!, vehicleId: v?.id ?? null, plateNumber: v ? v.plateNumber : (h.plateNumber ?? null),
      driverName: h.driverName ?? null, driverPhone: h.driverPhone ?? null, note: h.note ?? null,
    };
  }

  private async ordersOf(db: Tx | PrismaService, ids: string[]) {
    const rows = await db.salesOrder.findMany({ where: { id: { in: [...new Set(ids)] } }, include: { lines: { orderBy: { sortOrder: 'asc' } } } });
    return new Map(rows.map((o) => [o.id, o]));
  }
}
