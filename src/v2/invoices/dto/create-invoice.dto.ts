import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateInvoiceDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  invoiceNo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNo?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  invoiceDate: string;

  @ApiProperty({ enum: ['IN', 'OUT'] })
  @IsNotEmpty()
  @IsIn(['IN', 'OUT'])
  direction: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sellerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sellerTaxCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  buyerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  buyerTaxCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceCategory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  preVatAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  vatRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  vatAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
