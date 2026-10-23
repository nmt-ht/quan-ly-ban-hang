/**
 * Seed DỮ LIỆU GIẢ (demo) cho bản dựng lại Ninh Trang ERP.
 *
 * - Nguồn dữ liệu: prisma/demo-data.json (sinh bởi tools/gen-demo-data.mjs).
 * - Chạy SAU `npm run prisma:seed` (cần sẵn Role, Permission, CompanyInfo).
 * - Idempotent: nếu đã có khách hàng KH0000001 thì bỏ qua.
 * - KHÔNG chạy trên môi trường production thật.
 *
 * Cách chạy:
 *   DEMO_USER_PASSWORD='mat-khau-tu-dat' npm run prisma:seed:demo
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

/* eslint-disable @typescript-eslint/no-explicit-any */
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const D = (s?: string | null) => (s ? new Date(s) : undefined);

async function main() {
  const password = process.env.DEMO_USER_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error('Cần đặt biến môi trường DEMO_USER_PASSWORD (tối thiểu 8 ký tự) cho các user demo.');
  }
  // Hosts such as Render set NODE_ENV=production everywhere; a demo server opts in with SEED_DEMO=true.
  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO !== 'true') {
    throw new Error('Từ chối chạy seed dữ liệu giả khi NODE_ENV=production (đặt SEED_DEMO=true nếu đây là server demo).');
  }

  const data: any = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'demo-data.json'), 'utf8'));

  if (await prisma.customer.findUnique({ where: { code: 'KH0000001' } })) {
    console.log('Đã có dữ liệu demo (KH0000001) — bỏ qua.');
    return;
  }

  // ---- Danh mục: dùng bản ghi có sẵn theo tên, thiếu thì tạo (id = key) ----
  const wh: Record<string, string> = {};
  for (const w of data.warehouses) {
    const ex = await prisma.warehouse.findFirst({ where: { name: w.name } });
    wh[w.id] = ex ? ex.id : (await prisma.warehouse.create({ data: { id: w.id, name: w.name } })).id;
  }
  const cat: Record<string, string> = {};
  for (const c of data.categories) {
    const ex = await prisma.productCategory.findFirst({ where: { name: c.name } });
    cat[c.id] = ex ? ex.id : (await prisma.productCategory.create({ data: { id: c.id, name: c.name } })).id;
  }
  const acc: Record<string, string> = {};
  for (const a of data.accounts) {
    const ex = await prisma.cashAccount.findFirst({ where: { name: a.name } });
    // Existing (base seed) accounts take the demo's bank details too.
    acc[a.id] = ex
      ? (await prisma.cashAccount.update({ where: { id: ex.id }, data: { ...a, id: undefined } })).id
      : (await prisma.cashAccount.create({ data: a })).id;
  }

  // ---- Thẻ ----
  const tagMap: Record<string, string> = {};
  for (const t of data.tags) {
    const ex = await prisma.tag.findFirst({ where: { name: t.name } });
    tagMap[t.id] = ex
      ? ex.id
      : (await prisma.tag.create({ data: { id: t.id, name: t.name, color: t.color, sortOrder: t.sortOrder, isActive: t.isActive } })).id;
  }

  // ---- Người dùng ----
  const passwordHash = await bcrypt.hash(password, 10);
  const user: Record<string, string> = {};
  for (const u of data.users) {
    const role = await prisma.role.findFirst({ where: { name: u.roleName } });
    if (!role) throw new Error(`Thiếu chức vụ "${u.roleName}" — hãy chạy npm run prisma:seed trước.`);
    const row = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        id: u.key, // same id as the frontend demo (vehicles point at user-taixe…)
        name: u.name, email: u.email, passwordHash, roleId: role.id,
        status: u.status, lastLoginAt: D(u.lastLoginAt),
      },
    });
    user[u.key] = row.id;
  }

  // ---- Hàng hoá ----
  for (const p of data.products) {
    await prisma.product.create({
      data: {
        id: p.id, code: p.code, name: p.name, type: p.type, baseUnit: p.baseUnit,
        crossRefCode: p.crossRefCode,
        categoryId: p.categoryKey ? cat[p.categoryKey] : undefined,
        defaultWarehouseId: p.warehouseKey ? wh[p.warehouseKey] : undefined,
        minStock: p.minStock, vatRate: p.vatRate, warrantyMonths: p.warrantyMonths,
        origin: p.origin, retailPrice: p.retailPrice, wholesalePrice: p.wholesalePrice,
        dropshipPrice: p.dropshipPrice, purchaseNote: p.purchaseNote, saleNote: p.saleNote,
        description: p.description, isSellable: p.isSellable, isActive: p.isActive,
        unitConversions: { create: (p.unitConversions ?? []).map((c: any) => ({
          unitName: c.unitName, ratioToBaseUnit: c.ratioToBaseUnit, price: c.price,
        })) },
      },
    });
  }
  await prisma.bomLine.createMany({ data: data.bomLines.map((b: any) => ({
    finishedProductId: b.finishedProductId, componentId: b.componentId, quantityPerUnit: b.quantityPerUnit,
  })) });

  // ---- Đối tác ----
  await prisma.supplier.createMany({ data: data.suppliers.map((s: any) => ({ ...s, createdAt: D(s.createdAt) })) });
  await prisma.supplierProduct.createMany({ data: data.supplierProducts });
  for (const c of data.customers) {
    const { tagIds: tIds, addresses, createdAt, ...rest } = c;
    await prisma.customer.create({
      data: {
        ...rest, createdAt: D(createdAt),
        tags: { create: (tIds ?? []).map((t: string) => ({ tagId: tagMap[t] })) },
        addresses: { create: (addresses ?? []).map((a: any, i: number) => ({ ...a, sortOrder: i })) },
      },
    });
  }

  // ---- Đơn nhập hàng ----
  for (const o of data.purchaseOrders) {
    await prisma.purchaseOrder.create({
      data: {
        id: o.id, code: o.code, supplierId: o.supplierId, date: new Date(o.date), status: o.status,
        receivedDate: D(o.receivedDate),
        createdById: user[o.createdByKey],
        lines: { create: o.lines.map((l: any, i: number) => ({
          id: l.id, productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, receivedQuantity: l.receivedQuantity, sortOrder: i,
        })) },
      },
    });
  }

  // ---- Đơn bán hàng ----
  for (const o of data.salesOrders) {
    await prisma.salesOrder.create({
      data: {
        id: o.id, code: o.code, customerId: o.customerId,
        recipientName: o.recipientName, recipientPhone: o.recipientPhone,
        description: o.description, source: o.source,
        orderDate: new Date(o.orderDate), neededByDate: D(o.neededByDate),
        status: o.status, discountAmount: o.discountAmount,
        deliveredDate: D(o.deliveredDate), dueDate: D(o.dueDate),
        salesRepId: o.salesRepKey ? user[o.salesRepKey] : undefined,
        createdById: user[o.createdByKey],
        tags: { create: (o.tagIds ?? []).map((t: string) => ({ tagId: tagMap[t] })) },
        lines: { create: o.lines.map((l: any, i: number) => ({
          id: l.id, productId: l.productId, unit: l.unit, quantity: l.quantity, unitPrice: l.unitPrice, sortOrder: i,
          length: l.length, width: l.width, note: l.note, receivedQuantity: l.receivedQuantity ?? 0,
        })) },
      },
    });
  }

  // ---- Lệnh sản xuất ----
  for (const p of data.productionOrders) {
    await prisma.productionOrder.create({
      data: {
        id: p.id, code: p.code, sourceOrderId: p.sourceOrderId, productId: p.productId,
        quantity: p.quantity, status: p.status, bomSnapshot: p.bomSnapshot, createdAt: D(p.createdAt),
        startDate: D(p.startDate), completeDate: D(p.completeDate), producedQuantity: p.producedQuantity,
      },
    });
  }

  // ---- Xe & chuyến giao ----
  await prisma.vehicle.createMany({ data: data.vehicles.map((v: any) => ({
    ...v, createdAt: D(v.createdAt), registrationExpiry: D(v.registrationExpiry), insuranceExpiry: D(v.insuranceExpiry),
  })) });
  for (const t of data.deliveryTrips) {
    // Loads point at the order line by its index on the order; chốt giao fills their received quantity.
    const lineId = (orderId: string, index: number) => data.salesOrders.find((o: any) => o.id === orderId).lines[index].id;
    const confirmed = new Map<string, any>((t.confirmations ?? []).map((c: any) => [c.orderId, c]));
    await prisma.deliveryTrip.create({
      data: {
        id: t.id, code: t.code, date: new Date(t.date), driverName: t.driverName, driverPhone: t.driverPhone,
        plateNumber: t.plateNumber, vehicleId: t.vehicleId, status: t.status, note: t.note,
        shippedAt: D(t.shippedAt), returnedAt: D(t.returnedAt), completedAt: D(t.completedAt), cancelReason: t.cancelReason,
        fuelCost: t.costs?.fuel ?? 0, tollCost: t.costs?.toll ?? 0, otherCost: t.costs?.other ?? 0, costNote: t.costs?.note,
        createdById: user[t.createdByKey],
        orders: { create: t.orderIds.map((orderId: string, i: number) => ({
          orderId, sortOrder: i, confirmedAt: D(confirmed.get(orderId)?.confirmedAt), confirmNote: confirmed.get(orderId)?.note,
        })) },
        loads: { create: (t.loads ?? []).map((l: any) => ({
          orderLineId: lineId(l.orderId, l.lineIndex), productId: l.productId, warehouseId: l.warehouseId, quantity: l.quantity,
          receivedQuantity: confirmed.get(l.orderId)?.lines.find((x: any) => x.lineIndex === l.lineIndex)?.received,
        })) },
      },
    });
  }

  // ---- Phiếu kho & tồn kho ----
  for (const v of data.warehouseVouchers) {
    await prisma.warehouseVoucher.create({
      data: {
        id: v.id, code: v.code, type: v.type, date: new Date(v.date),
        warehouseId: wh[v.warehouseKey],
        targetWarehouseId: v.targetWarehouseKey ? wh[v.targetWarehouseKey] : undefined,
        reason: v.reason, isCancelled: v.isCancelled, createdById: user[v.createdByKey],
        lines: { create: v.lines.map((l: any, i: number) => ({
          productId: l.productId, quantity: l.quantity, delta: l.delta ?? l.quantity, unitPrice: l.unitPrice ?? 0, sortOrder: i,
        })) },
      },
    });
  }
  await prisma.stockLevel.createMany({ data: data.stockLevels.map((s: any) => ({
    productId: s.productId, warehouseId: wh[s.warehouseKey], quantity: s.quantity,
  })) });

  // ---- Phiếu thu/chi & số dư quỹ ----
  for (const c of data.cashVouchers) {
    await prisma.cashVoucher.create({
      data: {
        id: c.id, code: c.code, date: new Date(c.date), kind: c.kind, category: c.category,
        partnerType: c.partnerType, customerId: c.customerId, supplierId: c.supplierId,
        accountId: acc[c.accountKey], amount: c.amount, settledAmount: c.settledAmount,
        description: c.description, isCancelled: c.isCancelled, createdById: user[c.createdByKey],
      },
    });
  }
  // Số dư quỹ is not stored: the API derives it from the vouchers above (data.cashAccountBalances is the check).

  console.log('Đã nạp dữ liệu demo:', {
    khachHang: data.customers.length, donBan: data.salesOrders.length,
    donNhap: data.purchaseOrders.length, lenhSanXuat: data.productionOrders.length,
  });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
