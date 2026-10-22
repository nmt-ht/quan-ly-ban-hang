import { Prisma } from '@prisma/client';
import { toDay } from '../../common/text.js';

export const CASH_INCLUDE = { allocations: true, createdBy: { select: { email: true } } } as const satisfies Prisma.CashVoucherInclude;

export type CashVoucherRow = Prisma.CashVoucherGetPayload<{ include: typeof CASH_INCLUDE }>;

/** The frontend's CashVoucher: partnerId instead of customerId / supplierId, day-only date, creator e-mail. */
export function cashToApi(v: CashVoucherRow) {
  const { allocations, createdBy, createdById: _c, customerId, supplierId, ...rest } = v;
  return {
    ...rest, partnerId: customerId ?? supplierId, date: toDay(v.date)!, createdBy: createdBy.email,
    allocations: allocations.map((a) => ({ ref: a.ref, amount: a.amount })),
  };
}
