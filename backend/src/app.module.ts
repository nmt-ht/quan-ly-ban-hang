import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
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
import { DecimalInterceptor } from './common/decimal.interceptor.js';
import { PrismaExceptionFilter } from './common/prisma-exception.filter.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    // Đợt 1 — danh mục
    AccessModule,
    CompanyModule,
    TagsModule,
    LookupsModule,
    ProductsModule,
    CustomersModule,
    SuppliersModule,
    VehiclesModule,
    CashCatalogModule,
    // Đợt 2 — kho
    InventoryModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: DecimalInterceptor },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
