import { ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { AuthUser } from './auth.service.js';

const ALLOW_PENDING_PASSWORD = 'allowPendingPassword';

/** A route an account that must change its password may still call (đọc phiên, đổi mật khẩu). */
export const AllowWhilePasswordChange = () => SetMetadata(ALLOW_PENDING_PASSWORD, true);

/**
 * Signed-in check. An account with mustChangePassword (mật khẩu do quản trị cấp hoặc đặt lại) gets nothing else until it
 * picks its own password — the screen sends it to /doi-mat-khau, and the server refuses the rest so a stolen temporary
 * password is not enough to use the data.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ok = (await super.canActivate(context)) as boolean;
    if (!ok) return false;
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user?.mustChangePassword) return true;
    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD, [context.getHandler(), context.getClass()]);
    if (allowed) return true;
    throw new ForbiddenException('Bạn cần đổi mật khẩu trước khi tiếp tục.');
  }
}
