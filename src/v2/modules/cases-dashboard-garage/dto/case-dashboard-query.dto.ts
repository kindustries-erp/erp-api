import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import {
  CASE_DASHBOARD_CLASSES,
  CASE_DASHBOARD_STAGES,
} from './case-dashboard.types';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MESSAGE = 'Ngày phải có dạng YYYY-MM-DD.';

/** Ngày gốc để tính KPI tháng/tuần/ngày (mặc định hôm nay). */
export class CaseDashboardPeriodQueryDto {
  @ApiPropertyOptional({
    description: 'Ngày gốc (YYYY-MM-DD), mặc định hôm nay',
  })
  @IsOptional()
  @Matches(DAY_PATTERN, { message: DAY_MESSAGE })
  date?: string;
}

/** Khoảng ngày cho phễu. Thiếu cả hai thì mặc định tháng hiện tại. */
export class CaseDashboardRangeQueryDto {
  @ApiPropertyOptional({ description: 'Từ ngày (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(DAY_PATTERN, { message: DAY_MESSAGE })
  date_from?: string;

  @ApiPropertyOptional({ description: 'Đến ngày (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(DAY_PATTERN, { message: DAY_MESSAGE })
  date_to?: string;
}

/** Drill-down danh sách lệnh: khoảng ngày, giai đoạn/phân loại tùy chọn, phân trang. */
export class CaseDashboardCasesQueryDto extends CaseDashboardRangeQueryDto {
  @ApiPropertyOptional({ enum: CASE_DASHBOARD_STAGES })
  @IsOptional()
  @IsIn([...CASE_DASHBOARD_STAGES])
  stage?: (typeof CASE_DASHBOARD_STAGES)[number];

  @ApiPropertyOptional({ enum: CASE_DASHBOARD_CLASSES })
  @IsOptional()
  @IsIn([...CASE_DASHBOARD_CLASSES])
  classification?: (typeof CASE_DASHBOARD_CLASSES)[number];

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
