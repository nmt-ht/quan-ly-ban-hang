import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { ProductType } from '@prisma/client';

class UnitConversionDto {
  @IsString() unitName!: string;
  @IsNumber() ratioToBaseUnit!: number;
  @IsNumber() price!: number;
}

export class CreateProductDto {
  @IsString() @MinLength(1) name!: string;

  @IsEnum(ProductType) type!: ProductType;

  @IsString() @MinLength(1) baseUnit!: string;

  @IsOptional() @IsString() crossRefCode?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() defaultWarehouseId?: string;

  @IsOptional() @IsNumber() @Min(0) minStock?: number;
  @IsOptional() @IsNumber() @Min(0) vatRate?: number;
  @IsOptional() @IsNumber() @Min(0) warrantyMonths?: number;
  @IsOptional() @IsString() origin?: string;

  @IsOptional() @IsNumber() @Min(0) retailPrice?: number;
  @IsOptional() @IsNumber() @Min(0) wholesalePrice?: number;
  @IsOptional() @IsNumber() @Min(0) dropshipPrice?: number;

  @IsOptional() @IsString() purchaseNote?: string;
  @IsOptional() @IsString() saleNote?: string;
  @IsOptional() @IsString() description?: string;

  @IsOptional() @IsBoolean() isSellable?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UnitConversionDto)
  unitConversions?: UnitConversionDto[];
}
