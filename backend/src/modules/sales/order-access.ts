import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../../auth/auth.service.js';

/**
 * "Xem đơn của mọi người bán": a seller (order.create) without order.view_all sees — and changes — only the orders
 * they sell or made. Roles that do not sell (Thủ kho, giao hàng) see every order: they ship them.
 */
export function orderVisibleTo(user: AuthUser): Prisma.SalesOrderWhereInput {
  const perms = user.permissions;
  if (perms.includes('order.view_all') || !perms.includes('order.create')) return {};
  return { OR: [{ salesRepId: user.id }, { createdById: user.id }] };
}

/**
 * Locks the order row for the rest of the transaction (two changes at once queue up) and refuses an order `user` may
 * not see, as if it did not exist.
 */
export async function lockOrderFor(tx: Prisma.TransactionClient, id: string, user: AuthUser): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "SalesOrder" WHERE "id" = ${id} FOR UPDATE`;
  if (!(await tx.salesOrder.count({ where: { id, ...orderVisibleTo(user) } }))) throw new NotFoundException('Không tìm thấy đơn hàng');
}
