import { Body, ConflictException, Controller, Get, Injectable, NotFoundException, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { RequirePermissions } from '../../auth/permissions.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Text } from '../../common/dto.js';
import { foldVi } from '../../common/text.js';

export class NameDto {
  @Text(100) name!: string;
}

type Table = 'warehouse' | 'productCategory';
const LABEL: Record<Table, string> = { warehouse: 'kho', productCategory: 'nhóm hàng' };

// Kho and nhóm hàng are plain name lists. Never deleted: products and vouchers point at them.
@Injectable()
export class LookupsService {
  constructor(private readonly prisma: PrismaService) {}

  list(table: Table) {
    return (this.prisma[table] as any).findMany({ orderBy: { name: 'asc' } }) as Promise<{ id: string; name: string }[]>;
  }

  async save(table: Table, name: string, id?: string) {
    const all = await this.list(table);
    if (id && !all.some((x) => x.id === id)) throw new NotFoundException(`Không tìm thấy ${LABEL[table]}`);
    if (all.some((x) => x.id !== id && foldVi(x.name) === foldVi(name))) throw new ConflictException(`Đã có ${LABEL[table]} "${name}".`);
    const delegate = this.prisma[table] as any;
    return id ? delegate.update({ where: { id }, data: { name } }) : delegate.create({ data: { name } });
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
