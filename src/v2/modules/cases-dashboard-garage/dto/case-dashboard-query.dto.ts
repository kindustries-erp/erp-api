import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import {
  CASE_DASHBOARD_CLASSES,
  CASE_DASHBOARD_STAGES,
} from './case-dashboard.types';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MESSAGE = 'Ngày phải có dạng YYYY-MM-DD.';

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

/** `GET /overview`: ngày gốc cho KPI kỳ và khoảng ngày cho phễu (đều tùy chọn). */
export class CaseDashboardOverviewQueryDto extends CaseDashboardRangeQueryDto {
  @ApiPropertyOptional({
    description:
      'Ngày gốc cho KPI tháng/tuần/ngày (YYYY-MM-DD), mặc định hôm nay',
  })
  @IsOptional()
  @Matches(DAY_PATTERN, { message: DAY_MESSAGE })
  date?: string;
}

/** `GET /`: danh sách xe (drill-down): khoảng ngày, giai đoạn/phân loại tùy chọn, phân trang theo xe. */
export class CaseDashboardListQueryDto extends CaseDashboardRangeQueryDto {
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
