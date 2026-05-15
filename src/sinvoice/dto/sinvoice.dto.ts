import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';

export class SinvoiceConfigDto {
  @IsString()
  @IsNotEmpty()
  supplierTaxCode: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional()
  appKey?: string;

  @IsString()
  @IsNotEmpty()
  apiUrl: string;
}

export class CreateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  templateCode: string;

  @IsString()
  @IsNotEmpty()
  invoiceSeries: string;

  @IsObject()
  @IsNotEmpty()
  invoiceData: any;
}

export class TaxPortalSyncQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['IN', 'OUT'])
  direction?: 'IN' | 'OUT';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  size?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
