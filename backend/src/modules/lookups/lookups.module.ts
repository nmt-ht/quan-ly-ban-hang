import { Module } from '@nestjs/common';
import { CategoriesController, LookupsService, WarehousesController } from './lookups.controller.js';

@Module({
  controllers: [WarehousesController, CategoriesController],
  providers: [LookupsService],
})
export class LookupsModule {}
