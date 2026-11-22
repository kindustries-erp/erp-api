import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Query danh sách chứng từ kho gộp nhiều loại (nhập, xuất, điều chỉnh) trong một bảng. */
export class QueryStockVoucherUnionDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @ApiPropertyOptional({ description: 'Tìm theo số phiếu, đối tác, ghi chú' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'DRAFT, POSTED hoặc CANCELLED' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Loại phiếu của nguồn đã khai báo, ví dụ ISSUE',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Từ ngày (YYYY-MM-DD, giờ Việt Nam)' })
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'dateFrom phải có dạng YYYY-MM-DD' })
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Đến ngày (YYYY-MM-DD, giờ Việt Nam)' })
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'dateTo phải có dạng YYYY-MM-DD' })
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Sắp xếp, ví dụ `-voucherDate,voucherNo` (dấu - là giảm dần)',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo cột, JSON dạng {"status":["POSTED"]}',
  })
  @IsOptional()
  @IsString()
  column_filters?: string;

  @ApiPropertyOptional({
    description: 'Danh sách cột cần tổng, CSV, ví dụ `totalAmount`',
  })
  @IsOptional()
  @IsString()
  summary_keys?: string;
}

/** Query gợi ý giá trị của một cột (`column-options`) cho bộ lọc tiêu đề bảng. */
export class QueryStockVoucherUnionOptionsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  column?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @ApiPropertyOptional({
    description: 'Bộ lọc của các cột khác, JSON dạng {"type":["ISSUE"]}',
  })
  @IsOptional()
  @IsString()
  filters?: string;
}
