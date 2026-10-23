import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditController } from './audit.controller.js';
import { AuditContextInterceptor } from './audit.interceptor.js';
import { AuditService } from './audit.service.js';

/** Nhật ký hoạt động: AuditService is global so every module can log inside its own transaction. */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, { provide: APP_INTERCEPTOR, useClass: AuditContextInterceptor }],
  exports: [AuditService],
})
export class AuditModule {}
