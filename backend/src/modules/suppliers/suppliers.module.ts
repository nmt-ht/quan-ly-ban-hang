import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Injectable, Module, NotFoundException, Param, Patch, Post, Put, UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { RequirePermissions } from '../../auth/permissions.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SequenceService } from '../../prisma/sequence.service.js';
import { OptionalEmail, OptionalText, Text } from '../../common/dto.js';
import { AuditService } from '../../audit/audit.service.js';
import { diff } from '../../audit/audit.diff.js';

export class SupplierDto {
  @Text(200) name!: string;
  @OptionalText(30) contactPhone?: string;
  @OptionalEmail() email?: string;
  @OptionalText(20) taxCode?: string;
  @OptionalText(300) address?: string;
  @IsInt() @Min(0) creditDays!: number;
  @OptionalText(1000) note?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ActiveDto {
  @IsBoolean() isActive!: boolean;
}

export class SupplierProductDto {
  @OptionalText(60) supplierCode?: string;
  @IsNumber() @Min(0) purchasePrice!: number;
}

const SUPPLIER_FIELDS = {
  name: 'Tên', contactPhone: 'Điện thoại', email: 'Email', taxCode: 'Mã số thuế', address: 'Địa chỉ',
  creditDays: 'Số ngày được nợ', note: 'Ghi chú', isActive: 'Còn hợp tác',
};

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.supplier.findMany({ orderBy: { name: 'asc' } });
  }

  private data(dto: SupplierDto) {
    return {
      name: dto.name, contactPhone: dto.contactPhone ?? null, email: dto.email ?? null, taxCode: dto.taxCode ?? null,
      address: dto.address ?? null, creditDays: dto.creditDays, note: dto.note ?? null, isActive: dto.isActive ?? true,
    };
  }

  create(dto: SupplierDto) {
    return this.prisma.$transaction(async (tx) => {
      const s = await tx.supplier.create({ data: { ...this.data(dto), code: await this.sequences.nextCode('NCC', tx) } });
      await this.audit.log(tx, { action: 'supplier.create', entityType: 'Supplier', entityId: s.id, entityCode: s.code, summary: `Thêm nhà cung cấp ${s.code} · ${s.name}` });
      return s;
    });
  }

  async update(id: string, dto: SupplierDto) {
    const before = await this.prisma.supplier.findUnique({ where: { id } });
    const data = this.data(dto);
    return this.prisma.$transaction(async (tx) => {
      const s = await tx.supplier.update({ where: { id }, data });
      await this.audit.log(tx, {
        action: 'supplier.update', entityType: 'Supplier', entityId: id, entityCode: s.code,
        summary: `Sửa nhà cung cấp ${s.code} · ${s.name}`, changes: diff(before, data, SUPPLIER_FIELDS),
      });
      return s;
    });
  }

  /** Ngừng hợp tác is a status change: purchase history and payables stay. */
  setActive(id: string, isActive: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const s = await tx.supplier.update({ where: { id }, data: { isActive } });
      await this.audit.log(tx, {
        action: isActive ? 'supplier.activate' : 'supplier.deactivate', entityType: 'Supplier', entityId: id, entityCode: s.code,
        summary: `${isActive ? 'Hợp tác lại với' : 'Ngừng hợp tác với'} nhà cung cấp ${s.code} · ${s.name}`,
      });
      return s;
    });
  }

  // ---------- Danh mục hàng theo NCC ----------

  catalog() {
    return this.prisma.supplierProduct.findMany();
  }

  /** Adding an item that is already there updates its supplier code and price. */
  async upsertCatalogItem(supplierId: string, productId: string, dto: SupplierProductDto) {
    const key = { supplierId_productId: { supplierId, productId } };
    const before = await this.prisma.supplierProduct.findUnique({ where: key });
    const [supplier, product] = await Promise.all([
      this.prisma.supplier.findUnique({ where: { id: supplierId }, select: { code: true } }),
      this.prisma.product.findUnique({ where: { id: productId }, select: { code: true, name: true } }),
    ]);
    const data = { supplierCode: dto.supplierCode ?? null, purchasePrice: dto.purchasePrice };
    const item = await this.prisma.$transaction(async (tx) => {
      const saved = before
        ? await tx.supplierProduct.update({ where: key, data })
        : await tx.supplierProduct.create({ data: { supplierId, productId, ...data } });
      await this.audit.log(tx, {
        action: before ? 'supplier.catalog_update' : 'supplier.catalog_add', entityType: 'Supplier', entityId: supplierId, entityCode: supplier?.code,
        summary: `${before ? 'Sửa' : 'Thêm'} mặt hàng ${product?.code ?? productId} · ${product?.name ?? ''} trong danh mục NCC`,
        changes: diff(before, data, { supplierCode: 'Mã theo NCC', purchasePrice: 'Giá mua' }),
        related: product ? [product.code] : undefined,
      });
      return saved;
    });
    return { result: before ? 'updated' : 'added', item };
  }

  async removeCatalogItem(supplierId: string, productId: string): Promise<void> {
    const [supplier, product] = await Promise.all([
      this.prisma.supplier.findUnique({ where: { id: supplierId }, select: { code: true } }),
      this.prisma.product.findUnique({ where: { id: productId }, select: { code: true, name: true } }),
    ]);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.supplierProduct.deleteMany({ where: { supplierId, productId } });
      if (!count) throw new NotFoundException('Mặt hàng không có trong danh mục của nhà cung cấp này');
      await this.audit.log(tx, {
        action: 'supplier.catalog_remove', entityType: 'Supplier', entityId: supplierId, entityCode: supplier?.code,
        summary: `Bỏ mặt hàng ${product?.code ?? productId} · ${product?.name ?? ''} khỏi danh mục NCC`, related: product ? [product.code] : undefined,
      });
    });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get('suppliers')
  findAll() {
    return this.suppliers.findAll();
  }

  @RequirePermissions('supplier.create')
  @Post('suppliers')
  create(@Body() dto: SupplierDto) {
    return this.suppliers.create(dto);
  }

  @RequirePermissions('supplier.update')
  @Put('suppliers/:id')
  update(@Param('id') id: string, @Body() dto: SupplierDto) {
    return this.suppliers.update(id, dto);
  }

  @RequirePermissions('supplier.delete')
  @Patch('suppliers/:id/active')
  setActive(@Param('id') id: string, @Body() dto: ActiveDto) {
    return this.suppliers.setActive(id, dto.isActive);
  }

  // Purchase prices: only for roles that may see suppliers.
  @RequirePermissions('supplier.view')
  @Get('supplier-products')
  catalog() {
    return this.suppliers.catalog();
  }

  @RequirePermissions('supplier.manage_product')
  @Put('suppliers/:id/products/:productId')
  upsertCatalogItem(@Param('id') id: string, @Param('productId') productId: string, @Body() dto: SupplierProductDto) {
    return this.suppliers.upsertCatalogItem(id, productId, dto);
  }

  @RequirePermissions('supplier.manage_product')
  @Delete('suppliers/:id/products/:productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCatalogItem(@Param('id') id: string, @Param('productId') productId: string) {
    return this.suppliers.removeCatalogItem(id, productId);
  }
}

@Module({ controllers: [SuppliersController], providers: [SuppliersService], exports: [SuppliersService] })
export class SuppliersModule {}
