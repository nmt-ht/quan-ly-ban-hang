import { BadRequestException, Body, ConflictException, Controller, Get, Injectable, NotFoundException, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { RequireAnyPermission, RequirePermissions } from '../../auth/permissions.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OptionalText, Text } from '../../common/dto.js';
import { foldVi } from '../../common/text.js';
import { AuditService } from '../../audit/audit.service.js';
import { diff } from '../../audit/audit.diff.js';

export class RoleDto {
  @Text(60) name!: string;
  @OptionalText(500) description?: string;
}

export class CreateRoleDto extends RoleDto {
  @OptionalText(60) copyFromId?: string;
}

export class PermissionsDto {
  @IsArray() @IsString({ each: true }) codes!: string[];
}

export class ActiveDto {
  @IsBoolean() isActive!: boolean;
}

const INCLUDE = { permissions: { select: { permissionCode: true } }, _count: { select: { users: true } } } as const;

// Chức vụ & phân quyền. The system role (CEO) is read-only; roles are switched off (Ngừng dùng),
// never deleted, so accounts and history keep their meaning.
@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** The frontend's Role: permission codes plus the counts the list shows. */
  async findAll() {
    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({ include: INCLUDE, orderBy: { createdAt: 'asc' } }),
      this.prisma.permission.count(),
    ]);
    return roles.map(({ permissions, _count, createdAt: _c, ...r }) => ({
      ...r,
      description: r.description ?? '',
      permissions: permissions.map((p) => p.permissionCode),
      permissionCount: permissions.length,
      totalPermissionCount: total,
      userCount: _count.users,
    }));
  }

  private async one(id: string) {
    return (await this.findAll()).find((r) => r.id === id)!;
  }

  private async editable(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Không tìm thấy chức vụ.');
    if (role.isSystem) throw new BadRequestException('Chức vụ hệ thống không sửa được.');
    return role;
  }

  private async checkName(name: string, selfId: string | null) {
    const all = await this.prisma.role.findMany({ select: { id: true, name: true } });
    if (all.some((r) => r.id !== selfId && foldVi(r.name) === foldVi(name))) throw new ConflictException(`Đã có chức vụ "${name}".`);
  }

  async create(dto: CreateRoleDto) {
    await this.checkName(dto.name, null);
    const codes = dto.copyFromId
      ? (await this.prisma.rolePermission.findMany({ where: { roleId: dto.copyFromId }, select: { permissionCode: true } })).map((p) => p.permissionCode)
      : [];
    const from = dto.copyFromId ? await this.prisma.role.findUnique({ where: { id: dto.copyFromId }, select: { name: true } }) : null;
    const role = await this.prisma.$transaction(async (tx) => {
      const r = await tx.role.create({
        data: { name: dto.name, description: dto.description ?? null, permissions: { create: codes.map((permissionCode) => ({ permissionCode })) } },
      });
      await this.audit.log(tx, {
        action: 'role.create', entityType: 'Role', entityId: r.id, entityCode: r.name,
        summary: `Tạo chức vụ ${r.name}` + (from ? `, lấy ${codes.length} quyền từ ${from.name}` : ''),
      });
      return r;
    });
    return this.one(role.id);
  }

  async update(id: string, dto: RoleDto) {
    const before = await this.editable(id);
    await this.checkName(dto.name, id);
    const data = { name: dto.name, description: dto.description ?? null };
    await this.prisma.$transaction(async (tx) => {
      await tx.role.update({ where: { id }, data });
      await this.audit.log(tx, {
        action: 'role.update', entityType: 'Role', entityId: id, entityCode: dto.name, summary: `Sửa chức vụ ${dto.name}`,
        changes: diff(before, data, { name: 'Tên chức vụ', description: 'Mô tả' }),
      });
    });
    return this.one(id);
  }

  /** Unknown codes are dropped; the change applies to signed-in users on their next request. */
  async setPermissions(id: string, codes: string[]) {
    const role = await this.editable(id);
    const catalog = await this.prisma.permission.findMany({ select: { code: true, label: true } });
    const label = new Map(catalog.map((p) => [p.code, p.label]));
    const granted = [...new Set(codes)].filter((c) => label.has(c));
    const had = new Set((await this.prisma.rolePermission.findMany({ where: { roleId: id }, select: { permissionCode: true } })).map((p) => p.permissionCode));
    const added = granted.filter((c) => !had.has(c));
    const removed = [...had].filter((c) => !granted.includes(c));
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.rolePermission.createMany({ data: granted.map((permissionCode) => ({ roleId: id, permissionCode })) });
      await this.audit.log(tx, {
        action: 'role.set_permissions', entityType: 'Role', entityId: id, entityCode: role.name,
        summary: `Phân quyền chức vụ ${role.name}: thêm ${added.length}, bỏ ${removed.length} quyền`,
        changes: [
          ...(added.length ? [{ field: 'added', label: 'Thêm quyền', from: null, to: added.map((c) => label.get(c)!) }] : []),
          ...(removed.length ? [{ field: 'removed', label: 'Bỏ quyền', from: removed.map((c) => label.get(c) ?? c), to: null }] : []),
        ],
      });
    });
    return this.one(id);
  }

  async setActive(id: string, isActive: boolean) {
    const role = await this.editable(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.role.update({ where: { id }, data: { isActive } });
      await this.audit.log(tx, {
        action: isActive ? 'role.activate' : 'role.deactivate', entityType: 'Role', entityId: id, entityCode: role.name,
        summary: `${isActive ? 'Dùng lại' : 'Ngừng dùng'} chức vụ ${role.name}`,
      });
    });
    return this.one(id);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  // The user screens show and pick roles too.
  @RequireAnyPermission('position.view', 'user.view')
  @Get()
  findAll() {
    return this.roles.findAll();
  }

  @RequirePermissions('position.create')
  @Post()
  create(@Body() dto: CreateRoleDto) {
    return this.roles.create(dto);
  }

  @RequirePermissions('position.update')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: RoleDto) {
    return this.roles.update(id, dto);
  }

  @RequirePermissions('position.assign_permission')
  @Put(':id/permissions')
  setPermissions(@Param('id') id: string, @Body() dto: PermissionsDto) {
    return this.roles.setPermissions(id, dto.codes);
  }

  @RequirePermissions('position.update')
  @Patch(':id/active')
  setActive(@Param('id') id: string, @Body() dto: ActiveDto) {
    return this.roles.setActive(id, dto.isActive);
  }
}
