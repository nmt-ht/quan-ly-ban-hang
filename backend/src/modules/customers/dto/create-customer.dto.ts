import { CustomerType } from '@prisma/client';
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateCustomerDto {
  @IsString() @MinLength(1) name!: string;

  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsEnum(CustomerType) type?: CustomerType;
  @IsOptional() @IsInt() @Min(0) creditDays?: number;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() idNumber?: string;
  @IsOptional() @IsString() personalTaxCode?: string;
  @IsOptional() @IsString() companyTaxCode?: string;
  @IsOptional() @IsString() note?: string;
}
