import { ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';
import type { AuthUser } from './auth.service.js';

export const PERMISSIONS_KEY = 'permissions';
export const ANY_PERMISSIONS_KEY = 'anyPermissions';

// Usage: @RequirePermissions('product.create') — the caller needs every code listed.
// Codes match the catalog seeded in prisma/seed.ts (frontend core/data/permission-catalog.ts).
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

// Usage: @RequireAnyPermission('position.view', 'user.view') — one of the codes is enough.
export const RequireAnyPermission = (...permissions: string[]) => SetMetadata(ANY_PERMISSIONS_KEY, permissions);

/** The signed-in user (set by JwtStrategy). Only on routes behind JwtAuthGuard. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);
