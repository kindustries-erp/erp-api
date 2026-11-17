import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
export const STOCK_TABS = [
  'ALL',
  'IN_STOCK',
  'OUT_OF_STOCK',
  'NEGATIVE',
] as const;
export type StockTab = (typeof STOCK_TABS)[number];

class PagedQuery {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  pageSize?: number;
}

/** Query bảng số dư tồn theo mã hàng. Phạm vi ledger lấy từ cấu hình, không nhận từ query. */
export class QueryStockBalanceDto extends PagedQuery {
  @ApiPropertyOptional({ description: 'Tìm theo mã hoặc tên hàng' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: STOCK_TABS, default: 'ALL' })
  @IsOptional()
  @IsIn(STOCK_TABS)
  stockTab?: StockTab;

  @ApiPropertyOptional({ description: 'Ví dụ `-qtyOnHand,itemCode`' })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({
    description:
      'Bộ lọc của các cột, JSON dạng {"itemCode":["..."],"unit":["Cái"]}',
  })
  @IsOptional()
  @IsString()
  column_filters?: string;

  @ApiPropertyOptional({
    description:
      'Toán tử lọc số hoặc chuỗi, JSON dạng {"qtyOnHand":{"operator":"gt","value":"0"}}',
  })
  @IsOptional()
  @IsString()
  column_operators?: string;
}

/** Query thẻ kho của một mã hàng. */
export class QueryStockTransactionDto extends PagedQuery {
  @ApiPropertyOptional({ description: 'Mã hàng cần xem thẻ kho' })
  @IsString()
  itemCode: string;

  @ApiPropertyOptional({ description: 'Từ ngày (YYYY-MM-DD, giờ Việt Nam)' })
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'dateFrom phải có dạng YYYY-MM-DD' })
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Đến ngày (YYYY-MM-DD, giờ Việt Nam)' })
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'dateTo phải có dạng YYYY-MM-DD' })
  dateTo?: string;

  @ApiPropertyOptional({
    enum: ['WEIGHTED_AVG', 'FIFO'],
    default: 'WEIGHTED_AVG',
    description: 'Phương pháp giá vốn: WEIGHTED_AVG hoặc FIFO',
  })
  @IsOptional()
  @IsIn(['WEIGHTED_AVG', 'FIFO'])
  costingMethod?: 'WEIGHTED_AVG' | 'FIFO';
}

/** Query gợi ý giá trị cột (`column-options`) cho bộ lọc bảng tồn kho. */
export class QueryStockBalanceColumnOptionsDto {
  @ApiPropertyOptional({
    description: 'Tên cột cần lấy gợi ý (ví dụ unit, itemCode)',
  })
  @IsOptional()
  @IsString()
  column?: string;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm trong giá trị' })
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
    description: 'Bộ lọc của các cột khác, JSON dạng {"unit":["Cái"]}',
  })
  @IsOptional()
  @IsString()
  filters?: string;
}
