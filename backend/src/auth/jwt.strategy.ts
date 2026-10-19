import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  permissions: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-secret-change-me'),
    });
  }

  // Whatever this returns becomes `req.user`. Permissions are baked into the
  // token at login time (see auth.service.ts) so this guard never needs a
  // DB round trip; a role/permission change requires the user to re-login.
  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
