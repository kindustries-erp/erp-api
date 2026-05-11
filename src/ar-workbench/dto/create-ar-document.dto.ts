import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export const AR_DOCUMENT_TYPES = [
  'INVOICE','IMMEDIATE_SALE','ADVANCE','CREDIT_NOTE','SALES_RETURN','REFUND','WRITE_OFF','SUSPENSE','FX_REVALUATION','RETENTION','COD','GATEWAY','INTERCOMPANY','CONTRACT_MILESTONE','ADJUSTMENT',
] as const;

export const AR_DOCUMENT_STATUSES = ['DRAFT','POSTED','PARTIAL','SETTLED','DISPUTED','REVERSED','CANCELLED'] as const;

export class CreateArDocumentDto {
  @ApiProperty()
  @IsString()
  document_no!: string;

  @ApiProperty({ enum: AR_DOCUMENT_TYPES })
  @IsIn(AR_DOCUMENT_TYPES)
  document_type!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  business_partner_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accounting_account_id?: string;

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

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  total_amount!: number;

  @ApiPropertyOptional({ enum: AR_DOCUMENT_STATUSES, default: 'DRAFT' })
  @IsOptional()
  @IsIn(AR_DOCUMENT_STATUSES)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference_no?: string;

  @ApiPropertyOptional({ default: '' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['NORMAL','OVERDUE','BAD_DEBT_RISK','LEGAL'] })
  @IsOptional()
  @IsString()
  risk_status?: string;

  @ApiPropertyOptional({ enum: ['NONE','DISPUTED','RESOLVED'] })
  @IsOptional()
  @IsString()
  dispute_status?: string;

  @ApiPropertyOptional({ enum: ['NOT_STARTED','REMINDER_SENT','PROMISED','ESCALATED','LEGAL'] })
  @IsOptional()
  @IsString()
  collection_status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  promise_to_pay_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
