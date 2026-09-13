import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryChangelogDto {
  @ApiPropertyOptional({
    description: 'Từ khóa tìm kiếm (mã phiên bản, tag, tiêu đề, nội dung)',
    example: 'Garage',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Số trang (1-indexed)',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Số lượng mục trên mỗi trang',
    default: 6,
    example: 6,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 6;
}

export interface ChangelogItemDto {
  type: 'feature' | 'enhancement' | 'fix';
  textVi: string;
  textEn: string;
}

export interface ChangelogReleaseDto {
  version: string;
  date: string;
  tag?: string;
  isLatest?: boolean;
  titleVi: string;
  titleEn: string;
  items: ChangelogItemDto[];
}

export interface PaginatedChangelogResponse {
  items: ChangelogReleaseDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
}
