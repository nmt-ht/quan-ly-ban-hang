import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { decimalsToNumbers } from '../../common/decimal.interceptor.js';
import { ProductsService } from '../products/products.service.js';
import { LookupsService } from '../lookups/lookups.controller.js';
import { CustomersService } from '../customers/customers.service.js';
import { SuppliersService } from '../suppliers/suppliers.module.js';
import { VehiclesService } from '../vehicles/vehicles.module.js';
import { CashAccountsService } from '../cash/cash-catalog.module.js';
import { CashVouchersService } from '../cash/cash-vouchers.module.js';
import { PurchaseOrdersService } from '../purchasing/purchase-orders.service.js';
import { SalesService } from '../sales/sales.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { TripsService } from '../delivery/trips.service.js';

/** A row as the API sends it: Decimal → number, Date → ISO string. */
export type Plain<T> = T extends Prisma.Decimal
  ? number
  : T extends Date
    ? string
    : T extends (infer U)[]
      ? Plain<U>[]
      : T extends object
        ? { [K in keyof T]: Plain<T[K]> }
        : T;

export function plain<T>(value: T): Plain<T> {
  return JSON.parse(JSON.stringify(decimalsToNumbers(value))) as Plain<T>;
}

/**
 * Everything báo cáo and tổng quan compute from, in the shapes the list endpoints answer — so the
 * computations are the ones the screens used to run in the browser. Every order counts here, whoever
 * sells it: reports only show totals. Read once per request.
 */
@Injectable()
export class ReportDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly lookups: LookupsService,
    private readonly customers: CustomersService,
    private readonly suppliers: SuppliersService,
    private readonly vehicles: VehiclesService,
    private readonly cashAccounts: CashAccountsService,
    private readonly cashVouchers: CashVouchersService,
    private readonly purchaseOrders: PurchaseOrdersService,
    private readonly sales: SalesService,
    private readonly inventory: InventoryService,
    private readonly trips: TripsService,
  ) {}

  async load() {
    const d = plain({
      products: await this.products.findAll(),
      bomLines: await this.products.bomLines(),
      categories: await this.lookups.list('productCategory'),
      warehouses: await this.lookups.list('warehouse'),
      customers: await this.customers.findAll(),
      suppliers: await this.suppliers.findAll(),
      vehicles: await this.vehicles.findAll(),
      cashAccounts: await this.cashAccounts.findAll(),
      cashVouchers: await this.cashVouchers.findAll(),
      purchaseOrders: await this.purchaseOrders.findAll(),
      salesOrders: await this.sales.allOrders(),
      productionOrders: await this.sales.productionOrders(),
      stockLevels: await this.inventory.stockLevels(),
      warehouseVouchers: await this.inventory.vouchers(),
      // Giá vốn (Pha 1.3): bình quân hiện tại, and what each phiếu xuất froze — kept off the voucher list itself.
      averageCosts: await this.inventory.averageCosts(),
      issueCosts: await this.inventory.issueCosts(),
      orderTrips: await this.prisma.deliveryTripOrder.findMany({ select: { orderId: true, tripId: true } }),
      deliveryTrips: await this.trips.trips(),
      users: await this.prisma.user.findMany({ select: { email: true, name: true } }),
    });
    // Called like the screens' signals (data.products()), so the report code reads the same.
    return Object.fromEntries(Object.entries(d).map(([k, v]) => [k, () => v])) as { [K in keyof typeof d]: () => (typeof d)[K] };
  }
}

export type ReportData = Awaited<ReturnType<ReportDataService['load']>>;
