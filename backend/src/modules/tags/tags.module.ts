import {
  Body, ConflictException, Controller, Delete, Get, HttpCode, HttpStatus, Injectable, Module, NotFoundException, Param, Patch, Post, Put, UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { RequirePermissions } from '../../auth/permissions.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Text } from '../../common/dto.js';
import { foldVi } from '../../common/text.js';

// Same keys as the frontend's TagColorKey (shared/tag-colors.ts).
const COLORS = ['gray', 'red', 'orange', 'amber', 'lime', 'emerald', 'teal', 'cyan', 'blue', 'indigo', 'violet', 'pink'];

export class TagDto {
  @Text(40) name!: string;
  @IsOptional() @IsIn(COLORS) color?: string;
  @IsInt() @Min(0) sortOrder!: number;
  @IsBoolean() isActive!: boolean;
}

export class ActiveDto {
  @IsBoolean() isActive!: boolean;
}

const SELECT = { id: true, name: true, color: true, sortOrder: true, isActive: true } as const;

// Thẻ đánh dấu: one list shared by đơn hàng bán and khách hàng.
@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.tag.findMany({ select: SELECT, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async save(dto: TagDto, id?: string) {
    const all = await this.prisma.tag.findMany({ select: { id: true, name: true } });
    if (id && !all.some((t) => t.id === id)) throw new NotFoundException('Không tìm thấy thẻ');
    if (all.some((t) => t.id !== id && foldVi(t.name) === foldVi(dto.name))) throw new ConflictException(`Đã có thẻ "${dto.name}".`);
    const data = { name: dto.name, color: dto.color ?? null, sortOrder: dto.sortOrder, isActive: dto.isActive };
    return id ? this.prisma.tag.update({ where: { id }, data, select: SELECT }) : this.prisma.tag.create({ data, select: SELECT });
  }

  setActive(id: string, isActive: boolean) {
    return this.prisma.tag.update({ where: { id }, data: { isActive }, select: SELECT });
  }

  /** Only a tag nobody uses can go; one in use is switched off (Ngừng dùng) to keep history. */
  async remove(id: string): Promise<void> {
    const [orders, customers] = await Promise.all([
      this.prisma.salesOrderTag.count({ where: { tagId: id } }),
      this.prisma.customerTag.count({ where: { tagId: id } }),
    ]);
    if (orders || customers) throw new ConflictException('Thẻ đang được dùng — chọn Ngừng dùng thay vì xoá.');
    await this.prisma.tag.delete({ where: { id } });
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  findAll() {
    return this.tags.findAll();
  }

  @RequirePermissions('tag.manage')
  @Post()
  create(@Body() dto: TagDto) {
    return this.tags.save(dto);
  }

  @RequirePermissions('tag.manage')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: TagDto) {
    return this.tags.save(dto, id);
  }

  @RequirePermissions('tag.manage')
  @Patch(':id/active')
  setActive(@Param('id') id: string, @Body() dto: ActiveDto) {
    return this.tags.setActive(id, dto.isActive);
  }

  @RequirePermissions('tag.manage')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.tags.remove(id);
  }
}

@Module({ controllers: [TagsController], providers: [TagsService] })
export class TagsModule {}
