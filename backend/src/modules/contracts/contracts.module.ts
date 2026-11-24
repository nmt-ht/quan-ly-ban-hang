import {
  BadRequestException, Body, ConflictException, Controller, Get, HttpCode, HttpStatus, Injectable, Module, NotFoundException, Param, Post, Put, UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IsEnum, IsISO8601, IsNumber, IsOptional, Matches, Min } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { OptionalDay, OptionalText, Text } from '../../common/dto.js';
import { fromDay, toDay, vnDay } from '../../common/text.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SequenceService } from '../../prisma/sequence.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { diff, vnd } from '../../audit/audit.diff.js';
import { orderVisibleTo } from '../sales/order-access.js';
import { orderTotals, receivedValueOf as saleReceived, type SaleLine } from '../sales/sales-order.rules.js';
import { totalValueOf, receivedValueOf as purchaseReceived, type LineNumbers } from '../purchasing/purchase-order.rules.js';
import { closeIssue, partyIssue, progressOf, termsIssue } from './contracts.rules.js';
import type { ContractKind, ContractStatus } from './contracts.rules.js';

type Tx = Prisma.TransactionClient;
type Db = PrismaService | Tx;

export class ContractDto {
  @IsEnum(['BAN', 'MUA'], { message: 'Loại hợp đồng phải là bán hoặc mua' }) kind!: ContractKind;
  @OptionalText(60) contractNo?: string;
  @Text(300) title!: string;
  @OptionalText(60) customerId?: string;
  @OptionalText(60) supplierId?: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày ký phải có dạng YYYY-MM-DD' }) signedDate!: string;
  @OptionalDay() startDate?: string;
  @OptionalDay() endDate?: string;
  @IsNumber() @Min(0, { message: 'Giá trị hợp đồng không được âm' }) value!: number;
  @OptionalText(1000) paymentTerms?: string;
  @OptionalText(2000) description?: string;
  @OptionalText(200) owner?: string; // e-mail của người phụ trách
  @IsOptional() @IsISO8601() updatedAt?: string;
}

export class CloseContractDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày phải có dạng YYYY-MM-DD' }) date!: string;
  @OptionalText(500) note?: string;
}

const INCLUDE = {
  customer: { select: { code: true, name: true, companyName: true } },
  supplier: { select: { code: true, name: true } },
  owner: { select: { email: true } },
  createdBy: { select: { email: true } },
} as const satisfies Prisma.ContractInclude;

type Row = Prisma.ContractGetPayload<{ include: typeof INCLUDE }>;

const FIELDS = {
  contractNo: 'Số hợp đồng', title: 'Trích yếu', party: 'Đối tác', signedDate: 'Ngày ký', startDate: 'Hiệu lực từ', endDate: 'Hiệu lực đến',
  value: 'Giá trị hợp đồng', paymentTerms: 'Điều khoản thanh toán', description: 'Diễn giải', owner: 'Người phụ trách',
};

export interface OrderRef { id: string; code: string; date: string; status: string; total: number; received: number }
interface Metrics { orderCount: number; orderValue: number; receivedValue: number }
const NO_METRICS: Metrics = { orderCount: 0, orderValue: 0, receivedValue: 0 };

/** The frontend's Contract: day-only dates, e-mails for people, the partner's mã / tên, and the value of the orders linked to it. */
export function contractToApi(c: Row, m: Metrics = NO_METRICS, orders?: OrderRef[]) {
  const party = c.kind === 'BAN' ? c.customer : c.supplier;
  const p = progressOf(c.value.toNumber(), m.orderValue);
  return {
    id: c.id, code: c.code, kind: c.kind, contractNo: c.contractNo, title: c.title,
    customerId: c.customerId, supplierId: c.supplierId,
    partnerId: c.customerId ?? c.supplierId, partnerCode: party?.code ?? '', partnerName: (c.kind === 'BAN' ? c.customer?.companyName : null) || party?.name || '',
    signedDate: toDay(c.signedDate)!, startDate: toDay(c.startDate), endDate: toDay(c.endDate),
    value: c.value.toNumber(), paymentTerms: c.paymentTerms, description: c.description,
    status: c.status, closedDate: toDay(c.closedDate), closeNote: c.closeNote,
    owner: c.owner?.email ?? '', createdBy: c.createdBy.email, createdAt: c.createdAt, updatedAt: c.updatedAt,
    orderCount: m.orderCount, orderValue: m.orderValue, receivedValue: m.receivedValue,
    percent: p.percent, remaining: p.remaining, over: p.over,
    ...(orders ? { orders } : {}),
  };
}

/**
 * Hợp đồng (HDB… bán / HDM… mua): thoả thuận khung với khách hoặc nhà cung cấp. Chỉ theo dõi — không ghi sổ, không động kho.
 * Đang thực hiện → sửa; Thanh lý / Huỷ là một chiều. Người xem hợp đồng bán cần order.view, hợp đồng mua cần purchase.view (giá
 * trị đơn mua là giá nhập); người bán chỉ thấy danh sách đơn của mình trong hợp đồng, nhưng tổng giá trị là của cả hợp đồng.
 */
@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly audit: AuditService,
  ) {}

  private kindsOf(user: AuthUser): ContractKind[] {
    return [...(user.permissions.includes('order.view') ? ['BAN' as const] : []), ...(user.permissions.includes('purchase.view') ? ['MUA' as const] : [])];
  }

  async list(user: AuthUser) {
    const rows = await this.prisma.contract.findMany({
      where: { kind: { in: this.kindsOf(user) } }, include: INCLUDE, orderBy: [{ signedDate: 'desc' }, { code: 'desc' }],
    });
    const metrics = await this.metrics(this.prisma, rows.map((r) => r.id));
    return rows.map((r) => contractToApi(r, metrics.get(r.id)));
  }

  async one(id: string, user: AuthUser) {
    const c = await this.prisma.contract.findFirst({ where: { id, kind: { in: this.kindsOf(user) } }, include: INCLUDE });
    if (!c) throw new NotFoundException('Không tìm thấy hợp đồng');
    return this.detail(this.prisma, c, user);
  }

  /** The contract with the orders linked to it (a seller without order.view_all sees only their own). */
  private async detail(db: Db, c: Row, user: AuthUser) {
    const m = (await this.metrics(db, [c.id])).get(c.id);
    const orders: OrderRef[] = [];
    if (c.kind === 'BAN') {
      const rows = await db.salesOrder.findMany({ where: { contractId: c.id, ...orderVisibleTo(user) }, include: { lines: true }, orderBy: [{ orderDate: 'desc' }, { code: 'desc' }] });
      for (const o of rows) {
        const nums = o.lines.map(saleLine);
        orders.push({ id: o.id, code: o.code, date: toDay(o.orderDate)!, status: o.status, total: orderTotals(nums, o.discountAmount.toNumber()).total, received: saleReceived(nums, o.discountAmount.toNumber()) });
      }
    } else {
      const rows = await db.purchaseOrder.findMany({ where: { contractId: c.id }, include: { lines: true }, orderBy: [{ date: 'desc' }, { code: 'desc' }] });
      for (const o of rows) {
        const nums = o.lines.map(purchaseLine);
        orders.push({ id: o.id, code: o.code, date: toDay(o.date)!, status: o.status, total: totalValueOf(nums), received: purchaseReceived(nums) });
      }
    }
    return contractToApi(c, m, orders);
  }

  /** Giá trị các đơn (không tính đơn đã huỷ) gắn vào mỗi hợp đồng. */
  private async metrics(db: Db, ids: string[]): Promise<Map<string, Metrics>> {
    const out = new Map<string, Metrics>();
    if (!ids.length) return out;
    const add = (id: string | null, total: number, received: number) => {
      if (!id) return;
      const m = out.get(id) ?? { ...NO_METRICS };
      m.orderCount++; m.orderValue += total; m.receivedValue += received;
      out.set(id, m);
    };
    const [sales, purchases] = await Promise.all([
      db.salesOrder.findMany({ where: { contractId: { in: ids }, status: { not: 'HUY' } }, include: { lines: true } }),
      db.purchaseOrder.findMany({ where: { contractId: { in: ids }, status: { not: 'HUY' } }, include: { lines: true } }),
    ]);
    for (const o of sales) {
      const nums = o.lines.map(saleLine);
      const d = o.discountAmount.toNumber();
      add(o.contractId, orderTotals(nums, d).total, saleReceived(nums, d));
    }
    for (const o of purchases) {
      const nums = o.lines.map(purchaseLine);
      add(o.contractId, totalValueOf(nums), purchaseReceived(nums));
    }
    return out;
  }

  create(dto: ContractDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const refs = await this.check(tx, dto, user);
      const c = await tx.contract.create({
        data: {
          ...fields(dto), kind: dto.kind, code: await this.sequences.nextCode(dto.kind === 'BAN' ? 'HDB' : 'HDM', tx),
          customerId: dto.kind === 'BAN' ? dto.customerId! : null, supplierId: dto.kind === 'MUA' ? dto.supplierId! : null, ownerId: refs.ownerId, createdById: user.id,
        },
        include: INCLUDE,
      });
      await this.audit.log(tx, {
        action: 'contract.create', entityType: 'Contract', entityId: c.id, entityCode: c.code,
        summary: `Lập hợp đồng ${dto.kind === 'BAN' ? 'bán' : 'mua'} ${c.code} · ${refs.partner} · ${vnd(c.value)}`, related: [refs.partnerCode],
      });
      return this.detail(tx, c, user);
    });
  }

  update(id: string, dto: ContractDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const c = await this.locked(tx, id, user);
      if (dto.updatedAt && new Date(dto.updatedAt).getTime() !== c.updatedAt.getTime()) {
        throw new ConflictException(`${c.code} vừa được người khác lưu — tải lại để xem bản mới rồi sửa tiếp.`);
      }
      if (c.status !== 'DANG_THUC_HIEN') throw new BadRequestException(`Hợp đồng ${c.code} đã ${c.status === 'HUY' ? 'huỷ' : 'thanh lý'} — không sửa được.`);
      if (dto.kind !== c.kind) throw new BadRequestException('Không đổi được loại hợp đồng (bán / mua). Lập hợp đồng mới nếu cần.');
      const refs = await this.check(tx, dto, user);
      const samePartner = (c.kind === 'BAN' ? dto.customerId : dto.supplierId) === (c.customerId ?? c.supplierId);
      if (!samePartner && (await this.linkedOrders(tx, c.id, c.kind)) > 0) {
        throw new BadRequestException(`${c.code} đã có đơn gắn vào — không đổi đối tác được. Gỡ các đơn khỏi hợp đồng trước.`);
      }
      const before = await this.described(c);
      const next = await tx.contract.update({
        where: { id },
        data: { ...fields(dto), customerId: dto.kind === 'BAN' ? dto.customerId! : null, supplierId: dto.kind === 'MUA' ? dto.supplierId! : null, ownerId: refs.ownerId },
        include: INCLUDE,
      });
      await this.audit.log(tx, {
        action: 'contract.update', entityType: 'Contract', entityId: id, entityCode: c.code, summary: `Sửa hợp đồng ${c.code}`,
        changes: diff(before, await this.described(next), FIELDS),
      });
      return this.detail(tx, next, user);
    });
  }

  /** Thanh lý (hai bên xong việc) or huỷ bỏ: one-way, stamped with the day and a note. */
  close(id: string, status: Exclude<ContractStatus, 'DANG_THUC_HIEN'>, dto: CloseContractDto, user: AuthUser, today: string) {
    return this.prisma.$transaction(async (tx) => {
      const c = await this.locked(tx, id, user);
      const issue = closeIssue({ status: c.status, signedDate: toDay(c.signedDate)! }, dto.date, today);
      if (issue) throw new BadRequestException(issue);
      const next = await tx.contract.update({ where: { id }, data: { status, closedDate: fromDay(dto.date), closeNote: dto.note ?? null }, include: INCLUDE });
      await this.audit.log(tx, {
        action: status === 'HUY' ? 'contract.cancel' : 'contract.liquidate', entityType: 'Contract', entityId: id, entityCode: c.code,
        summary: `${status === 'HUY' ? 'Huỷ' : 'Thanh lý'} hợp đồng ${c.code} ngày ${dto.date}${dto.note ? `: ${dto.note}` : ''}`,
      });
      return this.detail(tx, next, user);
    });
  }

  private linkedOrders(tx: Tx, contractId: string, kind: ContractKind): Promise<number> {
    return kind === 'BAN' ? tx.salesOrder.count({ where: { contractId } }) : tx.purchaseOrder.count({ where: { contractId } });
  }

  private async locked(tx: Tx, id: string, user: AuthUser): Promise<Row> {
    await tx.$queryRaw`SELECT "id" FROM "Contract" WHERE "id" = ${id} FOR UPDATE`;
    const c = await tx.contract.findFirst({ where: { id, kind: { in: this.kindsOf(user) } }, include: INCLUDE });
    if (!c) throw new NotFoundException('Không tìm thấy hợp đồng');
    return c;
  }

  /** Right party for the kind, the party and người phụ trách exist, the terms hold together. */
  private async check(tx: Tx, dto: ContractDto, user: AuthUser) {
    if (!this.kindsOf(user).includes(dto.kind)) throw new NotFoundException('Không tìm thấy hợp đồng');
    const issue = partyIssue(dto.kind, dto.customerId, dto.supplierId) ?? termsIssue(dto);
    if (issue) throw new BadRequestException(issue);
    let partner: string; let partnerCode: string;
    if (dto.kind === 'BAN') {
      const x = await tx.customer.findUnique({ where: { id: dto.customerId! }, select: { code: true, name: true } });
      if (!x) throw new BadRequestException('Khách hàng không tồn tại');
      [partner, partnerCode] = [`${x.code} ${x.name}`, x.code];
    } else {
      const x = await tx.supplier.findUnique({ where: { id: dto.supplierId! }, select: { code: true, name: true } });
      if (!x) throw new BadRequestException('Nhà cung cấp không tồn tại');
      [partner, partnerCode] = [`${x.code} ${x.name}`, x.code];
    }
    let ownerId: string | null = null;
    if (dto.owner) {
      const u = await tx.user.findUnique({ where: { email: dto.owner.toLowerCase() } });
      if (!u) throw new BadRequestException('Người phụ trách không tồn tại');
      ownerId = u.id;
    }
    return { partner, partnerCode, ownerId };
  }

  /** A contract with names instead of ids, for the Sửa diff. */
  private async described(c: Row) {
    const owner = c.owner?.email ?? null;
    return {
      contractNo: c.contractNo, title: c.title, party: `${c.customer?.code ?? c.supplier?.code} · ${c.customer?.name ?? c.supplier?.name}`,
      signedDate: c.signedDate, startDate: c.startDate, endDate: c.endDate, value: c.value, paymentTerms: c.paymentTerms, description: c.description, owner,
    };
  }
}

function fields(dto: ContractDto) {
  return {
    contractNo: dto.contractNo ?? null, title: dto.title, signedDate: fromDay(dto.signedDate)!, startDate: fromDay(dto.startDate), endDate: fromDay(dto.endDate),
    value: dto.value, paymentTerms: dto.paymentTerms ?? null, description: dto.description ?? null,
  };
}

const saleLine = (l: Prisma.SalesOrderLineGetPayload<object>): SaleLine => ({
  productId: l.productId, quantity: l.quantity.toNumber(), unitPrice: l.unitPrice.toNumber(), discountRate: l.discountRate?.toNumber() ?? null,
  discountAmount: l.discountAmount.toNumber(), vatRate: l.vatRate.toNumber(), receivedQuantity: l.receivedQuantity.toNumber(), ratioToBase: l.ratioToBase.toNumber(),
});
const purchaseLine = (l: Prisma.PurchaseOrderLineGetPayload<object>): LineNumbers => ({
  quantity: l.quantity.toNumber(), unitPrice: l.unitPrice.toNumber(), receivedQuantity: l.receivedQuantity.toNumber(), vatRate: l.vatRate.toNumber(),
});

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @RequirePermissions('contract.view')
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.contracts.list(user);
  }

  @RequirePermissions('contract.view')
  @Get(':id')
  one(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.contracts.one(id, user);
  }

  @RequirePermissions('contract.create')
  @Post()
  create(@Body() dto: ContractDto, @CurrentUser() user: AuthUser) {
    return this.contracts.create(dto, user);
  }

  @RequirePermissions('contract.update')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: ContractDto, @CurrentUser() user: AuthUser) {
    return this.contracts.update(id, dto, user);
  }

  @RequirePermissions('contract.close')
  @Post(':id/liquidate')
  @HttpCode(HttpStatus.OK)
  liquidate(@Param('id') id: string, @Body() dto: CloseContractDto, @CurrentUser() user: AuthUser) {
    return this.contracts.close(id, 'DA_THANH_LY', dto, user, vnDay());
  }

  @RequirePermissions('contract.close')
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Body() dto: CloseContractDto, @CurrentUser() user: AuthUser) {
    return this.contracts.close(id, 'HUY', dto, user, vnDay());
  }
}

@Module({ controllers: [ContractsController], providers: [ContractsService], exports: [ContractsService] })
export class ContractsModule {}

