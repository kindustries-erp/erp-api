import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  GARAGE_EXPORT_MODES,
  type GarageExportMode,
} from './garage-export.dto';

const DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?)?$/;
const DATE_MESSAGE = 'Ngày phải có dạng YYYY-MM-DD';

const toSortArray = ({ value }: { value: unknown }) =>
  value === undefined || value === null || value === ''
    ? undefined
    : Array.isArray(value)
      ? value
      : [value];

export class GarageOpexExportDto {
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
  @IsNumber()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  year?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  month?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cost_group?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category_key?: string;

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
