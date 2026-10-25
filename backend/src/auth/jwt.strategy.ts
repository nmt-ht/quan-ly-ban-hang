import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { currentTenantCode } from '../platform/tenant.context.js';
import { AuthService, AuthUser, JwtPayload } from './auth.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly auth: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-secret-change-me'),
    });
  }

  // Whatever this returns becomes `req.user`. One small query per request keeps permissions
  // current: a locked account, revoked sessions or a role edit take effect without waiting for the
  // token to expire.
  async validate(payload: JwtPayload): Promise<AuthUser> {
    // A token works only for the doanh nghiệp it was issued for: user ids of two databases may collide.
    if ((payload.tid ?? null) !== (currentTenantCode() ?? null)) throw new UnauthorizedException('Phiên đăng nhập không thuộc doanh nghiệp này');
    const user = await this.auth.loadUser(payload.sub, payload.iat);
    if (!user) throw new UnauthorizedException('Phiên đăng nhập không còn hiệu lực');
    return user;
  }
}
