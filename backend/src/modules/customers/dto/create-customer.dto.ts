import { Type } from 'class-transformer';
import { CustomerType } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { OptionalEmail, OptionalText, Text } from '../../../common/dto.js';

export class CustomerAddressDto {
  @OptionalText(60) id?: string; // kept when given, so the frontend's ids stay stable
  @OptionalText(60) label?: string;
  @OptionalText(100) recipientName?: string;
  @OptionalText(30) phone?: string;
  @Text(300) address!: string;
  @IsBoolean() isDefault!: boolean;
}

/** The whole customer as the form saves it: PUT replaces every field, the tags and the addresses. */
export class CustomerDto {
  @Text(200) name!: string;
  @OptionalText(200) companyName?: string;
  @IsEnum(CustomerType) type!: CustomerType;
  @IsInt() @Min(0) creditDays!: number;
  @OptionalText(30) phone?: string;
  @OptionalEmail() email?: string;
  @OptionalText(30) idNumber?: string;
  @OptionalText(20) personalTaxCode?: string;
  @OptionalText(20) companyTaxCode?: string;
  @OptionalText(1000) note?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsArray() @IsString({ each: true }) tagIds!: string[];
  @IsOptional() @ValidateNested({ each: true }) @Type(() => CustomerAddressDto) addresses?: CustomerAddressDto[];
}

export class CustomerAddressesDto {
  @ValidateNested({ each: true }) @Type(() => CustomerAddressDto) addresses!: CustomerAddressDto[];
}

export class ActiveDto {
  @IsBoolean() isActive!: boolean;
}
