import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Module, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Type, plainToInstance } from 'class-transformer';
import {
  validate, ArrayMinSize, IsArray, IsISO8601, IsInt, IsNumber, IsOptional, IsPositive, IsString, Matches, Max, Min, ValidateNested, IsBoolean } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequireAnyPermission, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { OptionalDay, OptionalText, Text } from '../../common/dto.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { SalesService } from './sales.service.js';
import { ReceivablesService } from './receivables.service.js';
import { SalesReturnsController, SalesReturnsService } from './returns.js';
import { QuotationsController, QuotationsService } from './quotations.js';
import { DebtRemindersController, DebtRemindersService } from './reminders.js';
import { SalesOrderPageQuery, normaliseListQuery } from './sales-order-page.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MESSAGE = { message: 'Ngày phải có dạng YYYY-MM-DD' };

export class SaleLineDto {
  @OptionalText(60) id?: string;
  @Text(60) productId!: string;
  @Text(30) unit!: string;
  @OptionalText(30) unitName?: string;
  @IsOptional() @IsNumber() @IsPositive() ratioToBase?: number;
  @IsNumber() @IsPositive({ message: 'Số lượng phải lớn hơn 0' }) quantity!: number;
  @IsNumber() @Min(0) unitPrice!: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) discountRate?: number;
  @IsOptional() @IsNumber() @Min(0) discountAmount?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) vatRate?: number;
  @OptionalText(60) warehouseId?: string;
  @IsOptional() @IsNumber() @Min(0) length?: number;
  @IsOptional() @IsNumber() @Min(0) width?: number;
  @OptionalText(300) note?: string;
  @OptionalText(60) promotionId?: string;
  @IsOptional() @IsBoolean() isGift?: boolean;
}

export class SalesOrderDto {
  @Text(60) customerId!: string;
  @OptionalText(100) recipientName?: string;
  @OptionalText(30) recipientPhone?: string;
  @OptionalText(300) deliveryAddress?: string;
  @OptionalText(1000) description?: string;
  @OptionalText(60) source?: string;
  @IsArray() @IsString({ each: true }) tagIds!: string[];
  @Matches(DAY, DAY_MESSAGE) orderDate!: string;
  @OptionalDay() neededByDate?: string;
  @OptionalText(200) salesRep?: string;
  @IsNumber() @Min(0) discountAmount!: number;
  @OptionalText(60) payNowAccountId?: string;
  @OptionalText(60) promotionId?: string;
  /** Lưu dù vượt hạn mức công nợ của khách — chỉ chức vụ có debt.adjust. */
  @IsOptional() @IsBoolean() overrideCreditLimit?: boolean;
  /** Lập đơn từ báo giá (chỉ khi tạo đơn). */
  @OptionalText(60) quotationId?: string;
  @IsArray() @ArrayMinSize(1, { message: 'Thêm ít nhất một dòng hàng' }) @ValidateNested({ each: true }) @Type(() => SaleLineDto)
  lines!: SaleLineDto[];
  @IsOptional() @IsISO8601() updatedAt?: string;
}

export class DeliveryItemDto {
  @IsInt() @Min(0) lineIndex!: number;
  @IsNumber() @Min(0) quantity!: number;
  @OptionalText(60) warehouseId?: string; // empty for dịch vụ
}

export class DeliveryDto {
  @Matches(DAY, DAY_MESSAGE) date!: string;
  @OptionalText(300) note?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => DeliveryItemDto) items!: DeliveryItemDto[];
}

export class ReasonDto {
  @OptionalText(300) reason?: string;
}

export class CompleteDto {
  @IsOptional() @IsNumber() @Min(0) producedQuantity?: number;
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  // A seller without order.view_all sees only their own orders (SalesService.visibleTo).
  // `?recentDays=90` (what the app loads at sign-in, Pha 1.1): open orders plus the last 90 days.
  // `?ids=a,b` / `?codes=DH1,DH2`: just those orders (at most 500), for screens showing older ones.
  @RequirePermissions('order.view')
  @Get('sales-orders')
  orders(@CurrentUser() user: AuthUser, @Query('recentDays') recentDays?: string, @Query('ids') ids?: string, @Query('codes') codes?: string) {
    const days = Number(recentDays);
    const list = (v?: string) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 500) : undefined);
    return this.sales.orders(user, Number.isInteger(days) && days > 0 ? days : undefined, { ids: list(ids), codes: list(codes) });
  }

  /** Danh sách theo trang: lọc, tìm không dấu, sắp xếp, tổng của mọi đơn khớp (Pha 1.1). Declared before :id. */
  @RequirePermissions('order.view')
  @Get('sales-orders/page')
  async page(@Query() raw: Record<string, unknown>, @CurrentUser() user: AuthUser) {
    const q = plainToInstance(SalesOrderPageQuery, normaliseListQuery(raw));
    const errors = await validate(q, { whitelist: true });
    if (errors.length) throw new BadRequestException('Tham số lọc không hợp lệ');
    return this.sales.page(user, q);
  }

  /** Số đơn, doanh số, đơn còn mở của từng khách trên toàn bộ lịch sử. */
  @RequirePermissions('customer.view')
  @Get('sales-orders/customer-stats')
  customerStats(@CurrentUser() user: AuthUser) {
    return this.sales.customerStats(user);
  }

  @RequirePermissions('order.view')
  @Get('sales-orders/:id')
  order(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.sales.orderFor(id, user);
  }

  /** Giá vốn đã chốt của đơn — tab Giá vốn; same guard as /product-costs for giá vốn. */
  @RequirePermissions('product.view_cost_price')
  @Get('sales-orders/:id/issued-costs')
  issuedCosts(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.sales.issuedCosts(id, user);
  }

  @RequirePermissions('order.create')
  @Post('sales-orders')
  create(@Body() dto: SalesOrderDto, @CurrentUser() user: AuthUser) {
    return this.sales.create(dto, user);
  }

  @RequirePermissions('order.update')
  @Put('sales-orders/:id')
  update(@Param('id') id: string, @Body() dto: SalesOrderDto, @CurrentUser() user: AuthUser) {
    return this.sales.update(id, dto, user);
  }

  @RequirePermissions('order.cancel')
  @Post('sales-orders/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Body() dto: ReasonDto, @CurrentUser() user: AuthUser) {
    return this.sales.cancel(id, dto.reason, user);
  }

  @RequirePermissions('order.update')
  @Post('sales-orders/:id/close')
  @HttpCode(HttpStatus.OK)
  close(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.sales.close(id, user);
  }

  // Giao hàng tại kho / tại quầy: the seller or the storekeeper who hands the goods over.
  @RequireAnyPermission('order.update', 'stock.export')
  @Post('sales-orders/:id/deliver')
  @HttpCode(HttpStatus.OK)
  deliver(@Param('id') id: string, @Body() dto: DeliveryDto, @CurrentUser() user: AuthUser) {
    return this.sales.deliver(id, dto, user);
  }

  @Get('production-orders')
  productionOrders() {
    return this.sales.productionOrders();
  }

  @RequirePermissions('production.create')
  @Post('sales-orders/:id/production-orders')
  createProductionOrders(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.sales.createProductionOrders(id, user);
  }

  // Duyệt (Quản lý) or the workshop itself starts a lệnh — it issues the vật tư.
  @RequireAnyPermission('production.approve', 'production.update_progress')
  @Post('production-orders/:id/start')
  @HttpCode(HttpStatus.OK)
  start(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.sales.startProduction(id, user);
  }

  @RequirePermissions('production.complete')
  @Post('production-orders/:id/complete')
  @HttpCode(HttpStatus.OK)
  complete(@Param('id') id: string, @Body() dto: CompleteDto, @CurrentUser() user: AuthUser) {
    return this.sales.completeProduction(id, dto.producedQuantity, user);
  }

  @RequirePermissions('production.cancel')
  @Post('production-orders/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelProduction(@Param('id') id: string, @Body() dto: ReasonDto) {
    return this.sales.cancelProduction(id, dto.reason);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('receivables')
export class ReceivablesController {
  constructor(private readonly receivables: ReceivablesService) {}

  /** Công nợ phải thu per customer: open items, aging, sổ chi tiết. `?today=YYYY-MM-DD` for a past view. */
  @RequirePermissions('debt.view')
  @Get()
  rows(@Query('today') today?: string) {
    return this.receivables.rows(today && DAY.test(today) ? today : undefined);
  }
}

@Module({
  imports: [InventoryModule],
  controllers: [SalesController, SalesReturnsController, QuotationsController, ReceivablesController, DebtRemindersController],
  providers: [SalesService, SalesReturnsService, QuotationsService, ReceivablesService, DebtRemindersService],
  exports: [SalesService, ReceivablesService],
})
export class SalesModule {}
