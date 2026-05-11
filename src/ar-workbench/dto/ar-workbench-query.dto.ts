import { IsIn, IsInt, IsOptional, IsString, Min, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ArWorkbenchQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;

  @ApiPropertyOptional({ default: '-created_at' })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  business_partner_id?: string;

  @ApiPropertyOptional({ enum: ['INVOICE','IMMEDIATE_SALE','ADVANCE','CREDIT_NOTE','SALES_RETURN','REFUND','WRITE_OFF','SUSPENSE','FX_REVALUATION','RETENTION','COD','GATEWAY','INTERCOMPANY','CONTRACT_MILESTONE','ADJUSTMENT'] })
  @IsOptional()
  @IsString()
  document_type?: string;

  @ApiPropertyOptional({ enum: ['DRAFT','POSTED','PARTIAL','SETTLED','DISPUTED','REVERSED','CANCELLED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: ['NORMAL','OVERDUE','BAD_DEBT_RISK','LEGAL'] })
  @IsOptional()
  @IsString()
  risk_status?: string;

  @ApiPropertyOptional({ description: 'Only open/partial AR documents' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  open_only?: boolean;

  @ApiPropertyOptional({ description: 'Only overdue open/partial documents' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  overdue?: boolean;
}
