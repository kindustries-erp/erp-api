import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PartnerLedgerItemQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['RECEIVABLE', 'PAYABLE'] })
  @IsOptional()
  @IsIn(['RECEIVABLE', 'PAYABLE'])
  item_type?: 'RECEIVABLE' | 'PAYABLE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  business_partner_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accounting_account_id?: string;

  @ApiPropertyOptional({ enum: ['OPEN', 'PARTIAL', 'SETTLED', 'CANCELLED'] })
  @IsOptional()
  @IsIn(['OPEN', 'PARTIAL', 'SETTLED', 'CANCELLED'])
  status?: 'OPEN' | 'PARTIAL' | 'SETTLED' | 'CANCELLED';

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsString()
  due_from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsString()
  due_to?: string;

  @ApiPropertyOptional({ description: 'Lọc các khoản quá hạn' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  overdue?: boolean;
}
