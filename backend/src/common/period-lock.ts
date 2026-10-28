// Khoá sổ kỳ kế toán (as MISA): a chứng từ dated on or before CompanyInfo.lockDate cannot be lập, sửa or huỷ — what is
// in a closed kỳ stays as it was reported. Thiết lập › Thông tin công ty moves the date (quyền period.lock).
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toDay, vnDay } from './text.js';

/** Refuses a change to a chứng từ dated `day` (YYYY-MM-DD or a Date) when that day is in the closed kỳ. */
export async function assertOpenPeriod(db: Pick<Prisma.TransactionClient, 'companyInfo'>, day: string | Date, what: string): Promise<void> {
  const lock = toDay((await db.companyInfo.findUnique({ where: { id: 1 }, select: { lockDate: true } }))?.lockDate ?? null);
  const d = typeof day === 'string' ? day.slice(0, 10) : toDay(day)!;
  if (lock && d <= lock) {
    const [y, m, dd] = lock.split('-');
    throw new BadRequestException(`${what} ngày ${d.split('-').reverse().join('/')} thuộc kỳ đã khoá sổ (đến ${dd}/${m}/${y}).`);
  }
}

const dmy = (d: string) => d.split('-').reverse().join('/');

/**
 * Ngày chứng từ of a nghiệp vụ (as MISA's ngày hạch toán): the day the user picked, else hôm nay in Việt Nam. Refused when
 * after hôm nay, before what it follows (`after`: [mốc, YYYY-MM-DD] — ngày đặt đơn, ngày xuất kho…), or in the closed kỳ.
 */
export async function documentDay(
  db: Pick<Prisma.TransactionClient, 'companyInfo'>, picked: string | undefined, what: string, after: [string, string | null | undefined][] = [],
): Promise<string> {
  const day = picked?.slice(0, 10) || vnDay();
  if (day > vnDay()) throw new BadRequestException(`${what}: ngày ${dmy(day)} sau hôm nay.`);
  for (const [label, d] of after) {
    if (d && day < d.slice(0, 10)) throw new BadRequestException(`${what}: ngày ${dmy(day)} trước ${label} (${dmy(d.slice(0, 10))}).`);
  }
  await assertOpenPeriod(db, day, what);
  return day;
}
