import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ContractKind, attachIssue } from './contracts.rules.js';

type Db = PrismaService | Prisma.TransactionClient;

/**
 * Đơn bán / đơn mua gắn vào hợp đồng ("Thực hiện hợp đồng"): checked on the order's save. A contract of the other kind or of
 * another partner is refused; a contract already thanh lý / huỷ takes no new order, but an order already on it stays editable.
 * Returns the contract's mã (for the audit line), or null when no contract is given.
 */
export async function checkContractLink(
  db: Db, contractId: string | undefined | null, want: ContractKind, partnerId: string, currentContractId: string | null = null,
): Promise<string | null> {
  if (!contractId) return null;
  const c = await db.contract.findUnique({ where: { id: contractId } });
  if (!c) throw new BadRequestException('Hợp đồng không tồn tại');
  const issue = attachIssue(c, want, partnerId, contractId === currentContractId);
  if (issue) throw new BadRequestException(issue);
  return c.code;
}
