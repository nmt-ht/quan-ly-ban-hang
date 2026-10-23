import { Module } from '@nestjs/common';
import { CategoriesController, LookupsService } from './lookups.controller.js';
import { WarehousesController, WarehousesService } from './warehouses.js';

@Module({
  controllers: [WarehousesController, CategoriesController],
  providers: [LookupsService, WarehousesService],
  exports: [LookupsService],
})
export class LookupsModule {}
