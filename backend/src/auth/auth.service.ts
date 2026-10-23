import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

/** The signed-in user as every request sees it (`req.user`) and as /auth/me returns it. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  mustChangePassword: boolean;
}

// The token only carries the user id. Role and permissions are read from the database on every
// request, so locking an account or editing a role in Chức vụ & phân quyền applies at once.
export interface JwtPayload {
  sub: string;
  iat?: number; // seconds, set by jsonwebtoken
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string; user: AuthUser }> {
    const key = email.trim().toLowerCase();
    const account = await this.prisma.user.findUnique({ where: { email: key } });
    // Same message for unknown, locked and wrong password: the screen must not reveal which accounts exist.
    // The log keeps the real reason for whoever reads Nhật ký hoạt động.
    const reason = !account ? 'email không tồn tại' : account.status !== 'ACTIVE' ? 'tài khoản đã khoá'
      : !(await bcrypt.compare(password, account.passwordHash)) ? 'sai mật khẩu' : null;
    const user = reason ? null : await this.loadUser(account!.id);
    if (!user) {
      await this.audit.log(this.prisma, {
        action: 'auth.login_failed', entityType: 'User', entityId: account?.id ?? key, entityCode: key,
        summary: `Đăng nhập thất bại (${reason ?? 'chức vụ không còn hiệu lực'}): ${key}`,
        actor: { id: account?.id ?? null, name: account?.name ?? key },
      });
      throw new UnauthorizedException('Sai email hoặc mật khẩu');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      await this.audit.log(tx, {
        action: 'auth.login', entityType: 'User', entityId: user.id, entityCode: user.email,
        summary: `Đăng nhập (${user.roleName})`, actor: { id: user.id, name: user.name },
      });
    });
    const payload: JwtPayload = { sub: user.id };
    return { accessToken: await this.jwt.signAsync(payload), user };
  }

  /**
   * Null when the account no longer exists, is locked, or — given the token's `issuedAt` (seconds) —
   * its sessions were revoked after the token was issued. An inactive role grants nothing.
   */
  async loadUser(id: string, issuedAt?: number): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: { include: { permissions: { select: { permissionCode: true } } } } },
    });
    if (!user || user.status !== 'ACTIVE') return null;
    if (issuedAt !== undefined && user.sessionsRevokedAt && issuedAt < Math.floor(user.sessionsRevokedAt.getTime() / 1000)) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      roleName: user.role.name,
      permissions: user.role.isActive ? user.role.permissions.map((p) => p.permissionCode) : [],
      mustChangePassword: user.mustChangePassword,
    };
  }
}
