import { IsString, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString() @MaxLength(200)
  currentPassword!: string;

  @IsString() @MaxLength(200)
  newPassword!: string;
}
