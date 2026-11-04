import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { TableQueryDto } from '@/common/dto/table-query.dto';

/** Đọc giá trị boolean từ query string. Chuỗi "false" phải ra false (sửa H1). */
const parseBooleanQuery = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  return ['true', '1'].includes(value.toLowerCase());
};

export class BaseQueryPurchaseOrderDto extends TableQueryDto {
  /** Ghi đè pageSize của PaginationDto để chặn trang vô hạn (#10). */
  @ApiPropertyOptional({ maximum: 200, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplier_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  exclude_status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  inventory_item_id?: string;

  @ApiPropertyOptional({
    description: 'Chỉ lấy đơn còn số lượng có thể nhập kho',
  })
  @IsOptional()
  @Transform(parseBooleanQuery)
  @IsBoolean()
  only_receivable?: boolean;
}
