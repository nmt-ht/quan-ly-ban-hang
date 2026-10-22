import { Body, Controller, Get, HttpCode, HttpStatus, Module, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsISO8601, IsNumber, IsOptional, IsPositive, Matches, Max, Min, ValidateNested } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { OptionalText, Text } from '../../common/dto.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';
import { PayablesService } from './payables.service.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MESSAGE = { message: 'Ngày phải có dạng YYYY-MM-DD' };

export class OrderLineDto {
  @Text(60) productId!: string;
  @IsNumber() @IsPositive({ message: 'Số lượng phải lớn hơn 0' }) quantity!: number;
  @IsNumber() @Min(0) unitPrice!: number;
  @OptionalText(30) unitName?: string;
  @IsOptional() @IsNumber() @IsPositive() ratioToBase?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) vatRate?: number;
  @OptionalText(60) warehouseId?: string;
}

export class OrderDto {
  @Text(60) supplierId!: string;
  @Matches(DAY, DAY_MESSAGE) date!: string;
  @OptionalText(1000) note?: string;
  @IsArray() @ArrayMinSize(1, { message: 'Thêm ít nhất một dòng hàng' }) @ValidateNested({ each: true }) @Type(() => OrderLineDto)
  lines!: OrderLineDto[];
  @IsOptional() @IsISO8601() updatedAt?: string;
}

export class ReceiptItemDto {
  @IsInt() @Min(0) lineIndex!: number;
  @IsNumber() @Min(0) quantity!: number; // in the line's unit
  @Text(60) warehouseId!: string;
}

export class ReceiptDto {
  @Matches(DAY, DAY_MESSAGE) date!: string;
  @OptionalText(300) note?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ReceiptItemDto) items!: ReceiptItemDto[];
}

export class CancelDto {
  @OptionalText(300) reason?: string;
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly orders: PurchaseOrdersService) {}

  // Reads are open to every signed-in user: stock ("sắp về"), suppliers and debts show them.
  @Get()
  findAll() {
    return this.orders.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orders.findOne(id);
  }

  @RequirePermissions('purchase.create')
  @Post()
  create(@Body() dto: OrderDto, @CurrentUser() user: AuthUser) {
    return this.orders.create(dto, user.id);
  }

  @RequirePermissions('purchase.update')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: OrderDto) {
    return this.orders.update(id, dto);
  }

  // Gửi NCC is the approval step ("Duyệt đơn nhập hàng").
  @RequirePermissions('purchase.approve')
  @Post(':id/send')
  @HttpCode(HttpStatus.OK)
  send(@Param('id') id: string) {
    return this.orders.send(id);
  }

  @RequirePermissions('purchase.receive')
  @Post(':id/receive')
  @HttpCode(HttpStatus.OK)
  receive(@Param('id') id: string, @Body() dto: ReceiptDto, @CurrentUser() user: AuthUser) {
    return this.orders.receive(id, dto, user.id);
  }

  @RequirePermissions('purchase.update')
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  complete(@Param('id') id: string) {
    return this.orders.complete(id);
  }

  @RequirePermissions('purchase.cancel')
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Body() dto: CancelDto) {
    return this.orders.cancel(id, dto.reason);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('payables')
export class PayablesController {
  constructor(private readonly payables: PayablesService) {}

  /** Công nợ phải trả per supplier: open items, aging, sổ chi tiết. `?today=YYYY-MM-DD` for a past view. */
  @RequirePermissions('debt.view')
  @Get()
  rows(@Query('today') today?: string) {
    return this.payables.rows(today && DAY.test(today) ? today : undefined);
  }
}

@Module({
  imports: [InventoryModule],
  controllers: [PurchaseOrdersController, PayablesController],
  providers: [PurchaseOrdersService, PayablesService],
})
export class PurchasingModule {}
