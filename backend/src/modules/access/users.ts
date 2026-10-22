import {
  BadRequestException, Body, ConflictException, Controller, Get, HttpCode, HttpStatus, Injectable, NotFoundException, Param, Post, Put, UseGuards,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { User } from '@prisma/client';
import { IsBoolean, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/permissions.guard.js';
import { CurrentUser, RequirePermissions } from '../../auth/permissions.decorator.js';
import type { AuthUser } from '../../auth/auth.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OptionalText, Text } from '../../common/dto.js';

export const SYSTEM_ROLE = 'role-ceo';
const TOKEN_HOURS = 12; // keep in step with signOptions.expiresIn in auth.module.ts

export class UserDto {
  @Text(100) name!: string;
  @Text(200) email!: string;
  @Text(60) roleId!: string;
  @OptionalText(30) phone?: string;
  @OptionalText(500) note?: string;
}

export class CreateUserDto extends UserDto {
  @IsString() password!: string;
}

export class LockDto {
  @OptionalText(300) reason?: string;
}

export class ResetPasswordDto {
  @IsString() password!: string;
  @IsBoolean() mustChange!: boolean;
}

/** Mật khẩu: từ 8 ký tự, có cả chữ và số (same rule as the frontend's passwordIssue). */
function checkPassword(pw: string): void {
  if (pw.length < 8) throw new BadRequestException('Mật khẩu từ 8 ký tự');
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) throw new BadRequestException('Mật khẩu phải có cả chữ và số');
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The frontend's AppUser. Tokens are stateless, so "phiên mở" is an estimate: 1 when the last
 * sign-in is younger than a token's lifetime and was not revoked since, else 0.
 */
function toApi(u: User) {
  const { passwordHash: _h, sessionsRevokedAt, ...rest } = u;
  const login = u.lastLoginAt?.getTime() ?? 0;
  const open = login > Date.now() - TOKEN_HOURS * 3_600_000 && login > (sessionsRevokedAt?.getTime() ?? 0) && u.status === 'ACTIVE';
  return { ...rest, openSessions: open ? 1 : 0 };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return (await this.prisma.user.findMany({ orderBy: { name: 'asc' } })).map(toApi);
  }

  /** Names for every screen (người lập, người bán, tài xế): no contact details, no login history. */
  directory() {
    return this.prisma.user.findMany({ select: { id: true, name: true, email: true, roleId: true, status: true }, orderBy: { name: 'asc' } });
  }

  private async find(id: string): Promise<User> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('Không tìm thấy người dùng');
    return u;
  }

  private async clean(dto: UserDto, selfId: string | null) {
    const email = dto.email.toLowerCase();
    if (!EMAIL.test(email)) throw new BadRequestException('Email không hợp lệ');
    const taken = await this.prisma.user.findUnique({ where: { email } });
    if (taken && taken.id !== selfId) throw new ConflictException('Email đã được dùng');
    if (!(await this.prisma.role.findUnique({ where: { id: dto.roleId } }))) throw new BadRequestException('Chức vụ không tồn tại');
    return { name: dto.name, email, roleId: dto.roleId, phone: dto.phone ?? null, note: dto.note ?? null };
  }

  /** The last active account holding the system role (CEO) must stay active and keep the role. */
  private async isLastAdmin(u: User): Promise<boolean> {
    if (u.roleId !== SYSTEM_ROLE || u.status !== 'ACTIVE') return false;
    const others = await this.prisma.user.count({ where: { roleId: SYSTEM_ROLE, status: 'ACTIVE', NOT: { id: u.id } } });
    return others === 0;
  }

  async create(dto: CreateUserDto) {
    checkPassword(dto.password);
    const data = await this.clean(dto, null);
    const now = new Date();
    const u = await this.prisma.user.create({
      data: { ...data, passwordHash: await bcrypt.hash(dto.password, 10), passwordUpdatedAt: now, mustChangePassword: true },
    });
    return toApi(u);
  }

  async update(id: string, dto: UserDto) {
    const u = await this.find(id);
    const data = await this.clean(dto, id);
    if (data.roleId !== u.roleId && (await this.isLastAdmin(u))) throw new BadRequestException('Đây là tài khoản CEO cuối cùng — không đổi chức vụ được.');
    return toApi(await this.prisma.user.update({ where: { id }, data }));
  }

  /** Khoá: the account stays (vouchers keep its name), every session ends, it cannot sign in. */
  async lock(id: string, reason: string | undefined, me: AuthUser) {
    const u = await this.find(id);
    if (u.id === me.id) throw new BadRequestException('Không tự khoá tài khoản của mình.');
    if (await this.isLastAdmin(u)) throw new BadRequestException('Đây là tài khoản CEO cuối cùng — không khoá được.');
    const now = new Date();
    return toApi(await this.prisma.user.update({
      where: { id }, data: { status: 'DISABLED', lockedAt: now, lockedReason: reason ?? null, sessionsRevokedAt: now },
    }));
  }

  async unlock(id: string) {
    await this.find(id);
    return toApi(await this.prisma.user.update({ where: { id }, data: { status: 'ACTIVE', lockedAt: null, lockedReason: null } }));
  }

  /** Đặt lại mật khẩu: every session ends; optionally the user must pick a new one at next sign-in. */
  async resetPassword(id: string, password: string, mustChange: boolean) {
    checkPassword(password);
    await this.find(id);
    const now = new Date();
    return toApi(await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(password, 10), passwordUpdatedAt: now, mustChangePassword: mustChange, sessionsRevokedAt: now },
    }));
  }

  async endSessions(id: string) {
    await this.find(id);
    return toApi(await this.prisma.user.update({ where: { id }, data: { sessionsRevokedAt: new Date() } }));
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @RequirePermissions('user.view')
  @Get()
  findAll() {
    return this.users.findAll();
  }

  @Get('directory')
  directory() {
    return this.users.directory();
  }

  @RequirePermissions('user.create')
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @RequirePermissions('user.update')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UserDto) {
    return this.users.update(id, dto);
  }

  // "Xoá người dùng" in the catalog means khoá: accounts are never removed.
  @RequirePermissions('user.delete')
  @Post(':id/lock')
  @HttpCode(HttpStatus.OK)
  lock(@Param('id') id: string, @Body() dto: LockDto, @CurrentUser() me: AuthUser) {
    return this.users.lock(id, dto.reason, me);
  }

  @RequirePermissions('user.delete')
  @Post(':id/unlock')
  @HttpCode(HttpStatus.OK)
  unlock(@Param('id') id: string) {
    return this.users.unlock(id);
  }

  @RequirePermissions('user.reset_password')
  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.users.resetPassword(id, dto.password, dto.mustChange);
  }

  @RequirePermissions('user.update')
  @Post(':id/end-sessions')
  @HttpCode(HttpStatus.OK)
  endSessions(@Param('id') id: string) {
    return this.users.endSessions(id);
  }
}
