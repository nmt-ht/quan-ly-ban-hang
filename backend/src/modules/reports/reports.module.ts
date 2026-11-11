import { BadRequestException, Controller, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequireAnyPermission, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { ProductsModule } from '../products/products.module.js';
import { LookupsModule } from '../lookups/lookups.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import { SuppliersModule } from '../suppliers/suppliers.module.js';
import { VehiclesModule } from '../vehicles/vehicles.module.js';
import { CashCatalogModule } from '../cash/cash-catalog.module.js';
import { CashVouchersModule } from '../cash/cash-vouchers.module.js';
import { PurchasingModule } from '../purchasing/purchasing.module.js';
import { SalesModule } from '../sales/sales.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { DeliveryModule } from '../delivery/delivery.module.js';
import { ReceivablesService } from '../sales/receivables.service.js';
import { PayablesService } from '../purchasing/payables.service.js';
import { ReportDataService } from './report-data.service.js';
import { GROUP_PERMISSION, ReportDef } from './report.types.js';
import { costBook, inRange, isoDay, revenueLines, unitCosts } from './report.rules.js';
import { dashboard } from './dashboard.js';
import { alerts } from './alerts.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SalesService } from '../sales/sales.service.js';
import { quotationVisibleTo } from '../sales/order-access.js';
import { CashAccountsService } from '../cash/cash-catalog.module.js';
import { fromDay } from '../../common/text.js';
import { seesPurchasePrices } from '../../common/purchase-prices.js';
import { SALES_DEFS } from './defs/sales.defs.js';
import { STOCK_DEFS } from './defs/stock.defs.js';
import { OPS_DEFS } from './defs/ops.defs.js';

const DEFS: ReportDef[] = [...SALES_DEFS, ...STOCK_DEFS, ...OPS_DEFS];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function day(value: string | undefined, name: string): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (!DAY.test(value)) throw new BadRequestException(`${name} phải có dạng YYYY-MM-DD`);
  return value;
}

/**
 * Báo cáo and tổng quan, computed on the server from the same lists the screens read — so a role sees
 * the totals its report rights allow without downloading every document. Giá vốn ước tính is the
 * frontend's CostService rule (report.rules.ts).
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly source: ReportDataService,
    private readonly receivables: ReceivablesService,
    private readonly payables: PayablesService,
  ) {}

  async run(def: ReportDef, from: string | undefined, to: string | undefined, group: string | undefined, item?: string) {
    const data = await this.source.load();
    const today = isoDay();
    // Open start = from the beginning; the end is never later than today.
    const range = { from: from ?? '1970-01-01', to: !to || to > today ? today : to };
    const g = group && def.groups?.includes(group) ? group : def.groups?.[0] ?? '';
    return def.run({ data, cost: costBook(data) }, { range, group: g, item: item?.trim() ?? '' });
  }

  /** Doanh thu lines of [from, to] (the screen groups them); `first` = the first day with revenue. */
  async revenueLines(from: string | undefined, to: string | undefined) {
    const lines = revenueLines((await this.source.load()).salesOrders());
    const first = lines.map((l) => l.date).sort()[0] ?? null;
    return { first, lines: lines.filter((l) => inRange(l.date, { from, to })) };
  }

  /** Giá vốn bình quân hiện tại theo ĐVT chính của từng sản phẩm: productId → đơn giá. */
  async productCosts(): Promise<Record<string, number>> {
    return Object.fromEntries(unitCosts(await this.source.load()));
  }

  async dashboard(user: AuthUser, from: string | undefined, to: string | undefined) {
    const can = (p: string) => user.permissions.includes(p);
    const today = isoDay();
    const data = await this.source.load();
    const debt = can('debt.view') ? { receivables: await this.receivables.rows(), payables: await this.payables.rows() } : null;
    return dashboard({
      data, cost: costBook(data), debt, showProfit: can('report.view_profit'), showPurchases: seesPurchasePrices(user),
      showStockValue: can('stock.view_value') || can('product.view_cost_price'), from, to: to ?? today, today,
    });
  }
}

/**
 * Thông báo (GET /alerts): what is wrong right now, for this user. Each check runs only when the user holds the
 * permission of the screen that fixes it, so the bell never points at a page they cannot open.
 */
@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sales: SalesService,
    private readonly receivables: ReceivablesService,
    private readonly payables: PayablesService,
    private readonly cashAccounts: CashAccountsService,
  ) {}

  async list(user: AuthUser) {
    const can = (p: string) => user.permissions.includes(p);
    const today = isoDay();
    const [lateOrders, debt, cashAccounts, belowMin, draftPurchases, openQuotes] = await Promise.all([
      can('order.view') ? this.sales.lateOrderCount(user, today) : null,
      can('debt.view') ? Promise.all([this.receivables.rows(today), this.payables.rows(today)]).then(([receivables, payables]) => ({ receivables, payables })) : null,
      can('voucher.view') ? this.cashAccounts.findAll() : null,
      can('stock.view') ? this.belowMin() : null,
      can('purchase.approve') ? this.prisma.purchaseOrder.count({ where: { status: 'NHAP' } }) : null,
      can('quote.view') ? this.openQuotes(user) : null,
    ]);
    return alerts({ today, lateOrders, debt, cashAccounts, belowMin, draftPurchases, openQuotes });
  }

  /** Mặt hàng đang dùng (not dịch vụ) whose tồn across every kho is under its tồn tối thiểu — Tổng quan's count. */
  private async belowMin(): Promise<number> {
    const [products, levels] = await Promise.all([
      this.prisma.product.findMany({ where: { isActive: true, minStock: { gt: 0 }, NOT: { type: 'DICH_VU' } }, select: { id: true, minStock: true } }),
      this.prisma.stockLevel.groupBy({ by: ['productId'], _sum: { quantity: true } }),
    ]);
    const qty = new Map(levels.map((l) => [l.productId, Number(l._sum.quantity ?? 0)]));
    return products.filter((p) => (qty.get(p.id) ?? 0) < Number(p.minStock)).length;
  }

  /** Báo giá đang mở with a hạn hiệu lực, as the user's báo giá list shows them (same visibility rule). */
  private async openQuotes(user: AuthUser) {
    const rows = await this.prisma.quotation.findMany({ where: { AND: [quotationVisibleTo(user), { status: 'MOI', validUntil: { not: null, gte: fromDay(isoDay(new Date(Date.now() - 30 * 86_400_000)))! } }] }, select: { validUntil: true } });
    return rows.map((r) => ({ validUntil: r.validUntil!.toISOString().slice(0, 10) }));
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly alertsService: AlertsService,
  ) {}

  /** Thông báo for the topbar bell and Tổng quan › Cần xử lý. Every signed-in user; filtered by their permissions. */
  @Get('alerts')
  alerts(@CurrentUser() user: AuthUser) {
    return this.alertsService.list(user);
  }

  /** Tổng quan of a kỳ: `from` missing = from the first sale; `to` missing or later = today. */
  @RequirePermissions('report.dashboard')
  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.dashboard(user, day(from, 'from'), day(to, 'to'));
  }

  /**
   * Giá vốn bình quân (Pha 1.3; ước tính for products that have not moved since) — the figures behind Giá trị tồn, tab Giá vốn của đơn bán and chi phí lệnh sản xuất.
   * Computed here, not in the browser, so only roles with product.view_cost_price or stock.view_value get them.
   */
  @RequireAnyPermission('product.view_cost_price', 'stock.view_value')
  @Get('product-costs')
  productCosts() {
    return this.reports.productCosts();
  }

  @RequirePermissions('report.sales')
  @Get('reports/revenue-lines')
  revenueLines(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.revenueLines(day(from, 'from'), day(to, 'to'));
  }

  @Get('reports/:slug')
  run(
    @Param('slug') slug: string, @CurrentUser() user: AuthUser,
    @Query('from') from?: string, @Query('to') to?: string, @Query('group') group?: string, @Query('item') item?: string,
  ) {
    const def = DEFS.find((d) => d.slug === slug);
    if (!def) throw new NotFoundException('Không có báo cáo này');
    const need = GROUP_PERMISSION[def.group];
    if (!user.permissions.includes(need)) throw new ForbiddenException(`Chức vụ của bạn chưa có quyền: ${need}`);
    return this.reports.run(def, day(from, 'from'), day(to, 'to'), group, item);
  }
}

@Module({
  imports: [
    ProductsModule, LookupsModule, CustomersModule, SuppliersModule, VehiclesModule, CashCatalogModule, CashVouchersModule,
    PurchasingModule, SalesModule, InventoryModule, DeliveryModule,
  ],
  controllers: [ReportsController],
  providers: [ReportDataService, ReportsService, AlertsService],
})
export class ReportsModule {}
