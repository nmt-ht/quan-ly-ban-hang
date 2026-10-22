import { Body, Controller, Get, Injectable, Module, Put, UseGuards } from '@nestjs/common';
import { Matches, ValidateIf } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { RequirePermissions } from '../../auth/permissions.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OptionalEmail, OptionalText, Text } from '../../common/dto.js';

export class CompanyDto {
  @Text(200) name!: string;
  @OptionalText(300) address?: string;
  @OptionalText(20) taxCode?: string;
  @OptionalText(30) phone?: string;
  @OptionalEmail() email?: string;
  @OptionalText(200) website?: string;
  // A small PNG/JPEG data: URL (the frontend shrinks it) until file uploads exist, or a URL.
  @OptionalText(1_500_000)
  @ValidateIf((o: CompanyDto) => !!o.logo)
  @Matches(/^(data:image\/(png|jpeg);base64,|https?:\/\/)/, { message: 'Logo phải là ảnh PNG/JPEG hoặc đường dẫn' })
  logo?: string;
}

// Thông tin công ty: a single row (id = 1), printed on every phiếu.
@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const row = await this.prisma.companyInfo.findUnique({ where: { id: 1 } });
    const { id: _id, ...info } = row ?? { id: 1, name: '' };
    return info;
  }

  async save(dto: CompanyDto) {
    const data = {
      name: dto.name, address: dto.address ?? null, taxCode: dto.taxCode ?? null, phone: dto.phone ?? null,
      email: dto.email ?? null, website: dto.website ?? null, logo: dto.logo ?? null,
    };
    await this.prisma.companyInfo.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
    return this.get();
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('company')
export class CompanyController {
  constructor(private readonly company: CompanyService) {}

  // Every signed-in user reads it: the letterhead of printed vouchers needs it.
  @Get()
  get() {
    return this.company.get();
  }

  @RequirePermissions('company.update')
  @Put()
  save(@Body() dto: CompanyDto) {
    return this.company.save(dto);
  }
}

@Module({ controllers: [CompanyController], providers: [CompanyService] })
export class CompanyModule {}
