import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { IsBoundedRecord } from './table-preference-validators';
import { TABLE_PREFERENCE_LIMITS } from './table-preference-limits';

export class TablePreferenceColumnsDto {
  @ApiPropertyOptional({ example: { notes: false } })
  @IsOptional()
  @IsBoundedRecord((v) => typeof v === 'boolean', 'boolean')
  visibility?: Record<string, boolean>;

  @ApiPropertyOptional({ example: ['poNumber', 'vendor', 'status'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TABLE_PREFERENCE_LIMITS.orderMax)
  @IsString({ each: true })
  @MaxLength(TABLE_PREFERENCE_LIMITS.orderItemMax, { each: true })
  order?: string[];

  @ApiPropertyOptional({ example: { poNumber: 150 } })
  @IsOptional()
  @IsBoundedRecord((v) => typeof v === 'number', 'number')
  sizing?: Record<string, number>;
}

export class TablePreferenceCustomViewDto {
  @IsString()
  @MaxLength(TABLE_PREFERENCE_LIMITS.keyMax)
  key: string;

  @IsString()
  @MaxLength(TABLE_PREFERENCE_LIMITS.labelMax)
  label: string;

  @IsString()
  @MaxLength(TABLE_PREFERENCE_LIMITS.keyMax)
  baseKey: string;

  @IsBoundedRecord((v) => typeof v === 'boolean', 'boolean')
  visibility: Record<string, boolean>;

  @IsArray()
  @ArrayMaxSize(TABLE_PREFERENCE_LIMITS.orderMax)
  @IsString({ each: true })
  @MaxLength(TABLE_PREFERENCE_LIMITS.orderItemMax, { each: true })
  order: string[];
}

export class TablePreferenceViewsDto {
  @ApiPropertyOptional({ type: [TablePreferenceCustomViewDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TABLE_PREFERENCE_LIMITS.customViewsMax)
  @ValidateNested({ each: true })
  @Type(() => TablePreferenceCustomViewDto)
  customViews?: TablePreferenceCustomViewDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(TABLE_PREFERENCE_LIMITS.keyMax)
  activeKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(TABLE_PREFERENCE_LIMITS.keyMax)
  filterKey?: string;
}

/** Ghi đè từng phần: trường không gửi thì giữ nguyên trên server */
export class UpdateTablePreferenceDto {
  @ApiPropertyOptional({ type: TablePreferenceColumnsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TablePreferenceColumnsDto)
  columns?: TablePreferenceColumnsDto;

  @ApiPropertyOptional({ type: TablePreferenceViewsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TablePreferenceViewsDto)
  views?: TablePreferenceViewsDto;
}
