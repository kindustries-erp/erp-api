import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export const GARAGE_CASHFLOW_EXPORT_MODES = [
  'by-period',
  'by-current-filter',
  'current-filter',
] as const;
export type GarageCashflowExportMode =
  (typeof GARAGE_CASHFLOW_EXPORT_MODES)[number];

const DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?)?$/;
const DATE_MESSAGE = 'Ngày phải có dạng YYYY-MM-DD';

const toSortArray = ({ value }: { value: unknown }) =>
  value === undefined || value === null || value === ''
    ? undefined
    : Array.isArray(value)
      ? value
      : [value];

export class GarageCashflowExportDto {
  @IsOptional()
  @IsIn(GARAGE_CASHFLOW_EXPORT_MODES)
  mode?: GarageCashflowExportMode;

  @IsOptional()
  @IsIn(['week', 'month', 'quarter', 'year', 'custom'])
  periodType?: 'week' | 'month' | 'quarter' | 'year' | 'custom';

  @IsOptional()
  @IsString()
  @MaxLength(50)
  week?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  period?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  quarter?: string;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  dateFrom?: string;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  dateTo?: string;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  startDate?: string;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  endDate?: string;

  @IsOptional()
  @IsIn(['RECEIPT', 'PAYMENT', 'ALL'])
  voucherType?: 'RECEIPT' | 'PAYMENT' | 'ALL';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  accountId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedColumns?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  search?: string;

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
  column_filters?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  column_search?: string;
}
