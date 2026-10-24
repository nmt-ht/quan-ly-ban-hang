import { BadRequestException } from '@nestjs/common';

/** Mật khẩu: từ 8 ký tự, có cả chữ và số (same rule as the frontend's passwordIssue). */
export function checkPassword(pw: string): void {
  if (pw.length < 8) throw new BadRequestException('Mật khẩu từ 8 ký tự');
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) throw new BadRequestException('Mật khẩu phải có cả chữ và số');
}
