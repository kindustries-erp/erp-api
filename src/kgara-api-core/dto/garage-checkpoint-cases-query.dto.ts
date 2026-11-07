import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sort_by?: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sort_order?: 'ASC' | 'DESC';
}
