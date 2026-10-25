import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PlatformAuthService, PlatformGuard } from './platform-auth.js';
import { PlatformController } from './platform.controller.js';
import { PlatformDbService } from './platform-db.service.js';
import { TenantClientsService } from './tenant-clients.service.js';
import { TenantMiddleware } from './tenant.middleware.js';
import { TenantsService } from './tenants.service.js';

/** Nhiều doanh nghiệp, mỗi doanh nghiệp một database (src/platform/secret-box.ts says when it is on). */
@Module({
  controllers: [PlatformController],
  providers: [PlatformDbService, TenantClientsService, TenantsService, PlatformAuthService, PlatformGuard],
})
export class PlatformModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes('{*path}');
  }
}
