import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export const GARAGE_EXPORT_MODES = ['by-period', 'by-current-filter'] as const;
export type GarageExportMode = (typeof GARAGE_EXPORT_MODES)[number];

/** `YYYY-MM-DD` hoặc ISO `YYYY-MM-DDTHH:mm:ss`. */
const DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?)?$/;
const DATE_MESSAGE = 'Ngày phải có dạng YYYY-MM-DD';

const toSortArray = ({ value }: { value: unknown }) =>
  value === undefined || value === null || value === ''
    ? undefined
    : Array.isArray(value)
      ? value
      : [value];

/**
 * Điều kiện xuất Excel công nợ khách hàng / nhà cung cấp.
 * - `by-period`: chỉ áp dụng kỳ (`from`/`to`).
 * - `by-current-filter`: áp dụng toàn bộ filter/sort của bảng đang xem.
 */
export class GarageDebtsExportDto {
  @IsOptional()
  @IsIn(GARAGE_EXPORT_MODES)
  mode?: GarageExportMode;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  from?: string;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  q?: string;

  @IsOptional()
  @Transform(toSortArray)
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  sorts?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  filtersStr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  column_filters?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  column_search?: string;
}

/** Điều kiện xuất báo cáo Garage theo kỳ (tab Tổng quan): chỉ có khoảng ngày. */
export class GarageDashboardExportDto {
  @IsOptional()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  from?: string;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  to?: string;
}

/** Điều kiện xuất Excel bảng kê phiếu dịch vụ (cases). */
export class GarageCasesExportDto {
  @IsOptional()
  @IsIn(GARAGE_EXPORT_MODES)
  mode?: GarageExportMode;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  date_from?: string;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  date_to?: string;

  @IsOptional()
  @IsIn(['completion_date', 'case_date'])
  date_type?: 'completion_date' | 'case_date';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  classification?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  q?: string;

  @IsOptional()
  @Transform(toSortArray)
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  sorts?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  filtersStr?: string;
}
