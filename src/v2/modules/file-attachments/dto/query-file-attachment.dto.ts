import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Query của trang quản lý toàn hệ thống (`GET api/v2/file-attachments`). */
export class QueryFileAttachmentDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 20;

  @ApiPropertyOptional({
    description: 'Tìm theo tên file (nhiều từ khóa cách nhau bằng `;`)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ description: 'Sắp xếp `a,-b` (dấu - là giảm dần)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sort?: string;

  @ApiPropertyOptional({
    enum: ['only'],
    description: '`only`: chỉ file đã xóa mềm. Bỏ trống: chỉ file chưa xóa.',
  })
  @IsOptional()
  @IsIn(['only'])
  deleted?: 'only';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  ownerType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  category?: string;

  @ApiPropertyOptional({ enum: ['V2', 'LEGACY'] })
  @IsOptional()
  @IsIn(['V2', 'LEGACY'])
  origin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @Matches(DATE_PATTERN)
  date_from?: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @Matches(DATE_PATTERN)
  date_to?: string;

  @ApiPropertyOptional({ description: 'JSON: { cột: [giá trị] }' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  column_filters?: string;

  @ApiPropertyOptional({ description: 'JSON: { cột: từ khóa }' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  column_search?: string;

  @ApiPropertyOptional({
    description: 'JSON: { cột: { operator, value, valueTo } }',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  column_operators?: string;

  @ApiPropertyOptional({ description: 'JSON: { cột: { from, to } }' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  date_ranges?: string;
}
