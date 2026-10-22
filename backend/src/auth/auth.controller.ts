import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { AuthUser } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  /** Who am I and what may I do — read fresh from the database (see JwtStrategy.validate). */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: { user: AuthUser }): AuthUser {
    return req.user;
  }
}
