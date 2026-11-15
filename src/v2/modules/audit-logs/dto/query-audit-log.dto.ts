import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Query danh sách nhật ký. Giữ nguyên tên tham số của V1 (`AuditLogCoreQueryDto`)
 * để web đổi sang v2 mà không phải dịch tham số.
 */
export class QueryAuditLogDto {
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  module?: string;

  @ApiPropertyOptional({ description: 'Nhiều giá trị cách nhau bởi dấu phẩy' })
  @IsOptional()
  @IsString()
  actionType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Ví dụ `-createdAt` (giảm dần)' })
  @IsOptional()
  sorts?: string | string[];

  @ApiPropertyOptional({ description: 'JSON { cột: [giá trị] }' })
  @IsOptional()
  @IsString()
  column_filters?: string;

  @ApiPropertyOptional({ description: 'JSON { cột: từ khóa }' })
  @IsOptional()
  @IsString()
  column_search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date_from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date_to?: string;
}
