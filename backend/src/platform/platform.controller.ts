import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PlatformAuthService, PlatformGuard } from './platform-auth.js';
import { PlatformDbService } from './platform-db.service.js';
import { multiTenant } from './secret-box.js';
import { latestMigration } from './tenant-commands.js';
import { TenantsService } from './tenants.service.js';

class OwnerLoginDto {
  @IsEmail({}, { message: 'Email không hợp lệ' }) email!: string;
  @IsString() @IsNotEmpty() password!: string;
  @IsOptional() @Matches(/^\s*\d{3}\s?\d{3}\s*$/, { message: 'Mã xác thực gồm 6 chữ số' }) code?: string;
}

class CreateTenantDto {
  @IsString() @IsNotEmpty({ message: 'Nhập mã doanh nghiệp' }) @MaxLength(30) code!: string;
  @IsString() @IsNotEmpty({ message: 'Nhập tên doanh nghiệp' }) @MaxLength(200) name!: string;
  @IsEmail({}, { message: 'Email quản trị không hợp lệ' }) adminEmail!: string;
  @IsOptional() @IsString() @MaxLength(100) adminPassword?: string;
  @IsOptional() @IsString() @MaxLength(1000) databaseUrl?: string;
  @IsOptional() @IsBoolean() demo?: boolean;
}

class RenameTenantDto {
  @IsString() @IsNotEmpty({ message: 'Nhập tên doanh nghiệp' }) @MaxLength(200) name!: string;
}

class ResetPasswordDto {
  @IsOptional() @IsEmail({}, { message: 'Email không hợp lệ' }) email?: string;
}

type Req = { ip?: string };

/**
 * /api/platform — Quản trị nền tảng, only for the owner (PlatformGuard). TenantMiddleware runs these routes
 * outside every doanh nghiệp, and the audit interceptor leaves them alone: they log to platform_audit.
 */
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly auth: PlatformAuthService,
    private readonly tenants: TenantsService,
    private readonly platform: PlatformDbService,
  ) {}

  /** Public: whether the page has anything to sign in to. */
  @Get('status')
  status() {
    return { multiTenant: multiTenant(), ownerConfigured: multiTenant() && this.auth.ownerConfigured() };
  }

  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: OwnerLoginDto, @Req() req: Req) {
    return this.auth.login(dto.email, dto.password, dto.code?.replace(/\s/g, '') || undefined, req.ip ?? null);
  }

  @UseGuards(PlatformGuard)
  @Get('tenants')
  list() {
    return { latestMigration: latestMigration(), tenants: this.tenants.list() };
  }

  @UseGuards(PlatformGuard)
  @Post('tenants')
  create(@Body() dto: CreateTenantDto, @Req() req: Req) {
    return this.tenants.create(dto, req.ip ?? null);
  }

  @UseGuards(PlatformGuard)
  @Post('tenants/migrate-all')
  @HttpCode(HttpStatus.OK)
  migrateAll(@Req() req: Req) {
    return this.tenants.migrateAll(req.ip ?? null);
  }

  @UseGuards(PlatformGuard)
  @Patch('tenants/:code')
  rename(@Param('code') code: string, @Body() dto: RenameTenantDto, @Req() req: Req) {
    return this.tenants.rename(code, dto.name, req.ip ?? null);
  }

  @UseGuards(PlatformGuard)
  @Post('tenants/:code/retry')
  @HttpCode(HttpStatus.OK)
  retry(@Param('code') code: string, @Req() req: Req) {
    return this.tenants.retry(code, req.ip ?? null);
  }

  @UseGuards(PlatformGuard)
  @Post('tenants/:code/suspend')
  @HttpCode(HttpStatus.OK)
  suspend(@Param('code') code: string, @Req() req: Req) {
    return this.tenants.suspend(code, req.ip ?? null);
  }

  @UseGuards(PlatformGuard)
  @Post('tenants/:code/reopen')
  @HttpCode(HttpStatus.OK)
  reopen(@Param('code') code: string, @Req() req: Req) {
    return this.tenants.reopen(code, req.ip ?? null);
  }

  @UseGuards(PlatformGuard)
  @Post('tenants/:code/migrate')
  @HttpCode(HttpStatus.OK)
  migrate(@Param('code') code: string, @Req() req: Req) {
    return this.tenants.migrate(code, req.ip ?? null);
  }

  @UseGuards(PlatformGuard)
  @Post('tenants/:code/reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Param('code') code: string, @Body() dto: ResetPasswordDto, @Req() req: Req) {
    return this.tenants.resetPassword(code, dto.email, req.ip ?? null);
  }

  @UseGuards(PlatformGuard)
  @Get('audit')
  audit() {
    return this.platform.auditLog(200);
  }
}
