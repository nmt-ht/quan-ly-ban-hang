import { Body, Controller, Get, HttpCode, HttpStatus, Module, Post, UseGuards } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequireAnyPermission } from '../auth/permissions.decorator.js';
import { auditContext } from '../audit/audit.context.js';
import { parseImageDataUrl } from './image-data.js';
import { StorageService } from './storage.service.js';

export class UploadImageDto {
  @IsString() @MaxLength(12_000_000, { message: 'Ảnh quá lớn' }) dataUrl!: string;
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  /** Whether photos go to object storage (the form then uploads; otherwise it keeps a data: URL). */
  @Get('status')
  status() {
    return { enabled: this.storage.enabled };
  }

  /** One shrunk product photo (data: URL) → stored in R2, the URL comes back for the product to keep. The logo stays a data: URL: print, PDF and the favicon draw it on a canvas. */
  @RequireAnyPermission('product.create', 'product.update')
  @Post('images')
  @HttpCode(HttpStatus.OK)
  async image(@Body() dto: UploadImageDto) {
    // Storing a file changes no record: the product or company save that keeps its URL writes the Nhật ký line.
    const ctx = auditContext();
    if (ctx) ctx.readOnly = true;
    const url = await this.storage.putImage(parseImageDataUrl(dto.dataUrl));
    return { url };
  }
}

@Module({ controllers: [UploadsController], providers: [StorageService], exports: [StorageService] })
export class StorageModule {}
