import {
  BadRequestException, Body, ConflictException, Controller, Delete, Get, Injectable, NotFoundException, Param, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { RequirePermissions } from '../../auth/permissions.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Text } from '../../common/dto.js';
import { foldVi } from '../../common/text.js';
import { AuditService } from '../../audit/audit.service.js';

export class NameDto {
  @Text(100) name!: string;
}

type Table = 'warehouse' | 'productCategory';
const LABEL: Record<Table, string> = { warehouse: 'kho', productCategory: 'nhóm hàng' };
const ENTITY: Record<Table, string> = { warehouse: 'Warehouse', productCategory: 'ProductCategory' };

// Nhóm hàng is a plain name list (Kho has its own record and service: warehouses.ts; list('warehouse') stays for
// readers such as reports). A nhóm hàng may be deleted once its products have been moved to another nhóm (or out of
// any) — that is how two nhóm are merged.
@Injectable()
export class LookupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(table: Table) {
    return (this.prisma[table] as any).findMany({ orderBy: { name: 'asc' } }) as Promise<{ id: string; name: string }[]>;
  }

  async save(table: Table, name: string, id?: string) {
    const all = await this.list(table);
    const before = id ? all.find((x) => x.id === id) : undefined;
    if (id && !before) throw new NotFoundException(`Không tìm thấy ${LABEL[table]}`);
    if (all.some((x) => x.id !== id && foldVi(x.name) === foldVi(name))) throw new ConflictException(`Đã có ${LABEL[table]} "${name}".`);
    return this.prisma.$transaction(async (tx) => {
      const delegate = tx[table] as any;
      const row = (id ? await delegate.update({ where: { id }, data: { name } }) : await delegate.create({ data: { name } })) as { id: string; name: string };
      await this.audit.log(tx, {
        action: `${table === 'warehouse' ? 'warehouse' : 'category'}.${id ? 'update' : 'create'}`, entityType: ENTITY[table], entityId: row.id, entityCode: name,
        summary: id ? `Đổi tên ${LABEL[table]} "${before!.name}" thành "${name}"` : `Thêm ${LABEL[table]} ${name}`,
      });
      return row;
    });
  }

  /**
   * Deletes a nhóm hàng. Its products must go somewhere first: `moveTo` = another nhóm's id, or 'none' to leave them
   * without one. Each moved product gets its own Nhật ký line (Nhóm hàng: A → B), so its history shows the move.
   */
  async removeCategory(id: string, moveTo: string | undefined) {
    const all = await this.list('productCategory');
    const cat = all.find((x) => x.id === id);
    if (!cat) throw new NotFoundException('Không tìm thấy nhóm hàng');
    const target = moveTo && moveTo !== 'none' ? all.find((x) => x.id === moveTo && x.id !== id) : undefined;
    if (moveTo && moveTo !== 'none' && !target) throw new BadRequestException('Nhóm hàng chuyển sang không hợp lệ');
    return this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({ where: { categoryId: id }, select: { id: true, code: true }, orderBy: { code: 'asc' } });
      if (products.length && !moveTo) {
        throw new ConflictException(`Nhóm "${cat.name}" đang có ${products.length} mặt hàng — chọn nhóm chuyển các mặt hàng sang trước khi xoá.`);
      }
      if (products.length) {
        await tx.product.updateMany({ where: { categoryId: id }, data: { categoryId: target?.id ?? null } });
        for (const p of products) {
          await this.audit.log(tx, {
            action: 'product.update', entityType: 'Product', entityId: p.id, entityCode: p.code,
            summary: target ? `Chuyển sang nhóm ${target.name} (xoá nhóm ${cat.name})` : `Bỏ khỏi nhóm ${cat.name} (nhóm bị xoá)`,
            changes: [{ field: 'categoryId', label: 'Nhóm hàng', from: cat.name, to: target?.name ?? null }],
          });
        }
      }
      await tx.productCategory.delete({ where: { id } });
      await this.audit.log(tx, {
        action: 'category.delete', entityType: 'ProductCategory', entityId: id, entityCode: cat.name,
        summary: products.length
          ? `Xoá nhóm hàng ${cat.name}, chuyển ${products.length} mặt hàng ${target ? 'sang ' + target.name : 'ra khỏi nhóm'}`
          : `Xoá nhóm hàng ${cat.name}`,
        related: products.map((p) => p.code),
      });
      return { moved: products.length };
    });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly lookups: LookupsService) {}

  @Get()
  findAll() {
    return this.lookups.list('productCategory');
  }

  @RequirePermissions('category.create')
  @Post()
  create(@Body() dto: NameDto) {
    return this.lookups.save('productCategory', dto.name);
  }

  @RequirePermissions('category.update')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: NameDto) {
    return this.lookups.save('productCategory', dto.name, id);
  }

  /** ?moveTo=<nhóm id> | none — where the nhóm's products go; required when it has any. */
  @RequirePermissions('category.delete')
  @Delete(':id')
  remove(@Param('id') id: string, @Query('moveTo') moveTo?: string) {
    return this.lookups.removeCategory(id, moveTo?.trim() || undefined);
  }
}
