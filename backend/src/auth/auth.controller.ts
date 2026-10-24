import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import type { AuthUser } from './auth.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { AllowWhilePasswordChange, JwtAuthGuard } from './jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  /** Who am I and what may I do — read fresh from the database (see JwtStrategy.validate). */
  @UseGuards(JwtAuthGuard)
  @AllowWhilePasswordChange()
  @Get('me')
  me(@Req() req: { user: AuthUser }): AuthUser {
    return req.user;
  }

  /** Đổi mật khẩu của chính mình: ends every other session and answers with a fresh token for this one. */
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @AllowWhilePasswordChange()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(@Req() req: { user: AuthUser }, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(req.user.id, dto.currentPassword, dto.newPassword);
  }
}
