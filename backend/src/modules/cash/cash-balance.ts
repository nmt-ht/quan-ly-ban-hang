import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../../auth/auth.service.js';
import { fromDay } from '../../common/text.js';
import { vnd } from '../../audit/audit.diff.js';

/**
 * Không chi vượt tồn quỹ (as MISA): the account's số dư on `day` and today must both cover `amount` — a phiếu chi, or a
 * phiếu thu being huỷ (`cancelling`, its code), which takes its money back out of the quỹ (by hand, or by bỏ chốt giao).
 * The account row is locked so two at once queue up. voucher.overdraw goes ahead anyway: answers the note the Nhật ký
 * line carries then, '' when the quỹ covers it.
 */
export async function overdraw(
  tx: Prisma.TransactionClient, account: { id: string; name: string; openingBalance: Prisma.Decimal }, day: string, amount: number,
  user: AuthUser, cancelling?: string,
): Promise<string> {
  await tx.$queryRaw`SELECT "id" FROM "CashAccount" WHERE "id" = ${account.id} FOR UPDATE`;
  const balance = async (until?: Date) => {
    const sums = await tx.cashVoucher.groupBy({
      by: ['kind'], where: { accountId: account.id, isCancelled: false, ...(until ? { date: { lte: until } } : {}) }, _sum: { amount: true },
    });
    return sums.reduce((s, x) => s + (x.kind === 'THU' ? 1 : -1) * (x._sum.amount?.toNumber() ?? 0), account.openingBalance.toNumber());
  };
  const left = Math.min(await balance(fromDay(day)!), await balance());
  if (left >= amount) return '';
  if (!user.permissions.includes('voucher.overdraw')) {
    throw new BadRequestException(cancelling
      ? `Tồn quỹ ${account.name} chỉ còn ${vnd(left)} — huỷ ${cancelling} (${vnd(amount)}) sẽ làm quỹ âm.`
      : `Tồn quỹ ${account.name} chỉ còn ${vnd(left)} — không chi được ${vnd(amount)}.`);
  }
  return ` · ${cancelling ? 'huỷ làm quỹ âm' : 'chi vượt tồn quỹ'} (còn ${vnd(left)})`;
}
