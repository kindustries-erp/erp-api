import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { BaseQueryPurchaseOrderDto } from './base-query-purchase-order.dto';

/** Gợi ý giá trị của một cột, có lọc theo các cột khác của bảng. */
export class BaseQueryPurchaseOrderColumnOptionsDto extends BaseQueryPurchaseOrderDto {
  @ApiProperty({ description: 'Tên cột cần lấy giá trị gợi ý' })
  @IsString()
  @IsNotEmpty()
  column: string;

  @ApiPropertyOptional({ description: 'Từ khóa lọc danh sách gợi ý' })
  @IsOptional()
  @IsString()
  option_search?: string;
}

/** Ngày để xem trước số PO kế tiếp (#9: phải là ngày hợp lệ). */
export class BaseNextPurchaseOrderNoQueryDto {
  @ApiPropertyOptional({ example: '2026-11-04' })
  @IsOptional()
  @IsDateString()
  date?: string;
}
