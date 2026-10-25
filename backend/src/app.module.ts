import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ErrorReportInterceptor } from './monitoring/error-report.interceptor.js';
import { HealthController } from './monitoring/health.controller.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AccessModule } from './modules/access/access.module.js';
import { CashCatalogModule } from './modules/cash/cash-catalog.module.js';
import { CompanyModule } from './modules/company/company.module.js';
import { CustomersModule } from './modules/customers/customers.module.js';
import { LookupsModule } from './modules/lookups/lookups.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { SuppliersModule } from './modules/suppliers/suppliers.module.js';
import { TagsModule } from './modules/tags/tags.module.js';
import { VehiclesModule } from './modules/vehicles/vehicles.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { PurchasingModule } from './modules/purchasing/purchasing.module.js';
import { SalesModule } from './modules/sales/sales.module.js';
import { DeliveryModule } from './modules/delivery/delivery.module.js';
import { CashVouchersModule } from './modules/cash/cash-vouchers.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { PricingModule } from './modules/pricing/pricing.module.js';
import { PlatformModule } from './platform/platform.module.js';
import { DecimalInterceptor } from './common/decimal.interceptor.js';
import { PrismaExceptionFilter } from './common/prisma-exception.filter.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    // Nhiều doanh nghiệp: picks each request's database (off unless PLATFORM_DATABASE_URL is set)
    PlatformModule,
    AuditModule,
    AuthModule,
    // Đợt 1 — danh mục
    AccessModule,
    CompanyModule,
    TagsModule,
    LookupsModule,
    ProductsModule,
    PricingModule,
    CustomersModule,
    SuppliersModule,
    VehiclesModule,
    CashCatalogModule,
    // Đợt 2 — kho
    InventoryModule,
    // Đợt 3 — mua hàng, công nợ phải trả
    PurchasingModule,
    // Đợt 4 — bán hàng, sản xuất, công nợ phải thu
    SalesModule,
    // Đợt 5 — chuyến giao hàng
    DeliveryModule,
    // Đợt 6 — phiếu thu chi
    CashVouchersModule,
    // Đợt 7 — tổng quan, báo cáo
    ReportsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: ErrorReportInterceptor },
    { provide: APP_INTERCEPTOR, useClass: DecimalInterceptor },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
