import { BadRequestException, Controller, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequirePermissions } from '../../auth/permissions.decorator.js';
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
import { inRange, isoDay, revenueLines, unitCosts } from './report.rules.js';
import { dashboard } from './dashboard.js';
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

  async run(def: ReportDef, from: string | undefined, to: string | undefined, group: string | undefined) {
    const data = await this.source.load();
    const cost = unitCosts(data);
    const today = isoDay();
    // Open start = from the beginning; the end is never later than today.
    const range = { from: from ?? '1970-01-01', to: !to || to > today ? today : to };
    const g = group && def.groups?.includes(group) ? group : def.groups?.[0] ?? '';
    return def.run({ data, cost: { costOf: (id) => cost.get(id) ?? 0 } }, { range, group: g });
  }

  /** Doanh thu lines of [from, to] (the screen groups them); `first` = the first day with revenue. */
  async revenueLines(from: string | undefined, to: string | undefined) {
    const lines = revenueLines((await this.source.load()).salesOrders());
    const first = lines.map((l) => l.date).sort()[0] ?? null;
    return { first, lines: lines.filter((l) => inRange(l.date, { from, to })) };
  }

  async dashboard(user: AuthUser, from: string | undefined, to: string | undefined) {
    const can = (p: string) => user.permissions.includes(p);
    const today = isoDay();
    const data = await this.source.load();
    const debt = can('debt.view') ? { receivables: await this.receivables.rows(), payables: await this.payables.rows() } : null;
    return dashboard({ data, cost: unitCosts(data), debt, showProfit: can('report.view_profit'), from, to: to ?? today, today });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** Tổng quan of a kỳ: `from` missing = from the first sale; `to` missing or later = today. */
  @RequirePermissions('report.dashboard')
  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.dashboard(user, day(from, 'from'), day(to, 'to'));
  }

  @RequirePermissions('report.sales')
  @Get('reports/revenue-lines')
  revenueLines(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.revenueLines(day(from, 'from'), day(to, 'to'));
  }

  @Get('reports/:slug')
  run(
    @Param('slug') slug: string, @CurrentUser() user: AuthUser,
    @Query('from') from?: string, @Query('to') to?: string, @Query('group') group?: string,
  ) {
    const def = DEFS.find((d) => d.slug === slug);
    if (!def) throw new NotFoundException('Không có báo cáo này');
    const need = GROUP_PERMISSION[def.group];
    if (!user.permissions.includes(need)) throw new ForbiddenException(`Chức vụ của bạn chưa có quyền: ${need}`);
    return this.reports.run(def, day(from, 'from'), day(to, 'to'), group);
  }
}

@Module({
  imports: [
    ProductsModule, LookupsModule, CustomersModule, SuppliersModule, VehiclesModule, CashCatalogModule, CashVouchersModule,
    PurchasingModule, SalesModule, InventoryModule, DeliveryModule,
  ],
  controllers: [ReportsController],
  providers: [ReportDataService, ReportsService],
})
export class ReportsModule {}
