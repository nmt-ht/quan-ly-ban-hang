import {
  BadRequestException, Body, ConflictException, Controller, Get, HttpCode, HttpStatus, Injectable, Logger, Module, NotFoundException,
  OnModuleDestroy, OnModuleInit, Param, ParseUUIDPipe, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsISO8601, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { OptionalText } from '../../common/dto.js';
import { seal, unseal } from '../../common/company-secret.js';
import { assertOpenPeriod } from '../../common/period-lock.js';
import { toDay, vnDay } from '../../common/text.js';
import { multiTenant } from '../../platform/secret-box.js';
import { lockOrderFor, orderVisibleTo } from '../sales/order-access.js';
import { foreignCurrency, receivedValueOf } from '../sales/sales-order.rules.js';
import { InvoiceLine, InvoiceOrder, LineSlice, deliverySlices, invoiceData, receivedSlices } from '../sales/invoice.rules.js';
import {
  EINVOICE_PROVIDERS, EXTERNAL_PROVIDER, EInvoiceStatus, INVOICE_NUMBER, ProviderInvoice, SERIES, buyerIssue, buyerOf, canMove, invoiceRef, isLive,
  numberKey, parseInvoiceRef, partnerKey, seriesIssue, toProviderInvoice,
} from './einvoice.rules.js';
import { FakeProvider } from './providers/fake.provider.js';
import { EInvoiceProvider, ProviderResult, ProviderUnreachableError } from './providers/provider.js';

// ---------- DTOs ----------

export class EInvoiceSettingsDto {
  @IsIn(EINVOICE_PROVIDERS) provider!: (typeof EINVOICE_PROVIDERS)[number];
  @IsIn(['SANDBOX', 'PRODUCTION']) environment!: 'SANDBOX' | 'PRODUCTION';
  @OptionalText(300) baseUrl?: string;
  @OptionalText(200) username?: string;
  /** Write-only: absent = keep the stored one; "" = remove it. */
  @IsOptional() @IsString() @MaxLength(500) secret?: string;
  @IsIn(['1', '2']) templateCode!: '1' | '2';
  @OptionalText(6) @Matches(SERIES, { message: 'Ký hiệu hoá đơn không đúng dạng (ví dụ C26TAA)' }) series?: string;
  @IsBoolean() autoEmail!: boolean;
}

export class IssueDto {
  @IsUUID() orderId!: string;
  /** The đợt giao to invoice; absent = the whole đơn (an đơn whose đợt were recorded without chi tiết dòng). */
  @IsOptional() @IsUUID() deliveryId?: string;
  /** The đơn's updatedAt as the screen read it: refused when someone changed the đơn since. */
  @IsOptional() @IsISO8601() updatedAt?: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_IMPORT_ROWS = 500;
const MAX_EXPORT_ITEMS = 200;

/** Ghi nhận số of a hoá đơn issued outside the app. */
export class RecordDto {
  @IsUUID() orderId!: string;
  /** The đợt giao it was issued for; absent = the whole đơn. */
  @IsOptional() @IsUUID() deliveryId?: string;
  @IsIn(['1', '2']) templateCode!: '1' | '2';
  @Matches(SERIES, { message: 'Ký hiệu hoá đơn không đúng dạng (ví dụ C26TAA)' }) series!: string;
  @Matches(INVOICE_NUMBER, { message: 'Số hoá đơn gồm 1–8 chữ số' }) number!: string;
  @Matches(DAY, { message: 'Ngày hoá đơn phải có dạng YYYY-MM-DD' }) issueDate!: string;
  @IsOptional() @IsISO8601() updatedAt?: string;
}

export class RecordRowDto {
  /** The reference exported with the hoá đơn: the đơn's code, or `code#n` for its n-th đợt giao. */
  @IsString() @MaxLength(60) ref!: string;
  @IsOptional() @IsIn(['1', '2']) templateCode?: '1' | '2';
  @IsOptional() @Matches(SERIES, { message: 'Ký hiệu hoá đơn không đúng dạng (ví dụ C26TAA)' }) series?: string;
  @Matches(INVOICE_NUMBER, { message: 'Số hoá đơn gồm 1–8 chữ số' }) number!: string;
  @Matches(DAY, { message: 'Ngày hoá đơn phải có dạng YYYY-MM-DD' }) issueDate!: string;
}

export class ImportRecordsDto {
  /** true = only check and report; nothing is written. */
  @IsBoolean() dryRun!: boolean;
  @IsIn(['1', '2']) templateCode!: '1' | '2';
  /** Ký hiệu for the rows that do not carry their own. */
  @IsOptional() @Matches(SERIES, { message: 'Ký hiệu hoá đơn không đúng dạng (ví dụ C26TAA)' }) series?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(MAX_IMPORT_ROWS) @ValidateNested({ each: true }) @Type(() => RecordRowDto) rows!: RecordRowDto[];
}

export class ExportItemDto {
  @IsUUID() orderId!: string;
  @IsOptional() @IsUUID() deliveryId?: string;
}

export class ExportDataDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(MAX_EXPORT_ITEMS) @ValidateNested({ each: true }) @Type(() => ExportItemDto) items!: ExportItemDto[];
}

export class VoidDto {
  @IsString() @MinLength(3, { message: 'Nhập lý do gỡ (ít nhất 3 ký tự)' }) @MaxLength(300) reason!: string;
}

// ---------- service ----------

/** Seconds to the next status check, by how many checks were made. */
const BACKOFF = [10, 30, 120, 600, 1800, 3600];
const nextPoll = (attempts: number) => new Date(Date.now() + BACKOFF[Math.min(attempts, BACKOFF.length - 1)] * 1000);

const ORDER_FOR_INVOICE = {
  lines: { orderBy: { sortOrder: 'asc' } },
  deliveries: { include: { lines: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  customer: { include: { addresses: { orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }] } } },
} as const satisfies Prisma.SalesOrderInclude;

type OrderForInvoice = Prisma.SalesOrderGetPayload<{ include: typeof ORDER_FOR_INVOICE }>;

const n = (d: Prisma.Decimal | null | undefined) => (d == null ? null : d.toNumber());

/** The đơn in the shape the shared invoice rules take (same as the frontend's SalesOrder for these fields). */
function invoiceOrder(o: Pick<OrderForInvoice, 'lines' | 'discountAmount' | 'deliveries'>): InvoiceOrder {
  const lines: InvoiceLine[] = o.lines.map((l) => ({
    id: l.id, productId: l.productId, unit: l.unit, quantity: l.quantity.toNumber(), unitPrice: l.unitPrice.toNumber(),
    discountRate: n(l.discountRate), discountAmount: l.discountAmount.toNumber(), vatRate: l.vatRate.toNumber(),
    receivedQuantity: l.receivedQuantity.toNumber(), ratioToBase: l.ratioToBase.toNumber(), unitPriceFx: n(l.unitPriceFx),
    isGift: l.isGift, length: n(l.length), width: n(l.width),
  }));
  return {
    lines, discountAmount: o.discountAmount.toNumber(),
    deliveries: o.deliveries.map((d) => ({ id: d.id, lines: d.lines.map((x) => ({ orderLineId: x.orderLineId, quantity: x.quantity.toNumber() })) })),
  };
}

type EInvoiceRow = Prisma.EInvoiceGetPayload<object>;

/** The screens' hoá đơn: day-only dates, numbers, no provider secrets (there are none on the row). */
export function einvoiceToApi(r: EInvoiceRow) {
  return {
    ...r, issueDate: toDay(r.issueDate)!, taxable: r.taxable.toNumber(), vat: r.vat.toNumber(), total: r.total.toNumber(),
    exchangeRate: n(r.exchangeRate), totalFx: n(r.totalFx),
  };
}

@Injectable()
export class EInvoiceService {
  private readonly logger = new Logger('EInvoice');
  /** One FakeProvider per process: it keeps its hoá đơn in memory. */
  private fake?: FakeProvider;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async row() {
    return (await this.prisma.eInvoiceSettings.findUnique({ where: { id: 1 } })) ?? (await this.prisma.eInvoiceSettings.create({ data: { id: 1 } }));
  }

  /** What the settings screen may see: never the secret, only whether one is stored and still readable. */
  async settings() {
    const { secretSealed, ...s } = await this.row();
    return { ...s, hasSecret: !!secretSealed, secretReadable: !secretSealed || unseal(secretSealed) !== null, providers: EINVOICE_PROVIDERS };
  }

  async saveSettings(dto: EInvoiceSettingsDto, user: AuthUser) {
    const before = await this.row();
    if (dto.provider === 'MISA' && !(dto.username && (dto.secret || (dto.secret === undefined && before.secretSealed))))
      throw new BadRequestException('MISA meInvoice cần tài khoản và mật khẩu (hoặc app secret).');
    const secretSealed = dto.secret === undefined ? before.secretSealed : dto.secret === '' ? null : seal(dto.secret);
    const changed = dto.provider !== before.provider || dto.environment !== before.environment || (dto.baseUrl ?? null) !== before.baseUrl ||
      (dto.username ?? null) !== before.username || secretSealed !== before.secretSealed;
    await this.prisma.$transaction(async (tx) => {
      await tx.eInvoiceSettings.update({
        where: { id: 1 },
        data: {
          provider: dto.provider, environment: dto.environment, baseUrl: dto.baseUrl ?? null, username: dto.username ?? null, secretSealed,
          templateCode: dto.templateCode, series: dto.series ?? null, autoEmail: dto.autoEmail, verifiedAt: changed ? null : before.verifiedAt,
        },
      });
      await this.audit.log(tx, {
        action: 'einvoice.settings', entityType: 'EInvoiceSettings', entityId: '1',
        summary: `Sửa thiết lập hoá đơn điện tử (${dto.provider}, ${dto.environment === 'PRODUCTION' ? 'chính thức' : 'thử nghiệm'}, ký hiệu ${dto.templateCode}${dto.series ?? '—'})${dto.secret !== undefined ? ' · đổi mật khẩu' : ''}`,
        actor: { id: user.id, name: user.name },
      });
    });
    return this.settings();
  }

  /** The adapter for the saved settings. */
  private async provider(): Promise<{ adapter: EInvoiceProvider; settings: Awaited<ReturnType<EInvoiceService['row']>> }> {
    const s = await this.row();
    if (s.provider === 'NONE') throw new BadRequestException('Chưa chọn nhà cung cấp hoá đơn điện tử — vào Hệ thống › Hoá đơn điện tử.');
    if (s.provider === 'FAKE') {
      this.fake ??= new FakeProvider((series) => this.lastNumber(series).then((x) => x + 1));
      return { adapter: this.fake, settings: s };
    }
    // MISA meInvoice: the adapter comes with its sandbox account (task 9 of docs/ke-hoach-hoa-don-dien-tu.md).
    throw new BadRequestException('Kết nối MISA meInvoice chưa được cài đặt — tạm dùng "Thử nghiệm" để kiểm tra quy trình.');
  }

  /** The highest số hoá đơn issued in a ký hiệu (FakeProvider numbering). */
  private async lastNumber(series: string): Promise<number> {
    const [r] = await this.prisma.$queryRaw<{ max: number | null }[]>`
      SELECT MAX(CAST("number" AS INTEGER)) AS max FROM "EInvoice" WHERE "series" = ${series} AND "number" ~ '^[0-9]+$'`;
    return Number(r?.max ?? 0);
  }

  async testConnection(user: AuthUser) {
    const { adapter } = await this.provider();
    const message = await adapter.test();
    await this.prisma.$transaction(async (tx) => {
      await tx.eInvoiceSettings.update({ where: { id: 1 }, data: { verifiedAt: new Date() } });
      await this.audit.log(tx, { action: 'einvoice.test', entityType: 'EInvoiceSettings', entityId: '1', summary: `Kết nối thử hoá đơn điện tử: ${message}`, actor: { id: user.id, name: user.name } });
    });
    return { ok: true, message };
  }

  // ---------- building the hoá đơn of a đợt giao / đơn ----------

  private async orderFor(db: Prisma.TransactionClient | PrismaService, orderId: string, user: AuthUser): Promise<OrderForInvoice> {
    const o = await db.salesOrder.findFirst({ where: { id: orderId, ...orderVisibleTo(user) }, include: ORDER_FOR_INVOICE });
    if (!o) throw new NotFoundException('Không tìm thấy đơn hàng');
    return o;
  }

  /**
   * The hoá đơn gốc of one đợt giao (or of the whole đơn when its đợt have no chi tiết dòng), as it would be sent, plus
   * what it must equal: the công nợ booked for that đợt. Throws with the reason when it cannot be issued.
   */
  private async build(
    o: OrderForInvoice, deliveryId: string | undefined, settings: { templateCode: string; series: string | null }, key: string,
    opts: { lenient?: boolean; issueDate?: string } = {},
  ) {
    if (o.status === 'HUY') throw new BadRequestException(`${o.code} đã huỷ — không xuất hoá đơn.`);
    const io = invoiceOrder(o);
    let slices: LineSlice[];
    let issueDate: string;
    let booked: number;
    if (deliveryId) {
      const d = o.deliveries.find((x) => x.id === deliveryId);
      if (!d) throw new NotFoundException('Không tìm thấy đợt giao của đơn');
      if (!d.lines.length) throw new BadRequestException('Đợt giao này ghi trước khi có chi tiết từng dòng — xuất một hoá đơn cho cả đơn.');
      slices = deliverySlices(io, deliveryId);
      issueDate = toDay(d.date)!;
      booked = d.amount.toNumber();
    } else {
      if (o.deliveries.some((d) => d.lines.length)) throw new BadRequestException(`${o.code} giao theo đợt — xuất hoá đơn cho từng đợt.`);
      slices = receivedSlices(io);
      if (!slices.length) throw new BadRequestException(`${o.code} chưa giao hàng — hoá đơn lập khi chuyển giao hàng hoá cho người mua (NĐ 123, Điều 9).`);
      issueDate = toDay(o.deliveredDate) ?? toDay(o.deliveries.at(-1)?.date ?? null) ?? vnDay();
      booked = receivedValueOf(io.lines, io.discountAmount);
    }
    if (issueDate > vnDay()) throw new BadRequestException(`Ngày giao ${issueDate} sau hôm nay.`);
    // A hoá đơn already issued elsewhere (lenient): its ngày is the one on it, and what the app holds of the buyer is only a copy.
    if (opts.issueDate) issueDate = opts.issueDate;
    if (!opts.lenient) {
      const why = seriesIssue(settings.series, issueDate);
      if (why) throw new BadRequestException(why);
    }
    const c = o.customer;
    const buyer = buyerOf({ ...c, address: c.addresses[0]?.address ?? o.deliveryAddress });
    if (!opts.lenient) {
      const bad = buyerIssue(buyer);
      if (bad) throw new BadRequestException(bad);
    }
    const products = new Map(
      (await this.prisma.product.findMany({ where: { id: { in: [...new Set(o.lines.map((l) => l.productId))] } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]),
    );
    const code = foreignCurrency(o.currency);
    const rate = code && (o.exchangeRate?.toNumber() ?? 0) > 0 ? o.exchangeRate!.toNumber() : null;
    const name = (id: string) => products.get(id) ?? id;
    const data = invoiceData(io, slices, name, 1, rate);
    // The VND figures (what công nợ and the reports hold), whatever currency the hoá đơn is in.
    const vnd = rate ? invoiceData(io, slices, name, 1, null) : data;
    if (vnd.total !== booked) {
      throw new BadRequestException(`Tổng hoá đơn ${vnd.total.toLocaleString('vi-VN')} ₫ khác số đã ghi công nợ ${booked.toLocaleString('vi-VN')} ₫ — kiểm tra lại đợt giao trước khi xuất.`);
    }
    const inv: ProviderInvoice = toProviderInvoice(data, {
      key, kind: 'ORIGINAL', templateCode: settings.templateCode, series: settings.series ?? '', issueDate, buyer,
      currency: rate ? code! : 'VND', exchangeRate: rate ?? 1,
    });
    return { inv, vnd, fxTotal: rate ? data.total : null, rate, currency: rate ? code : null };
  }

  /** "Xem trước" exactly what Phát hành would send (or why it cannot be sent). */
  async preview(orderId: string, deliveryId: string | undefined, user: AuthUser) {
    const s = await this.row();
    const o = await this.orderFor(this.prisma, orderId, user);
    return (await this.build(o, deliveryId, s, 'xem-truoc')).inv;
  }

  /**
   * Phát hành the hoá đơn gốc of a đợt giao (or the whole đơn). The row goes in first, PENDING, with its idempotency key
   * — under the đơn's lock, so two clicks or two people make one hoá đơn (also a partial unique index) — and the provider
   * is called after the transaction: a slow provider never holds the lock, and an unknown outcome stays PENDING.
   */
  async issue(dto: IssueDto, user: AuthUser) {
    const { adapter, settings } = await this.provider();
    const created = await this.prisma.$transaction(async (tx) => {
      await lockOrderFor(tx, dto.orderId, user);
      const o = await this.orderFor(tx, dto.orderId, user);
      if (dto.updatedAt && new Date(dto.updatedAt).getTime() !== o.updatedAt.getTime())
        throw new ConflictException(`${o.code} vừa được người khác lưu — tải lại rồi xuất hoá đơn.`);
      const same = await tx.eInvoice.findMany({ where: { orderId: o.id, kind: 'ORIGINAL' }, select: { deliveryId: true, status: true, number: true } });
      const live = same.filter((x) => isLive(x.status));
      if (live.some((x) => x.deliveryId === (dto.deliveryId ?? null)))
        throw new ConflictException(dto.deliveryId ? 'Đợt giao này đã có hoá đơn điện tử.' : `${o.code} đã có hoá đơn điện tử.`);
      if (!dto.deliveryId && live.length) throw new ConflictException(`${o.code} đã xuất hoá đơn theo đợt — không xuất thêm hoá đơn cả đơn.`);
      const attempt = same.filter((x) => x.deliveryId === (dto.deliveryId ?? null)).length + 1;
      const key = partnerKey(o.code, { deliveryId: dto.deliveryId }, 'ORIGINAL', attempt);
      const b = await this.build(o, dto.deliveryId, settings, key);
      await assertOpenPeriod(tx, b.inv.issueDate, 'Hoá đơn điện tử');
      try {
        const row = await tx.eInvoice.create({
          data: {
            kind: 'ORIGINAL', status: 'PENDING', orderId: o.id, deliveryId: dto.deliveryId ?? null, partnerKey: key, provider: adapter.name,
            templateCode: b.inv.templateCode, series: b.inv.series, issueDate: new Date(`${b.inv.issueDate}T00:00:00Z`),
            buyer: b.inv.buyer as unknown as Prisma.InputJsonValue, lines: b.inv.lines as unknown as Prisma.InputJsonValue,
            taxable: b.vnd.taxable, vat: b.vnd.vat, total: b.vnd.total, currency: b.currency, exchangeRate: b.rate, totalFx: b.fxTotal,
            nextPollAt: nextPoll(0), createdById: user.id,
          },
        });
        await this.audit.log(tx, {
          action: 'einvoice.issue', entityType: 'EInvoice', entityId: row.id, entityCode: o.code,
          summary: `Gửi phát hành hoá đơn điện tử ${b.inv.templateCode}${b.inv.series} cho ${o.code}${dto.deliveryId ? ' (một đợt giao)' : ''} · ${b.vnd.total.toLocaleString('vi-VN')} ₫`,
          actor: { id: user.id, name: user.name },
        });
        return { row, inv: b.inv };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Hoá đơn này vừa được người khác gửi phát hành.');
        throw e;
      }
    });
    return this.send(created.row.id, () => adapter.issue(created.inv));
  }

  /** Calls the provider for one PENDING row and records what it answered; an unknown outcome stays PENDING. */
  private async send(id: string, call: () => Promise<ProviderResult>) {
    let result: ProviderResult;
    try {
      result = await call();
    } catch (e) {
      const unknown = e instanceof ProviderUnreachableError ? e.message : (e as Error)?.message ?? String(e);
      this.logger.warn(`EInvoice ${id}: no answer from the provider (${unknown}); will check again.`);
      const cur = await this.prisma.eInvoice.findUniqueOrThrow({ where: { id }, select: { attempts: true } });
      await this.prisma.eInvoice.update({
        where: { id },
        data: { error: `Chưa có phản hồi từ nhà cung cấp: ${unknown}`.slice(0, 500), attempts: { increment: 1 }, nextPollAt: nextPoll(cur.attempts + 1) },
      });
      return einvoiceToApi(await this.prisma.eInvoice.findUniqueOrThrow({ where: { id } }));
    }
    return einvoiceToApi(await this.record(id, result));
  }

  /** Writes a provider answer onto the row (only the moves canMove allows), and audits the outcome. */
  private async record(id: string, r: ProviderResult): Promise<EInvoiceRow> {
    return this.prisma.$transaction(async (tx) => {
      const cur = await tx.eInvoice.findUniqueOrThrow({ where: { id } });
      const to = r.state as EInvoiceStatus;
      if (!canMove(cur.status, to)) return cur;
      const row = await tx.eInvoice.update({
        where: { id },
        data: {
          status: to, providerRef: r.ref ?? cur.providerRef, number: r.number ?? cur.number, taxAuthorityCode: r.taxAuthorityCode ?? cur.taxAuthorityCode,
          lookupCode: r.lookupCode ?? cur.lookupCode, error: to === 'FAILED' ? (r.error ?? 'Nhà cung cấp từ chối hoá đơn.').slice(0, 500) : null,
          attempts: { increment: 1 }, nextPollAt: to === 'PENDING' ? nextPoll(cur.attempts + 1) : null,
        },
      });
      if (to !== cur.status && to !== 'PENDING') {
        await this.audit.log(tx, {
          action: to === 'ISSUED' ? 'einvoice.issued' : 'einvoice.failed', entityType: 'EInvoice', entityId: id,
          entityCode: row.number ? `${row.templateCode}${row.series}-${row.number}` : undefined,
          summary: to === 'ISSUED' ? `Đã phát hành hoá đơn ${row.templateCode}${row.series} số ${row.number}` : `Hoá đơn điện tử không phát hành được: ${row.error}`,
        });
      }
      return row;
    });
  }

  /**
   * Asks the provider about PENDING rows that are due — at most `limit`, each claimed (SKIP LOCKED, then moved a few
   * minutes ahead) so two app instances, or the poller and a screen, never check the same row at once.
   */
  async pollDue(limit = 20, orderId?: string): Promise<number> {
    const s = await this.row();
    if (s.provider === 'NONE') return 0;
    const claimed = await this.prisma.$queryRaw<{ id: string; partnerKey: string; providerRef: string | null }[]>`
      UPDATE "EInvoice" SET "nextPollAt" = now() + interval '5 minutes'
      WHERE "id" IN (
        SELECT "id" FROM "EInvoice"
        WHERE "status" = 'PENDING' AND "nextPollAt" <= now() ${orderId ? Prisma.sql`AND "orderId" = ${orderId}` : Prisma.empty}
        ORDER BY "nextPollAt" LIMIT ${limit} FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "partnerKey", "providerRef"`;
    if (!claimed.length) return 0;
    const { adapter } = await this.provider();
    for (const c of claimed) await this.send(c.id, () => adapter.status(c.partnerKey, c.providerRef));
    return claimed.length;
  }

  /** The hoá đơn of one đơn (checking the due PENDING ones first, so the screen sees fresh results in any mode). */
  async forOrder(orderId: string, user: AuthUser) {
    await this.orderFor(this.prisma, orderId, user);
    await this.pollDue(10, orderId).catch((e: Error) => this.logger.warn(`poll on read: ${e.message}`));
    const rows = await this.prisma.eInvoice.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } });
    return rows.map(einvoiceToApi);
  }

  /** "Kiểm tra lại": a PENDING one is asked about now; a FAILED one is sent again as a new attempt. */
  async retry(id: string, user: AuthUser) {
    const cur = await this.prisma.eInvoice.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException('Không tìm thấy hoá đơn điện tử');
    await this.orderFor(this.prisma, cur.orderId, user);
    if (cur.status === 'PENDING') {
      await this.prisma.eInvoice.update({ where: { id }, data: { nextPollAt: new Date(0) } });
      await this.pollDue(1, cur.orderId);
      return einvoiceToApi(await this.prisma.eInvoice.findUniqueOrThrow({ where: { id } }));
    }
    if (cur.status !== 'FAILED' || cur.kind !== 'ORIGINAL') throw new BadRequestException('Chỉ gửi lại được hoá đơn đang chờ hoặc bị lỗi.');
    return this.issue({ orderId: cur.orderId, deliveryId: cur.deliveryId ?? undefined }, user);
  }

  // ---------- hoá đơn phát hành ngoài phần mềm (cổng của nhà cung cấp, ví dụ MISA): ghi nhận số, xuất dữ liệu, nhập số về ----------

  /** The n-th đợt giao of an đơn (1 = first) — the order the reference in the exported file counts. */
  private deliveryIndex(o: { deliveries: { id: string }[] }, deliveryId: string | null | undefined): number | null {
    if (!deliveryId) return null;
    const i = o.deliveries.findIndex((d) => d.id === deliveryId);
    return i < 0 ? null : i + 1;
  }

  /**
   * Đợt giao (or whole đơn, when its đợt carry no chi tiết dòng) in [from, to] that still have no hoá đơn: what must be put on
   * the cổng of the nhà cung cấp. `ref` is the reference that goes in the exported file and comes back with the số hoá đơn.
   */
  async outstanding(q: { from: string; to: string; customerId?: string; search?: string }, user: AuthUser) {
    const gte = new Date(`${q.from}T00:00:00Z`), lte = new Date(`${q.to}T00:00:00Z`);
    const orders = await this.prisma.salesOrder.findMany({
      where: {
        status: { not: 'HUY' }, ...orderVisibleTo(user), ...(q.customerId ? { customerId: q.customerId } : {}),
        OR: [{ deliveries: { some: { date: { gte, lte } } } }, { deliveredDate: { gte, lte } }],
      },
      include: {
        lines: true, deliveries: { include: { lines: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        customer: { select: { name: true, companyName: true, companyTaxCode: true, personalTaxCode: true } },
        einvoices: { where: { kind: 'ORIGINAL' }, select: { deliveryId: true, status: true } },
      },
      orderBy: [{ orderDate: 'asc' }, { code: 'asc' }],
      take: 800,
    });
    const search = (q.search ?? '').trim().toLowerCase();
    const items: {
      ref: string; orderId: string; orderCode: string; deliveryId: string | null; date: string; customerName: string; taxCode: string; amount: number;
    }[] = [];
    for (const o of orders) {
      const live = o.einvoices.filter((e) => isLive(e.status));
      const name = o.customer.companyName?.trim() || o.customer.name;
      const taxCode = (o.customer.companyTaxCode || o.customer.personalTaxCode || '').trim();
      if (search && !`${o.code} ${name} ${taxCode}`.toLowerCase().includes(search)) continue;
      const io = invoiceOrder(o);
      const bySlice = o.deliveries.some((d) => d.lines.length);
      if (bySlice) {
        for (const [i, d] of o.deliveries.entries()) {
          const date = toDay(d.date)!;
          if (!d.lines.length || date < q.from || date > q.to || live.some((e) => e.deliveryId === d.id)) continue;
          items.push({ ref: invoiceRef(o.code, i + 1), orderId: o.id, orderCode: o.code, deliveryId: d.id, date, customerName: name, taxCode, amount: d.amount.toNumber() });
        }
      } else if (receivedSlices(io).length && !live.length) {
        const date = toDay(o.deliveredDate) ?? toDay(o.deliveries.at(-1)?.date ?? null) ?? vnDay();
        if (date < q.from || date > q.to) continue;
        items.push({ ref: invoiceRef(o.code, null), orderId: o.id, orderCode: o.code, deliveryId: null, date, customerName: name, taxCode, amount: receivedValueOf(io.lines, io.discountAmount) });
      }
    }
    items.sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));
    return { from: q.from, to: q.to, items, truncated: orders.length >= 800 };
  }

  /** The hoá đơn to be keyed or imported into the cổng of the nhà cung cấp, one per item, as the screen turns them into the Excel file. */
  async exportData(items: { orderId: string; deliveryId?: string }[], user: AuthUser) {
    const out: { orderId: string; deliveryId: string | null; ref?: string; orderCode?: string; invoice?: ProviderInvoice; error?: string }[] = [];
    for (const it of items) {
      try {
        const o = await this.orderFor(this.prisma, it.orderId, user);
        const b = await this.build(o, it.deliveryId, { templateCode: '1', series: null }, 'xuat-du-lieu', { lenient: true });
        out.push({ orderId: o.id, deliveryId: it.deliveryId ?? null, ref: invoiceRef(o.code, this.deliveryIndex(o, it.deliveryId)), orderCode: o.code, invoice: b.inv });
      } catch (e) {
        out.push({ orderId: it.orderId, deliveryId: it.deliveryId ?? null, error: (e as { message?: string }).message ?? String(e) });
      }
    }
    return out;
  }

  /**
   * Ghi nhận số of a hoá đơn gốc issued outside the app for one đợt giao (or the whole đơn). It becomes an ISSUED row (provider
   * EXTERNAL) so the bảng kê thuế bán ra, and the guards that stop changing hàng under a hoá đơn, work as for any hoá đơn. The
   * app checks what it can — the total must equal the công nợ of the đợt, the số must be new in its ký hiệu, the kỳ must be open.
   */
  async recordExternal(dto: RecordDto, user: AuthUser, dryRun = false) {
    const number = dto.number.trim();
    if (numberKey(number) === '0') throw new BadRequestException('Số hoá đơn bắt đầu từ 1.');
    if (dto.issueDate > vnDay()) throw new BadRequestException(`Ngày hoá đơn ${dto.issueDate} sau hôm nay.`);
    const why = seriesIssue(dto.series, dto.issueDate);
    if (why) throw new BadRequestException(why);
    return this.prisma.$transaction(async (tx) => {
      await lockOrderFor(tx, dto.orderId, user);
      const o = await this.orderFor(tx, dto.orderId, user);
      if (dto.updatedAt && new Date(dto.updatedAt).getTime() !== o.updatedAt.getTime())
        throw new ConflictException(`${o.code} vừa được người khác lưu — tải lại rồi ghi nhận hoá đơn.`);
      const same = await tx.eInvoice.findMany({ where: { orderId: o.id, kind: 'ORIGINAL' }, select: { deliveryId: true, status: true } });
      const live = same.filter((x) => isLive(x.status));
      if (live.some((x) => x.deliveryId === (dto.deliveryId ?? null)))
        throw new ConflictException(dto.deliveryId ? 'Đợt giao này đã có hoá đơn điện tử.' : `${o.code} đã có hoá đơn điện tử.`);
      if (!dto.deliveryId && live.length) throw new ConflictException(`${o.code} đã có hoá đơn theo đợt — không ghi nhận thêm hoá đơn cả đơn.`);
      const taken = await tx.$queryRaw<{ code: string | null }[]>`
        SELECT o."code" FROM "EInvoice" e JOIN "SalesOrder" o ON o."id" = e."orderId"
        WHERE e."templateCode" = ${dto.templateCode} AND e."series" = ${dto.series} AND ltrim(e."number", '0') = ${numberKey(number)}
          AND e."status" NOT IN ('FAILED', 'VOID') LIMIT 1`;
      if (taken.length) throw new ConflictException(`Hoá đơn ${dto.templateCode}${dto.series} số ${number} đã ghi nhận cho ${taken[0].code}.`);
      const attempt = same.filter((x) => x.deliveryId === (dto.deliveryId ?? null)).length + 1;
      const key = partnerKey(o.code, { deliveryId: dto.deliveryId }, 'ORIGINAL', attempt).replace(/-O(\d+)$/, '-X$1');
      const b = await this.build(o, dto.deliveryId, { templateCode: dto.templateCode, series: dto.series }, key, { lenient: true, issueDate: dto.issueDate });
      const day = toDay(o.deliveries.find((d) => d.id === dto.deliveryId)?.date ?? o.deliveredDate) ?? dto.issueDate;
      if (dto.issueDate < day) throw new BadRequestException(`Ngày hoá đơn ${dto.issueDate} trước ngày giao hàng ${day} — hoá đơn lập khi chuyển giao hàng hoá.`);
      await assertOpenPeriod(tx, dto.issueDate, 'Hoá đơn điện tử');
      if (dryRun) return null;
      try {
        const row = await tx.eInvoice.create({
          data: {
            kind: 'ORIGINAL', status: 'ISSUED', orderId: o.id, deliveryId: dto.deliveryId ?? null, partnerKey: key, provider: EXTERNAL_PROVIDER,
            templateCode: dto.templateCode, series: dto.series, number, issueDate: new Date(`${dto.issueDate}T00:00:00Z`),
            buyer: b.inv.buyer as unknown as Prisma.InputJsonValue, lines: b.inv.lines as unknown as Prisma.InputJsonValue,
            taxable: b.vnd.taxable, vat: b.vnd.vat, total: b.vnd.total, currency: b.currency, exchangeRate: b.rate, totalFx: b.fxTotal,
            createdById: user.id,
          },
        });
        await this.audit.log(tx, {
          action: 'einvoice.record', entityType: 'EInvoice', entityId: row.id, entityCode: o.code,
          summary: `Ghi nhận hoá đơn ${dto.templateCode}${dto.series} số ${number} (phát hành ngoài phần mềm) cho ${o.code}${dto.deliveryId ? ' (một đợt giao)' : ''} · ${b.vnd.total.toLocaleString('vi-VN')} ₫`,
          actor: { id: user.id, name: user.name },
        });
        return einvoiceToApi(row);
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Hoá đơn này vừa được người khác ghi nhận.');
        throw e;
      }
    });
  }

  /**
   * Số hoá đơn read back from the file the cổng exported: each row names (by `ref`) what it was made from. Rows that are not
   * ours (no such reference) are skipped, rows that break a rule are reported one by one, and the rest are recorded — or only
   * checked when `dryRun`, so the screen can show the outcome before anything is written.
   */
  async importRecords(dto: ImportRecordsDto, user: AuthUser) {
    const results: { index: number; ref: string; status: 'OK' | 'SKIPPED' | 'ERROR'; message?: string; orderCode?: string }[] = [];
    const seen = new Set<string>(); // số hoá đơn đã dùng trong file này (chạy thử không ghi nên không tự thấy trùng)
    for (const [index, row] of dto.rows.entries()) {
      const ref = row.ref.trim();
      const parsed = parseInvoiceRef(ref);
      if (!parsed) { results.push({ index, ref, status: 'SKIPPED', message: 'Không có mã tham chiếu đơn hàng.' }); continue; }
      const o = await this.prisma.salesOrder.findFirst({
        where: { code: parsed.orderCode, ...orderVisibleTo(user) },
        select: { id: true, code: true, deliveries: { select: { id: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
      });
      if (!o) { results.push({ index, ref, status: 'SKIPPED', message: `Không tìm thấy đơn ${parsed.orderCode}.` }); continue; }
      let deliveryId: string | undefined;
      if (parsed.deliveryIndex !== null) {
        deliveryId = o.deliveries[parsed.deliveryIndex - 1]?.id;
        if (!deliveryId) { results.push({ index, ref, status: 'ERROR', orderCode: o.code, message: `Đơn ${o.code} không có đợt giao thứ ${parsed.deliveryIndex}.` }); continue; }
      }
      const one: RecordDto = {
        orderId: o.id, deliveryId, templateCode: (row.templateCode ?? dto.templateCode) as '1' | '2', series: row.series ?? dto.series ?? '',
        number: row.number, issueDate: row.issueDate,
      };
      try {
        if (!SERIES.test(one.series)) throw new BadRequestException('Thiếu ký hiệu hoá đơn (ví dụ C26TAA).');
        const numberId = `${one.templateCode}|${one.series}|${numberKey(one.number)}`;
        if (seen.has(numberId)) throw new ConflictException(`Số hoá đơn ${one.number} trùng với một dòng trước trong file.`);
        await this.recordExternal(one, user, dto.dryRun);
        seen.add(numberId);
        results.push({ index, ref, status: 'OK', orderCode: o.code });
      } catch (e) {
        results.push({ index, ref, status: 'ERROR', orderCode: o.code, message: (e as { message?: string }).message ?? String(e) });
      }
    }
    return {
      dryRun: dto.dryRun, results,
      summary: { ok: results.filter((r) => r.status === 'OK').length, skipped: results.filter((r) => r.status === 'SKIPPED').length, errors: results.filter((r) => r.status === 'ERROR').length },
    };
  }

  /** "Gỡ ghi nhận" a hoá đơn recorded by mistake (or one the cổng later cancelled): the đợt can be recorded again. Not for a hoá đơn the app sent itself. */
  async voidRecord(id: string, dto: VoidDto, user: AuthUser) {
    const cur = await this.prisma.eInvoice.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException('Không tìm thấy hoá đơn điện tử');
    return this.prisma.$transaction(async (tx) => {
      await lockOrderFor(tx, cur.orderId, user);
      const row = await tx.eInvoice.findUniqueOrThrow({ where: { id }, include: { order: { select: { code: true } } } });
      if (row.provider !== EXTERNAL_PROVIDER) throw new BadRequestException('Chỉ gỡ ghi nhận được hoá đơn đã ghi nhận từ cổng ngoài; hoá đơn phát hành từ phần mềm cần lập hoá đơn điều chỉnh / thay thế.');
      if (row.status !== 'ISSUED') throw new BadRequestException('Hoá đơn này đã được gỡ hoặc không còn hiệu lực.');
      await assertOpenPeriod(tx, row.issueDate, 'Hoá đơn điện tử');
      const done = await tx.eInvoice.update({ where: { id }, data: { status: 'VOID', reason: dto.reason.trim() } });
      await this.audit.log(tx, {
        action: 'einvoice.void', entityType: 'EInvoice', entityId: id, entityCode: row.order.code,
        summary: `Gỡ ghi nhận hoá đơn ${row.templateCode}${row.series} số ${row.number} của ${row.order.code}: ${dto.reason.trim()}`,
        actor: { id: user.id, name: user.name },
      });
      return einvoiceToApi(done);
    });
  }

  /** Hoá đơn of a kỳ (hôm nay trở về 31 ngày trước by default), newest first. */
  async list(q: { from?: string; to?: string; status?: string; search?: string }, user: AuthUser) {
    const to = q.to ?? vnDay();
    const from = q.from ?? new Date(new Date(`${to}T00:00:00Z`).getTime() - 31 * 86_400_000).toISOString().slice(0, 10);
    const rows = await this.prisma.eInvoice.findMany({
      where: {
        issueDate: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) }, ...(q.status ? { status: q.status } : {}),
        order: orderVisibleTo(user),
      },
      include: { order: { select: { code: true, customer: { select: { name: true, companyName: true } } } } },
      orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
    const search = (q.search ?? '').trim().toLowerCase();
    return {
      from, to,
      rows: rows
        .map(({ order, ...r }) => ({ ...einvoiceToApi(r), orderCode: order.code, customerName: order.customer.companyName?.trim() || order.customer.name }))
        .filter((r) => !search || `${r.orderCode} ${r.customerName} ${r.number ?? ''} ${r.series}`.toLowerCase().includes(search)),
    };
  }
}

/**
 * Checks PENDING hoá đơn in the background (single-company mode). With nhiều doanh nghiệp there is no request — hence
 * no database — to run in, so there the screens' reads check their own đơn (EInvoiceService.forOrder) instead.
 * EINVOICE_POLL_MS sets the period (default 30 s; 0 turns it off).
 */
@Injectable()
export class EInvoicePoller implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('EInvoicePoller');
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly einvoices: EInvoiceService) {}

  onModuleInit() {
    const every = Number(process.env.EINVOICE_POLL_MS ?? 30_000);
    if (!every || multiTenant() || process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.tick(), every);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.einvoices.pollDue();
    } catch (e) {
      this.logger.warn(`poll: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}

// ---------- controller ----------

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('einvoice')
export class EInvoiceController {
  constructor(private readonly einvoices: EInvoiceService) {}

  @RequirePermissions('einvoice.settings')
  @Get('settings')
  settings() {
    return this.einvoices.settings();
  }

  @RequirePermissions('einvoice.settings')
  @Put('settings')
  saveSettings(@Body() dto: EInvoiceSettingsDto, @CurrentUser() user: AuthUser) {
    return this.einvoices.saveSettings(dto, user);
  }

  @RequirePermissions('einvoice.settings')
  @Post('settings/test')
  @HttpCode(HttpStatus.OK)
  test(@CurrentUser() user: AuthUser) {
    return this.einvoices.testConnection(user);
  }

  @RequirePermissions('einvoice.view')
  @Get('order/:orderId')
  forOrder(@Param('orderId', ParseUUIDPipe) orderId: string, @CurrentUser() user: AuthUser) {
    return this.einvoices.forOrder(orderId, user);
  }

  @RequirePermissions('einvoice.view')
  @Get('preview')
  preview(@Query('orderId', ParseUUIDPipe) orderId: string, @CurrentUser() user: AuthUser, @Query('deliveryId') deliveryId?: string) {
    return this.einvoices.preview(orderId, deliveryId || undefined, user);
  }

  @RequirePermissions('einvoice.issue')
  @Post('issue')
  @HttpCode(HttpStatus.OK)
  issue(@Body() dto: IssueDto, @CurrentUser() user: AuthUser) {
    return this.einvoices.issue(dto, user);
  }

  @RequirePermissions('einvoice.issue')
  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  retry(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.einvoices.retry(id, user);
  }

  // Hoá đơn phát hành ngoài phần mềm. Các đường tĩnh đặt trước ':id' để không bị ':id' nuốt.

  @RequirePermissions('einvoice.view')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string, @Query('status') status?: string, @Query('search') search?: string) {
    return this.einvoices.list({ from: dayOrUndefined(from), to: dayOrUndefined(to), status: status || undefined, search }, user);
  }

  @RequirePermissions('einvoice.view')
  @Get('outstanding')
  outstanding(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string, @Query('customerId') customerId?: string, @Query('search') search?: string) {
    const end = dayOrUndefined(to) ?? vnDay();
    const start = dayOrUndefined(from) ?? new Date(new Date(`${end}T00:00:00Z`).getTime() - 31 * 86_400_000).toISOString().slice(0, 10);
    if (start > end) throw new BadRequestException('Từ ngày phải trước đến ngày.');
    return this.einvoices.outstanding({ from: start, to: end, customerId: customerId || undefined, search }, user);
  }

  @RequirePermissions('einvoice.view')
  @Post('export-data')
  @HttpCode(HttpStatus.OK)
  exportData(@Body() dto: ExportDataDto, @CurrentUser() user: AuthUser) {
    return this.einvoices.exportData(dto.items, user);
  }

  @RequirePermissions('einvoice.issue')
  @Post('record')
  @HttpCode(HttpStatus.OK)
  record(@Body() dto: RecordDto, @CurrentUser() user: AuthUser) {
    return this.einvoices.recordExternal(dto, user);
  }

  @RequirePermissions('einvoice.issue')
  @Post('record/import')
  @HttpCode(HttpStatus.OK)
  importRecords(@Body() dto: ImportRecordsDto, @CurrentUser() user: AuthUser) {
    return this.einvoices.importRecords(dto, user);
  }

  @RequirePermissions('einvoice.issue')
  @Post(':id/void')
  @HttpCode(HttpStatus.OK)
  voidRecord(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VoidDto, @CurrentUser() user: AuthUser) {
    return this.einvoices.voidRecord(id, dto, user);
  }
}

const dayOrUndefined = (s?: string): string | undefined => {
  if (!s) return undefined;
  if (!DAY.test(s)) throw new BadRequestException('Ngày phải có dạng YYYY-MM-DD');
  return s;
};

@Module({
  controllers: [EInvoiceController],
  providers: [EInvoiceService, EInvoicePoller],
  exports: [EInvoiceService],
})
export class EInvoiceModule {}
