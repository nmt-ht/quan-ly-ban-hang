import { Body, ConflictException, Controller, Get, Injectable, NotFoundException, Param, Post, Put, UseGuards } from '@nestjs/common';
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

// Kho and nhóm hàng are plain name lists. Never deleted: products and vouchers point at them.
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
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly lookups: LookupsService) {}

  @Get()
  findAll() {
    return this.lookups.list('warehouse');
  }

  @RequirePermissions('warehouse.create')
  @Post()
  create(@Body() dto: NameDto) {
    return this.lookups.save('warehouse', dto.name);
  }

  @RequirePermissions('warehouse.update')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: NameDto) {
    return this.lookups.save('warehouse', dto.name, id);
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
}
