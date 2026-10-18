import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from './pagination.dto';

/**
 * Tham số truy vấn bảng server-side (V1 và `V2StandardTable`).
 * `column_filters`, `column_search`, `column_operators`, `date_ranges` đã có trong `PaginationDto`.
 * Các trường JSON được parse ở tầng service bằng `parseFilterRecord`, nên sai định dạng thì bỏ qua.
 */
export class TableQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Ngày bắt đầu (YYYY-MM-DD), áp dụng cho createdAt',
  })
  @IsOptional()
  @IsString()
  date_from?: string;

  @ApiPropertyOptional({
    description: 'Ngày kết thúc (YYYY-MM-DD), áp dụng cho createdAt',
  })
  @IsOptional()
  @IsString()
  date_to?: string;
}
