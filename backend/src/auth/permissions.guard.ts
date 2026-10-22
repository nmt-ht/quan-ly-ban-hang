import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ANY_PERMISSIONS_KEY, PERMISSIONS_KEY } from './permissions.decorator.js';
import { AuthUser } from './auth.service.js';

// Runs after JwtAuthGuard. Checks the codes set via @RequirePermissions (all of them) or
// @RequireAnyPermission (one of them) against the caller's role, which JwtStrategy reads from
// the database on every request — the matrix from Chức vụ & phân quyền. A route with neither
// is open to every signed-in user (danh mục reads: other screens need the names).
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const all = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, targets) ?? [];
    const any = this.reflector.getAllAndOverride<string[]>(ANY_PERMISSIONS_KEY, targets) ?? [];
    if (!all.length && !any.length) return true;

    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user) return false;

    const granted = new Set(user.permissions);
    const missing = all.filter((p) => !granted.has(p));
    if (missing.length) throw new ForbiddenException(`Chức vụ của bạn chưa có quyền: ${missing.join(', ')}`);
    if (any.length && !any.some((p) => granted.has(p))) {
      throw new ForbiddenException(`Chức vụ của bạn cần một trong các quyền: ${any.join(', ')}`);
    }
    return true;
  }
}
