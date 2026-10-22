import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Module, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNumber, IsString, Matches, Min, ValidateNested } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { OptionalText } from '../../common/dto.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { SalesModule } from '../sales/sales.module.js';
import { TripsService } from './trips.service.js';

export class TripHeaderDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày phải có dạng YYYY-MM-DD' }) date!: string;
  @OptionalText(60) vehicleId?: string;
  @OptionalText(20) plateNumber?: string;
  @OptionalText(100) driverName?: string;
  @OptionalText(30) driverPhone?: string;
  @OptionalText(500) note?: string;
}

export class TripCostsDto {
  @IsNumber() @Min(0) fuel!: number;
  @IsNumber() @Min(0) toll!: number;
  @IsNumber() @Min(0) other!: number;
  @OptionalText(300) note?: string;
}

export class TripOrdersDto {
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) orderIds!: string[];
}

export class ReceivedLineDto {
  @IsInt() @Min(0) lineIndex!: number;
  @IsNumber() @Min(0) received!: number;
}

export class ConfirmDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ReceivedLineDto) lines!: ReceivedLineDto[];
  @OptionalText(300) note?: string;
}

export class ReasonDto {
  @OptionalText(300) reason?: string;
}

// Every change answers { trip, orders } — the chuyến and the đơn it touched — plus what the step made
// (receipts of "Thu tiền ngay" on chốt giao, the ids of cancelled ones on bỏ chốt).
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('delivery-trips')
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Get()
  findAll() {
    return this.trips.trips();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.trips.trip(id);
  }

  @RequirePermissions('trip.create')
  @Post()
  create(@Body() dto: TripHeaderDto, @CurrentUser() user: AuthUser) {
    return this.trips.create(dto, user);
  }

  @RequirePermissions('trip.update')
  @Put(':id')
  updateHeader(@Param('id') id: string, @Body() dto: TripHeaderDto) {
    return this.trips.updateHeader(id, dto);
  }

  @RequirePermissions('vehicle.manage_cost')
  @Put(':id/costs')
  saveCosts(@Param('id') id: string, @Body() dto: TripCostsDto) {
    return this.trips.saveCosts(id, dto);
  }

  @RequirePermissions('trip.update')
  @Post(':id/orders')
  @HttpCode(HttpStatus.OK)
  addOrders(@Param('id') id: string, @Body() dto: TripOrdersDto) {
    return this.trips.addOrders(id, dto.orderIds);
  }

  @RequirePermissions('trip.update')
  @Delete(':id/orders/:orderId')
  removeOrder(@Param('id') id: string, @Param('orderId') orderId: string) {
    return this.trips.removeOrder(id, orderId);
  }

  @RequirePermissions('trip.ship')
  @Post(':id/ship')
  @HttpCode(HttpStatus.OK)
  ship(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.trips.ship(id, user);
  }

  @RequirePermissions('trip.deliver')
  @Post(':id/orders/:orderId/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(@Param('id') id: string, @Param('orderId') orderId: string, @Body() dto: ConfirmDto, @CurrentUser() user: AuthUser) {
    return this.trips.confirm(id, orderId, dto.lines, dto.note, user);
  }

  @RequirePermissions('trip.deliver')
  @Post(':id/orders/:orderId/unconfirm')
  @HttpCode(HttpStatus.OK)
  unconfirm(@Param('id') id: string, @Param('orderId') orderId: string, @CurrentUser() user: AuthUser) {
    return this.trips.unconfirm(id, orderId, user);
  }

  @RequirePermissions('trip.return')
  @Post(':id/return')
  @HttpCode(HttpStatus.OK)
  returnToWarehouse(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.trips.returnToWarehouse(id, user);
  }

  @RequirePermissions('trip.update')
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  complete(@Param('id') id: string) {
    return this.trips.complete(id);
  }

  @RequirePermissions('trip.cancel')
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Body() dto: ReasonDto) {
    return this.trips.cancel(id, dto.reason);
  }
}

@Module({
  imports: [InventoryModule, SalesModule],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class DeliveryModule {}
