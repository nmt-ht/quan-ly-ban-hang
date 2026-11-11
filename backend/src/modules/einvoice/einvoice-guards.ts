// A hoá đơn điện tử that was sent is a legal record: the đợt giao, số lượng and phiếu trả hàng it was made from may not
// change under it. The services that change them call these inside their own transaction. (FAILED attempts are not
// hoá đơn — they are removed with the đợt they were for.)
import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

const LIVE = { status: { not: 'FAILED' } } as const;

const label = (r: { templateCode: string; series: string; number: string | null; status: string }) =>
  r.number ? `${r.templateCode}${r.series} số ${r.number}` : `${r.templateCode}${r.series} (đang chờ phát hành)`;

/**
 * Before đợt giao of an đơn are removed (bỏ chốt giao): refused while one of them — or the đơn as a whole — has a hoá
 * đơn sent; FAILED attempts for them are deleted so the đợt can go.
 */
export async function releaseDeliveries(tx: Prisma.TransactionClient, orderId: string, deliveryIds: string[], orderCode: string): Promise<void> {
  if (!deliveryIds.length) return;
  const live = await tx.eInvoice.findFirst({
    where: { orderId, kind: 'ORIGINAL', ...LIVE, OR: [{ deliveryId: { in: deliveryIds } }, { deliveryId: null }] },
    select: { templateCode: true, series: true, number: true, status: true },
  });
  if (live) {
    throw new BadRequestException(
      `Đơn ${orderCode} đã xuất hoá đơn điện tử ${label(live)} cho hàng đã giao — không bỏ chốt giao được. Lập hoá đơn điều chỉnh / thay thế, hoặc ghi phiếu trả hàng.`,
    );
  }
  await tx.eInvoice.deleteMany({ where: { deliveryId: { in: deliveryIds }, status: 'FAILED' } });
}

/** Before a phiếu trả hàng is huỷ: refused while its hoá đơn điều chỉnh is sent (a huỷ would need another điều chỉnh). */
export async function assertReturnNotInvoiced(tx: Prisma.TransactionClient, returnId: string, returnCode: string): Promise<void> {
  const live = await tx.eInvoice.findFirst({
    where: { returnId, ...LIVE }, select: { templateCode: true, series: true, number: true, status: true },
  });
  if (live) throw new BadRequestException(`${returnCode} đã có hoá đơn điều chỉnh ${label(live)} — không huỷ phiếu trả hàng được.`);
}
