import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';

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
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string; user: AuthUser }> {
    const account = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    // Same message for unknown, locked and wrong password: the screen must not reveal which accounts exist.
    if (!account || account.status !== 'ACTIVE') throw new UnauthorizedException('Sai email hoặc mật khẩu');
    if (!(await bcrypt.compare(password, account.passwordHash))) throw new UnauthorizedException('Sai email hoặc mật khẩu');

    await this.prisma.user.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });
    const user = await this.loadUser(account.id);
    if (!user) throw new UnauthorizedException('Sai email hoặc mật khẩu');
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
