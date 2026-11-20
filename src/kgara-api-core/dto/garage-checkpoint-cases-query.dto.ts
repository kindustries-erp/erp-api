import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/** Số dòng tối đa mỗi trang (web tải 500 xe một lần cho drawer). */
export const CHECKPOINT_CASES_MAX_PAGE_SIZE = 500;

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

  @ApiPropertyOptional({
    default: 20,
    maximum: CHECKPOINT_CASES_MAX_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CHECKPOINT_CASES_MAX_PAGE_SIZE)
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

  @ApiPropertyOptional({
    enum: ['case', 'vehicle'],
    default: 'case',
    description:
      'case: mỗi dòng một lệnh (mặc định). vehicle: mỗi dòng một xe kèm các lệnh, total và phân trang theo xe.',
  })
  @IsOptional()
  @IsIn(['case', 'vehicle'])
  group_by?: 'case' | 'vehicle';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sort_by?: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sort_order?: 'ASC' | 'DESC';
}
