import { BadRequestException, Injectable } from '@nestjs/common';
import { JournalSource, PartnerType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SequenceService } from '../../prisma/sequence.service.js';
import { assertOpenPeriod } from '../../common/period-lock.js';
import { fromDay, toDay } from '../../common/text.js';

export interface LedgerLineInput {
  accountCode: string;
  debit?: number;
  credit?: number;
  partnerType?: PartnerType | null;
  customerId?: string | null;
  supplierId?: string | null;
  description?: string | null;
}

export interface PostEntryInput {
  date: string; // YYYY-MM-DD (ngày hạch toán)
  description?: string | null;
  source?: JournalSource;
  refType?: string | null;
  refId?: string | null;
  createdById: string;
  isReversal?: boolean;
  lines: LedgerLineInput[];
}

const r0 = (n: number) => Math.round(n);

/**
 * Lõi ghi sổ kế toán kép. Các hàm nhận `tx` (Prisma.TransactionClient) để bút toán nằm CÙNG
 * transaction với nghiệp vụ gốc (đợt giao hàng, phiếu thu/chi, nhận mua…). Bút toán bất biến:
 * muốn sửa thì ghi bút toán đảo (reverseEntriesFor).
 */
@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService, private readonly sequences: SequenceService) {}

  /** Sổ cái đã bật (CompanyInfo.ledgerStartDate) và ngày chứng từ nằm trong phạm vi ghi sổ? */
  async isLedgerActive(tx: Prisma.TransactionClient, day: string): Promise<boolean> {
    const info = await tx.companyInfo.findUnique({ where: { id: 1 }, select: { ledgerStartDate: true } });
    const start = toDay(info?.ledgerStartDate ?? null);
    return !!start && day.slice(0, 10) >= start;
  }

  /** Ghi một bút toán cân Nợ = Có. Trả về id bút toán. */
  async postEntry(tx: Prisma.TransactionClient, input: PostEntryInput): Promise<string> {
    const day = input.date.slice(0, 10);
    const lines = input.lines
      .map((l) => ({
        accountCode: String(l.accountCode),
        debit: r0(l.debit ?? 0),
        credit: r0(l.credit ?? 0),
        partnerType: l.partnerType ?? null,
        customerId: l.customerId ?? null,
        supplierId: l.supplierId ?? null,
        description: l.description ?? null,
      }))
      .filter((l) => l.debit !== 0 || l.credit !== 0);

    if (lines.length < 2) throw new BadRequestException('Bút toán phải có ít nhất 2 dòng.');
    for (const l of lines) {
      if (l.debit < 0 || l.credit < 0) throw new BadRequestException('Số tiền Nợ/Có không được âm.');
      if (l.debit !== 0 && l.credit !== 0) throw new BadRequestException('Mỗi dòng chỉ ghi Nợ hoặc Có.');
    }
    const totalD = lines.reduce((s, l) => s + l.debit, 0);
    const totalC = lines.reduce((s, l) => s + l.credit, 0);
    if (totalD !== totalC) throw new BadRequestException(`Bút toán không cân: tổng Nợ ${totalD} ≠ tổng Có ${totalC}.`);
    if (totalD <= 0) throw new BadRequestException('Tổng tiền bút toán phải lớn hơn 0.');

    await assertOpenPeriod(tx, day, 'Ghi sổ');

    const codes = [...new Set(lines.map((l) => l.accountCode))];
    const accts = await tx.account.findMany({ where: { code: { in: codes } }, select: { code: true, isDetail: true } });
    const byCode = new Map(accts.map((a) => [a.code, a]));
    for (const c of codes) {
      const a = byCode.get(c);
      if (!a) throw new BadRequestException(`Tài khoản ${c} không tồn tại.`);
      if (!a.isDetail) throw new BadRequestException(`Tài khoản ${c} là TK tổng hợp, không ghi trực tiếp.`);
    }

    const code = await this.sequences.nextCode('BT', tx);
    const entry = await tx.journalEntry.create({
      data: {
        code,
        date: fromDay(day)!,
        description: input.description ?? null,
        source: input.source ?? 'MANUAL',
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        isReversal: input.isReversal ?? false,
        createdById: input.createdById,
        lines: { create: lines },
      },
    });
    return entry.id;
  }

  /**
   * Ghi bút toán cho một phiếu thu/chi (dùng chung cho phiếu lập tay và "thu tiền ngay").
   * Bỏ qua nếu sổ cái chưa bật, hoặc loại thu/chi chưa map TK đối ứng (Thiết lập có thể bổ sung sau).
   *   THU: Nợ 111/112 / Có <đối ứng>   ·   CHI: Nợ <đối ứng> / Có 111/112
   */
  async postCashVoucher(tx: Prisma.TransactionClient, voucherId: string, createdById: string): Promise<void> {
    const v = await tx.cashVoucher.findUnique({ where: { id: voucherId }, include: { account: true } });
    if (!v) return;
    const day = toDay(v.date)!;
    if (!(await this.isLedgerActive(tx, day))) return;
    const cat = await tx.cashCategory.findFirst({ where: { kind: v.kind, name: v.category } });
    const counter = cat?.defaultAccountCode;
    if (!counter) return; // chưa khai TK đối ứng cho loại này
    const cashCode = v.account.type === 'NGAN_HANG' ? '112' : '111';
    const amount = v.amount.toNumber();
    const partner = { partnerType: v.partnerType, customerId: v.customerId, supplierId: v.supplierId };
    const lines = v.kind === 'THU'
      ? [{ accountCode: cashCode, debit: amount }, { accountCode: counter, credit: amount, ...partner }]
      : [{ accountCode: counter, debit: amount, ...partner }, { accountCode: cashCode, credit: amount }];
    await this.postEntry(tx, {
      date: day, source: 'CASH_VOUCHER', refType: 'CashVoucher', refId: v.id, createdById,
      description: `${v.kind === 'THU' ? 'Phiếu thu' : 'Phiếu chi'} ${v.code}${v.description ? ' - ' + v.description : ''}`,
      lines,
    });
  }

  /** Đảo bút toán của một phiếu thu/chi khi huỷ phiếu. */
  async cancelCashVoucher(tx: Prisma.TransactionClient, voucherId: string, createdById: string): Promise<void> {
    const v = await tx.cashVoucher.findUnique({ where: { id: voucherId }, select: { date: true, code: true } });
    if (!v) return;
    const day = toDay(v.date)!;
    if (!(await this.isLedgerActive(tx, day))) return;
    await this.reverseEntriesFor(tx, 'CashVoucher', voucherId, { date: day, createdById, description: `Huỷ phiếu ${v.code}` });
  }

  /** Đảo toàn bộ bút toán đã ghi cho một chứng từ gốc (khi huỷ/trả). Trả về số bút toán đã đảo. */
  async reverseEntriesFor(
    tx: Prisma.TransactionClient,
    refType: string,
    refId: string,
    opts: { date: string; createdById: string; description?: string },
  ): Promise<number> {
    const entries = await tx.journalEntry.findMany({ where: { refType, refId, isReversal: false }, include: { lines: true } });
    let n = 0;
    for (const e of entries) {
      if (e.lines.length === 0) continue;
      await this.postEntry(tx, {
        date: opts.date,
        source: 'REVERSAL',
        refType,
        refId,
        createdById: opts.createdById,
        isReversal: true,
        description: opts.description ?? `Đảo bút toán ${e.code}`,
        lines: e.lines.map((l) => ({
          accountCode: l.accountCode,
          debit: l.credit.toNumber(),
          credit: l.debit.toNumber(),
          partnerType: l.partnerType,
          customerId: l.customerId,
          supplierId: l.supplierId,
          description: `Đảo: ${l.description ?? ''}`.trim(),
        })),
      });
      n++;
    }
    return n;
  }
}
