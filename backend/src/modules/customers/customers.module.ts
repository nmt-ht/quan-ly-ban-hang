import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';
import { CustomerImportService } from './customers.import.js';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, CustomerImportService],
  exports: [CustomersService],
})
export class CustomersModule {}
