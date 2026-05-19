import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateArSalesInvoiceLineDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  line_no?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  item_code?: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty({ default: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @ApiProperty({ default: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unit_price!: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tax_rate?: number;

  @ApiPropertyOptional({
    description: 'Revenue account id. Defaults to account code 511.',
  })
  @IsOptional()
  @IsString()
  revenue_account_id?: string;

  @ApiPropertyOptional({
    description:
      'VAT output account id. Defaults to account code 3331 when tax_rate > 0.',
  })
  @IsOptional()
  @IsString()
  tax_account_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateArSalesInvoiceDto {
  @ApiProperty()
  @IsString()
  document_no!: string;

  @ApiProperty()
  @IsString()
  business_partner_id!: string;

  @ApiPropertyOptional({
    description: 'Linked journal entry id after posting/reconciliation.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  journal_entry_id?: number;

  @ApiProperty()
  @IsDateString()
  document_date!: string;

  @ApiProperty()
  @IsDateString()
  posting_date!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  due_date?: string;

  @ApiPropertyOptional({ default: 'VND' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  exchange_rate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference_no?: string;

  @ApiPropertyOptional({ default: '' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiProperty({ type: [CreateArSalesInvoiceLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateArSalesInvoiceLineDto)
  lines!: CreateArSalesInvoiceLineDto[];
}
