import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateBy,
  ValidateNested,
} from 'class-validator';

/** Object mà mọi giá trị đều thỏa `check` (class-validator không hỗ trợ sẵn cho object) */
function IsRecordOf(
  name: string,
  check: (value: unknown) => boolean,
): PropertyDecorator {
  return ValidateBy({
    name: 'isRecordOf',
    constraints: [name],
    validator: {
      validate: (value: unknown) =>
        value === undefined ||
        (typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value) &&
          Object.values(value).every(check)),
      defaultMessage: () => `$property phải là object với giá trị ${name}`,
    },
  });
}

export class TablePreferenceColumnsDto {
  @ApiPropertyOptional({
    description: 'Cột hiển thị (key = columnId)',
    example: { notes: false },
  })
  @IsOptional()
  @IsRecordOf('boolean', (v) => typeof v === 'boolean')
  visibility?: Record<string, boolean>;

  @ApiPropertyOptional({
    description: 'Thứ tự cột',
    example: ['poNumber', 'vendor', 'status'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  order?: string[];

  @ApiPropertyOptional({
    description: 'Độ rộng cột theo px (key = columnId)',
    example: { poNumber: 150 },
  })
  @IsOptional()
  @IsRecordOf('number', (v) => typeof v === 'number')
  sizing?: Record<string, number>;
}

export class TablePreferenceCustomViewDto {
  @IsString()
  @MaxLength(100)
  key: string;

  @IsString()
  @MaxLength(200)
  label: string;

  @IsString()
  @MaxLength(100)
  baseKey: string;

  @IsRecordOf('boolean', (v) => typeof v === 'boolean')
  visibility: Record<string, boolean>;

  @IsArray()
  @IsString({ each: true })
  order: string[];
}

export class TablePreferenceViewsDto {
  @ApiPropertyOptional({ type: [TablePreferenceCustomViewDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TablePreferenceCustomViewDto)
  customViews?: TablePreferenceCustomViewDto[];

  @ApiPropertyOptional({ description: 'Chế độ xem đang chọn' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  activeKey?: string;

  @ApiPropertyOptional({ description: 'Key của nhóm lọc đang chọn' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  filterKey?: string;
}

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
