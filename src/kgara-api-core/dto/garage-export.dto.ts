import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import { COMPLETED_CASES_EXPORT_COLUMN_KEYS } from '../helpers/kgara-excel-style.helper';

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

/**
 * Loại báo cáo Garage theo kỳ:
 * - `all`: toàn bộ file (mặc định, giữ tương thích ngược).
 * - `business`: tình hình hoạt động kinh doanh (P&L kèm chart).
 * - `cashflow-debts`: thu chi & công nợ.
 * - `overdue`: nợ quá hạn cần chú ý.
 */
export const GARAGE_PERIOD_REPORT_TYPES = [
  'all',
  'business',
  'cashflow-debts',
  'overdue',
] as const;
export type GaragePeriodReportType =
  (typeof GARAGE_PERIOD_REPORT_TYPES)[number];

/**
 * Mục chọn trực tiếp trên màn xuất (multi-select): báo cáo tổng quan, lợi nhuận, công nợ phải
 * thu / phải trả, nợ quá hạn, thu chi. Khi có mục chọn thì ưu tiên hơn `reportType`.
 */
export const GARAGE_PERIOD_REPORT_SECTION_KEYS = [
  'overview',
  'pnl',
  'receivables',
  'payables',
  'overdue',
  'cashflow',
] as const;
export type GaragePeriodReportSectionKey =
  (typeof GARAGE_PERIOD_REPORT_SECTION_KEYS)[number];

/** Điều kiện xuất báo cáo Garage theo kỳ (tab Tổng quan): khoảng ngày + loại báo cáo. */
export class GarageDashboardExportDto {
  @IsOptional()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  from?: string;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  to?: string;

  @IsOptional()
  @IsIn(GARAGE_PERIOD_REPORT_TYPES)
  reportType?: GaragePeriodReportType;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(GARAGE_PERIOD_REPORT_SECTION_KEYS, { each: true })
  reportSections?: GaragePeriodReportSectionKey[];
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

  /** Key cột Sheet 1 cần xuất; bỏ trống = toàn bộ cột mặc định. */
  @IsOptional()
  @Transform(toSortArray)
  @IsArray()
  @IsIn(COMPLETED_CASES_EXPORT_COLUMN_KEYS, { each: true })
  selectedColumns?: string[];
}
