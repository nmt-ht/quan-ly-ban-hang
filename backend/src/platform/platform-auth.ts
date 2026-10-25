import { CanActivate, ExecutionContext, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, timingSafeEqual } from 'node:crypto';
import { PlatformDbService } from './platform-db.service.js';
import { multiTenant, platformKey } from './secret-box.js';
import { newTotpSecret, otpauthUrl, verifyTotp } from './totp.js';

/** What the sign-in answers: ask for the code, show the secret to scan (first time), or the session. */
export type OwnerLoginResult =
  | { step: 'totp' }
  | { step: 'enroll'; secret: string; otpauthUrl: string }
  | { step: 'done'; accessToken: string; expiresInSeconds: number };

const SESSION_SECONDS = 8 * 3600;
const FAILED = 'Sai email, mật khẩu hoặc mã xác thực.';

const sameText = (a: string, b: string) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

/**
 * Chủ nền tảng: exactly one account, defined by PLATFORM_OWNER_EMAIL and PLATFORM_OWNER_PASSWORD (never
 * stored in a database a doanh nghiệp can reach), plus a 6-digit code from an authenticator app. The first
 * correct password shows the secret to scan; the first correct code confirms it.
 */
@Injectable()
export class PlatformAuthService {
  private readonly jwt = new JwtService({});

  constructor(private readonly platform: PlatformDbService) {}

  ownerConfigured(): boolean {
    return !!process.env.PLATFORM_OWNER_EMAIL && (process.env.PLATFORM_OWNER_PASSWORD ?? '').length >= 12;
  }

  async login(email: string, password: string, code: string | undefined, ip: string | null): Promise<OwnerLoginResult> {
    if (!multiTenant()) throw new NotFoundException('Chưa bật chế độ nhiều doanh nghiệp.');
    if (!this.ownerConfigured()) throw new ServiceUnavailableException('Chưa cấu hình tài khoản chủ nền tảng (PLATFORM_OWNER_EMAIL, PLATFORM_OWNER_PASSWORD từ 12 ký tự).');
    const okPassword =
      sameText(email.trim().toLowerCase(), process.env.PLATFORM_OWNER_EMAIL!.trim().toLowerCase()) && sameText(password, process.env.PLATFORM_OWNER_PASSWORD!);
    if (!okPassword) return this.fail(ip, 'sai email hoặc mật khẩu');

    const owner = await this.platform.owner();
    if (!owner.totpSecret) {
      const secret = owner.totpPending ?? newTotpSecret();
      if (!code) {
        if (!owner.totpPending) await this.platform.setPendingTotp(secret);
        return { step: 'enroll', secret, otpauthUrl: otpauthUrl(secret, process.env.PLATFORM_OWNER_EMAIL!) };
      }
      const step = verifyTotp(secret, code);
      if (step === null) return this.fail(ip, 'mã xác thực sai khi đăng ký');
      await this.platform.confirmTotp(secret, step);
      await this.platform.audit('owner.totp_enroll', null, 'Đăng ký ứng dụng xác thực cho chủ nền tảng', ip);
      return this.session(ip);
    }

    if (!code) return { step: 'totp' };
    const step = verifyTotp(owner.totpSecret, code);
    if (step === null || !(await this.platform.useTotpStep(step))) return this.fail(ip, step === null ? 'sai mã xác thực' : 'mã xác thực đã dùng');
    return this.session(ip);
  }

  private async session(ip: string | null): Promise<OwnerLoginResult> {
    await this.platform.audit('owner.login', null, 'Chủ nền tảng đăng nhập', ip);
    const accessToken = await this.jwt.signAsync({ sub: 'owner', scope: 'platform' }, { secret: platformKey('jwt'), expiresIn: SESSION_SECONDS });
    return { step: 'done', accessToken, expiresInSeconds: SESSION_SECONDS };
  }

  private async fail(ip: string | null, reason: string): Promise<never> {
    await this.platform.audit('owner.login_failed', null, `Đăng nhập quản trị nền tảng thất bại (${reason})`, ip);
    throw new UnauthorizedException(FAILED);
  }

  async verify(token: string): Promise<boolean> {
    try {
      const payload = await this.jwt.verifyAsync<{ scope?: string }>(token, { secret: platformKey('jwt') });
      return payload.scope === 'platform';
    } catch {
      return false;
    }
  }
}

/** Every platform route except sign-in: a bearer token signed with PLATFORM_SECRET, scope "platform". */
@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(private readonly auth: PlatformAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!multiTenant()) throw new NotFoundException('Chưa bật chế độ nhiều doanh nghiệp.');
    const header = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>().headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token || !(await this.auth.verify(token))) throw new UnauthorizedException('Phiên quản trị nền tảng đã hết, vui lòng đăng nhập lại.');
    return true;
  }
}
