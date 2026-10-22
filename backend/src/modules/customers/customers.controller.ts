import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { RequirePermissions } from '../../auth/permissions.decorator.js';
import { CustomersService } from './customers.service.js';
import { ActiveDto, CustomerAddressesDto, CustomerDto } from './dto/create-customer.dto.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  // Reads are open to every signed-in user: orders, trips and debts show customer names.
  @Get()
  findAll() {
    return this.customers.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customers.findOne(id);
  }

  @RequirePermissions('customer.create')
  @Post()
  create(@Body() dto: CustomerDto) {
    return this.customers.create(dto);
  }

  @RequirePermissions('customer.update')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: CustomerDto) {
    return this.customers.update(id, dto);
  }

  @RequirePermissions('customer.update')
  @Put(':id/addresses')
  setAddresses(@Param('id') id: string, @Body() dto: CustomerAddressesDto) {
    return this.customers.setAddresses(id, dto.addresses);
  }

  @RequirePermissions('customer.delete')
  @Patch(':id/active')
  setActive(@Param('id') id: string, @Body() dto: ActiveDto) {
    return this.customers.setActive(id, dto.isActive);
  }
}
