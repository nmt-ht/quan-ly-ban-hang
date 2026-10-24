import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { ProductsService } from './products.service.js';
import { ActiveDto, BomImportDto, CreateProductDto, ProductImportDto } from './dto/create-product.dto.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  // Reads are open to every signed-in user: orders, vouchers and stock show product names.
  @Get('products')
  findAll() {
    return this.products.findAll();
  }

  @Get('products/:id')
  findOne(@Param('id') id: string) {
    return this.products.findOne(id);
  }

  @RequirePermissions('product.create')
  @Post('products')
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @RequirePermissions('product.import')
  @Post('products/import')
  @HttpCode(HttpStatus.OK)
  import(@Body() dto: ProductImportDto, @CurrentUser() user: AuthUser) {
    return this.products.import(dto, user);
  }

  // Changing giá bán also needs product.update_price (checked in the service, which sees the old prices).
  @RequirePermissions('product.update')
  @Put('products/:id')
  update(@Param('id') id: string, @Body() dto: CreateProductDto, @CurrentUser() user: AuthUser) {
    return this.products.update(id, dto, user);
  }

  @RequirePermissions('product.delete')
  @Patch('products/:id/active')
  setActive(@Param('id') id: string, @Body() dto: ActiveDto) {
    return this.products.setActive(id, dto.isActive);
  }

  @Get('bom-lines')
  bomLines() {
    return this.products.bomLines();
  }

  @RequirePermissions('bom.manage')
  @Put('bom-lines')
  replaceBoms(@Body() dto: BomImportDto) {
    return this.products.replaceBoms(dto.replacements);
  }
}
