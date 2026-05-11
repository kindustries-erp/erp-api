import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export const AR_APPLICATION_TYPES = [
  'PAYMENT','ADVANCE_APPLIED','CREDIT_NOTE_APPLIED','REALLOCATION','WRITE_OFF','REFUND','SUSPENSE_CLEARING','CUSTOMER_VENDOR_OFFSET','COD_SETTLEMENT','GATEWAY_SETTLEMENT','FX_REALIZED',
] as const;

export class CreateArApplicationDto {
  @ApiProperty()
  @IsString()
  application_no!: string;

  @ApiProperty({ enum: AR_APPLICATION_TYPES })
  @IsIn(AR_APPLICATION_TYPES)
  application_type!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source_document_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  target_document_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payment_voucher_id?: string;

  @ApiProperty()
  @IsDateString()
  application_date!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ enum: ['DRAFT','POSTED','REVERSED','CANCELLED'], default: 'POSTED' })
  @IsOptional()
  @IsIn(['DRAFT','POSTED','REVERSED','CANCELLED'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
