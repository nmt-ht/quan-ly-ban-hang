import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsPositive, IsString, Matches, Min, ValidateNested } from 'class-validator';
import { MeasureMode, ProductType, UnitOperation } from '@prisma/client';
import { OptionalText, Text } from '../../../common/dto.js';

export class UnitConversionDto {
  @Text(30) unitName!: string;
  @IsOptional() @IsEnum(UnitOperation) operation?: UnitOperation;
  @IsOptional() @IsNumber() factor?: number;
  @IsNumber() @IsPositive() ratioToBaseUnit!: number;
  @IsNumber() @Min(0) price!: number;
  @IsOptional() @IsNumber() @Min(0) wholesalePrice?: number;
  @IsOptional() @IsNumber() @Min(0) dropshipPrice?: number;
}

export class ProductImageDto {
  @OptionalText(60) id?: string;
  // data: URL (resized by the frontend) until file uploads exist, or a storage URL.
  @IsString() @Matches(/^(data:image\/(png|jpeg|webp);base64,|https?:\/\/)/, { message: 'Ảnh phải là PNG/JPEG/WebP hoặc đường dẫn' }) url!: string;
  @Text(200) name!: string;
  @IsInt() @Min(0) width!: number;
  @IsInt() @Min(0) height!: number;
}

/** The whole product as the form saves it; PUT replaces every field, unit list and image list. */
export class CreateProductDto {
  @Text(200) name!: string;
  @IsEnum(ProductType) type!: ProductType;
  @Text(30) baseUnit!: string;
  @IsOptional() @IsEnum(MeasureMode) measureMode?: MeasureMode;

  @OptionalText(60) crossRefCode?: string;
  @OptionalText(60) categoryId?: string;
  @OptionalText(60) defaultWarehouseId?: string;

  @IsOptional() @IsNumber() @Min(0) minStock?: number;
  @IsOptional() @IsNumber() @Min(0) vatRate?: number;
  @IsOptional() @IsInt() @Min(0) warrantyMonths?: number;
  @OptionalText(100) origin?: string;

  @IsOptional() @IsNumber() @Min(0) retailPrice?: number;
  @IsOptional() @IsNumber() @Min(0) wholesalePrice?: number;
  @IsOptional() @IsNumber() @Min(0) dropshipPrice?: number;
  /** Giá bán tối thiểu theo ĐVT chính; 0 = không giới hạn. */
  @IsOptional() @IsNumber() @Min(0) minPrice?: number;

  @OptionalText(1000) purchaseNote?: string;
  @OptionalText(1000) saleNote?: string;
  @OptionalText(5000) description?: string;

  @IsOptional() @IsBoolean() isSellable?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;

  @IsOptional() @ValidateNested({ each: true }) @Type(() => UnitConversionDto) unitConversions?: UnitConversionDto[];
  @IsOptional() @ValidateNested({ each: true }) @Type(() => ProductImageDto) images?: ProductImageDto[];
}

export class ProductImportRowDto {
  /** Số dòng trong file Excel. */
  @IsInt() @Min(1) row!: number;
  /** Cập nhật mặt hàng này; trống = thêm mới (mã cấp khi lưu). */
  @OptionalText(60) id?: string;
  /** The row as the frontend parsed it; checked here row by row (CreateProductDto) so one bad row cannot fail the file. */
  @IsObject() data!: Record<string, unknown>;
}

/** Nhập hàng hoá từ Excel (Pha 1.9): dryRun = xem trước, nothing is saved. */
export class ProductImportDto {
  @IsOptional() @IsBoolean() dryRun?: boolean;
  @IsArray() @ArrayMaxSize(5000) @ValidateNested({ each: true }) @Type(() => ProductImportRowDto) rows!: ProductImportRowDto[];
}

export class ActiveDto {
  @IsBoolean() isActive!: boolean;
}

export class BomLineDto {
  @Text(60) componentId!: string;
  @IsNumber() @IsPositive() quantityPerUnit!: number;
}

export class BomReplacementDto {
  @Text(60) finishedProductId!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => BomLineDto) lines!: BomLineDto[];
}

/** Định mức: each listed finished product gets exactly these lines (others are untouched). */
export class BomImportDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => BomReplacementDto) replacements!: BomReplacementDto[];
}
