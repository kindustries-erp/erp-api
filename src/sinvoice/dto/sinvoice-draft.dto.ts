import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class SinvoiceDraftLineDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  itemName?: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @IsOptional()
  @IsNumber()
  taxRate?: number;
}

export class CreateSinvoiceDraftDto {
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
  totals?: {
    totalAmountWithTax?: number;
    totalTaxAmount?: number;
  };

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SinvoiceDraftLineDto)
  lines?: SinvoiceDraftLineDto[];
}

export class ListSinvoiceDraftQueryDto {
  @IsOptional()
  page?: number;

  @IsOptional()
  pageSize?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  filtersStr?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}

export class SaveSinvoiceConfigDto {
  @IsOptional()
  @IsString()
  supplierTaxCode?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  appKey?: string;

  @IsOptional()
  @IsString()
  apiUrl?: string;

  @IsOptional()
  @IsString()
  environment?: string;
}
