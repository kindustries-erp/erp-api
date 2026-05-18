import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class JournalEntryQueryDto {
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

  @ApiPropertyOptional({ enum: ['draft', 'posted', 'reversed'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'UUID of accounting period' })
  @IsOptional()
  @IsString()
  period_id?: string;

  @ApiPropertyOptional({ description: 'UUID of account (filter by line)' })
  @IsOptional()
  @IsString()
  account_id?: string;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Từ ngày (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  date_from?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Đến ngày (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  date_to?: string;
}
