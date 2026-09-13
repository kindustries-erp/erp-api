import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryPurchaseOrderItemsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Lọc theo ID nhà cung cấp (UUID)' })
  @IsOptional()
  @IsUUID()
  supplier_id?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID đơn mua hàng (UUID)' })
  @IsOptional()
  @IsUUID()
  purchase_order_id?: string;

  @ApiPropertyOptional({ description: 'Lọc từ ngày (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  date_from?: string;

  @ApiPropertyOptional({ description: 'Lọc đến ngày (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  date_to?: string;

  @ApiPropertyOptional({ description: 'Cột sắp xếp' })
  @IsOptional()
  @IsString()
  sort_by?: string;

  @ApiPropertyOptional({ description: 'Chiều sắp xếp (ASC/DESC)' })
  @IsOptional()
  @IsString()
  sort_order?: string;
}
