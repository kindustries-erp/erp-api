import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/** Query của GET /greenway/dashboard/checkpoint-cases (tên snake_case giữ theo frontend). */
export class GarageCheckpointCasesQueryDto {
  @ApiProperty({ description: 'Ngày bắt đầu (YYYY-MM-DD)' })
  @IsDateString()
  date_from: string;

  @ApiProperty({ description: 'Ngày kết thúc (YYYY-MM-DD)' })
  @IsDateString()
  date_to: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['all', 'remaining', 'paid', 'unpaid'] })
  @IsOptional()
  @IsIn(['all', 'remaining', 'paid', 'unpaid'])
  payment_status?: 'all' | 'remaining' | 'paid' | 'unpaid';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classification?: string;

  @ApiPropertyOptional({
    enum: ['all', 'quotation', 'in_progress', 'completed', 'cancelled'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_funnel?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sort_by?: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sort_order?: 'ASC' | 'DESC';
}
