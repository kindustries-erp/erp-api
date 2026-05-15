import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ViettelV2DraftLineDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  itemName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  unitPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  taxRate?: number;
}

export class CreateViettelV2DraftDto {
  @IsOptional()
  @IsString()
  documentNo?: string;

  @IsOptional()
  @IsString()
  buyerName?: string;

  @IsOptional()
  @IsString()
  buyerTaxCode?: string;

  @IsOptional()
  @IsString()
  buyerAddress?: string;

  @IsOptional()
  @IsString()
  buyerEmail?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ViettelV2DraftLineDto)
  lines?: ViettelV2DraftLineDto[];
}

export class SyncViettelV2InboundDto {
  @IsOptional()
  @IsString()
  supplierTaxCode?: string;

  @IsDateString()
  @IsNotEmpty()
  issueStartDate!: string;

  @IsDateString()
  @IsNotEmpty()
  issueEndDate!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pageNum?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  rowPerPage?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  inputSource?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  validatedStatus?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  invoiceStatus?: number;

  @IsOptional()
  @IsString()
  searchText?: string;
}
