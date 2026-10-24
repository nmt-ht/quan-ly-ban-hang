import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Injectable, Module, NotFoundException, Param, Patch, Post, Put, UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequireAnyPermission, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { ImportDto, ImportResult, RowError, cellBool, cellNumber, cellText, fold, runImport, validateRow } from '../../common/import.js';
import { Prisma } from '@prisma/client';
import { seesPurchasePrices } from '../../common/purchase-prices.js';
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
    return this.prisma.$transaction((tx) => this.createIn(tx, dto));
  }

  /** Thêm NCC inside the caller's transaction (the form, or one row of an import). */
  async createIn(tx: Prisma.TransactionClient, dto: SupplierDto, source: 'form' | 'excel' = 'form') {
    const s = await tx.supplier.create({ data: { ...this.data(dto), code: await this.sequences.nextCode('NCC', tx) } });
    await this.audit.log(tx, {
      action: 'supplier.create', entityType: 'Supplier', entityId: s.id, entityCode: s.code,
      summary: `Thêm nhà cung cấp ${s.code} · ${s.name}${source === 'excel' ? ' (nhập Excel)' : ''}`,
    });
    return s;
  }

  update(id: string, dto: SupplierDto) {
    return this.prisma.$transaction((tx) => this.updateIn(tx, id, dto));
  }

  async updateIn(tx: Prisma.TransactionClient, id: string, dto: SupplierDto, source: 'form' | 'excel' = 'form') {
    const before = await tx.supplier.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Không tìm thấy nhà cung cấp');
    const data = this.data(dto);
    const s = await tx.supplier.update({ where: { id }, data });
    await this.audit.log(tx, {
      action: 'supplier.update', entityType: 'Supplier', entityId: id, entityCode: s.code,
      summary: `Sửa nhà cung cấp ${s.code} · ${s.name}${source === 'excel' ? ' (nhập Excel)' : ''}`, changes: diff(before, data, SUPPLIER_FIELDS),
    });
    return s;
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

const SUPPLIER_IMPORT_LABELS: Record<string, string> = {
  code: 'Mã NCC', name: 'Tên nhà cung cấp', contactPhone: 'Điện thoại', email: 'Email', taxCode: 'Mã số thuế', address: 'Địa chỉ',
  creditDays: 'Số ngày được nợ', note: 'Ghi chú', isActive: 'Còn hợp tác',
};

const digits = (s: string) => s.replace(/\D/g, '');

/**
 * Nhập nhà cung cấp từ Excel (Pha 1.9), cùng quy tắc với nhập khách hàng: có "Mã NCC" → cập nhật (ô trống hoặc cột không
 * có trong file giữ nguyên), không có → thêm mới; NCC mới trùng mã số thuế hoặc điện thoại với NCC đã có bị chặn.
 */
@Injectable()
export class SupplierImportService {
  constructor(private readonly prisma: PrismaService, private readonly suppliers: SuppliersService, private readonly audit: AuditService) {}

  async run(dto: ImportDto, user: AuthUser): Promise<ImportResult> {
    const all = await this.prisma.supplier.findMany();
    const byCode = new Map(all.map((s) => [fold(s.code), s]));
    const byTax = new Map(all.filter((s) => s.taxCode).map((s) => [fold(s.taxCode!), s]));
    const byPhone = new Map(all.filter((s) => s.contactPhone).map((s) => [digits(s.contactPhone!), s]));
    const canCreate = user.permissions.includes('supplier.create');
    const canUpdate = user.permissions.includes('supplier.update');
    const seen = new Set<string>();

    return runImport(this.prisma, dto, async (tx, r) => {
      const c = r.cells;
      // Ô trống (hoặc cột không có trong file) = giữ nguyên khi cập nhật, mặc định khi thêm mới.
      const has = (k: string) => cellText(c[k]) !== '';
      const errors: string[] = [];
      const code = cellText(c.code);
      const existing = code ? byCode.get(fold(code)) : undefined;
      if (code && !existing) errors.push(`không có nhà cung cấp mã "${code}" — để trống Mã NCC nếu muốn thêm mới`);
      if (existing && !canUpdate) errors.push('chức vụ của bạn chưa có quyền sửa nhà cung cấp');
      if (!code && !canCreate) errors.push('chức vụ của bạn chưa có quyền thêm nhà cung cấp');

      const text = (k: string, old?: string | null) => (has(k) ? cellText(c[k]) || undefined : old ?? undefined);
      const taxCode = text('taxCode', existing?.taxCode);
      const phone = text('contactPhone', existing?.contactPhone);
      const key = existing ? `id:${existing.id}` : taxCode ? `tax:${fold(taxCode)}` : `name:${fold(cellText(c.name))}`;
      if (seen.has(key)) errors.push('trùng với một dòng phía trên trong file');
      seen.add(key);
      const twin = existing ? undefined : (taxCode && byTax.get(fold(taxCode))) || (phone && byPhone.get(digits(phone))) || undefined;
      if (twin) errors.push(`trùng mã số thuế / điện thoại với ${twin.code} · ${twin.name} — ghi Mã NCC ${twin.code} để cập nhật`);

      let creditDays = existing?.creditDays ?? 0;
      if (has('creditDays')) {
        const n = cellNumber(c.creditDays);
        if (n !== null && (Number.isNaN(n) || n < 0 || !Number.isInteger(n))) errors.push('Số ngày được nợ phải là số nguyên không âm');
        else creditDays = n ?? 0;
      }
      const isActive = has('isActive') ? cellBool(c.isActive, true) : existing?.isActive ?? true;
      if (isActive === null) errors.push('Còn hợp tác phải là Có / Không');
      if (errors.length) throw new RowError(errors);

      const next = await validateRow(SupplierDto, {
        name: text('name', existing?.name), contactPhone: phone, email: text('email', existing?.email), taxCode,
        address: text('address', existing?.address), creditDays, note: text('note', existing?.note), isActive,
      }, SUPPLIER_IMPORT_LABELS);
      if (!existing) {
        const s = await this.suppliers.createIn(tx, next, 'excel');
        return { action: 'create', code: s.code, name: s.name };
      }
      const keys = Object.keys(SUPPLIER_FIELDS) as (keyof typeof SUPPLIER_FIELDS)[];
      const changes = keys.filter((k) => String(existing[k] ?? '') !== String(next[k] ?? '')).map((k) => SUPPLIER_FIELDS[k]);
      if (!changes.length) return { action: 'unchanged', code: existing.code, name: existing.name };
      await this.suppliers.updateIn(tx, existing.id, next, 'excel');
      return { action: 'update', code: existing.code, name: next.name, changes };
    }, async (tx, res) => {
      await this.audit.log(tx, {
        action: 'supplier.import', entityType: 'Supplier', entityId: 'import',
        summary: `Nhập nhà cung cấp từ Excel: ${res.created} thêm mới, ${res.updated} cập nhật, ${res.unchanged} không đổi, ${res.failed} dòng lỗi bỏ qua`,
      });
    });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService, private readonly imports: SupplierImportService) {}

  @Get('suppliers')
  findAll() {
    return this.suppliers.findAll();
  }

  /** Nhập Excel: dryRun = xem trước (không lưu gì). Dòng thêm mới cần supplier.create, dòng cập nhật cần supplier.update. */
  @RequireAnyPermission('supplier.create', 'supplier.update')
  @Post('suppliers/import')
  @HttpCode(HttpStatus.OK)
  import(@Body() dto: ImportDto, @CurrentUser() user: AuthUser) {
    return this.imports.run(dto, user);
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

  // Danh mục hàng theo NCC: roles that see suppliers; the giá mua only to who may see purchase prices.
  @RequirePermissions('supplier.view')
  @Get('supplier-products')
  async catalog(@CurrentUser() user: AuthUser) {
    const rows = await this.suppliers.catalog();
    return seesPurchasePrices(user) ? rows : rows.map((r) => ({ ...r, purchasePrice: null }));
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

@Module({ controllers: [SuppliersController], providers: [SuppliersService, SupplierImportService], exports: [SuppliersService] })
export class SuppliersModule {}
