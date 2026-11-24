import {
  BadRequestException, Body, Controller, Get, Injectable, NotFoundException, Post, UseGuards,
} from '@nestjs/common';
import { IsIn, IsNumber, IsOptional, IsPositive, Matches } from 'class-validator';
import { Prisma, ProductionCostKind } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OptionalText, Text } from '../../common/dto.js';
import { fromDay, toDay } from '../../common/text.js';
import { documentDay } from '../../common/period-lock.js';
import { AuditService } from '../../audit/audit.service.js';
import { vnd } from '../../audit/audit.diff.js';
import { LedgerService } from './ledger.service.js';

type Tx = Prisma.TransactionClient;
const r0 = (n: number) => Math.round(n);
const num = (d: Prisma.Decimal | null | undefined) => (d ? d.toNumber() : 0);
const CREDIT_ACCOUNTS = ['334', '111', '112', '331', '214', '242'] as const;

/** Vật tư kho chuyển vào sản xuất: bán thành phẩm lấy từ 155, còn lại từ 156 (cùng cách mua hàng đang ghi). */
const stockAccountOf = (type: string) => (type === 'THANH_PHAM' ? '155' : '156');

interface Lsx { id: string; code: string; productId: string }

/**
 * Giá thành sản xuất (TK 154). Chi phí vật tư lấy từ các phiếu xuất kho của lệnh (đúng số hệ thống đã chốt giá vốn),
 * nhân công và sản xuất chung nhập qua ProductionCost. Mọi bút toán chỉ ghi khi sổ cái đã bật tại ngày liên quan.
 */
@Injectable()
export class ProductionAccountingService {
  constructor(private readonly ledger: LedgerService) {}

  /** Vật tư đã xuất cho lệnh (phiếu chưa huỷ), tính theo giá vốn lúc xuất, tách theo TK kho. */
  async materialIssued(tx: Tx, orderId: string) {
    const lines = await tx.warehouseVoucherLine.findMany({
      where: { voucher: { productionOrderId: orderId, type: 'XUAT', isCancelled: false } },
      select: { delta: true, unitCost: true, product: { select: { type: true, avgCost: true } } },
    });
    const byAccount = new Map<string, number>();
    for (const l of lines) {
      const cost = l.unitCost ?? l.product.avgCost;
      const acc = stockAccountOf(l.product.type);
      byAccount.set(acc, (byAccount.get(acc) ?? 0) + l.delta.toNumber() * cost.toNumber());
    }
    const parts = [...byAccount].map(([accountCode, amount]) => ({ accountCode, amount: r0(amount) })).filter((p) => p.amount > 0);
    return { total: parts.reduce((s, p) => s + p.amount, 0), parts, hasLines: lines.length > 0 };
  }

  /** Nhân công + sản xuất chung đã nhập thêm cho lệnh. */
  async extraCost(tx: Tx, orderId: string) {
    const rows = await tx.productionCost.findMany({ where: { orderId }, select: { amount: true } });
    return r0(rows.reduce((s, r) => s + num(r.amount), 0));
  }

  /** Tổng giá thành đã tập hợp của lệnh (vật tư + chi phí thêm) — dùng làm giá vốn thành phẩm khi nghiệm thu. */
  async totalCost(tx: Tx, orderId: string) {
    const [m, extra] = await Promise.all([this.materialIssued(tx, orderId), this.extraCost(tx, orderId)]);
    return { material: m.total, extra, total: m.total + extra, hasMaterial: m.hasLines };
  }

  /** Bắt đầu sản xuất: Nợ 154 / Có 156, 155 (vật tư đã xuất). */
  async onStart(tx: Tx, x: Lsx, date: string, userId: string) {
    if (!(await this.ledger.isLedgerActive(tx, date))) return;
    const m = await this.materialIssued(tx, x.id);
    if (m.total <= 0) return;
    await this.ledger.postEntry(tx, {
      date, source: 'PRODUCTION', refType: 'ProductionOrder', refId: x.id, createdById: userId,
      description: `Xuất vật tư sản xuất ${x.code}`,
      lines: [{ accountCode: '154', debit: m.total }, ...m.parts.map((p) => ({ accountCode: p.accountCode, credit: p.amount }))],
    });
  }

  /**
   * Nghiệm thu: Nợ 155 / Có 154 giá thành đã tập hợp. Làm được 0 thì toàn bộ là hao hụt: Nợ 632 / Có 154.
   * Dùng số liệu phía kho (vật tư xuất + chi phí thêm) để TK 155 luôn khớp giá trị tồn kho thành phẩm.
   */
  async onComplete(tx: Tx, x: Lsx, produced: number, date: string, userId: string) {
    if (!(await this.ledger.isLedgerActive(tx, date))) return;
    const { total } = await this.totalCost(tx, x.id);
    if (total <= 0) return;
    let target = '632';
    let description = `Hao hụt sản xuất ${x.code} (không nhập được thành phẩm)`;
    if (produced > 0) {
      const p = await tx.product.findUnique({ where: { id: x.productId }, select: { type: true } });
      target = stockAccountOf(p?.type ?? 'THANH_PHAM');
      description = `Nhập kho thành phẩm ${x.code}`;
    }
    await this.ledger.postEntry(tx, {
      date, source: 'PRODUCTION', refType: 'ProductionOrder', refId: x.id, createdById: userId, description,
      lines: [{ accountCode: target, debit: total }, { accountCode: '154', credit: total }],
    });
  }

  /** Huỷ lệnh: vật tư đã xuất không tự về kho, nên chi phí đã tập hợp ghi vào giá vốn: Nợ 632 / Có 154. */
  async onCancel(tx: Tx, x: Lsx, date: string, userId: string) {
    if (!(await this.ledger.isLedgerActive(tx, date))) return;
    const { total } = await this.totalCost(tx, x.id);
    if (total <= 0) return;
    await this.ledger.postEntry(tx, {
      date, source: 'PRODUCTION', refType: 'ProductionOrder', refId: x.id, createdById: userId,
      description: `Huỷ lệnh sản xuất ${x.code}: chi phí dở dang chuyển vào giá vốn`,
      lines: [{ accountCode: '632', debit: total }, { accountCode: '154', credit: total }],
    });
  }
}

export class ProductionCostDto {
  @Text(60) orderId!: string;
  @IsIn(['NHAN_CONG', 'SAN_XUAT_CHUNG']) kind!: ProductionCostKind;
  @IsNumber() @IsPositive({ message: 'Số tiền phải lớn hơn 0' }) amount!: number;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày phải có dạng YYYY-MM-DD' }) date!: string;
  @IsIn(CREDIT_ACCOUNTS as unknown as string[], { message: 'TK đối ứng phải là 334, 111, 112, 331, 214 hoặc 242' }) creditAccount!: string;
  @IsOptional() @OptionalText(300) description?: string;
}

@Injectable()
export class ProductionCostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  /** Bảng giá thành từng lệnh sản xuất. */
  async list() {
    const orders = await this.prisma.productionOrder.findMany({
      where: { status: { not: 'HUY' } }, orderBy: { createdAt: 'desc' }, take: 200,
      select: { id: true, code: true, status: true, quantity: true, producedQuantity: true, product: { select: { code: true, name: true } } },
    });
    const ids = orders.map((o) => o.id);
    const [lines, costs] = await Promise.all([
      this.prisma.warehouseVoucherLine.findMany({
        where: { voucher: { productionOrderId: { in: ids }, type: 'XUAT', isCancelled: false } },
        select: { delta: true, unitCost: true, product: { select: { avgCost: true } }, voucher: { select: { productionOrderId: true } } },
      }),
      this.prisma.productionCost.findMany({ where: { orderId: { in: ids } }, select: { orderId: true, kind: true, amount: true } }),
    ]);
    const material = new Map<string, number>();
    for (const l of lines) {
      const id = l.voucher.productionOrderId!;
      material.set(id, (material.get(id) ?? 0) + l.delta.toNumber() * (l.unitCost ?? l.product.avgCost).toNumber());
    }
    const labor = new Map<string, number>(), overhead = new Map<string, number>();
    for (const c of costs) {
      const m = c.kind === 'NHAN_CONG' ? labor : overhead;
      m.set(c.orderId, (m.get(c.orderId) ?? 0) + num(c.amount));
    }
    return orders.map((o) => {
      const mat = r0(material.get(o.id) ?? 0), lab = r0(labor.get(o.id) ?? 0), ovh = r0(overhead.get(o.id) ?? 0);
      const total = mat + lab + ovh;
      const qty = o.producedQuantity ? o.producedQuantity.toNumber() : o.quantity.toNumber();
      return {
        id: o.id, code: o.code, status: o.status, productCode: o.product.code, productName: o.product.name,
        quantity: o.quantity.toNumber(), produced: o.producedQuantity?.toNumber() ?? null,
        material: mat, labor: lab, overhead: ovh, total, unitCost: qty > 0 ? r0(total / qty) : 0,
      };
    });
  }

  /** Nhập chi phí nhân công / sản xuất chung cho lệnh chưa nghiệm thu: Nợ 154 / Có TK đối ứng. */
  async addCost(dto: ProductionCostDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.productionOrder.findUnique({ where: { id: dto.orderId }, select: { id: true, code: true, status: true } });
      if (!order) throw new NotFoundException('Không tìm thấy lệnh sản xuất.');
      if (order.status !== 'NHAP' && order.status !== 'DANG_SAN_XUAT') {
        throw new BadRequestException('Chỉ nhập chi phí cho lệnh đang ở trạng thái Nháp hoặc Đang sản xuất.');
      }
      const day = await documentDay(tx, dto.date, 'Chi phí sản xuất');
      const cost = await tx.productionCost.create({
        data: {
          orderId: order.id, kind: dto.kind, amount: dto.amount, date: fromDay(day)!,
          description: dto.description ?? null, creditAccount: dto.creditAccount, createdById: user.id,
        },
      });
      if (await this.ledger.isLedgerActive(tx, day)) {
        await this.ledger.postEntry(tx, {
          date: day, source: 'PRODUCTION', refType: 'ProductionOrder', refId: order.id, createdById: user.id,
          description: `${dto.kind === 'NHAN_CONG' ? 'Nhân công' : 'Sản xuất chung'} ${order.code}${dto.description ? ' - ' + dto.description : ''}`,
          lines: [{ accountCode: '154', debit: dto.amount }, { accountCode: dto.creditAccount, credit: dto.amount }],
        });
      }
      await this.audit.log(tx, {
        action: 'production_cost.create', entityType: 'ProductionOrder', entityId: order.id, entityCode: order.code,
        summary: `Chi phí ${dto.kind === 'NHAN_CONG' ? 'nhân công' : 'sản xuất chung'} ${vnd(dto.amount)} cho ${order.code}`,
      });
      return { id: cost.id, date: toDay(cost.date) };
    });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('accounting/production-costs')
export class ProductionCostsController {
  constructor(private readonly svc: ProductionCostsService) {}

  @RequirePermissions('accounting.view')
  @Get()
  list() {
    return this.svc.list();
  }

  @RequirePermissions('accounting.manual')
  @Post()
  add(@Body() dto: ProductionCostDto, @CurrentUser() user: AuthUser) {
    return this.svc.addCost(dto, user);
  }
}
