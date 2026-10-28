import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Module, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { WarehouseVoucherType } from '@prisma/client';
import { ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, Matches, Min, ValidateNested } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { seesPurchasePrices } from '../../common/purchase-prices.js';
import { CurrentUser, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { OptionalText, Text } from '../../common/dto.js';
import { listParam, parsePageQuery, windowStart } from '../../common/paging.js';
import { InventoryService, withoutLinePrices } from './inventory.service.js';
import { WarehouseVoucherPageQuery } from './warehouse-voucher-page.js';

export class VoucherLineDto {
  @Text(60) productId!: string;
  @IsNumber() @Min(0) quantity!: number; // ĐVT chính
  @OptionalText(30) unitName?: string;
  @IsOptional() @IsNumber() @Min(0) unitQuantity?: number;
  @IsOptional() @IsNumber() @Min(0) unitPrice?: number; // per base unit
  @OptionalText(300) note?: string;
}

export class VoucherDto {
  @IsEnum(WarehouseVoucherType) type!: WarehouseVoucherType;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày phải có dạng YYYY-MM-DD' }) date!: string;
  @Text(60) warehouseId!: string;
  @OptionalText(60) targetWarehouseId?: string;
  @OptionalText(300) reason?: string;
  @OptionalText(1000) note?: string;
  @IsArray() @ArrayMinSize(1, { message: 'Thêm ít nhất một dòng hàng' }) @ValidateNested({ each: true }) @Type(() => VoucherLineDto)
  lines!: VoucherLineDto[];
}

export class CancelDto {
  @OptionalText(300) reason?: string;
}

// Which permission lets a role lập each kind of phiếu (as the frontend's route rules).
const CREATE_PERMISSION: Record<WarehouseVoucherType, string[]> = {
  NHAP: ['stock.import'],
  XUAT: ['stock.export'],
  CHUYEN: ['stock.transfer'],
  KIEM_KE: ['stock.adjust', 'stock.stocktake'],
};

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  // Reads are open to every signed-in user: orders, trips and production show stock and their vouchers.
  @Get('stock-levels')
  stockLevels() {
    return this.inventory.stockLevels();
  }

  // Giá nhập on phiếu nhập only to who may see purchase prices (not Thủ kho, Sale, giao hàng, xưởng).
  // `?recentDays=90` (what the app loads at sign-in, Pha 1.1): the last 90 days. `?ids=` / `?codes=`: just those (at most
  // 500). `?relatedId=&relatedCode=`: those of one đơn / lệnh / chuyến — for screens showing older ones.
  @Get('warehouse-vouchers')
  async vouchers(
    @CurrentUser() user: AuthUser, @Query('recentDays') recentDays?: string, @Query('ids') ids?: string, @Query('codes') codes?: string,
    @Query('relatedId') relatedId?: string, @Query('relatedCode') relatedCode?: string,
  ) {
    const rows = await this.inventory.vouchers(windowStart(recentDays), { ids: listParam(ids), codes: listParam(codes) }, { id: relatedId, code: relatedCode });
    return seesPurchasePrices(user) ? rows : rows.map(withoutLinePrices);
  }

  /** Danh sách theo trang: lọc, tìm không dấu, sắp xếp, số phiếu theo loại / kho (Pha 1.1). Declared before :id. */
  @Get('warehouse-vouchers/page')
  async page(@Query() raw: Record<string, unknown>, @CurrentUser() user: AuthUser) {
    return this.inventory.page(await parsePageQuery(WarehouseVoucherPageQuery, raw, ['createdBy']), seesPurchasePrices(user));
  }

  /** Số phiếu và số dòng chứng từ của từng kho trên toàn bộ lịch sử. */
  @Get('warehouse-vouchers/usage')
  usage() {
    return this.inventory.warehouseUsage();
  }

  @Get('warehouse-vouchers/:id')
  async voucher(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const v = await this.inventory.voucher(id);
    return seesPurchasePrices(user) ? v : withoutLinePrices(v);
  }

  @Post('warehouse-vouchers')
  create(@Body() dto: VoucherDto, @CurrentUser() user: AuthUser) {
    if (!CREATE_PERMISSION[dto.type].some((p) => user.permissions.includes(p))) {
      throw new ForbiddenException(`Chức vụ của bạn chưa có quyền: ${CREATE_PERMISSION[dto.type].join(' hoặc ')}`);
    }
    // Đơn giá trên phiếu nhập needs its own permission (Thủ kho does not see purchase prices): drop it otherwise.
    const pricing = user.permissions.includes('stock.import_price');
    const lines = dto.lines.map((l) => (pricing ? l : { ...l, unitPrice: undefined }));
    return this.inventory.create({ ...dto, lines }, user.id);
  }

  @RequirePermissions('stock.cancel')
  @Post('warehouse-vouchers/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Body() dto: CancelDto, @CurrentUser() user: AuthUser) {
    return this.inventory.cancel(id, dto.reason, user.id);
  }
}

@Module({
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
